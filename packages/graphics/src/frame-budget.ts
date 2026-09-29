import { RingBuffer } from '@supadub/core';

export class FrameBudget {
  private readonly samples: RingBuffer<number>;
  constructor(capacity = 120) {
    this.samples = new RingBuffer(capacity);
  }
  sample(seconds: number): void {
    if (Number.isFinite(seconds) && seconds > 0 && seconds < 5) this.samples.push(seconds);
  }
  get count(): number {
    return this.samples.size;
  }
  get fps(): number {
    const values = this.samples.values();
    return values.length ? values.length / values.reduce((sum, value) => sum + value, 0) : 60;
  }
  percentile(fraction: number): number {
    const values = this.samples.values().sort((a, b) => a - b);
    return values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * fraction) - 1))] ?? 0;
  }
  clear(): void {
    this.samples.clear();
  }
}
