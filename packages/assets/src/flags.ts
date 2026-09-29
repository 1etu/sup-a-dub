import manifest from '../flags/manifest.json';
export type CountryFlag = Readonly<{ code: string; name: string; path: string }>;
export const COUNTRY_FLAGS: readonly CountryFlag[] = Object.freeze(
  manifest.flags.map((flag) => Object.freeze(flag)),
);
const byCode = new Map(COUNTRY_FLAGS.map((flag) => [flag.code, flag]));
export function countryFlag(code: string | null | undefined): string | null {
  return typeof code === 'string' ? (byCode.get(code.toUpperCase())?.path ?? null) : null;
}
export function countryName(code: string | null | undefined): string | null {
  return typeof code === 'string' ? (byCode.get(code.toUpperCase())?.name ?? null) : null;
}
