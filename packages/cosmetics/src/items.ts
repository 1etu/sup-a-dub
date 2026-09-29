import { COSMETICS } from './catalog';
import {
  HEAD_ITEMS,
  FACE_ITEMS,
  NECK_ITEMS,
  WAKE_ITEMS,
  EMOTE_ITEMS,
  CELEBRATION_ITEMS,
  type CosmeticKind,
  type ExtraDefinition,
  type ItemDefinition,
} from './types';

function group<K extends Exclude<CosmeticKind, 'avatar'>>(
  kind: K,
  ids: readonly string[],
  names: readonly string[],
  color: string,
  accentColor: string,
): ExtraDefinition<K>[] {
  return ids.map(
    (id, index) =>
      Object.freeze({
        id,
        kind,
        name: names[index]!,
        description:
          index === 0 ? 'A starter item for your collection.' : 'Earn this item through an achievement.',
        starter: index === 0,
        color,
        accentColor,
      }) as ExtraDefinition<K>,
  );
}

export const EXTRAS: readonly ExtraDefinition[] = Object.freeze([
  ...group(
    'head',
    HEAD_ITEMS,
    [
      'Sail Cap',
      'Bucket Hat',
      'Bubble Crown',
      'Flower',
      'Propeller Cap',
      'Diver Helmet',
      'Captain Hat',
      'Party Hat',
    ],
    '#edf3f5',
    '#447ead',
  ),
  ...group(
    'face',
    FACE_ITEMS,
    ['Round Glasses', 'Swim Goggles', 'Sunglasses', 'Star Glasses', 'Monocle', 'Sleep Mask'],
    '#426c96',
    '#a7dcec',
  ),
  ...group(
    'neck',
    NECK_ITEMS,
    ['Bandana', 'Bow Tie', 'Scarf', 'Life Ring', 'Medallion', 'Flower Lei'],
    '#e5758e',
    '#ffe4ad',
  ),
  ...group(
    'wake',
    WAKE_ITEMS,
    ['Soft Rings', 'Bubble Trail', 'Star Trail', 'Heart Trail', 'Rainbow Trail', 'Sparkle Trail'],
    '#bcecf1',
    '#edb4d9',
  ),
  ...group('emote', EMOTE_ITEMS, ['Wave', 'Love', 'Laugh', 'Wow', 'Cheer', 'Splash'], '#ffdb63', '#f291a7'),
  ...group(
    'celebration',
    CELEBRATION_ITEMS,
    ['Confetti', 'Star Shower', 'Bubble Shower', 'Fireworks'],
    '#f6d870',
    '#7ad7dd',
  ),
]);
export const ITEMS: readonly ItemDefinition[] = Object.freeze([...COSMETICS, ...EXTRAS]);
export const allCosmetics = ITEMS;
export const STARTER_ITEMS = Object.freeze(ITEMS.filter((item) => item.starter).map((item) => item.id));
