import type { VoiceHandle } from './types';

type ActiveVoice = { handle: VoiceHandle; priority: number; group: string; bus: string };

export class VoicePool {
  readonly capacity: number;
  private readonly voices = new Map<number, ActiveVoice>();
  private nextId = 1;
  private accepted = 0;
  private rejected = 0;
  private stolen = 0;
  private peak = 0;
  private closed = false;

  constructor(capacity = 42) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 128)
      throw new RangeError('Voice capacity must be between 1 and 128.');
    this.capacity = capacity;
  }

  play(
    count: number,
    priority: number,
    bus: string,
    group: string,
    create: (index: number) => VoiceHandle,
  ): boolean {
    if (
      this.closed ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > this.capacity ||
      !Number.isFinite(priority)
    )
      return this.reject();
    const needed = this.voices.size + count - this.capacity;
    if (needed > 0) {
      const candidates = [...this.voices]
        .filter(([, voice]) => voice.priority < priority)
        .sort((left, right) => left[1].priority - right[1].priority);
      if (candidates.length < needed) return this.reject();
      for (let index = 0; index < needed; index++) {
        this.stop(candidates[index]![0]);
        this.stolen++;
      }
    }
    const created: number[] = [];
    try {
      for (let index = 0; index < count; index++) {
        const handle = create(index);
        const id = this.nextId++;
        this.voices.set(id, { handle, priority, group, bus });
        created.push(id);
        handle.onEnded(() => this.voices.delete(id));
      }
    } catch (error) {
      for (const id of created) this.stop(id);
      this.rejected++;
      throw error;
    }
    this.accepted += count;
    this.peak = Math.max(this.peak, this.voices.size);
    return true;
  }

  stopGroup(group: string): void {
    for (const [id, voice] of this.voices) if (voice.group === group) this.stop(id);
  }

  stopBus(bus: string): void {
    for (const [id, voice] of this.voices) if (voice.bus === bus) this.stop(id);
  }

  stopAll(): void {
    for (const id of this.voices.keys()) this.stop(id);
  }

  get diagnostics() {
    return {
      active: this.voices.size,
      capacity: this.capacity,
      peak: this.peak,
      accepted: this.accepted,
      rejected: this.rejected,
      stolen: this.stolen,
    };
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopAll();
  }

  private stop(id: number): void {
    const voice = this.voices.get(id);
    this.voices.delete(id);
    voice?.handle.stop();
  }

  private reject(): false {
    this.rejected++;
    return false;
  }
}
