import type { Database } from 'bun:sqlite';
import {
  rankingWindow,
  type GameMode,
  type RankingPeriod,
  type RankingEntry,
  type RankingResponse,
} from '@supadub/protocol';

export type RankingObservation = {
  userId: string;
  runId: string;
  mode: GameMode;
  period: RankingPeriod;
  periodStart: number;
  score: number;
  longestChain: number;
  observedAt: number;
};
export const RANKING_PERIODS: readonly RankingPeriod[] = ['day', 'week', 'all-time'];

export function rankingKey(sample: RankingObservation): string {
  return `${sample.userId}:${sample.mode}:${sample.period}:${sample.periodStart}`;
}

export function betterRanking(
  a: Pick<RankingObservation, 'score' | 'longestChain' | 'observedAt' | 'mode'>,
  b: Pick<RankingObservation, 'score' | 'longestChain' | 'observedAt'>,
): boolean {
  return a.score !== b.score
    ? a.mode === 'endless'
      ? a.score > b.score
      : a.score < b.score
    : a.mode === 'practice' && a.longestChain !== b.longestChain
      ? a.longestChain > b.longestChain
      : a.observedAt < b.observedAt;
}

export function mergeRankingObservations(
  a: readonly RankingObservation[],
  b: readonly RankingObservation[],
): RankingObservation[] {
  const merged = new Map(a.map((sample) => [rankingKey(sample), sample]));
  for (const sample of b) {
    const key = rankingKey(sample);
    const previous = merged.get(key);
    if (!previous || betterRanking(sample, previous)) merged.set(key, sample);
  }
  if (merged.size > 4096) throw new Error('The ranking save queue is full.');
  return [...merged.values()];
}

export class RankingStore {
  constructor(private readonly db: Database) {}

  observe(samples: readonly RankingObservation[], now = Date.now()): void {
    if (samples.length > 4096) throw new Error('The ranking batch is too large.');
    this.db
      .transaction(() => {
        for (const sample of samples) {
          if (
            !RANKING_PERIODS.includes(sample.period) ||
            !['endless', 'practice'].includes(sample.mode) ||
            !Number.isSafeInteger(sample.score) ||
            sample.score < 0 ||
            sample.score > (sample.mode === 'endless' ? 360000 : 7 * 86400000) ||
            !Number.isSafeInteger(sample.longestChain) ||
            sample.longestChain < 0 ||
            sample.longestChain > 12 ||
            !Number.isSafeInteger(sample.observedAt) ||
            sample.observedAt < 0 ||
            sample.observedAt > now + 1000 ||
            rankingWindow(sample.period, sample.observedAt).start !== sample.periodStart ||
            sample.runId.length > 128
          )
            throw new Error('The ranking observation is invalid.');
          const rules = sample.mode === 'endless' ? 2 : 1;
          const level = sample.mode === 'endless' ? '' : 'fun-01';
          const metric = sample.mode === 'endless' ? 'peak-mass' : 'adjusted-time';
          if (sample.mode === 'endless' && sample.period === 'all-time')
            this.db
              .query('UPDATE users SET best_mass = MAX(best_mass,?) WHERE id = ?')
              .run(sample.score, sample.userId);
          this.db
            .query(
              `INSERT INTO ranking_bests(user_id,mode,metric,rules_version,level_id,period,period_start,score,longest_chain,achieved_at,run_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,mode,rules_version,level_id,period,period_start) DO UPDATE SET score = excluded.score,longest_chain = excluded.longest_chain,achieved_at = excluded.achieved_at,run_id = excluded.run_id WHERE (excluded.mode = 'endless' AND excluded.score > ranking_bests.score) OR (excluded.mode = 'practice' AND (excluded.score < ranking_bests.score OR (excluded.score = ranking_bests.score AND excluded.longest_chain > ranking_bests.longest_chain))) OR (excluded.score = ranking_bests.score AND (excluded.mode = 'endless' OR excluded.longest_chain = ranking_bests.longest_chain) AND (ranking_bests.achieved_at IS NULL OR excluded.achieved_at < ranking_bests.achieved_at))`,
            )
            .run(
              sample.userId,
              sample.mode,
              metric,
              rules,
              level,
              sample.period,
              sample.periodStart,
              sample.score,
              sample.longestChain,
              sample.observedAt,
              sample.runId,
            );
        }
      })
      .immediate();
  }

  board(
    mode: GameMode,
    period: RankingPeriod,
    viewerId: string | null,
    limit = 20,
    now = Date.now(),
  ): RankingResponse {
    const window = rankingWindow(period, now);
    const ordering =
      mode === 'endless'
        ? 'b.score DESC,b.achieved_at IS NULL,b.achieved_at,u.id'
        : 'b.score ASC,b.longest_chain DESC,b.achieved_at IS NULL,b.achieved_at,u.id';
    const query = `WITH ranked AS (SELECT u.id,u.name,r.role,p.country_code AS countryCode,i.equipped_skin AS skin,b.score,CASE WHEN b.mode = 'practice' THEN b.longest_chain ELSE NULL END AS longestChain,b.achieved_at AS achievedAt,ROW_NUMBER() OVER (ORDER BY ${ordering}) AS rank FROM ranking_bests b JOIN users u ON u.id = b.user_id JOIN account_roles r ON r.user_id = u.id JOIN account_profiles p ON p.user_id = u.id JOIN inventory_accounts i ON i.user_id = u.id WHERE b.mode = ? AND b.rules_version = ? AND b.level_id = ? AND b.period = ? AND b.period_start = ? AND NOT EXISTS (SELECT 1 FROM bans WHERE target_id = u.id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?))) SELECT * FROM ranked WHERE rank <= ? OR id = ? ORDER BY rank`;
    const bounded = Math.min(100, Math.max(1, Math.floor(limit)));
    const rows = this.db
      .query<RankingEntry, [string, number, string, string, number, number, number, string]>(query)
      .all(
        mode,
        mode === 'endless' ? 2 : 1,
        mode === 'endless' ? '' : 'fun-01',
        period,
        window.start,
        now,
        bounded,
        viewerId ?? '',
      );
    return {
      mode,
      period,
      metric: mode === 'endless' ? 'peak-mass' : 'adjusted-time',
      direction: mode === 'endless' ? 'desc' : 'asc',
      periodStart: period === 'all-time' ? null : window.start,
      periodEnd: window.end,
      generatedAt: now,
      entries: rows.filter((row) => row.rank <= bounded),
      viewer: rows.find((row) => row.id === viewerId) ?? null,
    };
  }

  prune(now = Date.now()): void {
    this.db
      .query(
        "DELETE FROM ranking_bests WHERE (period = 'day' AND period_start < ?) OR (period = 'week' AND period_start < ?)",
      )
      .run(
        rankingWindow('day', now).start - 34 * 86400000,
        rankingWindow('week', now).start - 12 * 7 * 86400000,
      );
  }
}
