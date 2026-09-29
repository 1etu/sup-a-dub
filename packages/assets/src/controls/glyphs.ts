import type { ControllerProfile, InputBinding, KeyboardPlatform } from '@supadub/inputengine';

export type GlyphState = 'normal' | 'pressed' | 'focused' | 'disabled';
export type ControlGlyph = {
  label: string;
  symbol?: 'cross' | 'circle' | 'square' | 'triangle';
  shape: 'key' | 'button' | 'mouse' | 'touch';
  color?: string;
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const names: Record<string, string> = {
  Space: 'SPACE',
  Enter: 'ENTER',
  Escape: 'ESC',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
  ControlLeft: 'CTRL',
  ControlRight: 'CTRL',
  AltLeft: 'ALT',
  AltRight: 'ALT',
  MetaLeft: 'WIN',
  MetaRight: 'WIN',
  Backquote: '`',
  Minus: '−',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backspace: '⌫',
  Tab: 'TAB',
};
const padNames: Record<ControllerProfile, readonly string[]> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', '↑', '↓', '←', '→'],
  playstation: [
    '×',
    '○',
    '□',
    '△',
    'L1',
    'R1',
    'L2',
    'R2',
    'SHARE',
    'OPTIONS',
    'L3',
    'R3',
    '↑',
    '↓',
    '←',
    '→',
  ],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS', '↑', '↓', '←', '→'],
  generic: ['1', '2', '3', '4', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'LS', 'RS', '↑', '↓', '←', '→'],
};

export function describeBinding(
  binding: InputBinding,
  profile: ControllerProfile = 'generic',
  platform: KeyboardPlatform = 'pc',
  keyLabel?: string,
): ControlGlyph {
  if (binding.kind === 'axis')
    return {
      shape: 'button',
      label: `LS ${binding.axis % 2 ? (binding.sign < 0 ? '↑' : '↓') : binding.sign < 0 ? '←' : '→'}`,
    };
  if (binding.kind === 'mouse')
    return { shape: 'mouse', label: ['LMB', 'MMB', 'RMB', 'M4', 'M5'][binding.button] ?? 'MOUSE' };
  if (binding.kind === 'button') {
    const symbol =
      profile === 'playstation'
        ? (['cross', 'circle', 'square', 'triangle'] as const)[binding.button]
        : undefined;
    const color =
      profile === 'xbox'
        ? ['#b3f167', '#ff8e97', '#80d4ff', '#ffe27e'][binding.button]
        : profile === 'playstation'
          ? ['#8cabff', '#ff9aa5', '#f0a5e9', '#8fe7c7'][binding.button]
          : undefined;
    return {
      shape: 'button',
      label: padNames[profile][binding.button] ?? `B${binding.button + 1}`,
      symbol,
      color,
    };
  }
  let label =
    keyLabel || names[binding.code] || binding.code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'NUM ');
  if (platform === 'mac')
    label = label.replace('WIN', '⌘').replace('ALT', '⌥').replace('SHIFT', '⇧').replace('ENTER', 'RETURN');
  const modifiers = [
    binding.ctrl ? 'CTRL' : '',
    binding.alt ? (platform === 'mac' ? '⌥' : 'ALT') : '',
    binding.shift ? (platform === 'mac' ? '⇧' : 'SHIFT') : '',
    binding.meta ? (platform === 'mac' ? '⌘' : 'WIN') : '',
  ].filter(Boolean);
  return { shape: 'key', label: [...modifiers, label].join('+') };
}

export function glyphSvg(glyph: ControlGlyph, state: GlyphState = 'normal'): string {
  const width = Math.max(44, Math.min(156, glyph.label.length * 8.5 + 24));
  const pressed = state === 'pressed';
  const opacity = state === 'disabled' ? '.4' : '1';
  const radius = glyph.shape === 'button' ? 20 : glyph.shape === 'touch' ? 18 : 10;
  const top = pressed ? 5 : 2;
  const foreground = glyph.color ?? '#f6fbff';
  const center = width / 2;
  const symbols: Record<string, string> = {
    cross: `<path d="M${center - 7} 14l14 14m0-14l-14 14"/>`,
    circle: `<circle cx="${center}" cy="21" r="9"/>`,
    square: `<rect x="${center - 8}" y="13" width="16" height="16" rx="1"/>`,
    triangle: `<path d="M${center} 12l10 17h-20z"/>`,
  };
  const content = glyph.symbol
    ? `<g fill="none" stroke="${foreground}" stroke-width="2.6" stroke-linejoin="round">${symbols[glyph.symbol]}</g>`
    : `<text x="50%" y="26" text-anchor="middle" font-family="Supadub Display,Audiowide,Arial,sans-serif" font-size="${glyph.label.length > 6 ? 11 : 13}" font-weight="bold" fill="${foreground}">${escape(glyph.label)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="key-glyph" width="${width}" height="46" viewBox="0 0 ${width} 46" role="img" aria-label="${escape(glyph.label)}" data-glyph-state="${state}"><g opacity="${opacity}"><rect x="2" y="6" width="${width - 4}" height="36" rx="${radius}" fill="#213e81" opacity=".65"/><rect x="2" y="${top}" width="${width - 4}" height="36" rx="${radius}" fill="${pressed ? '#176ca9' : '#3b91c1'}" stroke="${state === 'focused' ? '#c4f761' : '#bde9ec'}" stroke-width="2.4"/><path d="M12 ${top + 5}h${width - 24}" stroke="#efffff" stroke-width="3" opacity=".35" stroke-linecap="round"/>${content}</g></svg>`;
}

export function controlGlyph(
  binding: InputBinding,
  profile?: ControllerProfile,
  platform?: KeyboardPlatform,
  state: GlyphState = 'normal',
  keyLabel?: string,
): string {
  return glyphSvg(describeBinding(binding, profile, platform, keyLabel), state);
}
