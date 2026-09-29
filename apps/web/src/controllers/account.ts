import { api } from '../api';
import type { SessionResponse } from '@supadub/protocol';
import { isSkin } from '@supadub/cosmetics';
import { saveSettings } from '../settings';
import type { ClientContext } from '../features/contracts';

export interface AccountServices {
  reconnect(): void;
  refreshCommands(): void;
  loadProgress(): Promise<void>;
  resetProgress(): void;
  syncControls?(userId: string | null): void;
}

export class AccountController {
  private generation = 0;
  private disposed = false;
  constructor(
    private readonly context: ClientContext,
    private readonly services: AccountServices,
  ) {}

  async submit(form: HTMLFormElement): Promise<void> {
    const { state, show, confirm } = this.context;
    if (this.disposed || form.id !== 'auth-form' || state.loading) return;
    const generation = ++this.generation;
    const data = new FormData(form);
    state.loading = true;
    state.error = '';
    const button = form.querySelector<HTMLButtonElement>('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const username = String(data.get('username'));
      const password = String(data.get('password'));
      const result = state.authRegister
        ? await api.register(username, password, String(data.get('name')))
        : await api.signIn(username, password);
      if (generation !== this.generation) return;
      this.syncSession(result);
      if (isSkin(result.user?.equippedSkin)) state.settings.skin = result.user.equippedSkin;
      this.services.reconnect();
      this.services.refreshCommands();
      await this.services.loadProgress();
      if (generation !== this.generation) return;
      saveSettings(state.settings);
      confirm();
      state.loading = false;
      if (state.screen === 'auth') show('auth');
    } catch (error) {
      if (generation !== this.generation) return;
      state.loading = false;
      const errorLine = form.querySelector('.form-error');
      if (errorLine)
        errorLine.textContent = error instanceof Error ? error.message : 'Sign in failed. Try again.';
      if (button) button.disabled = false;
    }
  }

  async signOut(): Promise<void> {
    if (this.disposed) return;
    const { show, fail } = this.context;
    const generation = ++this.generation;
    try {
      await api.signOut();
      if (generation !== this.generation) return;
      this.clearSession();
      this.services.reconnect();
      this.services.refreshCommands();
      show('main');
    } catch (error) {
      if (generation === this.generation) fail(error);
    }
  }

  syncSession(session: SessionResponse): void {
    if (this.disposed) return;
    const { state } = this.context;
    if (session.user) state.bestScore = session.user.bestMass ?? 0;
    else if (state.user) state.bestScore = 0;
    state.user = session.user;
    this.services.syncControls?.(session.user?.id ?? null);
    state.practiceBest = session.user
      ? (session.practiceBest?.finalTimeMs ?? null)
      : state.settings.guestPracticeBest;
  }

  recordPracticeBest(timeMs: number): void {
    if (this.disposed || !Number.isFinite(timeMs) || timeMs < 0) return;
    const { state } = this.context;
    if (state.practiceBest !== null && state.practiceBest <= timeMs) return;
    state.practiceBest = timeMs;
    if (!state.user) {
      state.settings.guestPracticeBest = timeMs;
      saveSettings(state.settings);
    }
  }

  expireSession(): void {
    if (this.disposed) return;
    this.generation++;
    this.clearSession();
    this.services.refreshCommands();
  }

  private clearSession(): void {
    const { state } = this.context;
    state.user = null;
    this.services.syncControls?.(null);
    state.practiceBest = state.settings.guestPracticeBest;
    this.services.resetProgress();
    state.bestScore = 0;
    state.inventory = null;
    state.achievements = null;
    state.loading = false;
    state.settings.skin = 'gold';
    saveSettings(state.settings);
  }

  checkpoint(): () => boolean {
    const generation = this.generation;
    return () => !this.disposed && generation === this.generation;
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
  }
}
