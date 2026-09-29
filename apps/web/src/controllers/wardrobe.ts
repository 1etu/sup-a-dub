import type { Skin } from '@supadub/protocol';
import {
  STARTER_SKINS,
  getItem,
  type CosmeticId,
  type CosmeticSlot,
  type EquipRequest,
} from '@supadub/cosmetics';
import { api } from '../api';
import { saveSettings } from '../settings';
import type { ClientContext } from '../features/contracts';

export class Wardrobe {
  busy = false;
  private generation = 0;
  private loadGeneration = 0;
  private equipGeneration = 0;

  constructor(
    private readonly context: ClientContext,
    private readonly updateControls: () => void,
    private readonly selectSound: () => void,
  ) {}

  async load(): Promise<void> {
    const { state, refresh, fail } = this.context;
    if (!state.user || !state.featureFlags.collection || this.busy) return;
    const userId = state.user.id;
    const generation = this.generation;
    const request = ++this.loadGeneration;
    const current = () =>
      generation === this.generation && request === this.loadGeneration && state.user?.id === userId;
    try {
      await this.fetch(current);
      if (current() && state.screen === 'collection') refresh();
    } catch (error) {
      if (current() && state.screen === 'collection') fail(error);
    }
  }

  async equip(skin: Skin): Promise<void> {
    const { state, refresh, fail } = this.context;
    if (this.busy || state.loading || skin === state.settings.skin) return;
    state.error = '';
    if (!state.user) {
      if ((STARTER_SKINS as readonly string[]).includes(skin)) {
        state.settings.skin = skin;
        saveSettings(state.settings);
        this.selectSound();
        refresh();
      }
      return;
    }
    if (!state.featureFlags.collection) return;
    await this.commit((revision) => api.equip(skin, revision));
  }

  async equipItem(id: CosmeticId | null, slot?: CosmeticSlot): Promise<void> {
    const item = id ? getItem(id) : undefined;
    if (item?.kind === 'avatar') {
      await this.equip(item.id);
      return;
    }
    const { state } = this.context;
    if (!state.user || !state.featureFlags.collection || this.busy || state.loading) return;
    await this.commit((revision) => {
      const loadout = state.inventory!.loadout;
      let request: EquipRequest;
      if (item?.kind === 'emote') {
        const current = loadout.emotes;
        const itemIds = current.includes(item.id)
          ? current.filter((entry) => entry !== item.id)
          : [...current.slice(-3), item.id];
        request = { slot: 'emotes', itemIds, revision };
      } else {
        const target = item?.kind ?? slot;
        if (!target || target === 'avatar') throw new Error('Choose an item slot.');
        request = { slot: target, itemId: id, revision };
      }
      return api.equipItem(request);
    });
  }

  private async commit(send: (revision: number) => ReturnType<typeof api.equip>): Promise<void> {
    const { state, refresh, fail } = this.context;
    if (!state.user || this.busy || state.loading) return;
    state.error = '';
    const userId = state.user.id;
    const generation = this.generation;
    const request = ++this.equipGeneration;
    this.loadGeneration++;
    const current = () =>
      generation === this.generation && request === this.equipGeneration && state.user?.id === userId;
    this.busy = true;
    this.updateControls();
    try {
      if (!state.inventory) await this.fetch(current);
      if (!state.inventory || !current()) return;
      const inventory = await send(state.inventory.revision);
      if (!current() || inventory.revision < state.inventory.revision) return;
      state.inventory = inventory;
      state.settings.skin = inventory.equippedSkin;
      saveSettings(state.settings);
      this.selectSound();
      refresh();
    } catch (error) {
      if (current()) {
        await this.fetch(current).catch(() => {});
        if (current()) fail(error);
      }
    } finally {
      if (current()) {
        this.busy = false;
        this.updateControls();
      }
    }
  }

  private async fetch(current: () => boolean): Promise<void> {
    const { state } = this.context;
    const [inventory, achievements] = await Promise.all([api.inventory(), api.achievements()]);
    if (!current() || (state.inventory && inventory.revision < state.inventory.revision)) return;
    state.inventory = inventory;
    state.achievements = achievements;
    state.settings.skin = inventory.equippedSkin;
    saveSettings(state.settings);
  }

  reset(): void {
    this.generation++;
    this.loadGeneration++;
    this.equipGeneration++;
    this.busy = false;
  }
}
