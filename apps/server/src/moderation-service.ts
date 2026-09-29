import type { ModerationAction } from '@supadub/protocol';
import type { PoolRuntime } from './pool';
import type { Store } from './store';
import { tokenHash } from './store';
import { RateLimiter } from './security';
import type { ModerationExecution } from './moderation';

export class ModerationService {
  private readonly limiter = new RateLimiter();
  constructor(
    private readonly store: Store,
    private readonly runtime: PoolRuntime,
  ) {}

  async act(
    token: string | undefined,
    action: ModerationAction,
    actorGuestId?: string,
  ): Promise<ModerationExecution> {
    const user = this.store.sessionUser(token);
    const failure = (status: number, code: string, message: string): ModerationExecution => ({
      status,
      result: { requestId: action.requestId || 'invalid', ok: false, code, message },
    });
    if (!user || !token) return failure(401, 'session_expired', 'Sign in again to continue.');
    if (!this.runtime.features.enabled('moderation'))
      return failure(404, 'feature_disabled', 'Moderation controls are unavailable.');
    if (!this.limiter.take(user.id, 30, 60000))
      return failure(429, 'moderation_limited', 'Wait before another moderation action.');
    const messageTargetId =
      action.action === 'delete-message' ? this.runtime.chat.message(action.targetId)?.senderId : undefined;
    const result = (await this.runtime.persistence.enqueue({
      kind: 'moderation',
      task: { sessionHash: tokenHash(token), action, messageTargetId, actorGuestId },
    })) as ModerationExecution;
    if (result.effect && !result.repeated) {
      if (result.effect.action === 'delete-message' && result.effect.messageId) {
        this.runtime.chat.remove(result.effect.messageId);
        this.runtime.broadcastChat({ type: 'chat-deleted', id: result.effect.messageId });
      }
      if (result.effect.action === 'kick') this.runtime.kick(result.effect.targetId);
      if (result.effect.action === 'ban') this.runtime.enforceBans();
      if (result.effect.action === 'set-role') this.runtime.refreshAccount(result.effect.targetId);
    }
    return result;
  }
}
