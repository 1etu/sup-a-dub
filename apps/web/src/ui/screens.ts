import { renderRankings, renderProfile, renderModeration } from './community';
import type {
  PublicProfile,
  RankingResponse,
  RankingPeriod,
  AchievementResponse,
  AdminPlayer,
  GameMode,
  InventoryResponse,
  PracticeResult,
  UserProfile,
} from '@supadub/protocol';
import { STARTER_SKINS, cosmetic } from '@supadub/cosmetics';
import type { Settings } from '../settings';
import { renderCollection } from './collection';
import type { CollectionTab } from './collection';
import { chrome, escapeHtml, footer, logo, timecode, triangle } from './graphics';
import { renderResults } from './results';
import { promptGlyph } from './control-prompts';

export type Screen =
  | 'title'
  | 'main'
  | 'tub'
  | 'duck'
  | 'collection'
  | 'scores'
  | 'profile'
  | 'help'
  | 'options'
  | 'controls'
  | 'sound'
  | 'auth'
  | 'admin'
  | 'playing'
  | 'pause'
  | 'success'
  | 'results';
export type ViewState = {
  screen: Screen;
  communityReturn: Screen;
  featureFlags: Readonly<Record<string, boolean>>;
  profile: PublicProfile | null;
  ranking: RankingResponse | null;
  rankingMode: GameMode;
  rankingPeriod: RankingPeriod;
  mode: GameMode;
  user: UserProfile | null;
  settings: Settings;
  authRegister: boolean;
  result: PracticeResult | null;
  adminPlayers: AdminPlayer[];
  loading: boolean;
  error: string;
  bestScore: number;
  practiceBest: number | null;
  online: number;
  inventory: InventoryResponse | null;
  achievements: AchievementResponse | null;
  collectionTab: CollectionTab;
  collectionPage?: number;
};

const heading = (text: string) =>
  `${text === 'CHOOSE A TUB' ? `<button class="tub-back" data-action="back" aria-label="Back to main menu">${triangle('up')}</button>` : ''}<header class="screen-heading">${chrome(text, 'blue', 1050, 62)}</header>`;
const menuButton = (text: string, action: string, index: number, selected = false) =>
  `<button class="menu-item ${selected ? 'selected' : ''}" data-action="${action}" data-nav="${index}">${triangle('right')}<span class="menu-label">${chrome(text, 'pink', 840, 64)}</span>${triangle('left')}</button>`;
const errorLine = (message: string) => `<p class="form-error" role="alert">${escapeHtml(message)}</p>`;

export function renderScreen(
  state: ViewState,
  presentation: { replaying?: boolean; controls?: string } = {},
): string {
  const { screen, settings, user } = state;
  switch (screen) {
    case 'title':
      return `<div class="title-logo">${logo()}</div><button class="press-start" data-action="main">PRESS START</button><p class="title-credit">SUP-a-DUB · A MULTIPLAYER WEB GAME</p>`;
    case 'main':
      return `${logo()}<nav class="main-menu" aria-label="Main menu">${[
        ['PLAY', 'tub'],
        ['HI-SCORES', 'scores'],
        ['HOW TO PLAY', 'help'],
        ['OPTIONS', 'options'],
        [user ? 'MY ACCOUNT' : 'SIGN IN', 'auth'],
      ]
        .filter(([, action]) => action !== 'scores' || state.featureFlags.rankings)
        .map(([label, action], index) => menuButton(label, action, index, index === 0))
        .join(
          '',
        )}</nav>${user ? `<span class="signed-in">${escapeHtml(user.name)}${user.role !== 'player' && state.featureFlags.moderation ? '<button data-action="admin">POOL ADMIN</button>' : ''}</span>` : ''}${footer(true)}`;
    case 'tub':
      return `${heading('CHOOSE A TUB')}<span class="difficulty">${chrome(state.mode === 'practice' ? 'FUN' : 'ONLINE', 'lime', 480, 110)}</span><button class="tub-arrow previous" data-action="cycle-mode" aria-label="Previous tub">${triangle('left', 'lime')}</button><div class="tub-title">${chrome('TUB', 'lime', 640, 163)}<span class="tub-number">${state.mode === 'practice' ? '01' : '∞'}</span><span class="tub-caption">${state.mode === 'practice' ? 'BUBBLE RESCUE' : 'THE ENDLESS POOL'}</span></div><button class="tub-arrow next" data-action="cycle-mode" aria-label="Next tub">${triangle('right', 'lime')}</button><div class="tub-stats"><div><span>${chrome(state.mode === 'practice' ? 'MY BEST TIME' : 'MY BEST MASS', 'lime', 315, 31)}</span><b>${state.mode === 'practice' ? (state.practiceBest === null ? '--:--.--' : timecode(state.practiceBest)) : state.bestScore.toLocaleString()}</b></div>${state.mode === 'practice' ? `<div><span>${chrome('DUCKS TO SAVE', 'lime', 315, 31)}</span><b>12</b></div>` : ''}</div><p class="tub-presence"><span id="lobby-online-count">${Math.max(0, Math.floor(state.online))}</span> Players online</p>${footer(true, 'duck', 'OK', !user)}`;
    case 'duck':
      return `${heading('CHOOSE A DUCK')}<p class="selection-note">${state.mode === 'practice' ? 'Rescue every duck. Lead your chain to the pink exit.' : `Grow your flock. ${promptGlyph('split')} SPLIT ${promptGlyph('eject')} EJECT`}</p><div class="skin-picker" role="group" aria-label="Starter ducks">${STARTER_SKINS.map((skin) => `<button class="skin-choice ${skin === settings.skin ? 'selected' : ''}" data-skin="${skin}" aria-pressed="${skin === settings.skin}"><span class="duck-preview" data-duck-preview data-skin="${skin}" aria-hidden="true"></span><span class="skin-name">${skin.toUpperCase()}</span>${triangle('up', skin === settings.skin ? 'lime' : 'blue')}</button>`).join('')}</div>${state.featureFlags.collection ? `<button class="collection-link" data-action="collection">DUCK COLLECTION <span>${escapeHtml(cosmetic(settings.skin).name.toUpperCase())} EQUIPPED</span></button>` : ''}<form id="join-form" class="name-form"><label for="player-name">YOUR NAME</label><input id="player-name" name="name" maxlength="20" minlength="1" value="${escapeHtml(user?.name ?? settings.name)}" required autocomplete="nickname" spellcheck="false"/><button class="console-action" type="submit">${chrome(state.loading ? 'CONNECTING...' : 'LET’S SPLASH!', 'pink', 420, 36)}</button></form>${errorLine(state.error)}${footer(true, 'join', 'OK')}`;
    case 'collection':
      return `${heading('DUCK COLLECTION')}${renderCollection({ ...state, selectedSkin: settings.skin })}<div class="collection-error">${errorLine(state.error)}</div>${footer(true, 'duck', 'PLAY')}`;
    case 'scores':
      return `${heading('HI-SCORES')}${renderRankings(state)}${errorLine(state.error)}${footer(true, 'refresh-scores', 'REFRESH')}`;
    case 'profile':
      return `${heading('DUCK PROFILE')}${renderProfile(state)}<div class="collection-error">${errorLine(state.error)}</div>${footer(false, 'back', 'BACK')}`;
    case 'help':
      return `${heading('HOW TO PLAY')}<div class="help-content"><article><span class="help-number">01</span><h2>${chrome('MAKE A SPLASH', 'pink', 580, 38)}</h2><p>Steer with your pointer or ${promptGlyph('move-up')} ${promptGlyph('move-down')} ${promptGlyph('move-left')} ${promptGlyph('move-right')}.<br>On a touch screen, drag anywhere in the pool.</p></article><article><span class="help-number">02</span><h2>${chrome('GATHER YOUR FLOCK', 'pink', 680, 38)}</h2><p>Collect little ducks to grow. ${promptGlyph('split')} splits your flock.<br>${promptGlyph('eject')} ejects mass. Feed sharks to launch them.<br>Mass slowly fades. Full-size ducks split when slots remain.</p></article><article><span class="help-number">03</span><h2>${chrome('LEAD THE WAY', 'pink', 600, 38)}</h2><p>Watch for larger ducks. Your split pieces can reunite after 20 seconds.<br>In Tub 01, guide all 12 ducks to the pink exit.</p></article><p class="help-extra">${promptGlyph('quack')} QUACK <span>·</span> ${promptGlyph('pause')} MENU <span>·</span> ${promptGlyph('emote')} EMOTES</p></div>${footer(true, 'tub', 'PLAY')}`;
    case 'options':
      return `${heading('OPTIONS')}<div class="options-list"><label><span>SOUND</span><button data-setting="muted">${settings.muted ? 'OFF' : 'ON'} ${triangle('right')}</button></label><label><span>MUSIC</span><button data-setting="music">${settings.music ? 'ON' : 'OFF'} ${triangle('right')}</button></label><label for="volume"><span>VOLUME</span><input id="volume" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"/></label><label><span>PICTURE QUALITY</span><button data-setting="quality">${settings.quality.toUpperCase()} ${triangle('right')}</button></label><label><span>SOFT PICTURE</span><button data-setting="softness">${settings.softness ? 'ON' : 'OFF'} ${triangle('right')}</button></label><label><span>GENTLE MOTION</span><button data-setting="reducedMotion">${settings.reducedMotion ? 'ON' : 'OFF'} ${triangle('right')}</button></label><label><span>POOL TILES</span><button data-setting="theme">${{ blue: 'CLASSIC BLUE', hearts: 'PINK HEARTS', stars: 'MINT STARS', dots: 'BLUE CIRCLES' }[settings.theme]} ${triangle('right')}</button></label></div>${footer(true, 'back', 'DONE')}`;
    case 'controls':
      return `${heading('YOUR CONTROLS')}${presentation.controls ?? ''}${footer(true, 'back', 'DONE')}`;
    case 'sound':
      return `${heading('YOUR SOUND')}<div class="options-list audio-mix">${(
        [
          ['music-volume', 'MUSIC', settings.musicVolume ?? 0.75],
          ['effects-volume', 'EFFECTS', settings.effectsVolume ?? 1],
          ['ambience-volume', 'POOL WATER', settings.ambienceVolume ?? 0.65],
        ] as const
      )
        .map(
          ([id, name, gain]) =>
            `<label for="${id}"><span>${name}</span><input id="${id}" type="range" min="0" max="100" value="${Math.round(gain * 100)}"/></label>`,
        )
        .join(
          '',
        )}<p>Six original scores change with your flock, the rescue, and nearby rivals.</p></div>${footer(true, 'back', 'DONE')}`;
    case 'auth':
      return user
        ? `${heading('MY ACCOUNT')}<section class="account-view"><h2>${chrome(user.name.toUpperCase(), 'pink', 900, 66)}</h2><p>@${escapeHtml(user.username)}</p><div><span>BEST MASS</span><strong>${user.bestMass ?? 0}</strong></div><div><span>DUCKS COLLECTED</span><strong>${user.totalDucks}</strong></div>${state.featureFlags.profiles ? '<button class="text-action" data-action="my-profile">MY PROFILE & FLAG</button>' : ''}${state.featureFlags.collection ? '<button class="text-action" data-action="collection">DUCK COLLECTION</button>' : ''}${user.role !== 'player' && state.featureFlags.moderation ? '<button class="text-action" data-action="admin">POOL ADMIN</button>' : ''}<button class="text-action" data-action="sign-out">SIGN OUT</button></section>${footer(true, 'tub', 'PLAY')}`
        : `${heading(state.authRegister ? 'CREATE ACCOUNT' : 'SIGN IN')}<form id="auth-form" class="auth-form">${state.authRegister ? '<label>DUCK NAME<input name="name" minlength="1" maxlength="20" autocomplete="nickname" required/></label>' : ''}<label>USERNAME<input name="username" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="username" autocapitalize="none" required/></label><label>PASSWORD<input name="password" type="password" minlength="10" maxlength="128" autocomplete="${state.authRegister ? 'new-password' : 'current-password'}" required/></label><p class="field-hint">${state.authRegister ? 'Use 3–20 letters, numbers, or underscores. Password: 10 characters or more.' : 'Sign in to save your best flock and practice time.'}</p>${errorLine(state.error)}<button type="submit" class="console-action" ${state.loading ? 'disabled' : ''}>${chrome(state.loading ? 'ONE MOMENT...' : state.authRegister ? 'LET’S GO!' : 'SIGN IN', 'pink', 580, 48)}</button><button type="button" class="text-action" data-action="toggle-register">${state.authRegister ? 'ALREADY HAVE AN ACCOUNT?' : 'CREATE AN ACCOUNT'}</button></form>${footer(true, 'submit-auth', 'OK')}`;
    case 'admin':
      return `${heading('POOL STAFF')}${renderModeration(state)}<div class="collection-error">${errorLine(state.error)}</div>${footer(true, 'refresh-admin', 'REFRESH')}`;
    case 'pause':
      return `<div class="pause-shade"></div>${heading('TAKE A BREATHER')}<p class="selection-note pause-note">${state.mode === 'endless' ? 'THE POOL KEEPS MOVING' : 'THE CLOCK KEEPS RUNNING'}</p><nav class="pause-menu">${menuButton('KEEP SPLASHING', 'resume', 0, true)}${menuButton('OPTIONS', 'options', 1)}${menuButton('LEAVE POOL', 'leave', 2)}${user && user.role !== 'player' && state.featureFlags.moderation ? menuButton('POOL ADMIN', 'admin', 3) : ''}</nav>${footer(true, 'resume')}`;
    case 'success':
      return `<div class="success-message">${chrome('SUPER! SPLASHING!', 'pink', 1250, 91)}${chrome('GREAT!', 'pink', 850, 110)}</div>`;
    case 'results': {
      const result = state.result;
      if (!result) return '';
      return renderResults(result, Boolean(presentation.replaying));
    }
    case 'playing':
      return '';
  }
}
