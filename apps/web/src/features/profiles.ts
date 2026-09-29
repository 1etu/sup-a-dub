import { api } from '../api';
import { saveSettings } from '../settings';
import type { ClientContext, ClientFeature } from './contracts';

export class ProfilesFeature implements ClientFeature {
  private generation = 0;
  constructor(private readonly context: ClientContext) {}
  async action(name: string): Promise<boolean> {
    if (name !== 'my-profile') return false;
    const id = this.context.state.user?.id;
    if (id) await this.open(id);
    return true;
  }
  async click(target: HTMLElement): Promise<boolean> {
    if (!target.dataset.profile) return false;
    await this.open(target.dataset.profile);
    return true;
  }
  private async open(id: string): Promise<void> {
    const { state, show, refresh, fail } = this.context;
    const generation = ++this.generation;
    state.communityReturn = state.screen === 'profile' ? state.communityReturn : state.screen;
    state.profile = null;
    state.loading = true;
    show('profile');
    const currentView = this.context.checkpoint();
    const current = () => generation === this.generation && currentView();
    try {
      const profile = await api.profile(id);
      if (!current()) return;
      state.profile = profile;
      state.loading = false;
      if (state.screen === 'profile') refresh();
    } catch (error) {
      if (current()) {
        state.loading = false;
        fail(error);
      }
    }
  }
  async submit(form: HTMLFormElement): Promise<boolean> {
    if (form.id !== 'profile-form') return false;
    const { state, refresh, fail, confirm } = this.context;
    if (!state.profile || state.loading || state.user?.id !== state.profile.id) return true;
    const data = new FormData(form);
    const revision = state.profile.revision;
    const profileId = state.profile.id;
    const generation = ++this.generation;
    const currentView = this.context.checkpoint();
    const current = () => generation === this.generation && currentView() && state.profile?.id === profileId;
    state.loading = true;
    form.querySelector<HTMLButtonElement>('[type=submit]')!.disabled = true;
    try {
      const profile = await api.editProfile({
        name: String(data.get('name') ?? '').trim(),
        countryCode: String(data.get('country') ?? '') || null,
        revision,
      });
      if (!current()) return true;
      state.profile = profile;
      if (state.user) {
        state.user.name = state.profile.name;
        state.user.countryCode = state.profile.countryCode;
      }
      state.settings.name = state.profile.name;
      saveSettings(state.settings);
      state.loading = false;
      confirm();
      refresh();
    } catch (error) {
      if (!current()) return true;
      const profile = await api.profile(profileId).catch(() => null);
      if (!current()) return true;
      if (profile) state.profile = profile;
      state.loading = false;
      fail(error);
    }
    return true;
  }
  dispose(): void {
    this.generation++;
  }
}
