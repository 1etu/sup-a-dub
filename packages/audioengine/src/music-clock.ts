export function musicBoundary(
  origin: number,
  bpm: number,
  beats: number,
  index: number,
  sampleRate = 48000,
): number {
  return Math.round((origin + (index * beats * 60) / bpm) * sampleRate) / sampleRate;
}

export function nextMusicBoundary(
  origin: number,
  now: number,
  bpm: number,
  beats: number,
  sampleRate = 48000,
): number {
  const index = Math.max(0, Math.ceil(((now - origin) * bpm) / (beats * 60) - 1e-8));
  return musicBoundary(origin, bpm, beats, index, sampleRate);
}
