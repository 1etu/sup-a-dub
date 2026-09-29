import { COSMETICS } from './catalog';
import { STARTER_SKINS, type Skin, type CosmeticDefinition } from './types';
import { ITEMS } from './items';
import type { CosmeticId, CosmeticKind, ItemDefinition, Loadout, EquipRequest } from './types';
export * from './catalog';
export * from './types';
export * from './items';

const byId = new Map(COSMETICS.map((item) => [item.id, item]));
const itemsById = new Map(ITEMS.map((item) => [item.id, item]));

export function getItem(value: string): ItemDefinition | undefined {
  return itemsById.get(value as CosmeticId);
}

export function isCosmetic(value: unknown, kind?: CosmeticKind): value is CosmeticId {
  if (typeof value !== 'string') return false;
  const item = getItem(value);
  return !!item && (kind === undefined || item.kind === kind);
}

export function defaultLoadout(avatar: Skin = 'yellow'): Loadout {
  return {
    avatar,
    head: null,
    face: null,
    neck: null,
    wake: null,
    celebration: null,
    emotes: ['emote-wave'],
  };
}

export function validLoadout(value: unknown): value is Loadout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const loadout = value as Record<string, unknown>;
  return (
    Object.keys(loadout).length === 7 &&
    isSkin(loadout.avatar) &&
    (['head', 'face', 'neck', 'wake', 'celebration'] as const).every(
      (slot) => loadout[slot] === null || isCosmetic(loadout[slot], slot),
    ) &&
    Array.isArray(loadout.emotes) &&
    loadout.emotes.length <= 4 &&
    new Set(loadout.emotes).size === loadout.emotes.length &&
    loadout.emotes.every((id) => isCosmetic(id, 'emote'))
  );
}

export function parseEquipRequest(value: unknown): EquipRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) return null;
  const revision = input.revision as number;
  if (input.slot === 'emotes') {
    if (
      !Array.isArray(input.itemIds) ||
      input.itemIds.length > 4 ||
      new Set(input.itemIds).size !== input.itemIds.length ||
      !input.itemIds.every((id) => isCosmetic(id, 'emote'))
    )
      return null;
    return { slot: 'emotes', itemIds: [...input.itemIds] as Loadout['emotes'], revision };
  }
  const slot = input.slot ?? 'avatar';
  if (
    slot !== 'avatar' &&
    slot !== 'head' &&
    slot !== 'face' &&
    slot !== 'neck' &&
    slot !== 'wake' &&
    slot !== 'celebration'
  )
    return null;
  if (input.itemId === null && slot !== 'avatar') return { slot, itemId: null, revision };
  return isCosmetic(input.itemId, slot) ? { slot, itemId: input.itemId, revision } : null;
}

export function isSkin(value: unknown): value is Skin {
  return typeof value === 'string' && byId.has(value as Skin);
}

export function cosmetic(value: string): CosmeticDefinition {
  return byId.get(value as Skin) ?? byId.get('yellow')!;
}

export function getCosmetic(
  value: string,
): (CosmeticDefinition & { body: string; bill: string; patternColor: string }) | undefined {
  const item = byId.get(value as Skin);
  return item
    ? { ...item, body: item.color, bill: item.beakColor, patternColor: item.accentColor }
    : undefined;
}

export function isStarterSkin(value: unknown): value is (typeof STARTER_SKINS)[number] {
  return typeof value === 'string' && (STARTER_SKINS as readonly string[]).includes(value);
}
