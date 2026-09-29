import { MusicTransport } from './music-transport';
import { validMusicCatalog } from './music-types';
import type {
  MusicConnection,
  MusicControllerOptions,
  MusicCueOptions,
  MusicLayer,
  MusicLayers,
} from './music-types';
import { SampleBank } from './sample-bank';

export class MusicController {
  private transport?: MusicTransport;
  private cue?: string;
  private entryChunk = 0;
  private layers?: MusicLayers;
  private enabled = true;
  private muted = false;
  private paused = false;
  private closed = false;
  private finalDiagnostics?: MusicTransport['diagnostics'];

  constructor(
    private readonly options: MusicControllerOptions,
    private readonly connect: () => MusicConnection | undefined,
  ) {
    if (!validMusicCatalog(options.catalog)) throw new TypeError('The music catalog is invalid.');
  }

  setCue(id: string, options: MusicCueOptions = {}): boolean {
    const cue = this.options.catalog.find((entry) => entry.id === id);
    const startChunk = options.startChunk ?? 0;
    if (
      this.closed ||
      !cue ||
      !Number.isInteger(startChunk) ||
      startChunk < 0 ||
      startChunk >= cue.chunks.length
    )
      return false;
    this.cue = id;
    this.entryChunk = startChunk;
    this.attach();
    return this.transport?.setCue(id, { startChunk }) ?? true;
  }

  setLayers(values: Partial<Record<MusicLayer, number>>): void {
    const layers = { ...(this.layers ?? { melody: 1, harmony: 0.8, bass: 0.72, rhythm: 0.42 }) };
    for (const key of ['melody', 'harmony', 'bass', 'rhythm'] as const) {
      const value = values[key];
      if (value !== undefined && Number.isFinite(value)) layers[key] = Math.max(0, Math.min(1, value));
    }
    this.layers = layers;
    this.transport?.setLayers(layers);
  }

  setIntensity(value: number): void {
    if (!Number.isFinite(value)) return;
    const intensity = Math.max(0, Math.min(1, value));
    this.setLayers({
      melody: 0.76 + intensity * 0.24,
      harmony: 0.55 + intensity * 0.35,
      bass: 0.5 + intensity * 0.42,
      rhythm: 0.12 + intensity * 0.88,
    });
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.transport?.setEnabled(value && !this.muted);
    if (value) this.attach();
  }

  setMuted(value: boolean): void {
    this.muted = value;
    this.transport?.setEnabled(this.enabled && !value);
    if (!value) this.attach();
  }

  suspend(): void {
    this.paused = true;
    this.transport?.suspend();
  }

  resume(): void {
    this.paused = false;
    this.attach();
    this.transport?.resume();
  }

  get diagnostics() {
    return (
      this.transport?.diagnostics ??
      this.finalDiagnostics ?? {
        cue: null,
        requestedCue: this.cue ?? null,
        requestedChunk: this.entryChunk,
        quality: this.options.quality ?? 'normal',
        activeSources: 0,
        peakSources: 0,
        enabled: this.enabled && !this.muted,
        suspended: this.paused,
        disposed: this.closed,
        bank: {
          bytes: 0,
          reservedBytes: 0,
          maxBytes: (this.options.quality === 'low' ? 24 : 48) * 1024 * 1024,
        },
      }
    );
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.transport?.dispose();
    this.finalDiagnostics = this.transport?.diagnostics;
    this.transport = undefined;
  }

  private attach(): void {
    if (this.closed || this.transport || !this.enabled || this.muted) return;
    const connection = this.connect();
    if (!connection) return;
    const quality = this.options.quality ?? 'normal';
    const decoder =
      typeof OfflineAudioContext === 'function' ? new OfflineAudioContext(2, 1, 32000) : connection.context;
    const bank = new SampleBank(decoder, (quality === 'low' ? 24 : 48) * 1024 * 1024);
    this.transport = new MusicTransport(
      connection,
      this.options.catalog,
      bank,
      quality,
      this.options.scheduler,
      this.options.onError,
    );
    if (this.layers) this.transport.setLayers(this.layers);
    if (this.paused) this.transport.suspend();
    if (this.cue) this.transport.setCue(this.cue, { startChunk: this.entryChunk });
  }
}
