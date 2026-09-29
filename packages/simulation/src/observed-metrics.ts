import { WORLD } from '@supadub/protocol';
import type { EndlessWorld } from './endless';
import type { SimulationPlayer, SimBody } from './types';

export const OBSERVATION_CHUNK_LIMIT = 256;

export function observeTravel(
  world: EndlessWorld,
  player: SimulationPlayer,
  distance: number,
  bodies: readonly SimBody[],
): void {
  if (player.bot || !bodies.length) return;
  for (const body of bodies) {
    if (player.chartedChunks.size < OBSERVATION_CHUNK_LIMIT)
      player.chartedChunks.add(
        `${Math.floor(body.x / WORLD.chunkSize)}:${Math.floor(body.z / WORLD.chunkSize)}`,
      );
    world.maxMetric(player, 'farthestDistance', Math.hypot(body.x - player.spawnX, body.z - player.spawnZ));
  }
  world.maxMetric(player, 'chartedChunks', player.chartedChunks.size);
  if (bodies.length >= 4) {
    if (distance > 0) world.addMetric(player, 'flockDistance', distance);
    world.maxMetric(player, 'balancedBodyMass', Math.min(...bodies.map((body) => body.mass)));
  }
  if (
    distance > 0 &&
    [player.loadout.head, player.loadout.face, player.loadout.neck].filter(Boolean).length >= 2
  )
    world.addMetric(player, 'adornedDistance', distance);
}

export function observeFeedingChunk(world: EndlessWorld, player: SimulationPlayer, key: string): void {
  if (player.bot || player.feedingChunks.size >= OBSERVATION_CHUNK_LIMIT) return;
  player.feedingChunks.add(key);
  world.maxMetric(player, 'feedingChunks', player.feedingChunks.size);
}
