import { WORLD, type DuckState, type ObstacleState, type Vec2 } from '@supadub/protocol';
import { seededRandom } from './common';

export function chunkCoordinates(position: Vec2): Vec2 {
  return { x: Math.floor(position.x / WORLD.chunkSize), z: Math.floor(position.z / WORLD.chunkSize) };
}

export function createChunkObjects(
  x: number,
  z: number,
  seed = 731,
): { ducks: DuckState[]; obstacles: ObstacleState[] } {
  const random = seededRandom(Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed);
  const originX = x * WORLD.chunkSize;
  const originZ = z * WORLD.chunkSize;
  const obstacles: ObstacleState[] = [];
  if (Math.abs(x) + Math.abs(z) > 1 && random() > 0.5) {
    const horizontal = random() > 0.5;
    obstacles.push({
      id: `wall:${x}:${z}`,
      x: originX + 32,
      z: originZ + 32,
      width: horizontal ? 18 + random() * 6 : 2,
      depth: horizontal ? 2 : 18 + random() * 6,
    });
  }
  const ducks: DuckState[] = [];
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const duck = {
        id: `duck:${x}:${z}:${row * 8 + column}`,
        x: originX + column * 8 + 2 + random() * 4,
        z: originZ + row * 8 + 2 + random() * 4,
      };
      const wall = obstacles[0];
      if (
        wall &&
        Math.abs(duck.x - wall.x) < wall.width / 2 + 1 &&
        Math.abs(duck.z - wall.z) < wall.depth / 2 + 1
      )
        continue;
      ducks.push(duck);
    }
  }
  if (x === 0 && z === 0) {
    for (let index = 0; index < 12; index++) {
      const angle = (index * Math.PI) / 6;
      ducks.push({ id: `duck:welcome:${index}`, x: Math.cos(angle) * 6, z: Math.sin(angle) * 6 });
    }
  }
  return {
    ducks: ducks.map((duck) => ({
      ...duck,
      x: Math.round(duck.x * 1000) / 1000,
      z: Math.round(duck.z * 1000) / 1000,
    })),
    obstacles,
  };
}
