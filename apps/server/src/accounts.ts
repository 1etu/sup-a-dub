import type { Database } from 'bun:sqlite';
import type { AccountRole, Skin, UserProfile } from '@supadub/protocol';
import { defaultLoadout, type Loadout } from '@supadub/cosmetics';

export type UserRecord = {
  id: string;
  username: string;
  name: string;
  password_hash: string;
  role: AccountRole;
  country_code: string | null;
  profile_revision: number;
  best_score: number;
  best_mass: number;
  total_ducks: number;
  created_at: number;
};

export const ACCOUNT_SELECT =
  'SELECT u.id,u.username,u.name,u.password_hash,r.role,p.country_code,p.revision AS profile_revision,u.best_score,u.best_mass,u.total_ducks,u.created_at FROM users u JOIN account_roles r ON r.user_id = u.id JOIN account_profiles p ON p.user_id = u.id';

export function sessionAccount(db: Database, tokenHash: string, now = Date.now()): UserRecord | null {
  return db
    .query<UserRecord, [string, number]>(
      `${ACCOUNT_SELECT} JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now);
}

export function allowedSessionAccount(
  db: Database,
  tokenHash: string,
  guestId?: string,
  now = Date.now(),
): UserRecord | null {
  const user = sessionAccount(db, tokenHash, now);
  if (
    !user ||
    db
      .query(
        'SELECT id FROM bans WHERE (target_id = ? OR target_id = ?) AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)',
      )
      .get(user.id, guestId ?? '', now)
  )
    return null;
  return user;
}

export function profile(
  user: UserRecord,
  equippedSkin: Skin,
  loadout: Loadout = defaultLoadout(equippedSkin),
): UserProfile {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    equippedSkin,
    loadout,
    countryCode: user.country_code,
    revision: user.profile_revision,
    bestScore: user.best_score,
    bestMass: user.best_mass,
    totalDucks: user.total_ducks,
    createdAt: user.created_at,
  };
}
