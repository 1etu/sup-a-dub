import { rankingWindow, type GameMode } from '@supadub/protocol';
import { betterRanking, rankingKey, RANKING_PERIODS, type RankingObservation } from './rankings';
import type { PersistenceQueue } from './persistence';

export class RankingCollector {
  private readonly pending = new Map<string, RankingObservation>();
  private active: Promise<void> | null = null;
  failures = 0;

  constructor(private readonly queue: PersistenceQueue) {}

  observe(
    userId: string,
    runId: string,
    mode: GameMode,
    score: number,
    longestChain: number,
    at: number,
  ): void {
    for (const period of RANKING_PERIODS) {
      const sample: RankingObservation = {
        userId,
        runId,
        mode,
        score,
        longestChain,
        observedAt: at,
        period,
        periodStart: rankingWindow(period, at).start,
      };
      const key = rankingKey(sample);
      const previous = this.pending.get(key);
      if (previous && !betterRanking(sample, previous)) continue;
      if (!previous && this.pending.size >= 4096) {
        this.failures++;
        continue;
      }
      this.pending.set(key, sample);
    }
  }

  get size(): number {
    return this.pending.size;
  }

  flush(): Promise<void> {
    if (this.active) return this.active;
    if (!this.pending.size) return Promise.resolve();
    const observations = [...this.pending.values()];
    this.active = this.queue
      .enqueue({ kind: 'rankings', observations })
      .then(() => {
        for (const sample of observations)
          if (this.pending.get(rankingKey(sample)) === sample) this.pending.delete(rankingKey(sample));
      })
      .catch((error) => {
        this.failures++;
        throw error;
      })
      .finally(() => {
        this.active = null;
      });
    return this.active;
  }

  async drain(): Promise<void> {
    while (this.pending.size) await this.flush();
  }
}
