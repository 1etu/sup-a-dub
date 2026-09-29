import {
  ENDLESS,
  PROTOCOL_VERSION,
  WORLD,
  type BodyState,
  type DuckState,
  type ObstacleState,
  type PelletState,
  type SharkState,
  type Vec2,
  type WorldSnapshot,
} from '@supadub/protocol';
import { publicPlayer, rounded } from './common';
import type { EndlessWorld } from './endless';
import { selectNearest } from './nearest';

type VisibleState<T> = Vec2 & { radius: number; state: T };
type FrameChunk = { ducks: DuckState[]; obstacles: ObstacleState[] };
export type SnapshotReader = (id: string, pelletLimit?: number) => WorldSnapshot;

export function createSnapshotFrame(world: EndlessWorld): SnapshotReader {
  const tick = world.tick;
  const time = world.time;
  const players = [...world.players.values()].map(publicPlayer);
  const playerPositions = new Map(
    [...world.players.values()].map((player) => [player.id, { x: player.x, z: player.z }]),
  );
  const anchorsByOwner = new Map<string, Array<Vec2 & { radius: number }>>();
  const bodies: Array<VisibleState<BodyState>> = [];
  for (const body of world.bodies.values()) {
    const { id, ownerId, mass, radius, skin, launchUntil, mergeAt, protectedUntil } = body;
    const anchor = { x: body.x, z: body.z, radius };
    const owned = anchorsByOwner.get(ownerId);
    if (owned) owned.push(anchor);
    else anchorsByOwner.set(ownerId, [anchor]);
    bodies.push({
      ...anchor,
      state: {
        id,
        ownerId,
        mass,
        radius,
        skin,
        launchUntil,
        mergeAt,
        protectedUntil,
        angle: rounded(body.angle),
        x: rounded(body.x),
        z: rounded(body.z),
        vx: rounded(body.vx),
        vz: rounded(body.vz),
      },
    });
  }
  const pellets: Array<VisibleState<PelletState>> = [...world.pellets.values()].map((pellet) => {
    const { id, ownerId, x, z, vx, vz, mass } = pellet;
    return {
      x,
      z,
      radius: 0,
      state: { id, ownerId, x: rounded(x), z: rounded(z), vx: rounded(vx), vz: rounded(vz), mass },
    };
  });
  const sharks: Array<VisibleState<SharkState>> = [...world.sharks.values()].map((shark) => {
    const { id, x, z, vx, vz, mass, radius, feedCount, launchUntil } = shark;
    return {
      x,
      z,
      radius,
      state: {
        id,
        x: rounded(x),
        z: rounded(z),
        vx: rounded(vx),
        vz: rounded(vz),
        mass,
        radius,
        feedCount,
        launchUntil,
      },
    };
  });
  const chunks = new Map<string, FrameChunk>();
  for (const chunk of world.chunks.values())
    chunks.set(chunk.key, { ducks: [...chunk.ducks.values()], obstacles: [...chunk.obstacles] });
  const leaderboard = players
    .filter((player) => player.alive)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((player) => ({ id: player.id, name: player.name, score: player.score, bot: player.bot }));
  const online = players.filter((player) => !player.bot).length;

  return (id, pelletLimit = ENDLESS.maxPellets) => {
    const viewer = playerPositions.get(id);
    const anchors = anchorsByOwner.get(id) ?? (viewer ? [{ ...viewer, radius: 0 }] : []);
    const reach = anchors.map((anchor) => ({ ...anchor, radius: WORLD.interestRadius + anchor.radius }));
    const nearby = (point: Vec2, radius = 0) => {
      for (const anchor of reach) {
        const dx = point.x - anchor.x;
        const dz = point.z - anchor.z;
        const range = anchor.radius + radius;
        if (dx * dx + dz * dz <= range * range) return true;
      }
      return false;
    };
    const visibleBodies = bodies.filter((body) => body.state.ownerId === id || nearby(body, body.radius));
    const ownerIds = new Set(visibleBodies.map((body) => body.state.ownerId));
    ownerIds.add(id);
    const visibleChunks = new Map<string, FrameChunk>();
    for (const anchor of reach)
      for (
        let x = Math.floor((anchor.x - anchor.radius) / WORLD.chunkSize);
        x <= Math.floor((anchor.x + anchor.radius) / WORLD.chunkSize);
        x++
      )
        for (
          let z = Math.floor((anchor.z - anchor.radius) / WORLD.chunkSize);
          z <= Math.floor((anchor.z + anchor.radius) / WORLD.chunkSize);
          z++
        ) {
          const key = `${x}:${z}`;
          const chunk = chunks.get(key);
          if (chunk) visibleChunks.set(key, chunk);
        }
    const ducks: DuckState[] = [];
    const obstacles: ObstacleState[] = [];
    for (const chunk of visibleChunks.values()) {
      for (const duck of chunk.ducks) if (nearby(duck)) ducks.push(duck);
      for (const wall of chunk.obstacles) if (nearby(wall, 16)) obstacles.push(wall);
    }
    const visiblePellets = pellets.filter((pellet) => nearby(pellet)).map((pellet) => pellet.state);
    const center = players.find((player) => player.id === id) ?? { x: 0, z: 0 };
    return {
      type: 'snapshot',
      protocolVersion: PROTOCOL_VERSION,
      tick,
      time,
      mode: 'endless',
      exits: [],
      bounds: null,
      practice: null,
      players: players.filter((player) => ownerIds.has(player.id)),
      ducks: selectNearest(ducks, 2048, (duck) => {
        let distance = Infinity;
        for (const anchor of anchors)
          distance = Math.min(distance, (duck.x - anchor.x) ** 2 + (duck.z - anchor.z) ** 2);
        return distance;
      }),
      obstacles: obstacles.slice(0, 256),
      leaderboard,
      online,
      bodies: visibleBodies.map((body) => body.state),
      pellets: selectNearest(
        visiblePellets,
        pelletLimit,
        (pellet) => (pellet.x - center.x) ** 2 + (pellet.z - center.z) ** 2,
      ),
      sharks: sharks.filter((shark) => nearby(shark, shark.radius)).map((shark) => shark.state),
    };
  };
}
