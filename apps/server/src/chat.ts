import type { ChatMessage } from '@supadub/protocol';
import { RateLimiter } from './security';
import type { Store, UserRecord } from './store';

export class PoolChat {
  private readonly messages: ChatMessage[] = [];
  private readonly replay = new Map<string, { message: ChatMessage; expiresAt: number }>();
  private readonly limiter = new RateLimiter();
  constructor(private readonly store: Store) {}

  history(now = Date.now()): ChatMessage[] {
    this.prune(now);
    return [...this.messages];
  }

  submit(
    user: UserRecord,
    clientMessageId: string,
    text: string,
    now = Date.now(),
  ): { message?: ChatMessage; repeated?: boolean; error?: string } {
    this.prune(now);
    if (this.store.activeMute(user.id)) return { error: 'Your chat access is paused.' };
    const key = `${user.id}:${clientMessageId}`;
    const existing = this.replay.get(key);
    if (existing) return { message: existing.message, repeated: true };
    if (!this.limiter.take(user.id, 3, 5000, now))
      return { error: 'Wait a few seconds before sending another message.' };
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: user.id,
      name: user.name,
      role: user.role,
      text,
      createdAt: now,
    };
    this.messages.push(message);
    this.replay.set(key, { message, expiresAt: now + 15 * 60000 });
    if (this.messages.length > 100) this.messages.shift();
    while (this.replay.size > 4096) this.replay.delete(this.replay.keys().next().value!);
    return { message };
  }

  message(id: string): ChatMessage | undefined {
    this.prune(Date.now());
    return this.messages.find((message) => message.id === id);
  }

  remove(id: string): boolean {
    const index = this.messages.findIndex((message) => message.id === id);
    if (index < 0) return false;
    this.messages.splice(index, 1);
    return true;
  }

  private prune(now: number): void {
    while (this.messages.length && this.messages[0]!.createdAt < now - 15 * 60000) this.messages.shift();
    for (const [key, entry] of this.replay) if (entry.expiresAt <= now) this.replay.delete(key);
    this.limiter.prune(now);
  }
}
