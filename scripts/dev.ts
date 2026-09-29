import { syncAssets } from './sync-assets';

await syncAssets();

const children = [
  Bun.spawn(['bun', '--watch', 'apps/server/src/index.ts'], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, PORT: '3001' },
  }),
  Bun.spawn(['bun', 'run', '--bun', 'dev'], { cwd: 'apps/web', stdio: ['inherit', 'inherit', 'inherit'] }),
];

function stop() {
  children.forEach((child) => child.kill());
}

process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});
const firstExit = await Promise.race(children.map((child) => child.exited));
stop();
process.exit(firstExit);
