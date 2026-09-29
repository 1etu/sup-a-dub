import { createGameServer } from './server';

const app = await createGameServer();
console.log(`Sup-a-Dub server: ${app.server.url}`);

async function shutdown() {
  await app.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
