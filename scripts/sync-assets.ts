import { copyFile, cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const entries = [
  ['models/duck.glb', 'assets/models/duck.glb'],
  ['models/duck-lods.json', 'assets/models/duck-lods.json'],
  ['models/SCEA.txt', 'assets/models/SCEA.txt'],
  ['models/LICENSE.md', 'assets/models/LICENSE.md'],
  ['models/README.md', 'assets/models/README.md'],
  ['models/metadata.json', 'assets/models/metadata.json'],
  ['fonts/supadub-display.ttf', 'fonts/supadub-display.ttf'],
  ['fonts/Supadub-Display-OFL.txt', 'fonts/Supadub-Display-OFL.txt'],
  ['fonts/audiowide.ttf', 'fonts/audiowide.ttf'],
  ['fonts/Audiowide-OFL.txt', 'fonts/Audiowide-OFL.txt'],
  ['fonts/rajdhani-bold.ttf', 'fonts/rajdhani-bold.ttf'],
  ['fonts/Rajdhani-OFL.txt', 'fonts/Rajdhani-OFL.txt'],
  ['ASSET-PROVENANCE.md', 'assets/ASSET-PROVENANCE.md'],
] as const;

export async function syncAssets() {
  await mkdir(resolve(root, 'apps/web/public'), { recursive: true });
  await copyFile(
    resolve(root, 'THIRD_PARTY_NOTICES.md'),
    resolve(root, 'apps/web/public/THIRD_PARTY_NOTICES.md'),
  );
  for (const [source, output] of entries) {
    const target = resolve(root, 'apps/web/public', output);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(root, 'packages/assets', source), target);
  }
  await cp(resolve(root, 'packages/assets/icons'), resolve(root, 'apps/web/public/assets/icons'), {
    recursive: true,
  });
  await cp(resolve(root, 'packages/assets/flags'), resolve(root, 'apps/web/public/assets/flags'), {
    recursive: true,
  });
  await cp(resolve(root, 'packages/assets/ui/awards'), resolve(root, 'apps/web/public/assets/ui/awards'), {
    recursive: true,
  });
  if (await Bun.file(resolve(root, 'packages/assets/music/browser/catalog.json')).exists()) {
    await cp(resolve(root, 'packages/assets/music/browser'), resolve(root, 'apps/web/public/assets/music'), {
      recursive: true,
    });
  }
}

if (import.meta.main) await syncAssets();
