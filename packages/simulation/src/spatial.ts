export type IndexedBody = {
  id: string;
  x: number;
  z: number;
  radius: number;
  previousX?: number;
  previousZ?: number;
};

export class SpatialIndex<T extends IndexedBody> {
  private readonly bins = new Map<string, T[]>();
  constructor(private readonly size = 32) {}

  rebuild(values: Iterable<T>): void {
    this.bins.clear();
    for (const value of values) {
      const lowX = Math.floor((Math.min(value.x, value.previousX ?? value.x) - value.radius) / this.size);
      const highX = Math.floor((Math.max(value.x, value.previousX ?? value.x) + value.radius) / this.size);
      const lowZ = Math.floor((Math.min(value.z, value.previousZ ?? value.z) - value.radius) / this.size);
      const highZ = Math.floor((Math.max(value.z, value.previousZ ?? value.z) + value.radius) / this.size);
      for (let x = lowX; x <= highX; x++)
        for (let z = lowZ; z <= highZ; z++) {
          const key = `${x}:${z}`;
          const list = this.bins.get(key);
          if (list) list.push(value);
          else this.bins.set(key, [value]);
        }
    }
  }

  query(x: number, z: number, radius: number): Set<T> {
    const result = new Set<T>();
    for (let cx = Math.floor((x - radius) / this.size); cx <= Math.floor((x + radius) / this.size); cx++) {
      for (let cz = Math.floor((z - radius) / this.size); cz <= Math.floor((z + radius) / this.size); cz++) {
        for (const value of this.bins.get(`${cx}:${cz}`) ?? []) result.add(value);
      }
    }
    return result;
  }
}
