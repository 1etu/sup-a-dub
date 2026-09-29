export class Registry<Key extends string, Value> {
  private readonly entries = new Map<Key, Value>();
  constructor(readonly capacity = 256) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError('Use a positive registry capacity.');
  }
  register(id: Key, value: Value): void {
    if (this.entries.has(id)) throw new Error(`The registry already contains ${id}.`);
    if (this.entries.size >= this.capacity) throw new RangeError('The registry is full.');
    this.entries.set(id, value);
  }
  get(id: Key): Value | undefined {
    return this.entries.get(id);
  }
  require(id: Key): Value {
    if (!this.entries.has(id)) throw new Error(`The registry has no entry for ${id}.`);
    return this.entries.get(id)!;
  }
  has(id: Key): boolean {
    return this.entries.has(id);
  }
  values(): readonly Value[] {
    return [...this.entries.values()];
  }
  keys(): readonly Key[] {
    return [...this.entries.keys()];
  }
  get size(): number {
    return this.entries.size;
  }
  clear(): void {
    this.entries.clear();
  }
}
