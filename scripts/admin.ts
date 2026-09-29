import { cleanName } from '@supadub/protocol';
import { Store } from '../apps/server/src/store';
import { validCredentials } from '../apps/server/src/security';

const username = process.argv[2] ?? process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const credentials = validCredentials({ username, password });
if (!credentials) {
  console.error('Set ADMIN_PASSWORD to 10–128 characters. Run: bun run admin <username>');
  process.exit(1);
}

const store = new Store(process.env.DATABASE_PATH ?? 'data/supadub.sqlite');
try {
  const existing = store.userByUsername(credentials.username);
  const passwordHash = await Bun.password.hash(credentials.password);
  store.db.transaction(() => {
    if (existing) {
      store.setAdministrator(existing.id, passwordHash);
      store.audit('local-cli', 'admin-promote', existing.id, 'Local administrator updated');
    } else {
      const user = store.createUser(
        credentials.username,
        cleanName(process.env.ADMIN_NAME) ?? credentials.username,
        passwordHash,
        'admin',
      );
      store.audit('local-cli', 'admin-create', user.id, 'Local administrator created');
    }
  })();
  console.log(`Admin account ready: ${credentials.username}`);
} finally {
  store.close();
}
