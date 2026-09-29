import { COUNTRY_CODES, type AdminPlayer, type RankingEntry } from '@supadub/protocol';
import { ACHIEVEMENTS } from '@supadub/achievements';
import { achievementIcon, countryFlag, roleIcon } from '@supadub/assets';
import type { ViewState } from './screens';
import { chrome, escapeHtml, timecode } from './graphics';
import './community.css';

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code: string): string => displayNames.of(code) ?? code;
export function flag(code: string | null | undefined): string {
  if (!code) return '';
  const source = countryFlag(code);
  return source
    ? `<img class="country-flag" src="${escapeHtml(source)}" alt="${escapeHtml(countryName(code))}" title="${escapeHtml(countryName(code))}" width="30" height="20"/>`
    : `<span class="country-code" title="${escapeHtml(countryName(code))}">${escapeHtml(code)}</span>`;
}
export const rankFinish = (rank: number): string => ['gold', 'silver', 'bronze'][rank - 1] ?? 'plain';

export function renderRankings(state: ViewState): string {
  const board = state.ranking;
  const row = (entry: RankingEntry, viewer = false) =>
    `<button class="ranking-row ${viewer ? 'viewer' : ''}" ${state.featureFlags.profiles ? `data-profile="${escapeHtml(entry.id)}"` : 'disabled'}><b class="rank-number">${String(entry.rank).padStart(2, '0')}</b><span class="rank-player">${flag(entry.countryCode)}<span class="rank-name ${rankFinish(entry.rank)}">${escapeHtml(entry.name)}</span><img class="role-badge" src="${roleIcon(entry.role)}" alt="${entry.role}" width="24" height="24"/></span><strong>${state.rankingMode === 'practice' ? timecode(entry.score) : Math.round(entry.score).toLocaleString()}</strong>${state.rankingMode === 'practice' ? `<small>CHAIN ${entry.longestChain ?? 0}</small>` : ''}</button>`;
  return `<div class="ranking-controls"><div role="tablist" aria-label="Ranking mode">${(['endless', 'practice'] as const).map((mode) => `<button role="tab" aria-selected="${mode === state.rankingMode}" data-ranking-mode="${mode}">${mode === 'endless' ? 'BIGGEST FLOCKS' : 'FASTEST RESCUES'}</button>`).join('')}</div><div role="tablist" aria-label="Ranking period">${(['day', 'week', 'all-time'] as const).map((period) => `<button role="tab" aria-selected="${period === state.rankingPeriod}" data-ranking-period="${period}">${{ day: "DAY'S BEST", week: "WEEK'S BEST", 'all-time': 'ALL TIME BEST' }[period]}</button>`).join('')}</div></div><p class="ranking-caption">${state.rankingMode === 'endless' ? 'YOUR BIGGEST FLOCK. YOUR PLACE IN THE POOL.' : 'EVERY DUCK SAVED. EVERY SECOND COUNTS.'}</p><section class="ranking-table" data-preview-clip tabindex="0" aria-label="Ranked players">${state.loading ? '<p class="empty-message">CHECKING THE POOL...</p>' : board?.entries.length ? board.entries.map((entry) => row(entry, entry.id === state.user?.id)).join('') : '<p class="empty-message">A FRESH POOL. BE THE FIRST!</p>'}</section>${board?.viewer && !board.entries.some((entry) => entry.id === board.viewer?.id) ? `<div class="ranking-viewer">${row(board.viewer, true)}</div>` : ''}<p class="ranking-period-note">${state.rankingPeriod === 'all-time' ? 'LIFETIME RECORDS' : state.rankingPeriod === 'week' ? 'RESETS MONDAY AT 00:00 UTC' : 'RESETS AT 00:00 UTC'}</p>`;
}

export function renderProfile(state: ViewState): string {
  const profile = state.profile;
  if (!profile)
    return `<p class="empty-message profile-loading">${state.loading ? 'FINDING YOUR DUCK...' : 'THIS DUCK IS NOT AVAILABLE.'}</p>`;
  const own = profile.id === state.user?.id;
  const medals = profile.badges
    .map((award) => {
      const definition = ACHIEVEMENTS.find((entry) => entry.id === award.id);
      return `<figure title="${escapeHtml(definition?.name ?? award.id)}"><img src="${achievementIcon(award.id, award.tier)}" width="72" height="72" alt="${escapeHtml(`${definition?.name ?? award.id}, ${award.tier}`)}"/><figcaption>${escapeHtml(definition?.name ?? award.id)}</figcaption></figure>`;
    })
    .join('');
  return `<section class="profile-content" data-preview-clip tabindex="0"><header class="profile-header"><span class="profile-duck" data-duck-preview data-skin="${profile.skin}" aria-hidden="true"></span><div><h2>${chrome(profile.name.toUpperCase(), 'pink', 680, 54)}</h2><p>${flag(profile.countryCode)}<img class="role-badge" src="${roleIcon(profile.role)}" alt="${profile.role}" width="28" height="28"/> ${profile.role.toUpperCase()}</p><small>IN THE POOL SINCE ${new Date(profile.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' }).toUpperCase()}</small></div></header><div class="profile-records"><div><span>BEST FLOCK</span><strong>${Math.round(profile.bestMass).toLocaleString()}</strong></div><div><span>DUCKS COLLECTED</span><strong>${profile.totalDucks.toLocaleString()}</strong></div><div><span>BEST RESCUE</span><strong>${profile.practiceBest ? timecode(profile.practiceBest.finalTimeMs) : '--:--.--'}</strong><small>${profile.practiceBest ? `CHAIN ${profile.practiceBest.longestChain}` : 'PLAY TUB 01'}</small></div></div>${
    own
      ? `<form id="profile-form" class="profile-edit"><label>DUCK NAME<input name="name" value="${escapeHtml(profile.name)}" minlength="1" maxlength="20" required/></label><label>COUNTRY<select name="country"><option value="">NOT SET</option>${COUNTRY_CODES.slice()
          .sort((a, b) => countryName(a).localeCompare(countryName(b)))
          .map(
            (code) =>
              `<option value="${code}" ${code === profile.countryCode ? 'selected' : ''}>${escapeHtml(countryName(code))}</option>`,
          )
          .join(
            '',
          )}</select></label><button type="submit" ${state.loading ? 'disabled' : ''}>SAVE PROFILE</button></form>`
      : ''
  }<h3 class="profile-medal-heading">${profile.badges.length} MEDALS EARNED</h3><div class="profile-medals">${medals || '<p>Every splash is a fresh start. Earn your first medal!</p>'}</div></section>`;
}

export function renderModeration(state: ViewState): string {
  const user = state.user;
  if (!user || user.role === 'player') return '<p class="empty-message">STAFF ACCESS IS REQUIRED.</p>';
  const hierarchy = { guest: 0, bot: 0, player: 1, moderator: 2, admin: 3 };
  const canAct = (player: AdminPlayer) =>
    player.id !== user.id && hierarchy[player.role] < hierarchy[user.role];
  const button = (player: AdminPlayer, action: string, text: string, extra = '') =>
    `<button class="moderate-button" data-player="${escapeHtml(player.id)}" data-moderation="${action}" ${extra}>${text}</button>`;
  return `<section class="admin-content"><p class="admin-note">${user.role === 'moderator' ? 'POOL MODERATOR' : 'POOL ADMIN'} · KEEP THE WATER FRIENDLY</p><div class="moderation-options"><label>REASON<input id="ban-reason" maxlength="160" value="Pool rules violation"/></label><label>DURATION<select id="restriction-duration"><option value="60">1 MINUTE</option><option value="900" selected>15 MINUTES</option><option value="3600">1 HOUR</option><option value="86400">24 HOURS</option>${user.role === 'admin' ? '<option value="604800">7 DAYS</option><option value="2592000">30 DAYS</option><option value="31536000">1 YEAR · BAN ONLY</option><option value="permanent">PERMANENT · BAN ONLY</option>' : ''}</select></label></div><div class="admin-table moderation-table" data-preview-clip tabindex="0">${
    state.loading
      ? '<p class="empty-message">CHECKING THE POOL...</p>'
      : state.adminPlayers
          .filter((player) => player.role !== 'bot')
          .map(
            (player) =>
              `<article class="moderation-player"><header>${flag(player.countryCode)}<strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.role.toUpperCase())} · ${player.banned ? 'BANNED' : player.online ? 'IN POOL' : 'OFFLINE'}</small></header><code>${escapeHtml(player.id)}</code><div class="moderation-actions">${canAct(player) ? `${player.online ? button(player, 'kick', 'KICK') : ''}${button(player, 'mute', 'MUTE')}${button(player, 'ban', 'BAN')}${user.role === 'admin' && player.role !== 'guest' ? button(player, 'set-role', player.role === 'moderator' ? 'REMOVE MOD' : 'MAKE MOD', `data-role="${player.role === 'moderator' ? 'player' : 'moderator'}"`) : ''}` : '<small>PROTECTED ROLE</small>'}</div>${(player.cases ?? []).map((item) => `<div class="moderation-case"><span>${item.kind.toUpperCase()} · ${escapeHtml(item.reason)}<small>${item.expiresAt === null ? 'PERMANENT' : `UNTIL ${new Date(item.expiresAt).toLocaleString()}`}</small></span>${canAct(player) && (user.role === 'admin' || item.actorId === user.id) ? button(player, item.kind === 'ban' ? 'unban' : 'unmute', 'REVOKE', `data-case="${escapeHtml(item.id)}"`) : ''}</div>`).join('')}</article>`,
          )
          .join('') || '<p class="empty-message">NO PLAYERS YET.</p>'
  }</div></section>`;
}
