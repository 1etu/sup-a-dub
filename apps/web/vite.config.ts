import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const apiTarget = process.env.SUPADUB_API_TARGET ?? 'http://127.0.0.1:3001';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: [
      ...['graphics', 'sfx', 'controls', 'music'].map((part) => ({
        find: new RegExp('^@supadub/assets/' + part + '$'),
        replacement: fileURLToPath(
          new URL('../../packages/assets/src/' + part + '/index.ts', import.meta.url),
        ),
      })),
      ...[
        'core',
        'features',
        'graphics',
        'network',
        'protocol',
        'gameengine',
        'audioengine',
        'inputengine',
        'sprites',
        'assets',
        'achievements',
        'cosmetics',
      ].map((name) => ({
        find: new RegExp('^@supadub/' + name + '$'),
        replacement: fileURLToPath(new URL('../../packages/' + name + '/src/index.ts', import.meta.url)),
      })),
    ],
  },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      allow: ['.', '../../packages', '../../node_modules'].map((path) =>
        fileURLToPath(new URL(path, import.meta.url)),
      ),
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/.local/**',
        '**/.logs/**',
        '**/data/**',
        '**/*.sqlite',
        '**/*.sqlite-*',
      ],
    },
    proxy: {
      '/api': apiTarget,
      '/ws': { target: apiTarget.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
