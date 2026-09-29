import { musicBoundary, nextMusicBoundary } from './music-clock';
import { MUSIC_LAYERS } from './music-types';
import type {
  MusicCatalog,
  MusicConnection,
  MusicCue,
  MusicCueOptions,
  MusicLayer,
  MusicLayers,
  MusicQuality,
  SampleLease,
} from './music-types';
import { SampleBank } from './sample-bank';
import { browserScheduler } from './scheduler';
import type { SchedulerDriver } from './types';

type Prepared = { cue: MusicCue; index: number; leases: SampleLease[] };
type Group = {
  sources: AudioBufferSourceNode[];
  layers: GainNode[];
  gain: GainNode;
  leases: SampleLease[];
  end: number;
  closed: boolean;
};
const defaultLayers: MusicLayers = { melody: 1, harmony: 0.8, bass: 0.72, rhythm: 0.42 };
const release = (prepared?: Prepared) => prepared?.leases.forEach((lease) => lease.release());

export class MusicTransport {
  private readonly cues: Map<string, MusicCue>;
  private readonly groups = new Set<Group>();
  private timer?: unknown;
  private desired?: MusicCue;
  private entryChunk = 0;
  private entryPending = false;
  private current?: Prepared;
  private prepared?: Prepared;
  private loading?: AbortController;
  private generation = 0;
  private origin = 0;
  private boundaryIndex = 0;
  private nextStart = 0;
  private nextLayerTime = 0;
  private requestedLayers: MusicLayers = defaultLayers;
  private appliedLayers: MusicLayers = defaultLayers;
  private enabled = true;
  private paused = false;
  private closed = false;
  private sources = 0;
  private peakSources = 0;
  private lateChunks = 0;
  private errors = 0;
  private retryAt = 0;
  private starts = 0;

  constructor(
    private readonly connection: MusicConnection,
    catalog: MusicCatalog,
    private readonly bank: SampleBank,
    private readonly quality: MusicQuality = 'normal',
    private readonly scheduler: SchedulerDriver = browserScheduler,
    private readonly onError?: (error: unknown) => void,
  ) {
    this.cues = new Map(catalog.map((cue) => [cue.id, cue]));
  }

  setCue(id: string, options: MusicCueOptions = {}): boolean {
    const cue = this.cues.get(id);
    const startChunk = options.startChunk ?? 0;
    if (
      this.closed ||
      !cue ||
      !Number.isInteger(startChunk) ||
      startChunk < 0 ||
      startChunk >= cue.chunks.length
    )
      return false;
    if (this.desired === cue && this.entryChunk === startChunk) return true;
    this.desired = cue;
    this.entryChunk = startChunk;
    this.entryPending = true;
    this.cancelLoad();
    this.retryAt = 0;
    this.startTimer();
    this.tick();
    return true;
  }

  setLayers(values: Partial<Record<MusicLayer, number>>): void {
    if (this.closed) return;
    const next = { ...this.requestedLayers };
    for (const layer of MUSIC_LAYERS) {
      const value = values[layer];
      if (value !== undefined && Number.isFinite(value)) next[layer] = Math.max(0, Math.min(1, value));
    }
    this.requestedLayers = next;
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
    if (this.closed || this.enabled === value) return;
    this.enabled = value;
    if (!value) this.halt();
    else {
      this.startTimer();
      this.tick();
    }
  }

  suspend(): void {
    if (this.closed) return;
    this.paused = true;
    this.halt();
  }

  resume(): void {
    if (this.closed) return;
    this.paused = false;
    this.startTimer();
    this.tick();
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.halt();
    this.bank.dispose();
    this.desired = undefined;
    this.cues.clear();
  }

  get diagnostics() {
    const cue = this.current?.cue;
    return {
      cue: cue?.id ?? null,
      requestedCue: this.desired?.id ?? null,
      requestedChunk: this.entryChunk,
      quality: this.quality,
      chunk: this.current?.index ?? null,
      elapsed: cue ? Math.max(0, this.connection.context.currentTime - this.origin) : 0,
      activeSources: this.sources,
      peakSources: this.peakSources,
      maxSources: 10,
      chunkStarts: this.starts,
      lateChunks: this.lateChunks,
      loading: Boolean(this.loading),
      prepared: this.prepared?.index ?? null,
      enabled: this.enabled,
      suspended: this.paused,
      disposed: this.closed,
      errors: this.errors,
      bank: this.bank.diagnostics,
    };
  }

  private startTimer(): void {
    if (this.timer !== undefined || this.closed || this.paused || !this.enabled) return;
    this.timer = this.scheduler.every(25, () => this.tick());
  }

  private tick(): void {
    if (this.closed || this.paused || !this.enabled || !this.connection.running() || !this.desired) return;
    const now = this.connection.context.currentTime;
    for (const group of this.groups) if (group.end <= now) this.closeGroup(group);
    if (!this.current) {
      if (this.prepared) {
        const first = this.takePrepared();
        this.origin = now + 0.08;
        this.boundaryIndex = 1;
        this.appliedLayers = this.requestedLayers;
        this.current = first;
        this.entryPending = false;
        this.startGroup(first, this.origin, true);
        this.nextStart = this.boundary(first.cue, this.boundaryIndex);
        this.nextLayerTime = musicBoundary(
          this.origin,
          first.cue.bpm,
          first.cue.beatsPerBar,
          1,
          this.connection.context.sampleRate,
        );
      } else {
        this.requestLoad(this.desired, this.entryChunk);
        return;
      }
    }
    if (this.nextStart <= now + 0.12) {
      const previous = this.current;
      const ready = Boolean(this.prepared);
      const next = ready
        ? this.takePrepared()
        : { ...previous, leases: previous.leases.map((lease) => lease.retain()) };
      if (!ready) this.lateChunks++;
      let start = this.nextStart;
      if (start < now + 0.005) {
        start = now + 0.04;
        this.origin = start;
        this.boundaryIndex = 0;
        this.lateChunks++;
      }
      if (next.cue !== previous.cue) {
        this.origin = start;
        this.boundaryIndex = 0;
      }
      this.current = next;
      if (ready) this.entryPending = false;
      this.appliedLayers = this.requestedLayers;
      this.startGroup(next, start, false);
      release(previous);
      this.boundaryIndex++;
      this.nextStart = this.boundary(next.cue, this.boundaryIndex);
      this.nextLayerTime = nextMusicBoundary(
        this.origin,
        start + 0.01,
        next.cue.bpm,
        next.cue.beatsPerBar,
        this.connection.context.sampleRate,
      );
    }
    if (this.nextLayerTime <= now + 0.12) {
      const at = Math.max(now + 0.005, this.nextLayerTime);
      for (const group of this.groups) {
        for (let index = 0; index < MUSIC_LAYERS.length; index++) {
          const layer = MUSIC_LAYERS[index];
          const parameter = group.layers[index].gain;
          parameter.cancelScheduledValues(at);
          parameter.setValueAtTime(this.appliedLayers[layer], at);
          parameter.linearRampToValueAtTime(this.requestedLayers[layer], at + 0.12);
        }
      }
      this.appliedLayers = this.requestedLayers;
      const cue = this.current.cue;
      this.nextLayerTime = nextMusicBoundary(
        this.origin,
        at + 0.13,
        cue.bpm,
        cue.beatsPerBar,
        this.connection.context.sampleRate,
      );
    }
    if (!this.prepared && !this.loading) {
      if (this.desired !== this.current.cue || this.entryPending)
        this.requestLoad(this.desired, this.entryChunk);
      else this.requestLoad(this.current.cue, (this.current.index + 1) % this.current.cue.chunks.length);
    }
  }

  private requestLoad(cue: MusicCue, index: number): void {
    if (
      this.loading ||
      this.bank.diagnostics.loading > 0 ||
      this.connection.context.currentTime < this.retryAt
    )
      return;
    const abort = new AbortController();
    const generation = ++this.generation;
    this.loading = abort;
    const requests = MUSIC_LAYERS.map(async (layer) => {
      const formats = cue.chunks[index].stems[layer][this.quality];
      try {
        return await this.bank.acquire(formats.opus, abort.signal);
      } catch (error) {
        if (abort.signal.aborted) throw error;
        return this.bank.acquire(formats.aac, abort.signal);
      }
    });
    void Promise.allSettled(requests).then((results) => {
      const leases = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      const failure = results.find((result) => result.status === 'rejected');
      if (abort.signal.aborted || this.closed || generation !== this.generation || failure) {
        leases.forEach((lease) => lease.release());
        if (failure?.status === 'rejected' && !abort.signal.aborted && generation === this.generation) {
          this.errors++;
          this.retryAt = this.connection.context.currentTime + 10;
          try {
            this.onError?.(failure.reason);
          } catch {
            this.errors++;
          }
        }
      } else this.prepared = { cue, index, leases };
      if (this.loading === abort) this.loading = undefined;
      if (this.paused || !this.enabled || this.closed) this.bank.trim();
      this.tick();
    });
  }

  private startGroup(prepared: Prepared, start: number, first: boolean): void {
    const context = this.connection.context;
    if (this.sources + MUSIC_LAYERS.length > 10) {
      const oldest = this.groups.values().next().value as Group | undefined;
      if (oldest) this.closeGroup(oldest);
    }
    const gain = context.createGain();
    gain.connect(this.connection.output);
    const duration = (prepared.cue.barsPerChunk * prepared.cue.beatsPerBar * 60) / prepared.cue.bpm;
    const end = start + duration + 0.26;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(1, start + (first ? 0.35 : 0.24));
    gain.gain.setValueAtTime(1, start + duration);
    gain.gain.linearRampToValueAtTime(0, end);
    const group: Group = { sources: [], layers: [], gain, leases: [], end, closed: false };
    this.groups.add(group);
    try {
      for (let index = 0; index < MUSIC_LAYERS.length; index++) {
        const source = context.createBufferSource();
        const layer = context.createGain();
        const lease = prepared.leases[index].retain();
        group.leases.push(lease);
        group.layers.push(layer);
        group.sources.push(source);
        source.buffer = lease.buffer;
        layer.gain.setValueAtTime(this.appliedLayers[MUSIC_LAYERS[index]], start);
        source.connect(layer);
        layer.connect(gain);
        source.onended = () => {
          if (group.sources.every((item) => item.onended === null) || context.currentTime >= end - 0.002)
            this.closeGroup(group);
          source.onended = null;
        };
        this.sources++;
        source.start(start);
        source.stop(end);
      }
      this.peakSources = Math.max(this.peakSources, this.sources);
      this.starts++;
    } catch (error) {
      this.closeGroup(group);
      this.errors++;
      try {
        this.onError?.(error);
      } catch {
        this.errors++;
      }
    }
  }

  private boundary(cue: MusicCue, index: number): number {
    return musicBoundary(
      this.origin,
      cue.bpm,
      cue.barsPerChunk * cue.beatsPerBar,
      index,
      this.connection.context.sampleRate,
    );
  }

  private takePrepared(): Prepared {
    const prepared = this.prepared!;
    this.prepared = undefined;
    return prepared;
  }

  private closeGroup(group: Group): void {
    if (group.closed) return;
    group.closed = true;
    for (const source of group.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    for (const layer of group.layers) layer.disconnect();
    group.gain.disconnect();
    group.leases.forEach((lease) => lease.release());
    this.sources = Math.max(0, this.sources - group.sources.length);
    this.groups.delete(group);
  }

  private cancelLoad(): void {
    this.generation++;
    this.loading?.abort();
    this.loading = undefined;
    this.bank.cancelPending();
    release(this.prepared);
    this.prepared = undefined;
  }

  private halt(): void {
    if (this.timer !== undefined) this.scheduler.cancel(this.timer);
    this.timer = undefined;
    this.cancelLoad();
    for (const group of this.groups) this.closeGroup(group);
    release(this.current);
    this.current = undefined;
    this.bank.trim();
  }
}
