import type { Database } from 'bun:sqlite';
import type { AccountRole, ModerationAction, ModerationCase, ModerationResult } from '@supadub/protocol';
import { ACCOUNT_SELECT, allowedSessionAccount, type UserRecord } from './accounts';

export type ModerationExecution = {
  status: number;
  result: ModerationResult;
  repeated?: boolean;
  effect?: { action: ModerationAction['action']; targetId: string; messageId?: string };
};
export type ModerationTask = {
  sessionHash: string;
  action: ModerationAction;
  messageTargetId?: string;
  actorGuestId?: string;
};
const ranks: Record<AccountRole | 'guest', number> = { guest: 0, player: 0, moderator: 1, admin: 2 };
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9:_.-]{1,128}$/.test(value);

export class ModerationStore {
  constructor(private readonly db: Database) {}

  cases(targetId: string, now = Date.now()): ModerationCase[] {
    const bans = this.db
      .query<ModerationCase, [string, number]>(
        "SELECT id,'ban' AS kind,target_id AS targetId,actor_id AS actorId,reason,created_at AS createdAt,expires_at AS expiresAt FROM bans WHERE target_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 100",
      )
      .all(targetId, now);
    const mutes = this.db
      .query<ModerationCase, [string, number]>(
        "SELECT id,'mute' AS kind,user_id AS targetId,actor_id AS actorId,reason,created_at AS createdAt,expires_at AS expiresAt FROM chat_mutes WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 100",
      )
      .all(targetId, now);
    return [...bans, ...mutes].sort((a, b) => b.createdAt - a.createdAt);
  }

  apply(task: ModerationTask, now = Date.now()): ModerationExecution {
    const action = task.action;
    const failure = (status: number, code: string, message: string): ModerationExecution => ({
      status,
      result: {
        requestId: typeof action.requestId === 'string' ? action.requestId.slice(0, 128) : 'invalid',
        ok: false,
        code,
        message,
      },
    });
    if (
      !validId(action.requestId) ||
      !validId(action.targetId) ||
      !['kick', 'ban', 'unban', 'mute', 'unmute', 'delete-message', 'set-role'].includes(action.action) ||
      (action.caseId !== undefined && !validId(action.caseId))
    )
      return failure(400, 'invalid_action', 'Use a valid moderation action.');
    return this.db
      .transaction((): ModerationExecution => {
        const actor = allowedSessionAccount(this.db, task.sessionHash, task.actorGuestId, now);
        if (!actor) return failure(401, 'session_expired', 'Sign in again to continue.');
        if (actor.role === 'player') return failure(403, 'permission_denied', 'Staff access is required.');
        const fingerprint = new Bun.CryptoHasher('sha256')
          .update(
            JSON.stringify({
              action: action.action,
              targetId: action.targetId,
              caseId: action.caseId ?? null,
              durationSeconds: action.durationSeconds ?? null,
              reason: action.reason ?? null,
              role: action.role ?? null,
            }),
          )
          .digest('hex');
        const prior = this.db
          .query<{ fingerprint: string; result: string; status: number }, [string, string]>(
            'SELECT fingerprint,result,status FROM moderation_requests WHERE actor_id = ? AND request_id = ?',
          )
          .get(actor.id, action.requestId);
        if (prior)
          return prior.fingerprint === fingerprint
            ? { status: prior.status, result: JSON.parse(prior.result) as ModerationResult, repeated: true }
            : failure(409, 'request_conflict', 'This request ID already has a different action.');
        const targetId = action.action === 'delete-message' ? task.messageTargetId : action.targetId;
        if (!targetId || !validId(targetId))
          return failure(404, 'target_missing', 'This message is no longer available.');
        const user = this.db.query<UserRecord, [string]>(`${ACCOUNT_SELECT} WHERE u.id = ?`).get(targetId);
        const guest = user
          ? null
          : this.db
              .query<{ id: string; address_hash: string }, [string]>(
                'SELECT id,address_hash FROM guests WHERE id = ?',
              )
              .get(targetId);
        if (!user && !guest) return failure(404, 'target_missing', 'This player does not exist.');
        const targetRole = user?.role ?? 'guest';
        if (targetId === actor.id || targetId === task.actorGuestId || ranks[targetRole] >= ranks[actor.role])
          return failure(403, 'protected_target', 'Choose a player with a lower role.');
        const reason = typeof action.reason === 'string' ? action.reason.normalize('NFC').trim() : '';
        if (reason.length > 200 || /[\u0000-\u001f\u007f-\u009f]/.test(reason))
          return failure(400, 'invalid_reason', 'Use a reason with 1–200 characters.');
        let caseId: string | undefined;
        let expiresAt: number | null | undefined;
        if (action.action === 'ban' || action.action === 'mute') {
          if (!reason) return failure(400, 'invalid_reason', 'Enter a reason for this restriction.');
          if (action.action === 'mute' && !user)
            return failure(400, 'invalid_target', 'Only signed-in accounts can send chat.');
          const duration = action.durationSeconds;
          const permanent = action.action === 'ban' && duration === null;
          if (permanent && actor.role !== 'admin')
            return failure(403, 'duration_denied', 'Only admins can issue permanent bans.');
          const maximum =
            actor.role === 'moderator' ? 86400 : action.action === 'ban' ? 365 * 86400 : 30 * 86400;
          if (
            !permanent &&
            (typeof duration !== 'number' ||
              !Number.isSafeInteger(duration) ||
              duration < 60 ||
              duration > maximum)
          )
            return failure(400, 'invalid_duration', `Use a duration from 60 to ${maximum} seconds.`);
          caseId = crypto.randomUUID();
          expiresAt = permanent ? null : now + duration! * 1000;
          if (action.action === 'ban') {
            this.db
              .query(
                'INSERT INTO bans(id,target_id,address_hash,reason,actor_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
              )
              .run(caseId, targetId, guest?.address_hash ?? null, reason, actor.id, now, expiresAt);
            this.db.query('DELETE FROM sessions WHERE user_id = ?').run(targetId);
          } else
            this.db
              .query(
                'INSERT INTO chat_mutes(id,user_id,actor_id,reason,created_at,expires_at) VALUES (?,?,?,?,?,?)',
              )
              .run(caseId, targetId, actor.id, reason, now, expiresAt);
        } else if (action.action === 'unban' || action.action === 'unmute') {
          const kind = action.action === 'unban' ? 'ban' : 'mute';
          const active = this.cases(targetId, now).filter(
            (entry) => entry.kind === kind && (!action.caseId || entry.id === action.caseId),
          );
          const permitted = active.filter((entry) => actor.role === 'admin' || entry.actorId === actor.id);
          if (!permitted.length)
            return failure(
              active.length ? 403 : 404,
              active.length ? 'case_denied' : 'case_missing',
              active.length
                ? 'Moderators can revoke only their own cases.'
                : 'This restriction is no longer active.',
            );
          const table = kind === 'ban' ? 'bans' : 'chat_mutes';
          for (const entry of permitted)
            this.db.query(`UPDATE ${table} SET revoked_at = ? WHERE id = ?`).run(now, entry.id);
          caseId = permitted[0]!.id;
        } else if (action.action === 'set-role') {
          if (actor.role !== 'admin' || !user || (action.role !== 'player' && action.role !== 'moderator'))
            return failure(403, 'role_denied', 'Only admins can appoint or remove moderators.');
          this.db
            .query(
              'UPDATE account_roles SET role = ?,revision = revision + 1,updated_at = ? WHERE user_id = ?',
            )
            .run(action.role, now, targetId);
          this.db.query("UPDATE users SET role = 'player' WHERE id = ?").run(targetId);
        } else if (action.action === 'kick' && !reason)
          return failure(400, 'invalid_reason', 'Enter a reason for this kick.');
        const result: ModerationResult = {
          requestId: action.requestId,
          ok: true,
          code: 'applied',
          message:
            action.action === 'set-role' ? 'The account role changed.' : 'The moderation action completed.',
          ...(caseId ? { caseId } : {}),
          ...(expiresAt === undefined ? {} : { expiresAt }),
        };
        this.db
          .query('INSERT INTO audit(id,actor_id,action,target_id,detail,created_at) VALUES (?,?,?,?,?,?)')
          .run(
            crypto.randomUUID(),
            actor.id,
            action.action,
            targetId,
            JSON.stringify({
              requestId: action.requestId,
              reason,
              actorRole: actor.role,
              targetRole,
              durationSeconds: action.durationSeconds ?? null,
              caseId: caseId ?? null,
              role: action.role ?? null,
              messageId: action.action === 'delete-message' ? action.targetId : null,
            }),
            now,
          );
        this.db
          .query(
            'INSERT INTO moderation_requests(actor_id,request_id,fingerprint,result,status,created_at) VALUES (?,?,?,?,?,?)',
          )
          .run(actor.id, action.requestId, fingerprint, JSON.stringify(result), 200, now);
        return {
          status: 200,
          result,
          effect: {
            action: action.action,
            targetId,
            ...(action.action === 'delete-message' ? { messageId: action.targetId } : {}),
          },
        };
      })
      .immediate();
  }

  prune(now = Date.now()): void {
    this.db.query('DELETE FROM moderation_requests WHERE created_at < ?').run(now - 365 * 86400000);
  }
}
