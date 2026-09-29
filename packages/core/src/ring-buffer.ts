export class RingBuffer<Value> {
  private readonly storage: (Value | undefined)[];
  private next = 0;
  private length = 0;
  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError('Use a positive buffer capacity.');
    this.storage = new Array(capacity);
  }
  push(value: Value): void {
    this.storage[this.next] = value;
    this.next = (this.next + 1) % this.capacity;
    this.length = Math.min(this.capacity, this.length + 1);
  }
  values(): Value[] {
    const output: Value[] = [];
    const start = (this.next - this.length + this.capacity) % this.capacity;
    for (let index = 0; index < this.length; index++)
      output.push(this.storage[(start + index) % this.capacity]!);
    return output;
  }
  get size(): number {
    return this.length;
  }
  clear(): void {
    this.storage.fill(undefined);
    this.next = 0;
    this.length = 0;
  }
}
