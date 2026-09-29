import type { Database } from 'bun:sqlite';

const migrations = [
  {
    version: 1,
    sql: `
      ALTER TABLE users ADD COLUMN best_mass INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX users_best_mass ON users(best_mass DESC);
      CREATE TABLE inventory_accounts (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, equipped_skin TEXT NOT NULL DEFAULT 'gold', revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE inventory_items (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_id TEXT NOT NULL, earned_at INTEGER NOT NULL, source TEXT NOT NULL, PRIMARY KEY(user_id,item_id));
      CREATE TABLE achievement_progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, value REAL NOT NULL CHECK(value >= 0), updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,achievement_id));
      CREATE TABLE achievement_awards (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, tier TEXT NOT NULL CHECK(tier IN ('bronze','silver','gold')), season TEXT NOT NULL DEFAULT 'lifetime', definition_version INTEGER NOT NULL, awarded_at INTEGER NOT NULL, PRIMARY KEY(user_id,achievement_id,tier,season));
      CREATE TABLE reward_grants (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, grant_key TEXT NOT NULL, item_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,grant_key));
      CREATE TABLE progress_runs (run_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, mode TEXT NOT NULL CHECK(mode IN ('endless','practice')), sequence INTEGER NOT NULL, metrics TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, abandoned INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
      CREATE INDEX progress_runs_user ON progress_runs(user_id, updated_at);
      CREATE TABLE practice_streaks (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, current_streak INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE chat_mutes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, actor_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER);
      CREATE INDEX chat_mutes_active ON chat_mutes(user_id, expires_at, revoked_at);
      INSERT INTO inventory_accounts(user_id) SELECT id FROM users;
      INSERT INTO inventory_items(user_id,item_id,earned_at,source) SELECT id,'gold',created_at,'starter' FROM users;
      INSERT INTO inventory_items(user_id,item_id,earned_at,source) SELECT id,'yellow',created_at,'starter' FROM users;
      INSERT INTO inventory_items(user_id,item_id,earned_at,source) SELECT id,'pink',created_at,'starter' FROM users;
      INSERT INTO inventory_items(user_id,item_id,earned_at,source) SELECT id,'mint',created_at,'starter' FROM users;
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE progress_runs ADD COLUMN started_at INTEGER NOT NULL DEFAULT 0;
      UPDATE progress_runs SET started_at = updated_at;
      CREATE INDEX progress_runs_started ON progress_runs(user_id,started_at DESC);
      CREATE TABLE progress_horizons(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, before_time INTEGER NOT NULL);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE account_roles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('player','moderator','admin')), revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
      INSERT INTO account_roles(user_id,role,updated_at) SELECT id,role,created_at FROM users;
      CREATE TABLE account_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, country_code TEXT, revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, CHECK(country_code IS NULL OR (length(country_code) = 2 AND country_code = upper(country_code))));
      INSERT INTO account_profiles(user_id,updated_at) SELECT id,created_at FROM users;
      CREATE TABLE moderation_requests(actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, status INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(actor_id,request_id));
      CREATE INDEX moderation_requests_time ON moderation_requests(created_at);
      CREATE TABLE ranking_bests(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, mode TEXT NOT NULL CHECK(mode IN ('endless','practice')), metric TEXT NOT NULL CHECK(metric IN ('peak-mass','adjusted-time')), rules_version INTEGER NOT NULL, level_id TEXT NOT NULL, period TEXT NOT NULL CHECK(period IN ('day','week','all-time')), period_start INTEGER NOT NULL, score INTEGER NOT NULL CHECK(score >= 0), longest_chain INTEGER NOT NULL DEFAULT 0, achieved_at INTEGER, run_id TEXT, PRIMARY KEY(user_id,mode,rules_version,level_id,period,period_start));
      CREATE INDEX ranking_period ON ranking_bests(mode,rules_version,level_id,period,period_start,score,achieved_at,user_id);
      INSERT INTO ranking_bests(user_id,mode,metric,rules_version,level_id,period,period_start,score) SELECT id,'endless','peak-mass',2,'','all-time',0,best_mass FROM users WHERE best_mass > 0;
      INSERT INTO ranking_bests(user_id,mode,metric,rules_version,level_id,period,period_start,score,longest_chain) SELECT user_id,'practice','adjusted-time',rules_version,level_id,'all-time',0,final_time_ms,longest_chain FROM practice_bests WHERE saved_ducks = 12;
    `,
  },
  {
    version: 4,
    sql: `
      ALTER TABLE inventory_accounts ADD COLUMN loadout TEXT NOT NULL DEFAULT '';
      UPDATE inventory_accounts SET loadout = json_object('avatar',equipped_skin,'head',NULL,'face',NULL,'neck',NULL,'wake',NULL,'celebration',NULL,'emotes',json_array('emote-wave')),revision = revision + 1;
      INSERT OR IGNORE INTO inventory_items(user_id,item_id,earned_at,source) SELECT u.id,s.item,u.created_at,'starter' FROM users u CROSS JOIN (SELECT 'head-sail-cap' AS item UNION ALL SELECT 'face-round-glasses' UNION ALL SELECT 'neck-bandana' UNION ALL SELECT 'wake-rings' UNION ALL SELECT 'emote-wave' UNION ALL SELECT 'celebration-confetti') s;
      CREATE TABLE inventory_avatar_uses(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, avatar_id TEXT NOT NULL, first_used_at INTEGER NOT NULL, PRIMARY KEY(user_id,avatar_id));
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE account_control_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, preferences TEXT, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0), updated_at INTEGER NOT NULL, CHECK(preferences IS NULL OR (json_valid(preferences) AND length(CAST(preferences AS BLOB)) <= 16384)));
      INSERT INTO account_control_preferences(user_id,updated_at) SELECT id,created_at FROM users;
    `,
  },
] as const;

export function migrate(db: Database): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)',
  );
  for (const migration of migrations) {
    const checksum = new Bun.CryptoHasher('sha256').update(migration.sql).digest('hex');
    const existing = db
      .query<{ checksum: string }, [number]>('SELECT checksum FROM schema_migrations WHERE version = ?')
      .get(migration.version);
    if (existing) {
      if (existing.checksum !== checksum) throw new Error('A stored migration checksum does not match.');
      continue;
    }
    db.transaction(() => {
      db.exec(migration.sql);
      db.query('INSERT INTO schema_migrations(version,checksum,applied_at) VALUES (?,?,?)').run(
        migration.version,
        checksum,
        Date.now(),
      );
    }).immediate();
  }
}
