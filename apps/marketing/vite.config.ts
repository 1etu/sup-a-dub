import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { marketingAssets } from './assets';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/promo/',
  publicDir: false,
  plugins: [marketingAssets()],
  resolve: {
    alias: ['audioengine', 'assets'].map((name) => ({
      find: `@supadub/${name}`,
      replacement: fileURLToPath(new URL(`../../packages/${name}/src`, import.meta.url)),
    })),
  },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('../web/dist/promo', import.meta.url)),
    emptyOutDir: true,
  },
});
