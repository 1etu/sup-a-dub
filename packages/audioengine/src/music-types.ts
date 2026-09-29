import type { SchedulerDriver } from './types';

export const MUSIC_LAYERS = ['melody', 'harmony', 'bass', 'rhythm'] as const;
export type MusicLayer = (typeof MUSIC_LAYERS)[number];
export type MusicLayers = Readonly<Record<MusicLayer, number>>;
export type MusicQuality = 'normal' | 'low';
export type MusicCueOptions = Readonly<{ startChunk?: number }>;
export type MusicSample = Readonly<{
  url: string;
  sha256?: string;
  bytes: number;
  seconds: number;
  channels: 1 | 2;
}>;
export type MusicEncodings = Readonly<{ opus: MusicSample; aac: MusicSample }>;
export type MusicChunk = Readonly<{
  stems: Readonly<Record<MusicLayer, Readonly<Record<MusicQuality, MusicEncodings>>>>;
}>;
export type MusicCue = Readonly<{
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  barsPerChunk: number;
  seconds: number;
  chunks: readonly MusicChunk[];
}>;
export type MusicCatalog = readonly MusicCue[];
export type MusicConnection = Readonly<{
  context: BaseAudioContext;
  output: AudioNode;
  running(): boolean;
}>;
export type MusicControllerOptions = Readonly<{
  catalog: MusicCatalog;
  quality?: MusicQuality;
  scheduler?: SchedulerDriver;
  onError?: (error: unknown) => void;
}>;
export type SampleLease = Readonly<{
  buffer: AudioBuffer;
  retain(): SampleLease;
  release(): void;
}>;
export type SampleFetcher = (url: string, signal: AbortSignal) => Promise<ArrayBuffer>;

export function validMusicCatalog(catalog: unknown): catalog is MusicCatalog {
  if (!Array.isArray(catalog) || catalog.length < 1 || catalog.length > 16) return false;
  const ids = new Set<string>();
  for (const cue of catalog) {
    if (!cue || typeof cue !== 'object' || typeof cue.id !== 'string' || !Array.isArray(cue.chunks))
      return false;
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(cue.id) || ids.has(cue.id)) return false;
    ids.add(cue.id);
    if (
      !Number.isFinite(cue.bpm) ||
      cue.bpm < 80 ||
      cue.bpm > 180 ||
      cue.beatsPerBar !== 4 ||
      cue.barsPerChunk !== 4
    )
      return false;
    if (
      !Number.isFinite(cue.seconds) ||
      cue.seconds < 1 ||
      cue.seconds > 180 ||
      cue.chunks.length < 1 ||
      cue.chunks.length > 24
    )
      return false;
    for (const chunk of cue.chunks)
      for (const layer of MUSIC_LAYERS)
        for (const quality of ['normal', 'low'] as const)
          for (const codec of ['opus', 'aac'] as const) {
            const sample = chunk?.stems?.[layer]?.[quality]?.[codec];
            if (
              !sample ||
              typeof sample.url !== 'string' ||
              !sample.url.startsWith('/assets/') ||
              sample.url.includes('..') ||
              sample.url.startsWith('//') ||
              sample.url.length > 300 ||
              !Number.isInteger(sample.bytes) ||
              sample.bytes < 1 ||
              sample.bytes > 2_097_152
            )
              return false;
            if (
              !Number.isFinite(sample.seconds) ||
              sample.seconds <= 0 ||
              sample.seconds > 12.5 ||
              ![1, 2].includes(sample.channels)
            )
              return false;
            if (sample.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(sample.sha256)) return false;
          }
  }
  return true;
}
