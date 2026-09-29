import { BrowserAudioAdapter } from './adapters';
import { AudioMixer } from './mixer';
import { MusicController } from './music-controller';
import type { MusicControllerOptions } from './music-types';
import { SoundRegistry, validSoundPlan } from './registry';
import { AudioScheduler } from './scheduler';
import type {
  AudioAdapter,
  AudioEngineOptions,
  AudioSequence,
  PlayOptions,
  SoundParameters,
  SoundRecipe,
} from './types';
import { VoicePool } from './voice-pool';
import { WebAudioVoiceRenderer } from './voice-renderer';

type PreviousPlay = { time: number; occurrence: number };

export class AudioController {
  readonly registry = new SoundRegistry();
  private readonly adapter: AudioAdapter;
  private readonly pool: VoicePool;
  private readonly scheduler: AudioScheduler;
  private readonly previous = new Map<string, PreviousPlay>();
  private readonly requested = new Set<string>();
  private readonly busGains = new Map<string, number>();
  private readonly busMutes = new Map<string, boolean>();
  private mixer?: AudioMixer;
  private music?: MusicController;
  private renderer?: WebAudioVoiceRenderer;
  private pending?: Promise<void>;
  private seed: number;
  private muted = false;
  private volume = 0.65;
  private disposed = false;
  private paused = false;
  private lifecycle = 0;
  private errors = 0;
  private rejected = 0;

  constructor(private readonly options: AudioEngineOptions = {}) {
    this.adapter = options.adapter ?? new BrowserAudioAdapter();
    this.pool = new VoicePool(options.maxVoices ?? 42);
    this.seed = (options.seed ?? 873421) >>> 0;
    this.registry.registerSounds(options.sounds ?? []);
    this.registry.registerSequences(options.sequences ?? []);
    this.scheduler = new AudioScheduler(
      () => this.adapter.context?.currentTime ?? 0,
      options.scheduler,
      () => this.adapter.running,
      (error) => this.report(error),
    );
  }

  prepare(): void {
    if (this.disposed) return;
    try {
      const context = this.adapter.prepare?.() ?? this.adapter.context;
      if (context) this.initialize(context);
    } catch (error) {
      this.report(error);
    }
  }

  unlock(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.paused) {
      this.paused = false;
      this.lifecycle++;
    }
    this.pending ??= this.activate().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  registerSounds(recipes: readonly SoundRecipe[]): void {
    if (!this.disposed) this.registry.registerSounds(recipes);
  }
  registerSequences(sequences: readonly AudioSequence[]): void {
    if (!this.disposed) this.registry.registerSequences(sequences);
  }

  play(name: string, options: PlayOptions = {}): boolean {
    return this.playAt(name, options, (this.adapter.context?.currentTime ?? 0) + 0.005, 'effect');
  }

  setMuted(value: boolean): void {
    this.muted = value;
    this.mixer?.setMuted(value);
    this.music?.setMuted(value || Boolean(this.busMutes.get('music')));
    if (value) this.pool.stopAll();
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    this.mixer?.setVolume(this.volume);
  }

  setMusic(value: boolean): void {
    this.setBusMuted('music', !value);
  }

  setBusGain(id: string, value: number): void {
    if (!this.knownBus(id) || !Number.isFinite(value)) return;
    this.busGains.set(id, Math.max(0, Math.min(1, value)));
    this.mixer?.setBusGain(id, value);
  }

  setBusMuted(id: string, value: boolean): void {
    if (!this.knownBus(id)) return;
    this.busMutes.set(id, value);
    this.mixer?.setBusMuted(id, value);
    if (id === 'music') this.music?.setMuted(this.muted || value);
    if (value) this.pool.stopBus(id);
  }

  startSequence(id: string): boolean {
    if (
      this.disposed ||
      !this.registry.sequence(id) ||
      (this.requested.size >= 16 && !this.requested.has(id))
    )
      return false;
    this.requested.add(id);
    this.schedule(id);
    return true;
  }

  stopSequence(id: string): void {
    this.requested.delete(id);
    this.scheduler.stop(id);
    this.pool.stopGroup(id);
  }

  startAmbience(): void {
    for (const id of this.options.ambience ?? []) this.startSequence(id);
  }

  stopAmbience(): void {
    for (const id of this.options.ambience ?? []) this.stopSequence(id);
  }

  createMusic(options: MusicControllerOptions): MusicController {
    this.music?.dispose();
    const music = new MusicController(options, () => {
      const context = this.adapter.context;
      const output = this.mixer?.output('music');
      return context && output
        ? { context, output, running: () => !this.paused && this.adapter.running }
        : undefined;
    });
    this.music = music;
    if (this.paused) music.suspend();
    music.setMuted(this.muted || Boolean(this.busMutes.get('music')));
    if (this.disposed) music.dispose();
    return music;
  }

  async suspend(): Promise<void> {
    if (this.disposed) return;
    this.paused = true;
    const lifecycle = ++this.lifecycle;
    this.music?.suspend();
    for (const id of this.requested) this.scheduler.stop(id);
    this.pool.stopAll();
    await this.adapter.suspend();
    if (!this.disposed && !this.paused && lifecycle !== this.lifecycle) await this.unlock();
  }

  get diagnostics() {
    return {
      state: this.disposed ? 'disposed' : (this.adapter.context?.state ?? 'locked'),
      suspended: this.paused,
      sounds: this.registry.size,
      requestedSequences: this.requested.size,
      voices: this.pool.diagnostics,
      scheduler: this.scheduler.diagnostics,
      mixer: this.mixer?.diagnostics ?? { volume: this.volume, muted: this.muted, buses: [] },
      buffers: this.renderer?.diagnostics ?? { noiseBuffers: 0, noiseBytes: 0 },
      rejectedPlans: this.rejected,
      errors: this.errors,
      music: this.music?.diagnostics,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.paused = true;
    this.lifecycle++;
    this.music?.dispose();
    this.scheduler.dispose();
    this.pool.dispose();
    this.renderer?.dispose();
    this.mixer?.dispose();
    this.renderer = undefined;
    this.mixer = undefined;
    this.requested.clear();
    this.previous.clear();
    this.busGains.clear();
    this.busMutes.clear();
    this.registry.clear();
    void this.adapter.dispose().catch((error) => this.report(error));
  }

  private async activate(): Promise<void> {
    try {
      while (!this.disposed) {
        const lifecycle = this.lifecycle;
        const context = await this.adapter.unlock();
        if (!context || this.disposed) return;
        if (this.paused || lifecycle !== this.lifecycle) {
          if (this.paused) await this.adapter.suspend();
          if (this.paused || this.disposed) return;
          continue;
        }
        this.initialize(context);
        this.music?.resume();
        for (const id of this.requested) this.schedule(id);
        return;
      }
    } catch (error) {
      this.report(error);
    }
  }

  private initialize(context: BaseAudioContext): void {
    if (this.mixer) return;
    this.mixer = new AudioMixer(context, this.options.buses);
    this.renderer = new WebAudioVoiceRenderer(context);
    this.mixer.setMuted(this.muted);
    this.mixer.setVolume(this.volume);
    for (const [id, gain] of this.busGains) this.mixer.setBusGain(id, gain);
    for (const [id, muted] of this.busMutes) this.mixer.setBusMuted(id, muted);
  }

  private schedule(id: string): void {
    const sequence = this.registry.sequence(id);
    if (!sequence || !this.mixer || this.paused || !this.adapter.running) return;
    this.scheduler.start(id, sequence.interval, (time, step) => {
      const requests = sequence.create({ time, step, random: () => this.random() });
      if (requests.length > 16) {
        this.rejected++;
        return;
      }
      for (const request of requests) this.playAt(request.id, request, time, id);
    });
  }

  private playAt(name: string, options: PlayOptions, time: number, group: string): boolean {
    const recipe = this.registry.sound(name);
    const context = this.adapter.context;
    if (
      this.disposed ||
      this.paused ||
      !recipe ||
      !context ||
      !this.adapter.running ||
      !this.mixer ||
      !this.renderer
    )
      return false;
    const bus = recipe.bus ?? 'effects';
    const output = this.mixer.output(bus);
    if (!output || !this.mixer.audible(bus)) return false;
    const previous = this.previous.get(name);
    const elapsed = previous ? time - previous.time : Infinity;
    if (elapsed < (recipe.cooldown ?? 0.045)) return false;
    if (!this.validOptions(options)) {
      this.rejected++;
      return false;
    }
    try {
      const occurrence = (previous?.occurrence ?? -1) + 1;
      const plan = recipe.create({
        occurrence,
        elapsed,
        parameters: options.parameters ?? {},
        random: () => this.random(),
      });
      if (!validSoundPlan(plan)) {
        this.rejected++;
        return false;
      }
      const accepted = this.pool.play(plan.voices.length, recipe.priority ?? 1, bus, group, (index) =>
        this.renderer!.render(
          plan.voices[index]!,
          output,
          time + (options.delay ?? 0),
          options.gain ?? 1,
          options.pan ?? 0,
        ),
      );
      if (accepted) this.previous.set(name, { time, occurrence });
      return accepted;
    } catch (error) {
      this.report(error);
      return false;
    }
  }

  private knownBus(id: string): boolean {
    return (this.options.buses?.map((bus) => bus.id) ?? ['effects', 'music', 'ambience']).includes(id);
  }

  private validOptions(options: PlayOptions): boolean {
    if (!Number.isFinite(options.gain ?? 1) || (options.gain ?? 1) < 0 || (options.gain ?? 1) > 1)
      return false;
    if (!Number.isFinite(options.pan ?? 0) || Math.abs(options.pan ?? 0) > 1) return false;
    if (!Number.isFinite(options.delay ?? 0) || (options.delay ?? 0) < 0 || (options.delay ?? 0) > 4)
      return false;
    const parameters: SoundParameters = options.parameters ?? {};
    const entries = Object.entries(parameters);
    return (
      entries.length <= 16 && entries.every(([key, value]) => key.length <= 48 && Number.isFinite(value))
    );
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private report(error: unknown): void {
    this.errors++;
    try {
      this.options.onError?.(error);
    } catch {
      this.errors++;
    }
  }
}
