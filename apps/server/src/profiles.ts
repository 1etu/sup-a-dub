import type { Database } from 'bun:sqlite';
import { cleanName, isCountryCode, type PublicProfile, type ProfileEdit } from '@supadub/protocol';
import { TOTAL_MEDAL_TIERS, type Tier } from '@supadub/achievements';
import type { Skin } from '@supadub/cosmetics';
import { ACCOUNT_SELECT, allowedSessionAccount, type UserRecord } from './accounts';
import { InventoryStore } from './inventory';

export type ProfileResult =
  { ok: true; profile: PublicProfile } | { ok: false; status: 400 | 401 | 409; error: string };

export class ProfileStore {
  constructor(private readonly db: Database) {}

  publicProfile(id: string): PublicProfile | null {
    const user = this.db.query<UserRecord, [string]>(`${ACCOUNT_SELECT} WHERE u.id = ?`).get(id);
    if (!user) return null;
    const inventory = new InventoryStore(this.db).read(id);
    const skin = inventory.equippedSkin;
    const badges = this.db
      .query<{ id: string; tier: Tier }, [string, number]>(
        "SELECT achievement_id AS id,tier FROM achievement_awards WHERE user_id = ? AND season = 'lifetime' ORDER BY awarded_at,achievement_id,tier LIMIT ?",
      )
      .all(id, TOTAL_MEDAL_TIERS);
    const practiceBest = this.db
      .query<{ finalTimeMs: number; rawTimeMs: number; longestChain: number; savedDucks: number }, [string]>(
        "SELECT final_time_ms AS finalTimeMs,raw_time_ms AS rawTimeMs,longest_chain AS longestChain,saved_ducks AS savedDucks FROM practice_bests WHERE user_id = ? AND level_id = 'fun-01' AND rules_version = 1",
      )
      .get(id);
    return {
      id,
      name: user.name,
      role: user.role,
      countryCode: user.country_code,
      revision: user.profile_revision,
      skin,
      loadout: inventory.loadout,
      createdAt: user.created_at,
      bestMass: user.best_mass,
      totalDucks: user.total_ducks,
      practiceBest,
      badges,
    };
  }

  edit(sessionHash: string, edit: ProfileEdit, now = Date.now(), guestId?: string): ProfileResult {
    const name = cleanName(edit.name);
    if (
      !name ||
      !Number.isSafeInteger(edit.revision) ||
      edit.revision < 0 ||
      (edit.countryCode !== null && !isCountryCode(edit.countryCode))
    )
      return { ok: false, status: 400, error: 'Use a valid name and country.' };
    return this.db
      .transaction((): ProfileResult => {
        const user = allowedSessionAccount(this.db, sessionHash, guestId, now);
        if (!user) return { ok: false, status: 401, error: 'Sign in to edit your profile.' };
        if (user.profile_revision !== edit.revision)
          return { ok: false, status: 409, error: 'Your profile changed. Open it again.' };
        this.db.query('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
        this.db
          .query(
            'UPDATE account_profiles SET country_code = ?,revision = revision + 1,updated_at = ? WHERE user_id = ?',
          )
          .run(edit.countryCode, now, user.id);
        return { ok: true, profile: this.publicProfile(user.id)! };
      })
      .immediate();
  }
}
