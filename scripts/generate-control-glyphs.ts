import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { controlGlyph, glyphSvg, type GlyphState } from '@supadub/assets/controls';
import type { ControllerProfile, InputBinding } from '@supadub/inputengine';

const directory = resolve(import.meta.dir, '../packages/assets/icons/controls');
const states: readonly GlyphState[] = ['normal', 'pressed', 'focused', 'disabled'];
const keys = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
  .map((letter) => `Key${letter}`)
  .concat(
    [...'0123456789'].map((digit) => `Digit${digit}`),
    [
      'Space',
      'Enter',
      'Escape',
      'Tab',
      'Backspace',
      'ShiftLeft',
      'ControlLeft',
      'AltLeft',
      'MetaLeft',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'Delete',
      'Insert',
      'Backquote',
      'Minus',
      'Equal',
      'BracketLeft',
      'BracketRight',
      'Backslash',
      'Semicolon',
      'Quote',
      'Comma',
      'Period',
      'Slash',
    ],
    Array.from({ length: 12 }, (_, index) => `F${index + 1}`),
  );
const records: { path: string; platform: string; binding: InputBinding | 'touch'; state: GlyphState }[] = [];
await mkdir(directory, { recursive: true });
for (const platform of ['pc', 'mac'] as const)
  for (const code of keys)
    for (const state of states) {
      const path = `${platform}-${code}-${state}.svg`;
      const binding: InputBinding = { kind: 'key', code };
      await Bun.write(resolve(directory, path), controlGlyph(binding, 'generic', platform, state));
      records.push({ path, platform, binding, state });
    }
for (const platform of [
  'xbox',
  'playstation',
  'nintendo',
  'generic',
] as const satisfies readonly ControllerProfile[])
  for (let button = 0; button < 16; button++)
    for (const state of states) {
      const path = `${platform}-button-${button}-${state}.svg`;
      const binding: InputBinding = { kind: 'button', button };
      await Bun.write(resolve(directory, path), controlGlyph(binding, platform, 'pc', state));
      records.push({ path, platform, binding, state });
    }
for (let button = 0; button < 5; button++)
  for (const state of states) {
    const path = `mouse-${button}-${state}.svg`;
    const binding: InputBinding = { kind: 'mouse', button };
    await Bun.write(resolve(directory, path), controlGlyph(binding, 'generic', 'pc', state));
    records.push({ path, platform: 'mouse', binding, state });
  }
for (const state of states) {
  const path = `touch-${state}.svg`;
  await Bun.write(resolve(directory, path), glyphSvg({ shape: 'touch', label: 'TAP' }, state));
  records.push({ path, platform: 'touch', binding: 'touch', state });
}
await Bun.write(
  resolve(directory, 'manifest.json'),
  JSON.stringify(
    { version: 1, author: 'Sup-a-Dub', source: 'packages/assets/src/controls/glyphs.ts', assets: records },
    null,
    2,
  ),
);
console.log(`Generated ${records.length} control glyphs.`);
