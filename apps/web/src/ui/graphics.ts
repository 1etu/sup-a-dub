import { promptGlyph } from './control-prompts';

export const escapeHtml = (value: unknown): string =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

let sequence = 0;
type ChromeColor = 'pink' | 'blue' | 'lime' | 'white';
const chromeGradients: Record<ChromeColor, readonly (readonly [number, string])[]> = {
  pink: [
    [0, '#fbc1db'],
    [0.49, '#f9bad5'],
    [0.51, '#f699bd'],
    [1, '#fa98bd'],
  ],
  blue: [
    [0, '#afdef7'],
    [0.167, '#70c9f7'],
    [0.306, '#209fe9'],
    [0.444, '#0086e9'],
    [0.583, '#006ed3'],
    [0.722, '#014dac'],
    [0.861, '#06348e'],
    [0.944, '#02297f'],
    [1, '#022573'],
  ],
  lime: [
    [0, '#a4f348'],
    [0.49, '#83e82b'],
    [0.51, '#5bcd27'],
    [1, '#309d31'],
  ],
  white: [
    [0, '#ffffff'],
    [0.49, '#f4f2fc'],
    [0.51, '#e2e2f4'],
    [1, '#d4d9f1'],
  ],
};

export function chrome(
  text: string,
  color: ChromeColor = 'pink',
  width = 600,
  size = 64,
  className = '',
): string {
  const id = `chrome-${sequence++}`;
  const stops = chromeGradients[color]
    .map(([offset, fill]) => `<stop offset="${offset}" stop-color="${fill}"/>`)
    .join('');
  const outline = Math.max(3.8, size * 0.035);
  const gradient =
    color === 'blue'
      ? `gradientUnits="userSpaceOnUse" x1="0" y1="${size * (1 - 1486 / 2048)}" x2="0" y2="${size * (1 + 52 / 2048)}"`
      : 'x1="0" y1="0" x2="0" y2="1"';
  return `<svg class="chrome ${className}" width="${width}" height="${size * 1.35}" viewBox="0 0 ${width} ${size * 1.35}" role="img" aria-label="${escapeHtml(text)}"><defs><linearGradient id="${id}" ${gradient}>${stops}</linearGradient></defs><g font-family="Supadub Display, Audiowide, sans-serif" font-size="${size}" font-weight="normal" text-anchor="middle" stroke-linejoin="round"><text x="50%" y="${size}" fill="none" stroke="${color === 'pink' ? '#d6a4c6' : '#69bece'}" stroke-width="${outline + 4}">${escapeHtml(text)}</text><text x="50%" y="${size}" fill="url(#${id})" stroke="#f1f0ef" stroke-width="${outline}" paint-order="stroke fill">${escapeHtml(text)}</text></g></svg>`;
}

export function triangle(direction: 'left' | 'right' | 'up', color = 'blue'): string {
  return `<span class="triangle ${direction} ${color}" aria-hidden="true"></span>`;
}

export function logo(): string {
  return `<div class="game-logo" aria-label="Sup-a-Dub"><span class="logo-sup">${chrome('SUP', 'pink', 160, 42)}</span><span class="logo-dub">${chrome('a-DUB', 'blue', 355, 70)}</span><span class="logo-bubbles" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
}

export function controllerButton(shape: 'cross' | 'circle' | 'triangle'): string {
  return promptGlyph(shape === 'cross' ? 'confirm' : shape === 'circle' ? 'back' : 'account');
}

export function footer(back = true, action = 'confirm', label = 'OK', account = false): string {
  return `<footer class="console-footer">${account ? `<button data-action="auth">SIGN IN ${controllerButton('triangle')}</button>` : ''}<button data-action="${action}">${escapeHtml(label)} ${controllerButton('cross')}</button>${back ? `<button data-action="back">BACK ${controllerButton('circle')}</button>` : ''}</footer>`;
}

export function banIcon(): string {
  return `<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path fill="#ffdf43" stroke="#fff3b9" stroke-width="1.5" d="M11 23c-1-3 0-6 3-7-2-8 9-11 12-5 2 4-1 7-3 8l6 1-2 4c-3 7-13 9-18 3l-3-6z"/><circle cx="23" cy="12" r="1.4" fill="#283454"/><g fill="none" stroke="#ee73a7" stroke-width="4"><circle cx="20" cy="20" r="16"/><path d="M9 31 31 9"/></g></svg>`;
}

export function medal(kind: 'gold' | 'silver' | 'bronze'): string {
  return `<img class="medal" src="/assets/ui/awards/award-${kind}.png" width="512" height="512" alt="${kind} medal" draggable="false"/>`;
}

export function timecode(ms: number): string {
  const time = Math.max(0, Math.floor(ms / 10));
  return `${String(Math.floor(time / 6000)).padStart(2, '0')}:${String(Math.floor(time / 100) % 60).padStart(2, '0')}.${String(time % 100).padStart(2, '0')}`;
}
