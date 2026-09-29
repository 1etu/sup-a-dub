export const STARTER_SKINS = ['gold', 'yellow', 'pink', 'mint'] as const;
export const CATEGORY_SKINS = [
  'tangerine',
  'pearl',
  'lavender',
  'cobalt',
  'cherry',
  'bubblegum',
  'chrome',
  'starry',
] as const;
export const MASTERY_SKINS = ['koi', 'porcelain', 'sailor', 'copper'] as const;
export const EXPANSION_SKINS = [
  'lifeguard',
  'explorer',
  'mosaic',
  'lemon-sorbet',
  'speckled-egg',
  'peach-jelly',
  'tin-toy',
  'clockwork',
  'deep-sea',
  'fiesta',
  'aurora',
  'patchwork',
  'shark-blue',
  'shark-coral',
  'axolotl-rose',
  'axolotl-lime',
  'turtle-jade',
  'turtle-sand',
  'frog-pond',
  'frog-sunset',
  'whale-blue',
  'whale-lilac',
  'octopus-plum',
  'octopus-coral',
] as const;
export const EARNED_SKINS = [...CATEGORY_SKINS, ...MASTERY_SKINS, ...EXPANSION_SKINS] as const;
export const SKINS = [...STARTER_SKINS, ...EARNED_SKINS] as const;
export type Skin = (typeof SKINS)[number];
export const HEAD_ITEMS = [
  'head-sail-cap',
  'head-bucket',
  'head-crown',
  'head-flower',
  'head-propeller',
  'head-diver',
  'head-captain',
  'head-party',
] as const;
export const FACE_ITEMS = [
  'face-round-glasses',
  'face-goggles',
  'face-sunglasses',
  'face-star-glasses',
  'face-monocle',
  'face-sleep-mask',
] as const;
export const NECK_ITEMS = [
  'neck-bandana',
  'neck-bowtie',
  'neck-scarf',
  'neck-life-ring',
  'neck-medallion',
  'neck-flower-lei',
] as const;
export const WAKE_ITEMS = [
  'wake-rings',
  'wake-bubbles',
  'wake-stars',
  'wake-hearts',
  'wake-rainbow',
  'wake-sparkles',
] as const;
export const EMOTE_ITEMS = [
  'emote-wave',
  'emote-heart',
  'emote-laugh',
  'emote-wow',
  'emote-cheer',
  'emote-splash',
] as const;
export const CELEBRATION_ITEMS = [
  'celebration-confetti',
  'celebration-stars',
  'celebration-bubbles',
  'celebration-fireworks',
] as const;
export type HeadId = (typeof HEAD_ITEMS)[number];
export type FaceId = (typeof FACE_ITEMS)[number];
export type NeckId = (typeof NECK_ITEMS)[number];
export type WakeId = (typeof WAKE_ITEMS)[number];
export type EmoteId = (typeof EMOTE_ITEMS)[number];
export type CelebrationId = (typeof CELEBRATION_ITEMS)[number];
export type CosmeticId = Skin | HeadId | FaceId | NeckId | WakeId | EmoteId | CelebrationId;
export type CosmeticSlot = 'avatar' | 'head' | 'face' | 'neck' | 'wake' | 'celebration';
export type CosmeticKind = CosmeticSlot | 'emote';
export type AvatarFamily = 'duck' | 'shark' | 'axolotl' | 'turtle' | 'frog' | 'whale' | 'octopus';
export type Loadout = {
  avatar: Skin;
  head: HeadId | null;
  face: FaceId | null;
  neck: NeckId | null;
  wake: WakeId | null;
  celebration: CelebrationId | null;
  emotes: EmoteId[];
};
export type CosmeticCategory =
  | 'collection'
  | 'rescue'
  | 'practice'
  | 'growth'
  | 'combat'
  | 'control'
  | 'sharks'
  | 'endurance'
  | 'exploration'
  | 'rescue-craft'
  | 'shark-tactics'
  | 'flock-craft'
  | 'rivalry'
  | 'collection-craft';
export type CosmeticDefinition = {
  id: Skin;
  kind: 'avatar';
  modelFamily: AvatarFamily;
  name: string;
  description: string;
  starter: boolean;
  category: CosmeticCategory | null;
  silverMasteries?: number;
  color: string;
  accentColor: string;
  beakColor: string;
  metalness: number;
  roughness: number;
  pattern:
    | 'solid'
    | 'pearl'
    | 'stars'
    | 'koi'
    | 'porcelain'
    | 'sailor'
    | 'copper'
    | (typeof EXPANSION_SKINS)[number];
};
export type ExtraDefinition<K extends Exclude<CosmeticKind, 'avatar'> = Exclude<CosmeticKind, 'avatar'>> = {
  [P in K]: {
    id: P extends 'head'
      ? HeadId
      : P extends 'face'
        ? FaceId
        : P extends 'neck'
          ? NeckId
          : P extends 'wake'
            ? WakeId
            : P extends 'emote'
              ? EmoteId
              : CelebrationId;
    kind: P;
    name: string;
    description: string;
    starter: boolean;
    color: string;
    accentColor: string;
  };
}[K];
export type ItemDefinition = CosmeticDefinition | ExtraDefinition;
export type EquipRequest =
  | { slot: CosmeticSlot; itemId: CosmeticId | null; revision: number }
  | { slot: 'emotes'; itemIds: EmoteId[]; revision: number };
