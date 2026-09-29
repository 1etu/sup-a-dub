import { parseControlPreferences, parseControlPreferencesResponse } from '@supadub/protocol';
import type { ControlPreferences, ControlPreferencesEdit } from '@supadub/protocol';

export const CONTROL_STORAGE_KEY = 'supadub-controls-v1';

type ControlsServices = {
  read(key: string): ControlPreferences;
  write(key: string, preferences: ControlPreferences): void;
  load(): Promise<unknown>;
  save(edit: ControlPreferencesEdit): Promise<unknown>;
  apply(preferences: ControlPreferences): void;
  status(message: string, retry?: boolean): void;
  dirty?(key: string): boolean;
  markDirty?(key: string, dirty: boolean): void;
};
type AccountScope = {
  id: string | null;
  key: string;
  revision: number;
  ready: boolean;
  loading: boolean;
  saving: boolean;
  stopped: boolean;
  pending?: ControlPreferences;
  timer?: ReturnType<typeof setTimeout>;
};

export class AccountControls {
  private scope?: AccountScope;
  private disposed = false;

  constructor(
    private readonly services: ControlsServices,
    private readonly debounceMs = 300,
  ) {}

  switchAccount(id: string | null): void {
    if (this.disposed || this.scope?.id === id) return;
    if (this.scope?.timer) clearTimeout(this.scope.timer);
    const scope: AccountScope = {
      id,
      key: id ? `${CONTROL_STORAGE_KEY}:account:${id}` : CONTROL_STORAGE_KEY,
      revision: 0,
      ready: !id,
      loading: false,
      saving: false,
      stopped: false,
    };
    this.scope = scope;
    const local = this.services.read(scope.key);
    if (id && this.services.dirty?.(scope.key)) {
      scope.pending = local;
      scope.stopped = true;
    }
    this.services.apply(local);
    if (id) void this.load(scope);
    else this.services.status('Guest keys stay on this device. Sign in to save keys to your account.');
  }

  changed(value: ControlPreferences): void {
    const preferences = parseControlPreferences(value);
    const scope = this.scope;
    if (!preferences || !scope || this.disposed) return;
    this.services.write(scope.key, preferences);
    if (!scope.id) {
      this.services.status('Guest keys saved on this device.');
      return;
    }
    scope.pending = preferences;
    this.services.markDirty?.(scope.key, true);
    if (scope.stopped) {
      this.services.status('Keys work on this device. Choose SAVE MY KEYS to sync this account.', true);
      return;
    }
    this.services.status('Keys work now. Account save pending.');
    if (scope.timer) clearTimeout(scope.timer);
    scope.timer = setTimeout(() => {
      scope.timer = undefined;
      void this.flush(scope);
    }, this.debounceMs);
  }

  async retry(): Promise<void> {
    const scope = this.scope;
    if (!scope?.id || scope.saving || scope.loading || this.disposed) return;
    scope.stopped = false;
    await this.load(scope);
  }

  async reload(): Promise<void> {
    const scope = this.scope;
    if (!scope?.id || scope.saving || scope.loading || this.disposed) return;
    if (scope.timer) clearTimeout(scope.timer);
    scope.pending = undefined;
    scope.stopped = false;
    this.services.markDirty?.(scope.key, false);
    await this.load(scope);
  }

  private current(scope: AccountScope): boolean {
    return !this.disposed && this.scope === scope;
  }

  private async load(scope: AccountScope): Promise<void> {
    scope.loading = true;
    scope.ready = false;
    this.services.status('Loading account keys...');
    try {
      const response = parseControlPreferencesResponse(await this.services.load());
      if (!this.current(scope)) return;
      if (!response) throw new Error('Invalid controls response');
      scope.revision = response.revision;
      scope.ready = true;
      if (!scope.pending && response.preferences) {
        this.services.write(scope.key, response.preferences);
        this.services.apply(response.preferences);
      }
      if (scope.stopped && scope.pending)
        this.services.status(
          'Unsaved keys from this device remain. Choose SAVE MY KEYS or LOAD SAVED KEYS.',
          true,
        );
      else
        this.services.status(
          response.preferences ? 'Account keys loaded.' : 'Change a control to save keys to this account.',
        );
    } catch {
      if (!this.current(scope)) return;
      scope.stopped = true;
      this.services.status('Account keys could not load. Local keys still work. Try SAVE MY KEYS.', true);
    } finally {
      scope.loading = false;
    }
    if (this.current(scope) && scope.pending && !scope.stopped) await this.flush(scope);
  }

  private async flush(scope: AccountScope): Promise<void> {
    if (
      !this.current(scope) ||
      !scope.ready ||
      scope.loading ||
      scope.saving ||
      scope.stopped ||
      !scope.pending
    )
      return;
    const preferences = scope.pending;
    scope.pending = undefined;
    scope.saving = true;
    this.services.status('Saving account keys...');
    try {
      const response = parseControlPreferencesResponse(
        await this.services.save({ revision: scope.revision, preferences }),
      );
      if (!this.current(scope)) return;
      if (!response?.preferences || response.revision <= scope.revision)
        throw new Error('Invalid controls response');
      scope.revision = response.revision;
      this.services.status(scope.pending ? 'Account save pending.' : 'Keys saved to your account.');
      if (!scope.pending) this.services.markDirty?.(scope.key, false);
    } catch (error) {
      if (!this.current(scope)) return;
      scope.pending ??= preferences;
      scope.stopped = true;
      const conflict =
        typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
      this.services.status(
        conflict
          ? 'Another device changed your keys. Choose SAVE MY KEYS or LOAD SAVED KEYS.'
          : 'Account save failed. Local keys still work. Try SAVE MY KEYS.',
        true,
      );
    } finally {
      scope.saving = false;
    }
    if (this.current(scope) && scope.pending && !scope.stopped) await this.flush(scope);
  }

  dispose(): void {
    this.disposed = true;
    if (this.scope?.timer) clearTimeout(this.scope.timer);
    this.scope = undefined;
  }
}
