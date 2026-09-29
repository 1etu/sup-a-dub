import type { Database } from 'bun:sqlite';
import { migrate } from './migrations';

export function initializeDatabase(db: Database): void {
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 250;');
  db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player','admin')),
        best_score INTEGER NOT NULL DEFAULT 0,
        total_ducks INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS guests (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        address_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Little Ducky',
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS users_best_score ON users(best_score DESC);
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS bans (
        id TEXT PRIMARY KEY,
        target_id TEXT NOT NULL,
        address_hash TEXT,
        reason TEXT NOT NULL,
        actor_id TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        revoked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS bans_target ON bans(target_id, revoked_at);
      CREATE INDEX IF NOT EXISTS bans_address ON bans(address_hash, revoked_at);
      CREATE TABLE IF NOT EXISTS audit (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_id TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS practice_bests (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL,
        rules_version INTEGER NOT NULL,
        final_time_ms INTEGER NOT NULL,
        raw_time_ms INTEGER NOT NULL,
        longest_chain INTEGER NOT NULL,
        saved_ducks INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(user_id, level_id, rules_version)
      );
      CREATE INDEX IF NOT EXISTS practice_rank ON practice_bests(level_id, rules_version, final_time_ms);
    `);
  migrate(db);
}
