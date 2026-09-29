import { PRACTICE, type WorldSnapshot } from '@supadub/protocol';

export const PRACTICE_REPLAY_LIMITS = Object.freeze({
  durationMs: 30000,
  snapshots: 600,
  obstacles: 128,
  exits: 4,
  endHoldMs: 800,
  stepSeconds: 0.1,
});

export type PracticeReplayStatus = {
  playing: boolean;
  runId: string | null;
  snapshotCount: number;
  durationMs: number;
  positionMs: number;
  loops: number;
};

export type PracticeReplaySample = {
  snapshot: WorldSnapshot;
  resetTrail: boolean;
};

export class PracticeReplay {
  private readonly frames: WorldSnapshot[] = [];
  private runId: string | null = null;
  private playing = false;
  private sealed = false;
  private elapsedMs = 0;
  private loops = 0;
  private cursor = 0;
  private resetTrail = false;

  get status(): PracticeReplayStatus {
    return {
      playing: this.playing,
      runId: this.runId,
      snapshotCount: this.frames.length,
      durationMs: this.durationMs,
      positionMs: Math.min(this.elapsedMs, this.durationMs),
      loops: this.loops,
    };
  }

  private get durationMs(): number {
    return this.frames.length > 1 ? this.frames.at(-1)!.time - this.frames[0]!.time : 0;
  }

  record(snapshot: WorldSnapshot): boolean {
    if (
      snapshot.mode !== 'practice' ||
      !snapshot.practice ||
      !Number.isFinite(snapshot.time) ||
      snapshot.time < 0 ||
      !Number.isSafeInteger(snapshot.tick) ||
      snapshot.tick < 0 ||
      snapshot.players.length !== 1 ||
      snapshot.ducks.length > PRACTICE.totalDucks ||
      snapshot.obstacles.length > PRACTICE_REPLAY_LIMITS.obstacles ||
      snapshot.exits.length > PRACTICE_REPLAY_LIMITS.exits
    )
      return false;
    if (snapshot.practice.runId !== this.runId) {
      this.clear();
      this.runId = snapshot.practice.runId;
    }
    if (this.sealed) return false;
    const previous = this.frames.at(-1);
    if (previous && (snapshot.tick <= previous.tick || snapshot.time <= previous.time)) return false;
    const frame = structuredClone(snapshot);
    frame.bodies = [];
    frame.pellets = [];
    frame.sharks = [];
    frame.leaderboard = [];
    if (previous?.practice?.phase === 'ready' && frame.practice?.phase === 'ready') {
      this.frames[this.frames.length - 1] = frame;
    } else this.frames.push(frame);
    while (
      this.frames.length > PRACTICE_REPLAY_LIMITS.snapshots ||
      frame.time - this.frames[0]!.time > PRACTICE_REPLAY_LIMITS.durationMs
    )
      this.frames.shift();
    if (frame.practice?.phase === 'complete') this.sealed = true;
    return true;
  }

  start(): boolean {
    if (this.frames.length < 2 || this.durationMs <= 0) return false;
    this.playing = true;
    this.sealed = true;
    this.elapsedMs = 0;
    this.loops = 0;
    this.cursor = 0;
    this.resetTrail = true;
    return true;
  }

  advance(dt: number): PracticeReplaySample | null {
    if (!this.playing) return null;
    let resetTrail = this.resetTrail;
    this.resetTrail = false;
    if (!resetTrail) {
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(PRACTICE_REPLAY_LIMITS.stepSeconds, dt)) : 0;
      this.elapsedMs += step * 1000;
      const loopMs = this.durationMs + PRACTICE_REPLAY_LIMITS.endHoldMs;
      if (this.elapsedMs >= loopMs) {
        this.elapsedMs %= loopMs;
        this.loops++;
        this.cursor = 0;
        resetTrail = true;
      }
    }
    const time = this.frames[0]!.time + Math.min(this.elapsedMs, this.durationMs);
    while (this.cursor + 1 < this.frames.length && this.frames[this.cursor + 1]!.time <= time) this.cursor++;
    const before = this.frames[this.cursor]!;
    const after = this.frames[Math.min(this.frames.length - 1, this.cursor + 1)]!;
    const alpha = after.time === before.time ? 0 : (time - before.time) / (after.time - before.time);
    const players = before.players.map((player) => {
      const next = after.players.find((candidate) => candidate.id === player.id);
      if (!next) return { ...player };
      const angle = Math.atan2(Math.sin(next.angle - player.angle), Math.cos(next.angle - player.angle));
      return {
        ...player,
        x: player.x + (next.x - player.x) * alpha,
        z: player.z + (next.z - player.z) * alpha,
        angle: player.angle + angle * alpha,
      };
    });
    const practice = before.practice && {
      ...before.practice,
      elapsedMs:
        before.practice.elapsedMs +
        ((after.practice?.elapsedMs ?? before.practice.elapsedMs) - before.practice.elapsedMs) * alpha,
    };
    return { snapshot: { ...before, time, players, practice }, resetTrail };
  }

  stop(): void {
    this.playing = false;
    this.elapsedMs = 0;
    this.cursor = 0;
    this.resetTrail = false;
  }

  clear(): void {
    this.stop();
    this.frames.length = 0;
    this.runId = null;
    this.sealed = false;
    this.loops = 0;
  }
}
