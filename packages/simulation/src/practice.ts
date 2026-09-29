import {
  PRACTICE,
  PROTOCOL_VERSION,
  WORLD,
  type ActionMessage,
  type InputMessage,
  type PracticeResult,
  type PracticeState,
  type Skin,
  type Vec2,
  type WorldSnapshot,
} from '@supadub/protocol';
import { applyInput, createPlayer, publicPlayer } from './common';
import type { Chunk, SimulationPlayer, WorldOptions } from './types';

export class PracticeWorld {
  readonly mode = 'practice' as const;
  readonly players = new Map<string, SimulationPlayer>();
  readonly chunks = new Map<string, Chunk>();
  readonly bounds = {
    minX: -PRACTICE.width / 2,
    maxX: PRACTICE.width / 2,
    minZ: -PRACTICE.depth / 2,
    maxZ: PRACTICE.depth / 2,
  };
  readonly exits = [
    { id: 'exit:practice', x: 0, z: 0, radius: PRACTICE.exitRadius, kind: 'finish' as const, active: true },
  ];
  readonly seed = 731;
  readonly maxChunks = 1;
  tick = 0;
  time = 0;
  practice!: PracticeState;
  constructor(private readonly options: WorldOptions) {
    this.reset();
  }

  addPlayer(
    id: string,
    name: string,
    skin: Skin,
    now: number,
    position: Vec2 = { x: -9, z: 5 },
    bot = false,
  ): SimulationPlayer {
    const player = createPlayer(id, name, skin, now, position, bot);
    player.runId = this.practice.runId;
    this.players.set(id, player);
    this.time = now;
    return player;
  }

  removePlayer(id: string): SimulationPlayer | undefined {
    const player = this.players.get(id);
    this.players.delete(id);
    return player;
  }

  setInput(id: string, input: InputMessage, now: number): boolean {
    if (this.practice.phase === 'complete' || !applyInput(this.players.get(id), input, now, false))
      return false;
    if (this.practice.phase === 'ready' && Math.hypot(input.x, input.z) > 0.01) {
      this.practice.phase = 'playing';
      this.practice.startedAt = now;
    }
    return true;
  }

  action(id: string, message: ActionMessage, now: number) {
    return { accepted: false, reason: 'Practice has no split or ejection.' };
  }

  restartPractice(id: string, runId: string, now: number): boolean {
    if (this.practice.runId !== runId || !this.players.has(id)) return false;
    const old = this.players.get(id)!;
    this.reset();
    const player = this.addPlayer(id, old.name, old.skin, now);
    player.identityId = old.identityId;
    player.role = old.role;
    player.controlEpoch = old.controlEpoch;
    player.loadout = { ...old.loadout, emotes: [...old.loadout.emotes] };
    return true;
  }

  step(deltaSeconds: number, now: number): void {
    this.time = now;
    this.tick++;
    if (this.practice.phase === 'complete') return;
    if (this.practice.startedAt !== null)
      this.practice.elapsedMs = Math.max(0, now - this.practice.startedAt);
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    const chunk = this.chunks.get('0:0')!;
    for (const player of this.players.values()) {
      const previousX = player.x;
      const previousZ = player.z;
      if (now - player.lastInputAt > 400) player.input = { ...player.input, x: 0, z: 0, boost: false };
      player.x = Math.max(
        this.bounds.minX + WORLD.playerRadius,
        Math.min(this.bounds.maxX - WORLD.playerRadius, player.x + player.input.x * WORLD.moveSpeed * dt),
      );
      player.z = Math.max(
        this.bounds.minZ + WORLD.playerRadius,
        Math.min(this.bounds.maxZ - WORLD.playerRadius, player.z + player.input.z * WORLD.moveSpeed * dt),
      );
      const distance = Math.hypot(player.x - previousX, player.z - previousZ);
      player.practiceDistance += distance;
      if (
        distance > 0 &&
        [player.loadout.head, player.loadout.face, player.loadout.neck].filter(Boolean).length >= 2
      ) {
        player.metrics.adornedDistance = (player.metrics.adornedDistance ?? 0) + distance;
        player.metricSequence++;
      }
      if (Math.hypot(player.input.x, player.input.z) > 0.01)
        player.angle = Math.atan2(player.input.x, player.input.z);
      let collected = 0;
      for (const [key, duck] of chunk.ducks) {
        if (Math.hypot(player.x - duck.x, player.z - duck.z) <= WORLD.playerRadius + 0.5) {
          chunk.ducks.delete(key);
          collected++;
        }
      }
      if (collected) {
        player.chain += collected;
        player.score += collected * 10;
        player.totalCollected += collected;
        this.options.onEvent?.(player.id, { type: 'event', event: 'collect', amount: collected });
      }
      this.deliver(player, now);
    }
  }

  snapshot(id: string): WorldSnapshot {
    return {
      type: 'snapshot',
      protocolVersion: PROTOCOL_VERSION,
      tick: this.tick,
      time: this.time,
      mode: this.mode,
      exits: this.exits,
      bounds: this.bounds,
      practice: { ...this.practice },
      players: [...this.players.values()].map(publicPlayer),
      ducks: [...this.chunks.get('0:0')!.ducks.values()],
      obstacles: [],
      leaderboard: [],
      online: 1,
      bodies: [],
      pellets: [],
      sharks: [],
    };
  }

  private reset(): void {
    const ducks = new Map<string, { id: string; x: number; z: number }>();
    for (const x of [-10.8, 10.8])
      for (let index = 0; index < 6; index++) {
        const id = `practice:${x}:${index}`;
        ducks.set(id, { id, x, z: -6 + index * 2.4 });
      }
    this.chunks.clear();
    this.chunks.set('0:0', {
      key: '0:0',
      x: 0,
      z: 0,
      ducks,
      obstacles: [],
      respawns: new Map(),
      lastSeen: 0,
    });
    this.practice = {
      runId: crypto.randomUUID(),
      levelId: 'fun-01',
      phase: 'ready',
      startedAt: null,
      elapsedMs: 0,
      totalDucks: 12,
      savedDucks: 0,
      longestChain: 0,
      result: null,
    };
  }

  private deliver(player: SimulationPlayer, now: number): void {
    if (
      this.practice.phase !== 'playing' ||
      !player.chain ||
      Math.hypot(player.x, player.z) > PRACTICE.exitRadius
    )
      return;
    const count = player.chain;
    if (count >= 4) {
      player.metrics.deliveries = (player.metrics.deliveries ?? 0) + 1;
      if (now - (player.lastDeliveryAt || this.practice.startedAt!) <= 10000)
        player.metrics.promptDeliveries = (player.metrics.promptDeliveries ?? 0) + 1;
    }
    player.lastDeliveryAt = now;
    this.practice.savedDucks += count;
    this.practice.longestChain = Math.max(this.practice.longestChain, count);
    player.metrics.savedDucks = (player.metrics.savedDucks ?? 0) + count;
    player.metrics.deliveredChain = Math.max(player.metrics.deliveredChain ?? 0, count);
    player.metricSequence++;
    player.chain = 0;
    this.options.onEvent?.(player.id, { type: 'event', event: 'saved', amount: count });
    if (this.practice.savedDucks < 12) return;
    const rawTimeMs = Math.max(0, now - this.practice.startedAt!);
    const chainBonusMs = this.practice.longestChain * 500;
    const finalTimeMs = Math.max(0, rawTimeMs - chainBonusMs);
    const result: PracticeResult = {
      runId: this.practice.runId,
      levelId: 'fun-01',
      rawTimeMs,
      finalTimeMs,
      chainBonusMs,
      totalDucks: 12,
      savedDucks: 12,
      longestChain: this.practice.longestChain,
      medal: finalTimeMs <= 25000 ? 'gold' : finalTimeMs <= 40000 ? 'silver' : 'bronze',
    };
    this.practice.phase = 'complete';
    this.practice.elapsedMs = rawTimeMs;
    this.practice.result = result;
    player.metrics.practiceRuns = 1;
    player.metrics.practiceTimeMs = finalTimeMs;
    player.metrics.singleChainRuns = result.longestChain === 12 ? 1 : 0;
    player.metrics.efficientRescues = player.practiceDistance <= 120 ? 1 : 0;
    player.usedAvatars.add(player.skin);
    player.metricSequence++;
    player.input = { ...player.input, x: 0, z: 0, boost: false };
    this.options.onPracticeComplete?.(player.id, result);
  }
}
