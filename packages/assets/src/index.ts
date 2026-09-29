export { COUNTRY_FLAGS, countryFlag, countryName } from './flags';
export type { CountryFlag } from './flags';
export { RESULT_TIMING } from './presentation/result-timing';
export type { ResultTiming } from './presentation/result-timing';

export const ASSETS = Object.freeze({
  duck: '/assets/models/duck.glb',
  duckLods: '/assets/models/duck-lods.json',
  displayFont: '/fonts/supadub-display.ttf',
  numberFont: '/fonts/rajdhani-bold.ttf',
  fallbackFont: '/fonts/audiowide.ttf',
});

export type MedalTier = 'bronze' | 'silver' | 'gold';
export type RoleIcon = 'player' | 'guest' | 'bot' | 'admin' | 'moderator';
export type ModerationIcon = 'ban' | 'unban' | 'mute' | 'unmute' | 'inspect' | 'audit' | 'kick';

export function achievementIcon(id: string, tier: MedalTier): string {
  return `/assets/icons/achievements/${encodeURIComponent(id)}-${tier}.svg`;
}

export function cosmeticIcon(id: string): string {
  return `/assets/icons/cosmetics/${encodeURIComponent(id)}.svg`;
}

export function roleIcon(role: RoleIcon): string {
  return `/assets/icons/roles/${role}.svg`;
}

export function moderationIcon(action: ModerationIcon): string {
  return `/assets/icons/moderation/${action}.svg`;
}

export const POOL_COLORS = Object.freeze({
  blue: '#4187d1',
  lime: '#87e941',
  white: '#e9e8eb',
  pink: '#e36b9a',
  ceramic: '#c3cae8',
  sky: '#516da6',
  cloud: '#d1a7b0',
});
