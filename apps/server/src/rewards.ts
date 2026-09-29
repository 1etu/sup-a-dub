import type { Database } from 'bun:sqlite';
import {
  ACHIEVEMENTS,
  METRIC_ACHIEVEMENTS,
  MASTERY_ACHIEVEMENTS,
  LEGACY_MASTERY_IDS,
  ITEM_REWARDS,
  CATALOG_VERSION,
  TOTAL_MEDAL_TIERS,
  TIERS,
  earnedCategorySkins,
  earnedMasterySkins,
  masteryProgress,
  mergeMetric,
  qualifies,
  type Metrics,
  type Tier,
} from '@supadub/achievements';
import type { AchievementResponse, AchievementAward, GameMode, ProgressGrant } from '@supadub/protocol';
import { ITEMS, getItem, isSkin } from '@supadub/cosmetics';

export class RewardStore {
  constructor(private readonly db: Database) {}

  private awards(userId: string): { id: string; tier: Tier; at: number }[] {
    return this.db
      .query<{ id: string; tier: Tier; at: number }, [string]>(
        "SELECT achievement_id AS id,tier,awarded_at AS at FROM achievement_awards WHERE user_id = ? AND season = 'lifetime'",
      )
      .all(userId);
  }

  private earned(userId: string): Map<string, Set<Tier>> {
    const result = new Map<string, Set<Tier>>();
    for (const award of this.awards(userId)) {
      const tiers = result.get(award.id) ?? new Set<Tier>();
      tiers.add(award.tier);
      result.set(award.id, tiers);
    }
    return result;
  }

  read(userId: string): AchievementResponse {
    const progress = new Map(
      this.db
        .query<{ achievement_id: string; value: number }, [string]>(
          'SELECT achievement_id,value FROM achievement_progress WHERE user_id = ?',
        )
        .all(userId)
        .map((row) => [row.achievement_id, row.value]),
    );
    const awards = this.awards(userId);
    const earned = this.earned(userId);
    return {
      catalogVersion: CATALOG_VERSION,
      totalTiers: TOTAL_MEDAL_TIERS,
      earnedTiers: awards.filter((award) => ACHIEVEMENTS.some((entry) => entry.id === award.id)).length,
      achievements: ACHIEVEMENTS.map((definition) => {
        const rows = awards.filter((award) => award.id === definition.id);
        const earnedTiers = TIERS.filter((tier) => rows.some((award) => award.tier === tier));
        const tierProgress =
          definition.kind === 'mastery'
            ? (Object.fromEntries(
                TIERS.map((tier) => [tier, masteryProgress(definition, tier, earned)]),
              ) as Record<Tier, number>)
            : undefined;
        return {
          ...definition,
          progress: tierProgress
            ? tierProgress[TIERS.find((tier) => !earnedTiers.includes(tier)) ?? 'gold']
            : (progress.get(definition.id) ?? (definition.aggregation === 'min' ? null : 0)),
          ...(tierProgress ? { tierProgress } : {}),
          earnedTiers,
          earnedAt: Object.fromEntries(rows.map((award) => [award.tier, award.at])),
        };
      }),
    };
  }

  private award(userId: string, id: string, tier: Tier, now: number): boolean {
    return (
      this.db
        .query(
          'INSERT OR IGNORE INTO achievement_awards(user_id,achievement_id,tier,season,definition_version,awarded_at) VALUES (?,?,?,?,?,?)',
        )
        .run(userId, id, tier, 'lifetime', CATALOG_VERSION, now).changes > 0
    );
  }

  applyMetrics(
    userId: string,
    mode: GameMode,
    metrics: Metrics,
    previous: Metrics,
    now: number,
  ): AchievementAward[] {
    const awarded: AchievementAward[] = [];
    for (const definition of METRIC_ACHIEVEMENTS) {
      const value = metrics[definition.metric];
      if (value === undefined || !definition.modes.includes(mode)) continue;
      if (definition.aggregation === 'sum' && value < (previous[definition.metric] ?? 0))
        throw new Error('A progress counter cannot decrease.');
      const current = this.db
        .query<{ value: number }, [string, string]>(
          'SELECT value FROM achievement_progress WHERE user_id = ? AND achievement_id = ?',
        )
        .get(userId, definition.id)?.value;
      const next = mergeMetric(definition, current, value, previous[definition.metric] ?? 0);
      this.db
        .query(
          'INSERT INTO achievement_progress(user_id,achievement_id,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,achievement_id) DO UPDATE SET value = excluded.value,updated_at = excluded.updated_at',
        )
        .run(userId, definition.id, next, now);
      for (const tier of TIERS)
        if (qualifies(definition, next, tier) && this.award(userId, definition.id, tier, now))
          awarded.push({ id: definition.id, tier });
    }
    return awarded;
  }

  private reconcilePass(userId: string, now: number): ProgressGrant {
    const grant: ProgressGrant = { awards: [], skinIds: [], itemIds: [] };
    const earned = this.earned(userId);
    for (const definition of MASTERY_ACHIEVEMENTS)
      for (const tier of TIERS)
        if (masteryProgress(definition, tier, earned) === definition.requires.length) {
          if (this.award(userId, definition.id, tier, now)) grant.awards.push({ id: definition.id, tier });
          const tiers = earned.get(definition.id) ?? new Set<Tier>();
          tiers.add(tier);
          earned.set(definition.id, tiers);
        }
    const bronze = new Set([...earned].filter(([, tiers]) => tiers.has('bronze')).map(([id]) => id));
    const silverMasteries = LEGACY_MASTERY_IDS.filter((id) => earned.get(id)?.has('silver')).length;
    const categorySkins = earnedCategorySkins(bronze);
    const rewards = [
      ...categorySkins.map((itemId) => ({ itemId, key: `category:${itemId}:bronze:lifetime` })),
      ...earnedMasterySkins(silverMasteries).map((itemId) => ({
        itemId,
        key: `mastery:${itemId}:silver:lifetime`,
      })),
      ...ITEM_REWARDS.filter((reward) => earned.get(reward.achievementId)?.has(reward.tier)).map(
        (reward) => ({
          itemId: reward.itemId,
          key: `achievement:${reward.achievementId}:${reward.tier}:lifetime`,
        }),
      ),
    ];
    for (const { itemId, key } of rewards) {
      const inserted = this.db
        .query('INSERT OR IGNORE INTO reward_grants(user_id,grant_key,item_id,created_at) VALUES (?,?,?,?)')
        .run(userId, key, itemId, now);
      if (!inserted.changes) continue;
      const item = this.db
        .query('INSERT OR IGNORE INTO inventory_items(user_id,item_id,earned_at,source) VALUES (?,?,?,?)')
        .run(userId, itemId, now, 'achievement');
      if (item.changes) {
        this.db.query('UPDATE inventory_accounts SET revision = revision + 1 WHERE user_id = ?').run(userId);
        grant.itemIds.push(itemId);
        if (isSkin(itemId)) grant.skinIds.push(itemId);
      }
    }
    return grant;
  }

  reconcile(userId: string, now: number): ProgressGrant {
    const result: ProgressGrant = { awards: [], skinIds: [], itemIds: [] };
    for (let pass = 0; pass < ITEMS.length; pass++) {
      const grant = this.reconcilePass(userId, now);
      const count = this.db
        .query<{ id: string }, [string]>('SELECT item_id AS id FROM inventory_items WHERE user_id = ?')
        .all(userId)
        .filter((item) => getItem(item.id)?.starter === false).length;
      const awards = this.applyMetrics(userId, 'endless', { earnedItems: count }, {}, now);
      result.awards.push(...grant.awards, ...awards);
      result.skinIds.push(...grant.skinIds);
      result.itemIds.push(...grant.itemIds);
      if (!grant.itemIds.length && !awards.length) break;
    }
    return result;
  }

  reconcileCatalog(): void {
    const version = this.db
      .query<{ value: string }, []>("SELECT value FROM metadata WHERE key = 'reward_catalog_version'")
      .get()?.value;
    if (Number(version) >= CATALOG_VERSION) return;
    let after = '';
    while (true) {
      const users = this.db
        .query<{ id: string }, [string]>('SELECT id FROM users WHERE id > ? ORDER BY id LIMIT 256')
        .all(after);
      if (!users.length) break;
      this.db
        .transaction(() => {
          for (const user of users) this.reconcile(user.id, Date.now());
        })
        .immediate();
      after = users.at(-1)!.id;
    }
    this.db
      .query(
        "INSERT INTO metadata(key,value) VALUES ('reward_catalog_version',?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(String(CATALOG_VERSION));
  }
}
