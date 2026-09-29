import type { CosmeticCategory } from '@supadub/cosmetics';
import type { MasteryDefinition, Tier } from './types';

export const CATEGORY_NAMES: Readonly<Record<CosmeticCategory, string>> = Object.freeze({
  collection: 'Collection',
  rescue: 'Rescue',
  practice: 'Practice Skill',
  growth: 'Growth',
  combat: 'Combat',
  control: 'Flock Control',
  sharks: 'Sharks',
  endurance: 'Endurance',
  exploration: 'Exploration',
  'rescue-craft': 'Rescue Craft',
  'shark-tactics': 'Shark Tactics',
  'flock-craft': 'Flock Craft',
  rivalry: 'Rivalry',
  'collection-craft': 'Collection Craft',
});

export const LEGACY_MASTERY_IDS = Object.freeze([
  'collection-mastery',
  'rescue-mastery',
  'practice-mastery',
  'growth-mastery',
  'combat-mastery',
  'control-mastery',
  'sharks-mastery',
  'endurance-mastery',
]);
export const MASTERY_REQUIREMENTS: Readonly<Record<CosmeticCategory, readonly string[]>> = Object.freeze({
  collection: Object.freeze(['natural-ducks', 'run-collector', 'quick-collector']),
  rescue: Object.freeze(['ducks-saved', 'practice-finisher', 'duck-chain']),
  practice: Object.freeze(['speed-rescue', 'single-chain', 'completion-streak']),
  growth: Object.freeze(['body-mass', 'flock-mass', 'fast-growth']),
  combat: Object.freeze(['body-absorber', 'pool-champion', 'split-absorber']),
  control: Object.freeze(['full-flock', 'split-master', 'reunion']),
  sharks: Object.freeze(['shark-feeder', 'shark-launcher', 'shark-survivor']),
  endurance: Object.freeze(['long-swim', 'distance-swimmer', 'generous-duck']),
  exploration: Object.freeze(['charted-pool', 'distant-shores', 'feeding-grounds']),
  'rescue-craft': Object.freeze(['careful-deliveries', 'prompt-deliveries', 'efficient-rescue']),
  'shark-tactics': Object.freeze(['distant-feeding', 'burst-recovery', 'shark-harvest']),
  'flock-craft': Object.freeze(['shared-snacks', 'flock-voyage', 'balanced-flock']),
  rivalry: Object.freeze(['rival-mass', 'rival-streak', 'comeback-flock']),
  'collection-craft': Object.freeze(['wardrobe-tour', 'dressed-traveler', 'earned-collection']),
});

export const MASTERY_ACHIEVEMENTS: readonly MasteryDefinition[] = Object.freeze(
  Object.entries(CATEGORY_NAMES).map(([category, name]) =>
    Object.freeze({
      id: category + '-mastery',
      name: name + ' Mastery',
      description: 'Earn all three ' + name + ' medals at each tier.',
      category: category as CosmeticCategory,
      kind: 'mastery' as const,
      metric: null,
      aggregation: 'all' as const,
      thresholds: [3, 3, 3] as const,
      unit: 'medals' as const,
      modes: ['endless', 'practice'] as const,
      requires: MASTERY_REQUIREMENTS[category as CosmeticCategory],
    }),
  ),
);

export function masteryProgress(
  definition: MasteryDefinition,
  tier: Tier,
  earned: ReadonlyMap<string, ReadonlySet<Tier>>,
): number {
  return definition.requires.filter((id) => earned.get(id)?.has(tier)).length;
}
