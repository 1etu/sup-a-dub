import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const root = resolve(import.meta.dirname, '../..');
const art = 'packages/assets/marketing';
const sources: Record<string, string> = {
  'wordmark.svg': `${art}/wordmark.svg`,
  'icon.png': 'docs/marketing/brand/supadub-avatar-192.png',
  'wallpaper.png': 'docs/marketing/brand/supadub-hero.png',
  'gameplay.mp4': 'docs/marketing/video/gameplay.mp4',
  'credits.txt': `${art}/CREDITS.txt`,
  'SCEA.txt': 'packages/assets/models/SCEA.txt',
  'display-license.txt': 'packages/assets/fonts/Supadub-Display-OFL.txt',
  'numbers-license.txt': 'packages/assets/fonts/Rajdhani-OFL.txt',
  ...Object.fromEntries(
    ['yellow', 'gold', 'pink', 'mint', 'captain', 'shark', 'film', 'rescue', 'endless', 'toys'].map(
      (name) => [`${name}.webp`, `${art}/${name}.webp`],
    ),
  ),
};

export function marketingAssets(): Plugin {
  return {
    name: 'supadub-marketing-assets',
    async buildStart() {
      if (this.meta.watchMode) return;
      for (const [name, path] of Object.entries(sources)) {
        this.emitFile({
          type: 'asset',
          fileName: `art/${name}`,
          source: await readFile(resolve(root, path)),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split('?')[0] ?? '';
        const name = pathname.replace(/^\/(?:promo\/)?art\//, '');
        const source = Object.hasOwn(sources, name) ? sources[name] : undefined;
        if (!source || name === pathname) return next();
        try {
          const file = Bun.file(resolve(root, source));
          response.setHeader('Content-Type', file.type);
          response.end(await file.bytes());
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
