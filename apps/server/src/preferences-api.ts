import {
  CONTROL_PREFERENCES_MAX_BYTES,
  parseControlPreferencesEdit,
  type ControlPreferencesResponse,
} from '@supadub/protocol';
import { tokenHash, type Store, type Identity } from './store';
import { RateLimiter, readCookies, readJson } from './security';
import type { PersistenceQueue } from './persistence';
import type { ControlPreferencesResult } from './control-preferences';

type PreferencesResponse = { status: number; body: ControlPreferencesResponse | { error: string } };

export class PreferencesApi {
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly store: Store,
    private readonly persistence: PersistenceQueue,
  ) {}

  async controls(request: Request, current: Identity): Promise<PreferencesResponse> {
    if (!current.user) return { status: 401, body: { error: 'Sign in to open your saved controls.' } };
    if (this.store.activeBan(current))
      return { status: 403, body: { error: 'This account cannot access saved controls.' } };
    if (request.method === 'GET') return { status: 200, body: this.store.controls.read(current.user.id) };
    if (request.method !== 'POST')
      return { status: 405, body: { error: 'Use GET or POST for this request.' } };
    if (!this.limiter.take(current.user.id, 60, 60000))
      return { status: 429, body: { error: 'Too many control changes. Try again in a minute.' } };
    const edit = parseControlPreferencesEdit(await readJson(request, CONTROL_PREFERENCES_MAX_BYTES));
    if (!edit) return { status: 400, body: { error: 'Use valid controls and a saved revision.' } };
    const result = (await this.persistence.enqueue({
      kind: 'controls',
      sessionHash: tokenHash(readCookies(request).get('sd_session') ?? ''),
      guestId: current.guestId,
      edit,
    })) as ControlPreferencesResult;
    return result.ok
      ? { status: 200, body: result.controls }
      : { status: result.status, body: { error: result.error } };
  }
}
