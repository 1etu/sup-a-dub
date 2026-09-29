import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initializeDatabase } from './schema';
import { ProgressionStore } from './progression';
import { ProfileStore } from './profiles';
import { RankingStore } from './rankings';
import { ModerationStore } from './moderation';
import { ControlPreferencesStore } from './control-preferences';
import { ACCOUNT_SELECT, sessionAccount, type UserRecord } from './accounts';
export { profile, type UserRecord } from './accounts';
import type {
  LeaderboardEntry,
  PracticeBest,
  PracticeLeaderboardEntry,
  PracticeResult,
  UserProfile,
} from '@supadub/protocol';

export type Identity = {
  id: string;
  userId: string | null;
  guestId: string;
  addressHash: string;
  user: UserRecord | null;
};

export type BanRecord = {
  id: string;
  target_id: string;
  address_hash: string | null;
  reason: string;
  created_at: number;
  expires_at: number | null;
  revoked_at: number | null;
};

export type AuditRecord = {
  id: string;
  actor_id: string;
  action: string;
  target_id: string;
  detail: string;
  created_at: number;
};

export function tokenHash(token: string): string {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

export class Store {
  readonly db: Database;
  readonly addressSalt: string;
  readonly progression: ProgressionStore;
  readonly profiles: ProfileStore;
  readonly rankings: RankingStore;
  readonly moderation: ModerationStore;
  readonly controls: ControlPreferencesStore;
  readonly path: string;

  constructor(path = 'data/supadub.sqlite') {
    this.path = path;
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true, strict: true });
    try {
      initializeDatabase(this.db);
      this.progression = new ProgressionStore(this.db);
      this.profiles = new ProfileStore(this.db);
      this.rankings = new RankingStore(this.db);
      this.moderation = new ModerationStore(this.db);
      this.controls = new ControlPreferencesStore(this.db);
      this.progression.reconcileCatalog();
      const salt = this.db
        .query<{ value: string }, []>("SELECT value FROM metadata WHERE key = 'address_salt'")
        .get();
      this.addressSalt = salt?.value ?? crypto.randomUUID();
      if (!salt)
        this.db.query("INSERT INTO metadata (key, value) VALUES ('address_salt', ?)").run(this.addressSalt);
      this.prune();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  addressHash(address: string): string {
    return tokenHash(`${this.addressSalt}:${address}`);
  }

  userById(id: string): UserRecord | null {
    return this.db.query<UserRecord, [string]>(`${ACCOUNT_SELECT} WHERE u.id = ?`).get(id);
  }

  userByUsername(username: string): UserRecord | null {
    return this.db
      .query<UserRecord, [string]>(`${ACCOUNT_SELECT} WHERE u.username = ? COLLATE NOCASE`)
      .get(username);
  }

  createUser(
    username: string,
    name: string,
    passwordHash: string,
    role: UserRecord['role'] = 'player',
  ): UserRecord {
    const id = crypto.randomUUID();
    this.db
      .transaction(() => {
        this.db
          .query(
            'INSERT INTO users (id, username, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(
            id,
            username.toLowerCase(),
            name,
            passwordHash,
            role === 'admin' ? 'admin' : 'player',
            Date.now(),
          );
        this.db
          .query('INSERT INTO account_roles(user_id,role,updated_at) VALUES (?,?,?)')
          .run(id, role, Date.now());
        this.db.query('INSERT INTO account_profiles(user_id,updated_at) VALUES (?,?)').run(id, Date.now());
        this.progression.ensureInventory(id);
        this.controls.ensure(id);
      })
      .immediate();
    return this.userById(id)!;
  }

  makeGuest(addressHash: string): { id: string; token: string } {
    const id = `guest:${crypto.randomUUID()}`;
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const now = Date.now();
    this.db
      .query(
        'INSERT INTO guests (id, token_hash, address_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, tokenHash(token), addressHash, now, now);
    return { id, token };
  }

  guest(token: string): { id: string; address_hash: string } | null {
    return this.db
      .query<{ id: string; address_hash: string }, [string]>(
        'SELECT id, address_hash FROM guests WHERE token_hash = ?',
      )
      .get(tokenHash(token));
  }

  renameGuest(id: string, name: string): void {
    this.db.query('UPDATE guests SET name = ?, last_seen = ? WHERE id = ?').run(name, Date.now(), id);
  }

  makeSession(userId: string): string {
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const now = Date.now();
    this.db
      .query('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(tokenHash(token), userId, now + 30 * 86400000, now);
    return token;
  }

  sessionUser(token: string | undefined): UserRecord | null {
    if (!token) return null;
    return sessionAccount(this.db, tokenHash(token));
  }

  revokeSession(token: string | undefined): void {
    if (token) this.db.query('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  }

  activeBan(
    identity: Pick<Identity, 'id' | 'guestId' | 'addressHash'> & { userId?: string | null },
  ): BanRecord | null {
    return this.db
      .query<BanRecord, [string, string, string, number]>(
        `SELECT * FROM bans WHERE (target_id = ? OR target_id = ? OR address_hash = ?)
       AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1`,
      )
      .get(identity.id, identity.guestId, identity.userId ? '' : identity.addressHash, Date.now());
  }

  banTarget(
    actorId: string,
    targetId: string,
    addressHash: string | null,
    reason: string,
    durationHours?: number,
  ): BanRecord {
    const now = Date.now();
    const id = crypto.randomUUID();
    const expiresAt = durationHours ? now + durationHours * 3600000 : null;
    this.db.transaction(() => {
      this.db
        .query(
          'INSERT INTO bans (id, target_id, address_hash, reason, actor_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(id, targetId, addressHash, reason, actorId, now, expiresAt);
      this.audit(actorId, 'ban', targetId, reason);
      this.db.query('DELETE FROM sessions WHERE user_id = ?').run(targetId);
    })();
    return this.db.query<BanRecord, [string]>('SELECT * FROM bans WHERE id = ?').get(id)!;
  }

  unbanTarget(actorId: string, targetId: string): void {
    this.db.transaction(() => {
      this.db
        .query('UPDATE bans SET revoked_at = ? WHERE target_id = ? AND revoked_at IS NULL')
        .run(Date.now(), targetId);
      this.audit(actorId, 'unban', targetId, 'Access restored');
    })();
  }

  activeBans(): BanRecord[] {
    return this.db
      .query<BanRecord, [number]>(
        'SELECT * FROM bans WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 500',
      )
      .all(Date.now());
  }

  listUsers(): UserRecord[] {
    return this.db.query<UserRecord, []>(`${ACCOUNT_SELECT} ORDER BY u.created_at DESC LIMIT 500`).all();
  }

  guestById(id: string): { id: string; name: string; address_hash: string; created_at: number } | null {
    return this.db
      .query<{ id: string; name: string; address_hash: string; created_at: number }, [string]>(
        'SELECT id, name, address_hash, created_at FROM guests WHERE id = ?',
      )
      .get(id);
  }

  saveStats(userId: string, bestScore: number, collected: number): void {
    this.db
      .query('UPDATE users SET best_score = MAX(best_score, ?), total_ducks = total_ducks + ? WHERE id = ?')
      .run(Math.floor(bestScore), Math.max(0, Math.floor(collected)), userId);
  }

  savePractice(userId: string, result: PracticeResult): void {
    this.db
      .query(
        `INSERT INTO practice_bests (user_id, level_id, rules_version, final_time_ms, raw_time_ms, longest_chain, saved_ducks, updated_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, level_id, rules_version) DO UPDATE SET
      final_time_ms = excluded.final_time_ms, raw_time_ms = excluded.raw_time_ms,
      longest_chain = excluded.longest_chain, saved_ducks = excluded.saved_ducks, updated_at = excluded.updated_at
      WHERE excluded.final_time_ms < practice_bests.final_time_ms OR (excluded.final_time_ms = practice_bests.final_time_ms AND excluded.longest_chain > practice_bests.longest_chain)`,
      )
      .run(
        userId,
        result.levelId,
        result.finalTimeMs,
        result.rawTimeMs,
        result.longestChain,
        result.savedDucks,
        Date.now(),
      );
  }

  practiceBest(userId: string): PracticeBest | null {
    return this.db
      .query<PracticeBest, [string]>(
        "SELECT final_time_ms AS finalTimeMs, raw_time_ms AS rawTimeMs, longest_chain AS longestChain, saved_ducks AS savedDucks FROM practice_bests WHERE user_id = ? AND level_id = 'fun-01' AND rules_version = 1",
      )
      .get(userId);
  }

  highScores(): LeaderboardEntry[] {
    return this.db
      .query<{ id: string; name: string; score: number }, [number]>(
        `SELECT id, name, best_score AS score FROM users WHERE best_score > 0
       AND NOT EXISTS (SELECT 1 FROM bans WHERE target_id = users.id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?))
       ORDER BY best_score DESC, name ASC LIMIT 20`,
      )
      .all(Date.now())
      .map((row) => ({ ...row, bot: false }));
  }

  practiceLeaderboard(): PracticeLeaderboardEntry[] {
    return this.db
      .query<PracticeLeaderboardEntry, [number]>(
        `SELECT users.id, users.name, final_time_ms AS finalTimeMs, longest_chain AS longestChain
       FROM practice_bests JOIN users ON users.id = practice_bests.user_id
       WHERE level_id = 'fun-01' AND rules_version = 1 AND saved_ducks = 12
       AND NOT EXISTS (SELECT 1 FROM bans WHERE target_id = users.id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?))
       ORDER BY final_time_ms ASC, longest_chain DESC, users.name ASC LIMIT 20`,
      )
      .all(Date.now());
  }

  massHighScores(): LeaderboardEntry[] {
    return this.db
      .query<{ id: string; name: string; score: number }, [number]>(
        `SELECT id,name,best_mass AS score FROM users WHERE best_mass > 0 AND NOT EXISTS (SELECT 1 FROM bans WHERE target_id = users.id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)) ORDER BY best_mass DESC,name LIMIT 20`,
      )
      .all(Date.now())
      .map((entry) => ({ ...entry, bot: false }));
  }

  activeMute(userId: string): { reason: string; expiresAt: number } | null {
    return this.db
      .query<{ reason: string; expiresAt: number }, [string, number]>(
        'SELECT reason,expires_at AS expiresAt FROM chat_mutes WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY expires_at DESC LIMIT 1',
      )
      .get(userId, Date.now());
  }

  mute(actorId: string, userId: string, reason: string, durationMinutes: number): void {
    this.db
      .transaction(() => {
        this.db
          .query(
            'INSERT INTO chat_mutes(id,user_id,actor_id,reason,created_at,expires_at) VALUES (?,?,?,?,?,?)',
          )
          .run(
            crypto.randomUUID(),
            userId,
            actorId,
            reason,
            Date.now(),
            Date.now() + durationMinutes * 60000,
          );
        this.audit(actorId, 'mute', userId, reason);
      })
      .immediate();
  }

  unmute(actorId: string, userId: string): void {
    this.db
      .transaction(() => {
        this.db
          .query('UPDATE chat_mutes SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
          .run(Date.now(), userId);
        this.audit(actorId, 'unmute', userId, 'Chat restored');
      })
      .immediate();
  }

  audit(actorId: string, action: string, targetId: string, detail: string): void {
    this.db
      .query(
        'INSERT INTO audit (id, actor_id, action, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(crypto.randomUUID(), actorId, action, targetId, detail, Date.now());
  }

  audits(): AuditRecord[] {
    return this.db.query<AuditRecord, []>('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100').all();
  }

  prune(): void {
    this.db.query('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    this.db
      .query('DELETE FROM guests WHERE last_seen < ? AND id NOT IN (SELECT target_id FROM bans)')
      .run(Date.now() - 365 * 86400000);
  }

  setAdministrator(userId: string, passwordHash: string): void {
    this.db
      .transaction(() => {
        this.db
          .query("UPDATE users SET role = 'admin',password_hash = ? WHERE id = ?")
          .run(passwordHash, userId);
        this.db
          .query(
            "UPDATE account_roles SET role = 'admin',revision = revision + 1,updated_at = ? WHERE user_id = ?",
          )
          .run(Date.now(), userId);
        this.db.query('DELETE FROM sessions WHERE user_id = ?').run(userId);
      })
      .immediate();
  }

  close(): void {
    this.db.close();
  }
}
