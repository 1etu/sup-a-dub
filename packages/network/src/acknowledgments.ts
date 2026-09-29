import type { Clock } from '@supadub/core';
import { monotonicClock } from '@supadub/core';

type Pending<T> = { resolve(value: T): void; reject(reason: Error): void; expiresAt: number };

export class Acknowledgments<T> {
  private readonly pending = new Map<string, Pending<T>>();
  private sequence = 0;
  private epoch = 0;

  constructor(
    private readonly clock: Clock = monotonicClock,
    private readonly capacity = 64,
    private readonly namespace = crypto.randomUUID(),
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError('The request capacity is invalid.');
  }

  request(timeoutMs = 10000): { id: string; result: Promise<T> } {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('The timeout is invalid.');
    if (this.pending.size >= this.capacity) throw new RangeError('The request queue is full.');
    const id = `${this.namespace}:${this.epoch}:${++this.sequence}`;
    const result = new Promise<T>((resolve, reject) =>
      this.pending.set(id, { resolve, reject, expiresAt: this.clock.now() + timeoutMs }),
    );
    return { id, result };
  }

  accept(id: string, value: T): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;
    this.pending.delete(id);
    if (pending.expiresAt <= this.clock.now()) {
      pending.reject(new Error('The request timed out.'));
      return false;
    }
    pending.resolve(value);
    return true;
  }

  expire(): void {
    const now = this.clock.now();
    for (const [id, pending] of this.pending)
      if (pending.expiresAt <= now) {
        this.pending.delete(id);
        pending.reject(new Error('The request timed out.'));
      }
  }

  reset(reason = 'The connection changed.'): void {
    this.epoch++;
    this.sequence = 0;
    for (const pending of this.pending.values()) pending.reject(new Error(reason));
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }
}
