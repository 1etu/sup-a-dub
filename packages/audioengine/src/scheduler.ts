import type { SchedulerDriver } from './types';

export const browserScheduler: SchedulerDriver = {
  every: (milliseconds, callback) => setInterval(callback, milliseconds),
  cancel: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

type ScheduledSequence = {
  interval: number;
  next: number;
  step: number;
  callback: (time: number, step: number) => void;
};

export class AudioScheduler {
  private readonly sequences = new Map<string, ScheduledSequence>();
  private timer?: unknown;
  private closed = false;
  private skipped = 0;

  constructor(
    private readonly now: () => number,
    private readonly driver: SchedulerDriver = browserScheduler,
    private readonly running: () => boolean = () => true,
    private readonly reportError: (error: unknown) => void = () => undefined,
  ) {}

  start(id: string, interval: number, callback: (time: number, step: number) => void): boolean {
    if (
      this.closed ||
      this.sequences.has(id) ||
      this.sequences.size >= 16 ||
      !Number.isFinite(interval) ||
      interval < 0.025 ||
      interval > 60
    )
      return false;
    this.sequences.set(id, { interval, next: this.now() + 0.04, step: 0, callback });
    this.timer ??= this.driver.every(50, () => this.tick());
    this.tick();
    return true;
  }

  stop(id: string): void {
    this.sequences.delete(id);
    if (!this.sequences.size && this.timer !== undefined) {
      this.driver.cancel(this.timer);
      this.timer = undefined;
    }
  }

  tick(): void {
    if (this.closed || !this.running()) return;
    const now = this.now();
    if (!Number.isFinite(now)) return;
    let budget = 32;
    for (const sequence of this.sequences.values()) {
      if (sequence.next < now) {
        const skipped = Math.floor((now - sequence.next) / sequence.interval) + 1;
        sequence.step += skipped;
        sequence.next += skipped * sequence.interval;
        this.skipped += skipped;
      }
      while (sequence.next < now + 0.16 && budget > 0) {
        const time = sequence.next;
        const step = sequence.step;
        sequence.next += sequence.interval;
        sequence.step++;
        budget--;
        try {
          sequence.callback(time, step);
        } catch (error) {
          this.reportError(error);
        }
      }
    }
  }

  get diagnostics() {
    return { sequences: this.sequences.size, timer: this.timer !== undefined, skippedSteps: this.skipped };
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.timer !== undefined) this.driver.cancel(this.timer);
    this.timer = undefined;
    this.sequences.clear();
  }
}
