import { api } from '../api';
import type { ClientContext, ClientFeature } from './contracts';
import type { ModerationAction } from '@supadub/protocol';

export class ModerationFeature implements ClientFeature {
  private generation = 0;
  private submitting = false;
  constructor(private readonly context: ClientContext) {}
  async action(name: string): Promise<boolean> {
    if (!['admin', 'refresh-admin'].includes(name)) return false;
    await this.load();
    return true;
  }
  private async load(): Promise<void> {
    const { state, show, refresh, fail } = this.context;
    if (!state.user || state.user.role === 'player') return;
    if (state.screen !== 'admin') state.communityReturn = state.screen;
    const generation = ++this.generation;
    state.loading = true;
    show('admin');
    const currentView = this.context.checkpoint();
    const current = () => generation === this.generation && currentView();
    try {
      const response = await api.staffPlayers();
      if (!current()) return;
      state.adminPlayers = response.players;
      state.loading = false;
      if (state.screen === 'admin') refresh();
    } catch (error) {
      if (current()) {
        state.loading = false;
        fail(error);
      }
    }
  }
  async click(target: HTMLElement): Promise<boolean> {
    if (!target.dataset.moderation || !target.dataset.player) return false;
    if (this.submitting) return true;
    const root = target.closest('.admin-content');
    const reason =
      root?.querySelector<HTMLInputElement>('#ban-reason')?.value.trim() || 'Pool rules violation';
    const duration = root?.querySelector<HTMLSelectElement>('#restriction-duration')?.value ?? '900';
    const action = target.dataset.moderation as ModerationAction['action'];
    const generation = this.generation;
    const currentView = this.context.checkpoint();
    const current = () => generation === this.generation && currentView();
    this.submitting = true;
    target.setAttribute('disabled', '');
    try {
      await api.moderate({
        action,
        targetId: target.dataset.player,
        reason,
        caseId: target.dataset.case,
        durationSeconds: ['ban', 'mute'].includes(action)
          ? duration === 'permanent'
            ? null
            : Number(duration)
          : undefined,
        role:
          action === 'set-role' ? (target.dataset.role === 'moderator' ? 'moderator' : 'player') : undefined,
      });
      if (!current()) return true;
      this.context.confirm();
      await this.load();
    } catch (error) {
      if (current()) this.context.fail(error);
    } finally {
      this.submitting = false;
    }
    return true;
  }
  dispose(): void {
    this.generation++;
  }
}
