import type { Database } from 'bun:sqlite';
import {
  CONTROL_PREFERENCES_MAX_BYTES,
  parseControlPreferences,
  parseControlPreferencesEdit,
  type ControlPreferencesResponse,
} from '@supadub/protocol';
import { allowedSessionAccount, sessionAccount } from './accounts';

export type ControlPreferencesResult =
  | { ok: true; controls: ControlPreferencesResponse }
  | { ok: false; status: 400 | 401 | 403 | 409; error: string };

export class ControlPreferencesStore {
  constructor(private readonly db: Database) {}

  ensure(userId: string, now = Date.now()): void {
    this.db
      .query('INSERT OR IGNORE INTO account_control_preferences(user_id,updated_at) VALUES (?,?)')
      .run(userId, now);
  }

  read(userId: string): ControlPreferencesResponse {
    const row = this.db
      .query<{ preferences: string | null; revision: number }, [string]>(
        'SELECT preferences,revision FROM account_control_preferences WHERE user_id = ?',
      )
      .get(userId);
    if (!row) throw new Error('This account has no control preferences.');
    let preferences = null;
    try {
      if (row.preferences) preferences = parseControlPreferences(JSON.parse(row.preferences));
    } catch {}
    return { revision: row.revision, preferences };
  }

  edit(sessionHash: string, value: unknown, now = Date.now(), guestId?: string): ControlPreferencesResult {
    const edit = parseControlPreferencesEdit(value);
    if (!edit) return { ok: false, status: 400, error: 'Use valid controls and a saved revision.' };
    const encoded = JSON.stringify(edit.preferences);
    if (new TextEncoder().encode(encoded).byteLength > CONTROL_PREFERENCES_MAX_BYTES)
      return { ok: false, status: 400, error: 'The control settings are too large.' };
    return this.db
      .transaction((): ControlPreferencesResult => {
        const user = sessionAccount(this.db, sessionHash, now);
        if (!user) return { ok: false, status: 401, error: 'Sign in to save your controls.' };
        if (!allowedSessionAccount(this.db, sessionHash, guestId, now))
          return { ok: false, status: 403, error: 'This account cannot access saved controls.' };
        const current = this.read(user.id);
        if (current.revision !== edit.revision)
          return { ok: false, status: 409, error: 'Your controls changed. Reload them and try again.' };
        this.db
          .query(
            'UPDATE account_control_preferences SET preferences = ?,revision = revision + 1,updated_at = ? WHERE user_id = ? AND revision = ?',
          )
          .run(encoded, now, user.id, edit.revision);
        return { ok: true, controls: this.read(user.id) };
      })
      .immediate();
  }
}
