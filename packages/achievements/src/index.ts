import { COSMETICS, type Skin } from '@supadub/cosmetics';
import { METRIC_ACHIEVEMENTS } from './catalog';
import { MASTERY_ACHIEVEMENTS, MASTERY_REQUIREMENTS } from './mastery';
import {
  TIERS,
  type Metric,
  type Metrics,
  type Tier,
  type AchievementDefinition,
  type MetricAchievementDefinition,
} from './types';
export * from './catalog';
export * from './mastery';
export * from './types';
export * from './rewards';

export const ACHIEVEMENTS: readonly AchievementDefinition[] = Object.freeze([
  ...METRIC_ACHIEVEMENTS,
  ...MASTERY_ACHIEVEMENTS,
]);
export const TOTAL_MEDAL_TIERS = ACHIEVEMENTS.length * TIERS.length;
export const METRICS: readonly Metric[] = Object.freeze(
  METRIC_ACHIEVEMENTS.map((definition) => definition.metric),
);

export function qualifies(definition: AchievementDefinition, progress: number, tier: Tier): boolean {
  if (!Number.isFinite(progress) || progress < 0) return false;
  const threshold = definition.thresholds[TIERS.indexOf(tier)];
  return definition.aggregation === 'min' ? progress <= threshold : progress >= threshold;
}

export function mergeMetric(
  definition: MetricAchievementDefinition,
  current: number | undefined,
  value: number,
  previous = 0,
): number {
  if (definition.aggregation === 'sum') return (current ?? 0) + Math.max(0, value - previous);
  if (definition.aggregation === 'max') return Math.max(current ?? 0, value);
  return Math.min(current ?? Infinity, value);
}

export function earnedCategorySkins(bronzeIds: ReadonlySet<string>): Skin[] {
  return COSMETICS.filter(
    (item) => item.category && MASTERY_REQUIREMENTS[item.category].every((id) => bronzeIds.has(id)),
  ).map((item) => item.id);
}

export function validateMetrics(value: unknown): value is Metrics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, count]) =>
      METRICS.includes(key as Metric) &&
      typeof count === 'number' &&
      Number.isFinite(count) &&
      count >= 0 &&
      count <= 1e12,
  );
}

export function earnedMasterySkins(count: number): Skin[] {
  return COSMETICS.filter((item) => item.silverMasteries !== undefined && count >= item.silverMasteries).map(
    (item) => item.id,
  );
}
