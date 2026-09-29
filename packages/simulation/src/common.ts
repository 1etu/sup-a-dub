import { WORLD, type InputMessage, type ObstacleState, type Skin, type Vec2 } from '@supadub/protocol';
import type { SimulationPlayer } from './types';
import { defaultLoadout } from '@supadub/cosmetics';

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPlayer(
  id: string,
  name: string,
  skin: Skin,
  now: number,
  position: Vec2,
  bot = false,
): SimulationPlayer {
  return {
    id,
    name,
    skin,
    loadout: defaultLoadout(skin),
    appearanceSince: now,
    usedAvatars: new Set(),
    spawnX: position.x,
    spawnZ: position.z,
    chartedChunks: new Set(),
    feedingChunks: new Set(),
    lostHumanBody: false,
    practiceDistance: 0,
    lastDeliveryAt: 0,
    ...position,
    angle: 0,
    score: 0,
    chain: 0,
    boosting: false,
    bot,
    protectedUntil: now + WORLD.protectionMs,
    lastInputSeq: 0,
    input: { type: 'input', seq: 0, x: 0, z: 0, boost: false },
    lastInputAt: now,
    totalCollected: 0,
    bestScore: 0,
    identityId: id,
    role: bot ? 'bot' : 'guest',
    runId: crypto.randomUUID(),
    controlEpoch: 1,
    startedAt: now,
    alive: true,
    metrics: {},
    metricSequence: 0,
    lastActionSeq: -1,
    splitReadyAt: 0,
    ejectReadyAt: 0,
    actionResults: new Map(),
    collectedAt: [],
    sharkSurvivalAt: [],
  };
}

export function applyInput(
  player: SimulationPlayer | undefined,
  input: InputMessage,
  now: number,
  requireEpoch: boolean,
): boolean {
  if (
    !player ||
    !player.alive ||
    input.seq <= player.lastInputSeq ||
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.z)
  )
    return false;
  if (requireEpoch && input.controlEpoch !== player.controlEpoch) return false;
  if (
    input.target &&
    (!Number.isFinite(input.target.x) ||
      !Number.isFinite(input.target.z) ||
      Math.hypot(input.target.x - player.x, input.target.z - player.z) > 256)
  )
    return false;
  const length = Math.max(1, Math.hypot(input.x, input.z));
  player.input = { ...input, x: input.x / length, z: input.z / length, boost: false };
  player.lastInputSeq = input.seq;
  player.lastInputAt = now;
  return true;
}

export function publicPlayer(player: SimulationPlayer): import('@supadub/protocol').PlayerState {
  return {
    id: player.id,
    name: player.name,
    skin: player.skin,
    loadout: { ...player.loadout, emotes: [...player.loadout.emotes] },
    x: rounded(player.x),
    z: rounded(player.z),
    angle: rounded(player.angle),
    score: player.score,
    chain: player.chain,
    boosting: false,
    bot: player.bot,
    protectedUntil: player.protectedUntil,
    lastInputSeq: player.lastInputSeq,
    totalMass: player.totalMass ?? player.score,
    bodyCount: player.bodyCount ?? 1,
    alive: player.alive,
    role: player.role,
    runId: player.runId,
  };
}

export function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function collideObstacles(
  position: Vec2,
  previous: Vec2,
  radius: number,
  obstacles: readonly ObstacleState[],
): Vec2 {
  let start = { ...previous };
  let end = { ...position };
  for (let pass = 0; pass < 3; pass++) {
    let hitTime = 1;
    let hitAxis: 'x' | 'z' | null = null;
    let hitSign = 0;
    for (const wall of obstacles) {
      const half = { x: wall.width / 2 + radius, z: wall.depth / 2 + radius };
      if (Math.abs(start.x - wall.x) < half.x && Math.abs(start.z - wall.z) < half.z) {
        const axis = half.x - Math.abs(start.x - wall.x) < half.z - Math.abs(start.z - wall.z) ? 'x' : 'z';
        const direction = Math.sign(start[axis] - wall[axis]) || Math.sign(previous[axis] - wall[axis]) || 1;
        start[axis] = wall[axis] + direction * (half[axis] + 0.001);
        end[axis] = start[axis];
      }
      let enter = -Infinity;
      let exit = Infinity;
      let axis: 'x' | 'z' = 'x';
      let sign = 0;
      for (const component of ['x', 'z'] as const) {
        const delta = end[component] - start[component];
        const low = wall[component] - half[component];
        const high = wall[component] + half[component];
        if (Math.abs(delta) < 1e-10) {
          if (start[component] <= low || start[component] >= high) {
            exit = -Infinity;
            break;
          }
          continue;
        }
        const near = (low - start[component]) / delta;
        const far = (high - start[component]) / delta;
        const first = Math.min(near, far);
        if (first > enter) {
          enter = first;
          axis = component;
          sign = delta > 0 ? -1 : 1;
        }
        exit = Math.min(exit, Math.max(near, far));
      }
      if (enter >= 0 && enter < hitTime && enter <= exit && exit >= 0) {
        hitTime = enter;
        hitAxis = axis;
        hitSign = sign;
      }
    }
    if (!hitAxis) return end;
    const contact = { x: start.x + (end.x - start.x) * hitTime, z: start.z + (end.z - start.z) * hitTime };
    contact[hitAxis] += hitSign * 0.001;
    end[hitAxis] = contact[hitAxis];
    start = contact;
  }
  return start;
}

export function sweptDistance(
  a: { x: number; z: number; previousX?: number; previousZ?: number },
  b: { x: number; z: number; previousX?: number; previousZ?: number },
): number {
  const x = (a.previousX ?? a.x) - (b.previousX ?? b.x);
  const z = (a.previousZ ?? a.z) - (b.previousZ ?? b.z);
  const dx = a.x - b.x - x;
  const dz = a.z - b.z - z;
  const length = dx * dx + dz * dz;
  const t = length > 0 ? Math.max(0, Math.min(1, -(x * dx + z * dz) / length)) : 0;
  return Math.hypot(x + dx * t, z + dz * t);
}
