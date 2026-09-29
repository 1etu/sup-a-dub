import type { CosmeticId } from '@supadub/cosmetics';
import { TIERS, type Tier } from './types';

const rewards: readonly (readonly [string, CosmeticId, CosmeticId, CosmeticId])[] = [
  ['charted-pool', 'explorer', 'head-bucket', 'shark-blue'],
  ['distant-shores', 'wake-bubbles', 'aurora', 'whale-blue'],
  ['feeding-grounds', 'lifeguard', 'face-goggles', 'neck-life-ring'],
  ['careful-deliveries', 'head-flower', 'lemon-sorbet', 'turtle-jade'],
  ['prompt-deliveries', 'neck-bowtie', 'peach-jelly', 'turtle-sand'],
  ['efficient-rescue', 'mosaic', 'wake-hearts', 'celebration-bubbles'],
  ['distant-feeding', 'face-sunglasses', 'deep-sea', 'shark-coral'],
  ['burst-recovery', 'head-diver', 'emote-wow', 'octopus-plum'],
  ['shark-harvest', 'wake-sparkles', 'head-captain', 'octopus-coral'],
  ['shared-snacks', 'tin-toy', 'face-monocle', 'axolotl-lime'],
  ['flock-voyage', 'clockwork', 'neck-scarf', 'whale-lilac'],
  ['balanced-flock', 'head-propeller', 'emote-splash', 'celebration-stars'],
  ['rival-mass', 'fiesta', 'face-star-glasses', 'frog-sunset'],
  ['rival-streak', 'head-party', 'emote-cheer', 'frog-pond'],
  ['comeback-flock', 'neck-medallion', 'wake-rainbow', 'celebration-fireworks'],
  ['wardrobe-tour', 'speckled-egg', 'neck-flower-lei', 'axolotl-rose'],
  ['dressed-traveler', 'patchwork', 'face-sleep-mask', 'wake-stars'],
  ['earned-collection', 'emote-heart', 'emote-laugh', 'head-crown'],
];

export const ITEM_REWARDS: readonly { achievementId: string; tier: Tier; itemId: CosmeticId }[] =
  Object.freeze(
    rewards.flatMap(([achievementId, ...items]) =>
      items.map((itemId, index) => Object.freeze({ achievementId, tier: TIERS[index]!, itemId })),
    ),
  );
