import type { AudioBusDefinition } from './types';

export const DEFAULT_AUDIO_BUSES: readonly AudioBusDefinition[] = Object.freeze([
  { id: 'effects', gain: 0.68 },
  { id: 'music', gain: 0.19 },
  { id: 'ambience', gain: 0.14 },
]);

type Bus = { node: GainNode; gain: number; muted: boolean };

export class AudioMixer {
  private readonly master: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly buses = new Map<string, Bus>();
  private volume = 0.65;
  private muted = false;
  private closed = false;

  constructor(
    private readonly context: BaseAudioContext,
    definitions = DEFAULT_AUDIO_BUSES,
  ) {
    if (definitions.length > 16 || new Set(definitions.map((bus) => bus.id)).size !== definitions.length) {
      throw new RangeError('Audio buses exceed their limits or have duplicate IDs.');
    }
    for (const bus of definitions) {
      if (
        !/^[a-z][a-z0-9.-]{0,63}$/.test(bus.id) ||
        !Number.isFinite(bus.gain) ||
        bus.gain < 0 ||
        bus.gain > 1
      ) {
        throw new TypeError('Audio bus definition is invalid.');
      }
    }
    this.master = context.createGain();
    this.limiter = context.createDynamicsCompressor();
    this.master.gain.value = this.volume;
    this.limiter.threshold.value = -12;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.005;
    this.limiter.release.value = 0.12;
    this.limiter.connect(this.master);
    this.master.connect(context.destination);
    for (const definition of definitions) {
      const node = context.createGain();
      node.gain.value = definition.gain;
      node.connect(this.limiter);
      this.buses.set(definition.id, { node, gain: definition.gain, muted: false });
    }
  }

  output(id: string): AudioNode | undefined {
    return this.buses.get(id)?.node;
  }

  audible(id: string): boolean {
    const bus = this.buses.get(id);
    return !this.closed && !this.muted && this.volume > 0 && !!bus && !bus.muted && bus.gain > 0;
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value) || this.closed) return;
    this.volume = Math.max(0, Math.min(1, value));
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.025);
  }

  setMuted(value: boolean): void {
    if (this.closed) return;
    this.muted = value;
    this.master.gain.setTargetAtTime(value ? 0 : this.volume, this.context.currentTime, 0.025);
  }

  setBusGain(id: string, value: number): void {
    const bus = this.buses.get(id);
    if (!bus || !Number.isFinite(value) || this.closed) return;
    bus.gain = Math.max(0, Math.min(1, value));
    bus.node.gain.setTargetAtTime(bus.muted ? 0 : bus.gain, this.context.currentTime, 0.04);
  }

  setBusMuted(id: string, value: boolean): void {
    const bus = this.buses.get(id);
    if (!bus || this.closed) return;
    bus.muted = value;
    bus.node.gain.setTargetAtTime(value ? 0 : bus.gain, this.context.currentTime, 0.04);
  }

  get diagnostics() {
    return {
      volume: this.volume,
      muted: this.muted,
      buses: [...this.buses].map(([id, bus]) => ({ id, gain: bus.gain, muted: bus.muted })),
    };
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const bus of this.buses.values()) bus.node.disconnect();
    this.buses.clear();
    this.limiter.disconnect();
    this.master.disconnect();
  }
}
