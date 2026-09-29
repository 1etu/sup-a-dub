export function selectNearest<T>(values: readonly T[], limit: number, distance: (value: T) => number): T[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('The selection limit is invalid.');
  if (values.length <= limit) return [...values];
  if (!limit) return [];
  const distances = new Array<number>(values.length);
  const heap: number[] = [];
  const worse = (a: number, b: number) =>
    distances[a]! > distances[b]! || (distances[a] === distances[b] && a > b);
  for (let index = 0; index < values.length; index++) {
    distances[index] = distance(values[index]!);
    if (heap.length < limit) {
      let slot = heap.length;
      heap.push(index);
      while (slot > 0) {
        const parent = (slot - 1) >> 1;
        if (!worse(heap[slot]!, heap[parent]!)) break;
        [heap[parent], heap[slot]] = [heap[slot]!, heap[parent]!];
        slot = parent;
      }
      continue;
    }
    if (!worse(heap[0]!, index)) continue;
    heap[0] = index;
    let slot = 0;
    while (slot * 2 + 1 < heap.length) {
      const left = slot * 2 + 1;
      const right = left + 1;
      const child = right < heap.length && worse(heap[right]!, heap[left]!) ? right : left;
      if (!worse(heap[child]!, heap[slot]!)) break;
      [heap[slot], heap[child]] = [heap[child]!, heap[slot]!];
      slot = child;
    }
  }
  return heap.sort((a, b) => distances[a]! - distances[b]! || a - b).map((index) => values[index]!);
}
