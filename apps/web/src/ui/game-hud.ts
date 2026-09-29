import type { GameMode } from '@supadub/protocol';
import { promptGlyph } from './control-prompts';

const flockSymbol = `<svg class="flock-symbol" viewBox="0 0 52 38" aria-hidden="true"><path d="M23 20c-5-2-6-8-2-12 4-5 12-3 13 3l7 3-7 3c-1 2-2 3-4 4 6 4 11 1 14-3 1 11-7 17-16 16-9-1-14-6-13-12 2 2 5 2 8-2Z"/><path d="M10 23c-4-2-5-7-2-10 4-4 10-2 11 3l6 2-6 3-3 3c5 3 9 1 12-2 0 9-6 14-14 13S2 30 3 25c2 1 4 1 7-2Z"/></svg>`;

export function gameplayPrompts(chat: boolean): string {
  return `<span>SPLIT ${promptGlyph('split')}</span><span>EJECT ${promptGlyph('eject')}</span>${chat ? `<span>CHAT ${promptGlyph('chat')}</span>` : ''}`;
}

export function renderHud(mode: GameMode): string {
  const practice = mode === 'practice';
  return `<section class="flock-stats ${practice ? 'practice-stats' : ''}" aria-label="${practice ? 'Practice progress' : 'Your flock'}"><div class="flock-total" aria-label="${practice ? 'Elapsed time' : 'Mass'}">${practice ? '<span class="stat-caption">TIME</span>' : ''}<strong id="main-score">${practice ? '00:00.00' : '40'}</strong></div><div class="flock-pieces" aria-label="${practice ? 'Ducks saved' : 'Pieces'}">${flockSymbol}<strong><span id="${practice ? 'flock-count' : 'piece-count'}">${practice ? '0' : '1'}</span><small> / ${practice ? '12' : '16'}</small></strong></div><p id="flock-notice" role="status"></p></section>${practice ? '<p id="game-hint" class="rescue-hint">LEAD THE DUCKS TO THE PINK EXIT</p>' : ''}<footer class="game-prompts" aria-label="Game controls">${practice ? '' : `<div id="game-hint">${gameplayPrompts(true)}</div>`}<button data-action="pause" aria-label="Open game menu">MENU ${promptGlyph('pause')}</button></footer><div class="connection-info" id="connection-info"></div><div class="touch-controls"><button data-action="emote" aria-label="Open emote wheel">EMOTE</button><button data-action="quack" aria-label="Quack">QUACK</button>${practice ? '' : '<button id="touch-split" data-action="split" aria-label="Split your ducks">SPLIT</button><button id="touch-eject" data-action="eject" aria-label="Eject mass">EJECT</button>'}</div><div class="event-toast" id="event-toast" role="status"></div>`;
}
