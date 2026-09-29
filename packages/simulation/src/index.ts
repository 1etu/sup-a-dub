import type { Metrics } from '@supadub/achievements';
import { validLoadout, type Loadout } from '@supadub/cosmetics';
import {
  type ActionMessage,
  type InputMessage,
  type PlayerRole,
  type Skin,
  type Vec2,
} from '@supadub/protocol';
import { EndlessWorld } from './endless';
import { PracticeWorld } from './practice';
import type { SimBody, SimPellet, SimShark, SimulationPlayer, WorldOptions } from './types';
import type { SnapshotReader } from './snapshot-frame';
export { seededRandom, collideObstacles, sweptDistance } from './common';
export { createChunkObjects, chunkCoordinates } from './chunks';
export type { SimulationPlayer, WorldOptions, SimBody, SimPellet, SimShark } from './types';
export type { SnapshotReader } from './snapshot-frame';

export class GameWorld {
  readonly implementation: EndlessWorld | PracticeWorld;
  constructor(options: WorldOptions = {}) {
    this.implementation =
      options.mode === 'practice' ? new PracticeWorld(options) : new EndlessWorld(options);
  }
  get players() {
    return this.implementation.players;
  }
  get chunks() {
    return this.implementation.chunks;
  }
  get bodies(): Map<string, SimBody> {
    return this.implementation instanceof EndlessWorld ? this.implementation.bodies : new Map();
  }
  get pellets(): Map<string, SimPellet> {
    return this.implementation instanceof EndlessWorld ? this.implementation.pellets : new Map();
  }
  get sharks(): Map<string, SimShark> {
    return this.implementation instanceof EndlessWorld ? this.implementation.sharks : new Map();
  }
  get mode() {
    return this.implementation.mode;
  }
  get bounds() {
    return this.implementation.bounds;
  }
  get exits() {
    return this.implementation.exits;
  }
  get practice() {
    return this.implementation.practice;
  }
  get seed() {
    return this.implementation.seed;
  }
  get maxChunks() {
    return this.implementation.maxChunks;
  }
  get tick() {
    return this.implementation.tick;
  }
  get time() {
    return this.implementation.time;
  }
  addPlayer(id: string, name: string, skin: Skin, now: number, position?: Vec2, bot = false) {
    return this.implementation.addPlayer(id, name, skin, now, position, bot);
  }
  removePlayer(id: string) {
    return this.implementation.removePlayer(id);
  }
  setInput(id: string, input: InputMessage, now: number) {
    return this.implementation.setInput(id, input, now);
  }
  action(id: string, message: ActionMessage, now: number) {
    return this.implementation.action(id, message, now);
  }
  restartPractice(id: string, runId: string, now: number) {
    return this.implementation.restartPractice(id, runId, now);
  }
  step(deltaSeconds: number, now: number) {
    this.implementation.step(deltaSeconds, now);
  }
  snapshot(id: string) {
    return this.implementation.snapshot(id);
  }
  prepareSnapshots(): SnapshotReader {
    return this.implementation instanceof EndlessWorld
      ? this.implementation.prepareSnapshots()
      : (id) => this.implementation.snapshot(id);
  }
  setIdentity(id: string, identityId: string, role: PlayerRole): void {
    const player = this.players.get(id);
    if (player) {
      player.identityId = identityId;
      player.role = role;
    }
  }
  setSkin(id: string, skin: Skin): void {
    const player = this.players.get(id);
    if (!player) return;
    this.observeAvatar(player);
    player.skin = skin;
    if (player.loadout.avatar !== skin) player.appearanceSince = this.time;
    player.loadout = { ...player.loadout, avatar: skin };
    for (const body of this.bodies.values()) if (body.ownerId === id) body.skin = skin;
  }
  setLoadout(id: string, loadout: Loadout): void {
    if (!validLoadout(loadout)) return;
    this.setSkin(id, loadout.avatar);
    const player = this.players.get(id);
    if (player) player.loadout = { ...loadout, emotes: [...loadout.emotes] };
  }
  setController(id: string, epoch: number): void {
    const player = this.players.get(id);
    if (!player) return;
    player.controlEpoch = epoch;
    player.lastInputSeq = 0;
    player.lastActionSeq = -1;
    player.actionResults.clear();
    player.input = { type: 'input', seq: 0, x: 0, z: 0, boost: false, controlEpoch: epoch };
  }
  private observeAvatar(player: SimulationPlayer): void {
    if (!player.alive || player.usedAvatars.has(player.skin)) return;
    const practice = this.practice;
    if (this.mode === 'practice' && practice?.phase !== 'playing') return;
    const activeSince = Math.max(player.appearanceSince, practice?.startedAt ?? player.startedAt);
    if (this.time - activeSince < 10000) return;
    player.usedAvatars.add(player.skin);
    player.metricSequence++;
  }
  metrics(id: string): {
    runId: string;
    startedAt: number;
    sequence: number;
    metrics: Metrics;
    mode: 'practice' | 'endless';
    avatars: Skin[];
  } | null {
    const player = this.players.get(id);
    if (player) this.observeAvatar(player);
    return player
      ? {
          runId: player.runId,
          startedAt: player.startedAt,
          sequence: player.metricSequence,
          metrics: { ...player.metrics },
          mode: this.mode,
          avatars: [...player.usedAvatars],
        }
      : null;
  }
}
