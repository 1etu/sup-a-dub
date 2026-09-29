import type { Skin } from '@supadub/protocol';
import { isSkin } from '@supadub/cosmetics';
import type { GraphicsQuality, PoolTheme } from '@supadub/gameengine';

export type Settings = {
  name: string;
  skin: Skin;
  volume: number;
  muted: boolean;
  music: boolean;
  musicVolume?: number;
  effectsVolume?: number;
  ambienceVolume?: number;
  quality: GraphicsQuality;
  softness: boolean;
  reducedMotion: boolean;
  theme: PoolTheme;
  guestPracticeBest: number | null;
};

const defaults: Settings = {
  name: 'Ducky',
  skin: 'gold',
  volume: 0.6,
  muted: false,
  music: true,
  musicVolume: 0.75,
  effectsVolume: 1,
  ambienceVolume: 0.65,
  quality: 'auto',
  softness: true,
  reducedMotion: false,
  theme: 'blue',
  guestPracticeBest: null,
};

export function readSettings(): Settings {
  try {
    const data = JSON.parse(localStorage.getItem('supadub-settings') ?? '{}');
    const guestBest = Object.hasOwn(data, 'guestPracticeBest') ? data.guestPracticeBest : data.practiceBest;
    return {
      name: typeof data.name === 'string' && data.name.length <= 20 ? data.name : defaults.name,
      skin: isSkin(data.skin) ? data.skin : defaults.skin,
      volume:
        typeof data.volume === 'number' && Number.isFinite(data.volume)
          ? Math.max(0, Math.min(1, data.volume))
          : defaults.volume,
      muted: data.muted === true,
      music: data.music !== false,
      musicVolume: readGain(data.musicVolume, 0.75),
      effectsVolume: readGain(data.effectsVolume, 1),
      ambienceVolume: readGain(data.ambienceVolume, 0.65),
      quality: ['auto', 'high', 'low'].includes(data.quality) ? data.quality : defaults.quality,
      softness: data.softness !== false,
      reducedMotion:
        typeof data.reducedMotion === 'boolean'
          ? data.reducedMotion
          : matchMedia('(prefers-reduced-motion: reduce)').matches,
      theme: ['blue', 'hearts', 'stars', 'dots'].includes(data.theme) ? data.theme : 'blue',
      guestPracticeBest:
        typeof guestBest === 'number' && Number.isFinite(guestBest) && guestBest >= 0 ? guestBest : null,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem('supadub-settings', JSON.stringify(settings));
  } catch {}
}

function readGain(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
