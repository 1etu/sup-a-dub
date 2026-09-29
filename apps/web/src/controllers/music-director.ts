import type { AudioEngine, MusicController } from '@supadub/audioengine';
import { GAME_MUSIC, type GameMusicCue } from '@supadub/assets/music';
import type { WorldSnapshot } from '@supadub/protocol';

export type MusicState = {
  screen: string;
  mode: 'practice' | 'endless';
  snapshot: WorldSnapshot | null;
  playerId: string;
  movement: number;
};

export function musicPressure(state: MusicState): number {
  if (state.screen !== 'playing')
    return state.screen === 'success' || state.screen === 'results' ? 0.55 : 0.14;
  const self = state.snapshot?.players.find((player) => player.id === state.playerId);
  if (!self) return 0.2;
  const movement = Math.max(0, Math.min(1, state.movement));
  if (state.mode === 'practice')
    return Math.min(
      0.9,
      0.2 +
        ((state.snapshot?.practice?.savedDucks ?? 0) / 12) * 0.4 +
        (self.chain / 12) * 0.2 +
        movement * 0.18,
    );
  let threat = 0;
  for (const player of state.snapshot?.players ?? []) {
    if (player.id === self.id || (player.totalMass ?? player.score) <= (self.totalMass ?? self.score) * 1.1)
      continue;
    threat = Math.max(threat, Math.max(0, 1 - Math.hypot(player.x - self.x, player.z - self.z) / 24));
  }
  for (const shark of state.snapshot?.sharks ?? []) {
    if ((self.totalMass ?? self.score) < 120) continue;
    threat = Math.max(threat, Math.max(0, 1 - Math.hypot(shark.x - self.x, shark.z - self.z) / 10) * 0.8);
  }
  const pieces = Math.min(
    1,
    (state.snapshot?.bodies?.filter((body) => body.ownerId === self.id).length ?? 1) / 8,
  );
  return Math.min(1, 0.18 + movement * 0.2 + pieces * 0.2 + threat * 0.65);
}

export class MusicDirector {
  private music: MusicController;
  private low: boolean;
  private disposed = false;
  private cue: GameMusicCue = 'bubble-lobby';
  private intensity = 0.14;
  private previous = 0;
  private lastCue = -Infinity;
  private accent = 0;
  errors = 0;

  constructor(
    private readonly audio: AudioEngine,
    low = false,
  ) {
    this.low = low;
    this.music = this.createMusic();
    audio.setBusGain('music', 0.45);
  }

  setQuality(low: boolean): void {
    if (this.disposed || this.low === low) return;
    this.low = low;
    this.music = this.createMusic();
  }

  signal(strength = 0.15): void {
    this.accent = Math.min(0.4, this.accent + strength);
  }

  update(now: number, state: MusicState): void {
    if (this.disposed || now - this.previous < 0.2) return;
    const dt = Math.min(1, this.previous ? now - this.previous : 0.2);
    this.previous = now;
    const target = Math.min(1, musicPressure(state) + this.accent);
    this.accent *= Math.exp(-dt / 2.5);
    this.intensity += (target - this.intensity) * (1 - Math.exp(-dt / (target > this.intensity ? 1.5 : 8)));
    this.music.setIntensity(this.intensity);
    const playing = ['playing', 'pause'].includes(state.screen);
    const result = ['success', 'results'].includes(state.screen);
    const cue: GameMusicCue = result
      ? 'home-with-ducks'
      : !playing
        ? 'bubble-lobby'
        : state.mode === 'practice'
          ? this.intensity > 0.55
            ? 'rubber-run'
            : 'tile-trails'
          : this.intensity > 0.78
            ? 'deep-end'
            : this.intensity > 0.52
              ? 'flock-frenzy'
              : 'rubber-run';
    if (
      cue !== this.cue &&
      (now - this.lastCue > 12 ||
        result ||
        cue === 'deep-end' ||
        !playing ||
        this.cue === 'bubble-lobby' ||
        this.cue === 'home-with-ducks')
    ) {
      this.cue = cue;
      this.lastCue = now;
      this.music.setCue(cue, { startChunk: cue === 'deep-end' ? 6 : 0 });
    }
  }

  get diagnostics() {
    return {
      ...this.music.diagnostics,
      desiredCue: this.cue,
      intensity: this.intensity,
      loadErrors: this.errors,
    };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.music.dispose();
  }

  private createMusic(): MusicController {
    const music = this.audio.createMusic({
      catalog: GAME_MUSIC,
      quality: this.low ? 'low' : 'normal',
      onError: () => {
        this.errors++;
      },
    });
    music.setCue(this.cue, { startChunk: this.cue === 'deep-end' ? 6 : 0 });
    music.setIntensity(this.intensity);
    return music;
  }
}
