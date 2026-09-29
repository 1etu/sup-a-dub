import { WORLD, type DuckState, type Vec2, type WorldSnapshot } from '@supadub/protocol';

const capacity = 1200;
type Collector = Vec2 & { id: string; radius: number };

function collectors(snapshot: WorldSnapshot): Collector[] {
  return snapshot.mode === 'practice'
    ? snapshot.players.map((player) => ({ ...player, radius: WORLD.playerRadius }))
    : (snapshot.bodies ?? []);
}

function distanceToPath(point: Vec2, start: Vec2, end: Vec2): number {
  const x = end.x - start.x,
    z = end.z - start.z;
  const length = x * x + z * z;
  const fraction = length
    ? Math.max(0, Math.min(1, ((point.x - start.x) * x + (point.z - start.z) * z) / length))
    : 0;
  return Math.hypot(point.x - start.x - x * fraction, point.z - start.z - z * fraction);
}

export class BubbleRemovals {
  private previous: WorldSnapshot | null = null;

  update(snapshot: WorldSnapshot, selfId: string): DuckState[] {
    const previous = this.previous;
    this.previous = snapshot;
    if (
      !previous ||
      previous.mode !== snapshot.mode ||
      snapshot.time <= previous.time ||
      snapshot.time - previous.time > 1000 ||
      previous.practice?.runId !== snapshot.practice?.runId
    )
      return [];
    const currentIds = new Set(snapshot.ducks.map((duck) => duck.id));
    const current = collectors(snapshot);
    const starts = new Map(collectors(previous).map((body) => [body.id, body]));
    const anchors = snapshot.bodies?.filter((body) => body.ownerId === selfId) ?? [];
    const popped: DuckState[] = [];
    for (const duck of previous.ducks.slice(0, capacity)) {
      if (currentIds.has(duck.id)) continue;
      if (
        snapshot.mode === 'endless' &&
        !anchors.some(
          (anchor) =>
            Math.hypot(duck.x - anchor.x, duck.z - anchor.z) < WORLD.interestRadius + anchor.radius - 2,
        )
      )
        continue;
      if (
        !current.some((body) => {
          const start = starts.get(body.id) ?? body;
          if (Math.hypot(body.x - start.x, body.z - start.z) > 20) return false;
          return distanceToPath(duck, start, body) <= Math.max(start.radius, body.radius) + 0.65;
        })
      )
        continue;
      popped.push(duck);
      if (popped.length === 32) break;
    }
    return popped;
  }

  clear(): void {
    this.previous = null;
  }
}
