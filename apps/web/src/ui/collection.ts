import { ACHIEVEMENTS, CATEGORY_NAMES, TIERS } from '@supadub/achievements';
import type { AchievementDefinition, Tier } from '@supadub/achievements';
import { achievementIcon } from '@supadub/assets';
import { COSMETICS, ITEMS, STARTER_ITEMS } from '@supadub/cosmetics';
import type { CosmeticCategory, Skin } from '@supadub/cosmetics';
import type {
  AchievementProgress,
  AchievementResponse,
  InventoryResponse,
  UserProfile,
} from '@supadub/protocol';
import { chrome, escapeHtml } from './graphics';
import {
  COLLECTION_LABELS,
  COLLECTION_PAGE_SIZE,
  COLLECTION_TABS,
  collectionItems,
  renderItems,
} from './collection-items';

export type CollectionTab = (typeof COLLECTION_TABS)[number];
export type CollectionView = {
  user: UserProfile | null;
  inventory: InventoryResponse | null;
  achievements: AchievementResponse | null;
  collectionTab: CollectionTab;
  collectionPage?: number;
  selectedSkin: Skin;
  loading: boolean;
};

const formatAmount = (value: number, definition: AchievementDefinition) =>
  definition.unit === 'milliseconds'
    ? `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} SEC`
    : value.toLocaleString(undefined, { maximumFractionDigits: 0 });

function tierProgress(definition: AchievementDefinition, progress: number | null, tier: Tier): number {
  if (progress === null || !Number.isFinite(progress) || progress < 0) return 0;
  const threshold = definition.thresholds[TIERS.indexOf(tier)];
  return Math.max(
    0,
    Math.min(1, definition.aggregation === 'min' ? threshold / Math.max(1, progress) : progress / threshold),
  );
}

function renderAchievement(
  definition: AchievementDefinition,
  progress: AchievementProgress | undefined,
): string {
  const current = progress?.progress ?? null;
  const caption =
    current === null
      ? 'NO RECORD YET'
      : `${definition.aggregation === 'min' ? 'BEST' : 'PROGRESS'} ${formatAmount(current, definition)}`;
  return `<article class="achievement-card" data-achievement="${definition.id}"><h3>${escapeHtml(definition.name)}</h3><p class="achievement-description">${escapeHtml(definition.description)}</p><div class="achievement-tiers">${TIERS.map(
    (tier, index) => {
      const earned = progress?.earnedTiers.includes(tier) ?? false;
      const goal = `${definition.aggregation === 'min' ? '≤ ' : ''}${formatAmount(definition.thresholds[index], definition)}`;
      const amount = earned
        ? 1
        : tierProgress(
            definition,
            definition.kind === 'mastery' ? (progress?.tierProgress?.[tier] ?? 0) : current,
            tier,
          );
      return `<figure class="achievement-tier ${earned ? 'earned' : 'locked'} ${tier}" data-tier="${tier}" data-earned="${earned}"><img src="${achievementIcon(definition.id, tier)}" width="88" height="88" alt="${escapeHtml(`${definition.name}, ${tier}, ${earned ? 'earned' : 'locked'}`)}" loading="lazy"/><figcaption><span>${tier.toUpperCase()}</span><strong>${escapeHtml(goal)}</strong><small>${earned ? 'EARNED' : 'LOCKED'}</small></figcaption><span class="tier-progress" role="progressbar" aria-label="${escapeHtml(`${definition.name} ${tier}`)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(amount * 100)}"><span style="width:${amount * 100}%"></span></span></figure>`;
    },
  ).join(
    '',
  )}</div><p class="achievement-current">${escapeHtml(caption)} <span>${definition.modes.includes('practice') ? 'PRACTICE' : 'ENDLESS'}</span></p></article>`;
}

function renderMedals(state: CollectionView): string {
  const records = new Map(state.achievements?.achievements.map((item) => [item.id, item]));
  return `<div class="collection-medals">${(Object.keys(CATEGORY_NAMES) as CosmeticCategory[])
    .slice((state.collectionPage ?? 0) * 2, ((state.collectionPage ?? 0) + 1) * 2)
    .map((category) => {
      const definitions = ACHIEVEMENTS.filter((item) => item.category === category);
      const reward = COSMETICS.find((skin) => skin.category === category);
      const earned = definitions.reduce(
        (count, definition) => count + (records.get(definition.id)?.earnedTiers.length ?? 0),
        0,
      );
      return `<section class="medal-category" aria-labelledby="category-${category}"><header><h2 id="category-${category}">${escapeHtml(CATEGORY_NAMES[category].toUpperCase())}</h2><span>${earned} / ${definitions.length * TIERS.length} MEDALS</span></header><p class="category-reward">${reward ? `Earn the three base bronze medals to unlock ${escapeHtml(reward.name)}.` : 'Earn each medal tier to unlock a new item.'} Complete every tier to earn its mastery medal.</p><div class="achievement-grid">${definitions.map((definition) => renderAchievement(definition, records.get(definition.id))).join('')}</div></section>`;
    })
    .join('')}</div>`;
}

export function renderCollection(state: CollectionView): string {
  const total = ACHIEVEMENTS.length * TIERS.length;
  const earned = Math.max(0, Math.min(total, state.achievements?.earnedTiers ?? 0));
  const owned = new Set([...STARTER_ITEMS, ...(state.inventory?.ownedItemIds ?? [])]).size;
  const active = state.collectionTab;
  const pages =
    active === 'medals'
      ? Math.ceil(Object.keys(CATEGORY_NAMES).length / 2)
      : Math.ceil(collectionItems(state).length / COLLECTION_PAGE_SIZE);
  const page = Math.max(0, Math.min(pages - 1, state.collectionPage ?? 0));
  return `<div class="collection-tabs" role="tablist" aria-label="Duck collection">${COLLECTION_TABS.map((tab) => `<button id="collection-tab-${tab}" role="tab" aria-controls="collection-content" aria-selected="${active === tab}" class="${active === tab ? 'selected' : ''}" data-action="collection-${tab}">${COLLECTION_LABELS[tab]}</button>`).join('')}</div><div class="collection-summary"><span>${active === 'medals' ? `${earned} / ${total} MEDALS` : `${owned} / ${ITEMS.length} ITEMS`}</span><p>${state.loading ? 'CHECKING YOUR COLLECTION...' : state.user ? 'PLAY. EARN MEDALS. MAKE IT YOURS.' : 'SIGN IN TO EARN MEDALS AND UNLOCK ITEMS.'}</p>${!state.user ? '<button data-action="auth">SIGN IN</button>' : ''}</div><section id="collection-content" class="collection-content" role="tabpanel" aria-labelledby="collection-tab-${active}" tabindex="0" data-preview-clip>${active === 'medals' ? renderMedals({ ...state, collectionPage: page }) : renderItems({ ...state, collectionPage: page })}</section><nav class="collection-pages" aria-label="Collection pages"><button data-action="collection-previous" ${page === 0 ? 'disabled' : ''} aria-label="Previous collection page">&#9664;</button><span>${page + 1} / ${pages}</span><button data-action="collection-next" ${page + 1 >= pages ? 'disabled' : ''} aria-label="Next collection page">&#9654;</button></nav>`;
}
