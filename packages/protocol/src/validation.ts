import { PRACTICE, type PracticeResult, type PracticeState, type PoolBounds } from './wire-types';

export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '')
    .trim();
  if (name.length < 1 || name.length > 20) return null;
  return name;
}

export function cleanChat(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim();
  if (!text || [...text].length > 240 || new TextEncoder().encode(text).length > 768) return null;
  return text;
}

export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function finite(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return finite(value, minimum, maximum) && Number.isSafeInteger(value);
}

export function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9:_.-]{1,128}$/.test(value);
}

export function position(value: Record<string, unknown>): boolean {
  return finite(value.x, -1e7, 1e7) && finite(value.z, -1e7, 1e7);
}

export function named(value: Record<string, unknown>): boolean {
  return identifier(value.id) && typeof value.name === 'string' && cleanName(value.name) === value.name;
}

export function list(
  value: unknown,
  limit: number,
  validate: (entry: Record<string, unknown>) => boolean,
): value is Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > limit) return false;
  const ids = new Set<string>();
  for (const entry of value) {
    if (!object(entry) || !validate(entry)) return false;
    if (typeof entry.id === 'string') {
      if (ids.has(entry.id)) return false;
      ids.add(entry.id);
    }
  }
  return true;
}

export function practiceResult(value: unknown): value is PracticeResult {
  if (!object(value) || !identifier(value.runId) || !identifier(value.levelId)) return false;
  if (!integer(value.rawTimeMs, 0, 7 * 86400000) || !integer(value.finalTimeMs, 0, 7 * 86400000))
    return false;
  if (
    value.totalDucks !== PRACTICE.totalDucks ||
    value.savedDucks !== value.totalDucks ||
    !integer(value.longestChain, 1, PRACTICE.totalDucks)
  )
    return false;
  if (
    value.chainBonusMs !== value.longestChain * 500 ||
    value.finalTimeMs !== Math.max(0, value.rawTimeMs - value.chainBonusMs)
  )
    return false;
  return value.medal === 'gold' || value.medal === 'silver' || value.medal === 'bronze';
}

export function practiceState(value: unknown): value is PracticeState {
  if (!object(value) || !identifier(value.runId) || !identifier(value.levelId)) return false;
  if (
    value.totalDucks !== PRACTICE.totalDucks ||
    !integer(value.savedDucks, 0, PRACTICE.totalDucks) ||
    !integer(value.longestChain, 0, value.savedDucks)
  )
    return false;
  if (!integer(value.elapsedMs, 0, 7 * 86400000)) return false;
  if (value.phase === 'ready')
    return (
      value.startedAt === null && value.elapsedMs === 0 && value.savedDucks === 0 && value.result === null
    );
  if (!integer(value.startedAt)) return false;
  if (value.phase === 'playing') return value.savedDucks < PRACTICE.totalDucks && value.result === null;
  return (
    value.phase === 'complete' &&
    practiceResult(value.result) &&
    value.result.runId === value.runId &&
    value.result.levelId === value.levelId &&
    value.result.savedDucks === value.savedDucks &&
    value.result.longestChain === value.longestChain &&
    value.result.rawTimeMs === value.elapsedMs
  );
}

export function bounds(value: unknown): value is PoolBounds {
  return (
    object(value) &&
    finite(value.minX, -1e7, 1e7) &&
    finite(value.maxX, -1e7, 1e7) &&
    finite(value.minZ, -1e7, 1e7) &&
    finite(value.maxZ, -1e7, 1e7) &&
    value.minX < value.maxX &&
    value.minZ < value.maxZ
  );
}
