export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<(value: never) => void>>();
  private count = 0;
  constructor(private readonly capacity = 256) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError('Use a positive listener capacity.');
  }
  on<Key extends keyof Events>(key: Key, listener: (value: Events[Key]) => void): () => void {
    let listeners = this.listeners.get(key);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(key, listeners);
    }
    const callback = listener as (value: never) => void;
    if (!listeners.has(callback)) {
      if (this.count >= this.capacity) throw new RangeError('The event bus is full.');
      listeners.add(callback);
      this.count++;
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (listeners.delete(callback)) this.count--;
      if (!listeners.size) this.listeners.delete(key);
    };
  }
  emit<Key extends keyof Events>(key: Key, value: Events[Key]): void {
    const errors: unknown[] = [];
    for (const listener of [...(this.listeners.get(key) ?? [])]) {
      try {
        listener(value as never);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'An event listener failed.');
  }
  get listenerCount(): number {
    return this.count;
  }
  dispose(): void {
    for (const listeners of this.listeners.values()) listeners.clear();
    this.listeners.clear();
    this.count = 0;
  }
}
