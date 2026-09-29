import { ACHIEVEMENTS, CATEGORY_NAMES, ITEM_REWARDS } from '@supadub/achievements';
import {
  COSMETICS,
  ITEMS,
  STARTER_ITEMS,
  defaultLoadout,
  type ItemDefinition,
  type Loadout,
} from '@supadub/cosmetics';
import { escapeHtml } from './graphics';
import { cosmeticIcon } from '@supadub/assets';
import type { CollectionView } from './collection';

export const COLLECTION_PAGE_SIZE = 12;
export const COLLECTION_TABS = [
  'skins',
  'head',
  'face',
  'neck',
  'wake',
  'emote',
  'celebration',
  'medals',
] as const;
export const COLLECTION_LABELS = {
  skins: 'SKINS',
  head: 'HATS',
  face: 'FACE',
  neck: 'NECK',
  wake: 'TRAILS',
  emote: 'EMOTES',
  celebration: 'PARTY',
  medals: 'MEDALS',
};

export function rewardLabel(item: ItemDefinition): string {
  if (item.starter) return 'STARTER ITEM';
  const reward = ITEM_REWARDS.find((entry) => entry.itemId === item.id);
  if (reward)
    return `${ACHIEVEMENTS.find((entry) => entry.id === reward.achievementId)?.name ?? reward.achievementId} · ${reward.tier.toUpperCase()}`;
  if (item.kind === 'avatar' && item.silverMasteries) return `${item.silverMasteries} SILVER MASTERY MEDALS`;
  if (item.kind === 'avatar' && item.category)
    return `${CATEGORY_NAMES[item.category]} · THREE BRONZE MEDALS`;
  return 'EARN THROUGH PLAY';
}

export function previewAttributes(skin: string, loadout?: Partial<Loadout>): string {
  return `data-duck-preview data-skin="${escapeHtml(skin)}" data-head="${escapeHtml(loadout?.head ?? '')}" data-face="${escapeHtml(loadout?.face ?? '')}" data-neck="${escapeHtml(loadout?.neck ?? '')}"`;
}

export function collectionItems(state: CollectionView): readonly ItemDefinition[] {
  return state.collectionTab === 'skins'
    ? COSMETICS
    : ITEMS.filter((item) => item.kind === state.collectionTab);
}

export function renderItems(state: CollectionView): string {
  const owned = new Set([...STARTER_ITEMS, ...(state.inventory?.ownedItemIds ?? [])]);
  const loadout = state.inventory?.loadout ?? defaultLoadout(state.selectedSkin);
  const items = collectionItems(state);
  const page = Math.max(
    0,
    Math.min(Math.ceil(items.length / COLLECTION_PAGE_SIZE) - 1, state.collectionPage ?? 0),
  );
  const slot = state.collectionTab;
  const removable = slot !== 'skins' && slot !== 'medals' && slot !== 'emote';
  return `${removable ? `<div class="outfit-slot"><span>YOUR ${COLLECTION_LABELS[slot]}</span><button data-clear-slot="${slot}" ${!state.user || !loadout[slot] ? 'disabled' : ''}>REMOVE ITEM</button></div>` : ''}<div class="collection-skins">${items
    .slice(page * COLLECTION_PAGE_SIZE, (page + 1) * COLLECTION_PAGE_SIZE)
    .map((item) => {
      const available = owned.has(item.id);
      const selected =
        item.kind === 'emote' ? loadout.emotes.includes(item.id) : loadout[item.kind] === item.id;
      const bodyItem = item.kind === 'avatar';
      const attachment = ['head', 'face', 'neck'].includes(item.kind);
      const previewLoadout = bodyItem
        ? selected
          ? loadout
          : undefined
        : { ...loadout, [item.kind]: item.id };
      const preview =
        bodyItem || attachment
          ? `<span class="collection-preview" ${previewAttributes(bodyItem ? item.id : loadout.avatar, previewLoadout)} aria-hidden="true"></span>`
          : `<img class="cosmetic-icon" src="${cosmeticIcon(item.id)}" width="128" height="128" alt=""/>`;
      const disabled =
        !available || state.loading || (selected && item.kind !== 'emote') || (!state.user && !bodyItem);
      return `<article class="collection-skin ${available ? 'owned' : 'locked'} ${selected ? 'equipped' : ''}" data-cosmetic="${item.id}">${preview}<h2>${escapeHtml(item.name.toUpperCase())}</h2><p>${escapeHtml(rewardLabel(item))}</p><button ${bodyItem ? `data-equip-skin="${item.id}"` : `data-equip-item="${item.id}"`} aria-pressed="${selected}" ${disabled ? 'disabled' : ''}>${selected ? (item.kind === 'emote' ? 'REMOVE FROM WHEEL' : 'IN USE') : available ? (bodyItem ? 'USE DUCK' : item.kind === 'emote' ? 'ADD TO WHEEL' : 'USE ITEM') : 'LOCKED'}</button></article>`;
    })
    .join('')}</div>`;
}
