import type { BodyState, DuckState, ObstacleState, PelletState, SharkState, WorldSnapshot } from './index';

export type EntityPatch<T extends { id: string }> = { upsert: T[]; remove: string[] };
export type SnapshotDelta = Omit<
  WorldSnapshot,
  'type' | 'bodies' | 'ducks' | 'pellets' | 'sharks' | 'obstacles'
> & {
  type: 'snapshot-delta';
  baseTick: number;
  bodies: EntityPatch<BodyState>;
  ducks: EntityPatch<DuckState>;
  pellets: EntityPatch<PelletState>;
  sharks: EntityPatch<SharkState>;
  obstacles: EntityPatch<ObstacleState>;
};

function difference<T extends { id: string }>(previous: readonly T[], current: readonly T[]): EntityPatch<T> {
  const old = new Map(previous.map((entry) => [entry.id, entry]));
  const upsert: T[] = [];
  for (const entry of current) {
    const existing = old.get(entry.id);
    let changed = !existing;
    if (existing && existing !== entry)
      for (const key in entry)
        if (entry[key] !== existing[key]) {
          changed = true;
          break;
        }
    if (changed) upsert.push(entry);
    old.delete(entry.id);
  }
  return { upsert, remove: [...old.keys()] };
}

export function snapshotDelta(previous: WorldSnapshot, current: WorldSnapshot): SnapshotDelta {
  return {
    ...current,
    type: 'snapshot-delta',
    baseTick: previous.tick,
    bodies: difference(previous.bodies ?? [], current.bodies ?? []),
    ducks: difference(previous.ducks, current.ducks),
    pellets: difference(previous.pellets ?? [], current.pellets ?? []),
    sharks: difference(previous.sharks ?? [], current.sharks ?? []),
    obstacles: difference(previous.obstacles, current.obstacles),
  };
}

function apply<T extends { id: string }>(
  previous: readonly T[],
  patch: EntityPatch<T>,
  limit: number,
): T[] | null {
  const entries = new Map(previous.map((entry) => [entry.id, entry]));
  const touched = new Set<string>();
  for (const id of patch.remove) {
    if (touched.has(id)) return null;
    touched.add(id);
    entries.delete(id);
  }
  for (const entry of patch.upsert) {
    if (touched.has(entry.id)) return null;
    touched.add(entry.id);
    entries.set(entry.id, entry);
  }
  return entries.size <= limit ? [...entries.values()] : null;
}

export function applySnapshotDelta(
  previous: WorldSnapshot | null,
  delta: SnapshotDelta,
): WorldSnapshot | null {
  if (
    !previous ||
    delta.baseTick !== previous.tick ||
    delta.tick <= previous.tick ||
    delta.mode !== previous.mode
  )
    return null;
  const bodies = apply(previous.bodies ?? [], delta.bodies, 2144);
  const ducks = apply(previous.ducks, delta.ducks, 2048);
  const pellets = apply(previous.pellets ?? [], delta.pellets, 4096);
  const sharks = apply(previous.sharks ?? [], delta.sharks, 64);
  const obstacles = apply(previous.obstacles, delta.obstacles, 256);
  if (!bodies || !ducks || !pellets || !sharks || !obstacles) return null;
  const { baseTick, ...rest } = delta;
  return { ...rest, type: 'snapshot', bodies, ducks, pellets, sharks, obstacles };
}
