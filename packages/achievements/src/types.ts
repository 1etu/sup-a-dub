import type { CosmeticCategory } from '@supadub/cosmetics';

export const CATALOG_VERSION = 3 as const;
export const TIERS = ['bronze', 'silver', 'gold'] as const;
export type Tier = (typeof TIERS)[number];
export type Metric =
  | 'naturalDucks'
  | 'runDucks'
  | 'quickDucks'
  | 'savedDucks'
  | 'practiceRuns'
  | 'deliveredChain'
  | 'practiceTimeMs'
  | 'singleChainRuns'
  | 'completionStreak'
  | 'bodyMass'
  | 'totalMass'
  | 'fastMass'
  | 'absorptions'
  | 'eliminations'
  | 'splitAbsorptions'
  | 'bodyCount'
  | 'splitActions'
  | 'reunions'
  | 'pelletsFed'
  | 'sharkLaunches'
  | 'sharkSurvivals'
  | 'runDurationMs'
  | 'distance'
  | 'donatedMass'
  | 'chartedChunks'
  | 'farthestDistance'
  | 'feedingChunks'
  | 'deliveries'
  | 'promptDeliveries'
  | 'efficientRescues'
  | 'distantFeeds'
  | 'burstRecoveryMass'
  | 'sharkHarvestMass'
  | 'simultaneousEjections'
  | 'flockDistance'
  | 'balancedBodyMass'
  | 'humanMassAbsorbed'
  | 'runEliminations'
  | 'comebackMass'
  | 'avatarsUsed'
  | 'adornedDistance'
  | 'earnedItems';
export type Metrics = Partial<Record<Metric, number>>;
export type MetricAchievementDefinition = {
  kind: 'metric';
  id: string;
  name: string;
  description: string;
  category: CosmeticCategory;
  metric: Metric;
  aggregation: 'sum' | 'max' | 'min';
  modes: readonly ('endless' | 'practice')[];
  thresholds: readonly [number, number, number];
  unit: 'ducks' | 'runs' | 'mass' | 'bodies' | 'actions' | 'milliseconds' | 'units';
};

export type MasteryDefinition = Omit<
  MetricAchievementDefinition,
  'kind' | 'metric' | 'aggregation' | 'unit'
> & { kind: 'mastery'; metric: null; aggregation: 'all'; unit: 'medals'; requires: readonly string[] };
export type AchievementDefinition = MetricAchievementDefinition | MasteryDefinition;
