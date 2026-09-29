import { integer, object } from './validation';

export const CONTROL_ACTION_IDS = [
  'menu-up',
  'menu-down',
  'menu-left',
  'menu-right',
  'confirm',
  'account',
  'back',
  'pause',
  'move-up',
  'move-down',
  'move-left',
  'move-right',
  'practice-up',
  'practice-down',
  'split',
  'eject',
  'boost',
  'quack',
  'chat',
  'emote',
] as const;
export const CONTROL_PROFILES = ['xbox', 'playstation', 'nintendo', 'generic'] as const;
export const CONTROL_PREFERENCES_VERSION = 1;
export const CONTROL_PREFERENCES_MAX_BYTES = 16384;
export type ControlActionId = (typeof CONTROL_ACTION_IDS)[number];
export type ControlProfile = (typeof CONTROL_PROFILES)[number];
export type ControlBinding =
  | { kind: 'key'; code: string; ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }
  | { kind: 'mouse'; button: number }
  | { kind: 'button'; button: number }
  | { kind: 'axis'; axis: number; sign: -1 | 1 };
export type ControlBindingMap = Readonly<Record<string, readonly ControlBinding[]>>;
export type ControlPreferences = {
  version: 1;
  controller: ControlProfile | 'auto';
  handedness: 'right' | 'left';
  keyboard: ControlBindingMap;
  pads: Partial<Record<ControlProfile, ControlBindingMap>>;
};
export type ControlPreferencesResponse = { revision: number; preferences: ControlPreferences | null };
export type ControlPreferencesEdit = { revision: number; preferences: ControlPreferences };

const actions = new Set<string>(CONTROL_ACTION_IDS);
const profiles = new Set<string>(CONTROL_PROFILES);
const modifiers = ['ctrl', 'alt', 'shift', 'meta'] as const;
const keyPattern =
  /^(Key[A-Z]|Digit[0-9]|Numpad[A-Za-z0-9]+|F([1-9]|1[0-2])|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$/;
const knownKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
const revision = (value: unknown): value is number => integer(value, 0, Number.MAX_SAFE_INTEGER);

function parseBinding(value: unknown, keyboard: boolean): ControlBinding | null {
  if (!object(value)) return null;
  if (keyboard && value.kind === 'key') {
    if (
      !knownKeys(value, ['kind', 'code', ...modifiers]) ||
      typeof value.code !== 'string' ||
      value.code.length > 32 ||
      !keyPattern.test(value.code)
    )
      return null;
    const binding: Extract<ControlBinding, { kind: 'key' }> = { kind: 'key', code: value.code };
    for (const key of modifiers) {
      if (value[key] !== undefined && typeof value[key] !== 'boolean') return null;
      if (typeof value[key] === 'boolean') binding[key] = value[key];
    }
    return binding;
  }
  if (
    keyboard &&
    value.kind === 'mouse' &&
    knownKeys(value, ['kind', 'button']) &&
    integer(value.button, 0, 4)
  )
    return { kind: 'mouse', button: value.button };
  if (
    !keyboard &&
    value.kind === 'button' &&
    knownKeys(value, ['kind', 'button']) &&
    integer(value.button, 0, 31)
  )
    return { kind: 'button', button: value.button };
  if (
    !keyboard &&
    value.kind === 'axis' &&
    knownKeys(value, ['kind', 'axis', 'sign']) &&
    integer(value.axis, 0, 7) &&
    (value.sign === -1 || value.sign === 1)
  )
    return { kind: 'axis', axis: value.axis, sign: value.sign };
  return null;
}

function bindingId(binding: ControlBinding): string {
  if (binding.kind === 'key')
    return `key:${binding.code}:${modifiers.map((key) => Number(Boolean(binding[key]))).join('')}`;
  if (binding.kind === 'axis') return `axis:${binding.axis}:${binding.sign}`;
  return `${binding.kind}:${binding.button}`;
}

function parseMap(value: unknown, keyboard: boolean): ControlBindingMap | null {
  if (!object(value) || Object.keys(value).length > CONTROL_ACTION_IDS.length) return null;
  const result: Record<string, ControlBinding[]> = {};
  for (const [id, entries] of Object.entries(value)) {
    if (!actions.has(id) || !Array.isArray(entries) || entries.length > 2) return null;
    const bindings: ControlBinding[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const binding = parseBinding(entry, keyboard);
      if (!binding || seen.has(bindingId(binding))) return null;
      seen.add(bindingId(binding));
      bindings.push(binding);
    }
    result[id] = bindings;
  }
  return result;
}

export function parseControlPreferences(value: unknown): ControlPreferences | null {
  if (
    !object(value) ||
    !knownKeys(value, ['version', 'controller', 'handedness', 'keyboard', 'pads']) ||
    value.version !== CONTROL_PREFERENCES_VERSION ||
    typeof value.controller !== 'string' ||
    (value.controller !== 'auto' && !profiles.has(value.controller)) ||
    (value.handedness !== 'right' && value.handedness !== 'left') ||
    !object(value.pads) ||
    Object.keys(value.pads).length > CONTROL_PROFILES.length
  )
    return null;
  const keyboard = parseMap(value.keyboard, true);
  if (!keyboard) return null;
  const pads: ControlPreferences['pads'] = {};
  for (const [profile, entries] of Object.entries(value.pads)) {
    if (!profiles.has(profile)) return null;
    const mapping = parseMap(entries, false);
    if (!mapping) return null;
    pads[profile as ControlProfile] = mapping;
  }
  return {
    version: 1,
    controller: value.controller as ControlPreferences['controller'],
    handedness: value.handedness,
    keyboard,
    pads,
  };
}

export function parseControlPreferencesEdit(value: unknown): ControlPreferencesEdit | null {
  if (
    !object(value) ||
    !knownKeys(value, ['revision', 'preferences']) ||
    !revision(value.revision) ||
    value.revision === Number.MAX_SAFE_INTEGER
  )
    return null;
  const preferences = parseControlPreferences(value.preferences);
  return preferences ? { revision: value.revision, preferences } : null;
}

export function parseControlPreferencesResponse(value: unknown): ControlPreferencesResponse | null {
  if (!object(value) || !knownKeys(value, ['revision', 'preferences']) || !revision(value.revision))
    return null;
  if (value.preferences === null) return { revision: value.revision, preferences: null };
  const preferences = parseControlPreferences(value.preferences);
  return preferences ? { revision: value.revision, preferences } : null;
}
