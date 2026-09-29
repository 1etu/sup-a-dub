import type { Database } from 'bun:sqlite';
import { validateMetrics, type Metrics } from '@supadub/achievements';
import { isSkin, SKINS, type Skin, type EquipRequest } from '@supadub/cosmetics';
import type { ProgressGrant } from '@supadub/protocol';
import { InventoryStore } from './inventory';
import { RewardStore } from './rewards';
export type { EquipResult } from './inventory';

export type ProgressBatch = {
  userId: string;
  runId: string;
  startedAt: number;
  sequence: number;
  mode: 'endless' | 'practice';
  metrics: Metrics;
  avatars?: Skin[];
};
type SavedRun = {
  user_id: string;
  mode: string;
  sequence: number;
  metrics: string;
  completed: number;
  abandoned: number;
  started_at: number;
};
export class ProgressionStore {
  private readonly inventoryStore: InventoryStore;
  private readonly rewards: RewardStore;
  constructor(private readonly db: Database) {
    this.inventoryStore = new InventoryStore(db);
    this.rewards = new RewardStore(db);
  }
  ensureInventory(userId: string): void {
    this.inventoryStore.ensure(userId);
  }
  inventory(userId: string) {
    return this.inventoryStore.read(userId);
  }
  equip(userId: string, request: EquipRequest | string, revision?: number) {
    return this.inventoryStore.equip(userId, request, revision);
  }
  achievements(userId: string) {
    return this.rewards.read(userId);
  }
  reconcileCatalog(): void {
    this.rewards.reconcileCatalog();
  }

  apply(batch: ProgressBatch): ProgressGrant {
    if (
      !validateMetrics(batch.metrics) ||
      (batch.avatars !== undefined &&
        (!Array.isArray(batch.avatars) ||
          batch.avatars.length > SKINS.length ||
          !batch.avatars.every(isSkin) ||
          new Set(batch.avatars).size !== batch.avatars.length)) ||
      !Number.isSafeInteger(batch.sequence) ||
      batch.sequence < 0 ||
      !Number.isSafeInteger(batch.startedAt) ||
      batch.startedAt < 0 ||
      batch.startedAt > Date.now() + 1000 ||
      batch.runId.length > 128 ||
      !['endless', 'practice'].includes(batch.mode)
    )
      throw new Error('The progress batch is invalid.');
    return this.db
      .transaction(() => {
        const saved = this.db
          .query<SavedRun, [string]>(
            'SELECT user_id,mode,sequence,metrics,completed,abandoned,started_at FROM progress_runs WHERE run_id = ?',
          )
          .get(batch.runId);
        if (saved && (saved.user_id !== batch.userId || saved.mode !== batch.mode))
          throw new Error('This run belongs to another player.');
        if (!saved) {
          const horizon =
            this.db
              .query<{ before_time: number }, [string]>(
                'SELECT before_time FROM progress_horizons WHERE user_id = ?',
              )
              .get(batch.userId)?.before_time ?? -1;
          if (batch.startedAt <= horizon || batch.startedAt < Date.now() - 90 * 86400000)
            return { awards: [], skinIds: [], itemIds: [] };
        } else if (saved.started_at !== batch.startedAt) throw new Error('A run start time cannot change.');
        if (saved && (saved.sequence >= batch.sequence || saved.abandoned))
          return { awards: [], skinIds: [], itemIds: [] };
        const previous: Metrics = saved ? (JSON.parse(saved.metrics) as Metrics) : {};
        const metrics = { ...batch.metrics };
        delete metrics.avatarsUsed;
        delete metrics.earnedItems;
        const completed = batch.mode === 'practice' && metrics.practiceRuns === 1;
        if (completed && !saved?.completed) {
          this.db
            .query(
              'INSERT INTO practice_streaks(user_id,current_streak) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET current_streak = current_streak + 1',
            )
            .run(batch.userId);
          metrics.completionStreak = this.db
            .query<{ current_streak: number }, [string]>(
              'SELECT current_streak FROM practice_streaks WHERE user_id = ?',
            )
            .get(batch.userId)!.current_streak;
        }
        const now = Date.now();
        for (const avatar of batch.avatars ?? [])
          metrics.avatarsUsed = this.inventoryStore.observeAvatar(batch.userId, avatar, now);
        const grant: ProgressGrant = { awards: [], skinIds: [], itemIds: [] };
        this.db
          .query(
            'INSERT INTO progress_runs(run_id,user_id,mode,sequence,metrics,completed,updated_at,started_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(run_id) DO UPDATE SET sequence = excluded.sequence,metrics = excluded.metrics,completed = MAX(progress_runs.completed,excluded.completed),updated_at = excluded.updated_at',
          )
          .run(
            batch.runId,
            batch.userId,
            batch.mode,
            batch.sequence,
            JSON.stringify(metrics),
            Number(completed),
            now,
            batch.startedAt,
          );
        grant.awards.push(...this.rewards.applyMetrics(batch.userId, batch.mode, metrics, previous, now));
        const derived = this.rewards.reconcile(batch.userId, now);
        grant.awards.push(...derived.awards);
        grant.skinIds.push(...derived.skinIds);
        grant.itemIds.push(...derived.itemIds);
        const collected =
          Math.max(0, (metrics.naturalDucks ?? 0) - (previous.naturalDucks ?? 0)) +
          Math.max(0, (metrics.savedDucks ?? 0) - (previous.savedDucks ?? 0));
        this.db
          .query('UPDATE users SET best_mass = MAX(best_mass, ?), total_ducks = total_ducks + ? WHERE id = ?')
          .run(
            batch.mode === 'endless' ? Math.floor(metrics.totalMass ?? 0) : 0,
            Math.floor(collected),
            batch.userId,
          );
        return grant;
      })
      .immediate();
  }

  abandonPractice(userId: string, runId: string): void {
    this.db
      .transaction(() => {
        const run = this.db
          .query<{ completed: number; user_id: string }, [string]>(
            'SELECT completed,user_id FROM progress_runs WHERE run_id = ?',
          )
          .get(runId);
        if (run && run.user_id !== userId) throw new Error('This run belongs to another player.');
        if (run?.completed) return;
        this.db
          .query(
            'INSERT INTO practice_streaks(user_id,current_streak) VALUES (?,0) ON CONFLICT(user_id) DO UPDATE SET current_streak = 0',
          )
          .run(userId);
        this.db.query('UPDATE progress_runs SET abandoned = 1 WHERE run_id = ?').run(runId);
      })
      .immediate();
  }

  prune(now = Date.now()): void {
    this.db
      .transaction(() => {
        const rows = this.db
          .query<{ run_id: string; user_id: string; started_at: number }, [number, number]>(
            `SELECT run_id,user_id,started_at FROM (SELECT run_id,user_id,started_at,updated_at,ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY started_at DESC,run_id) AS position FROM progress_runs) WHERE (position > 1000 AND updated_at < ?) OR updated_at < ?`,
          )
          .all(now - 5 * 60000, now - 90 * 86400000);
        const mark = this.db.query(
          'INSERT INTO progress_horizons(user_id,before_time) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET before_time = MAX(before_time,excluded.before_time)',
        );
        const remove = this.db.query('DELETE FROM progress_runs WHERE run_id = ?');
        for (const row of rows) {
          mark.run(row.user_id, row.started_at);
          remove.run(row.run_id);
        }
      })
      .immediate();
  }
}
