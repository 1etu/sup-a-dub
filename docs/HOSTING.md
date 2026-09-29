# Hosting

Run one Bun process on a host with persistent disk. The server serves the web build, API, and WebSockets. Static hosting alone cannot run the game.

## Build and start

Use the Bun version in `package.json`. Run these commands from the repository root:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

Keep the workspace packages and `apps/web/dist` on the host. Use a process supervisor to restart the server after a failure.

## Configuration

Copy `.env.example` to `.env`. Set these values for your host:

| Variable          | Default                   | Hosting value                                           |
| ----------------- | ------------------------- | ------------------------------------------------------- |
| `PORT`            | `3001`                    | Port for the Bun server                                 |
| `HOST`            | `127.0.0.1`               | Keep this for a proxy on the same host                  |
| `DATABASE_PATH`   | `data/supadub.sqlite`     | Absolute path on persistent disk                        |
| `APP_ORIGIN`      | Local development origins | Exact public origin, such as `https://game.example.com` |
| `TRUSTED_PROXIES` | Empty                     | Comma-separated proxy IP addresses, such as `127.0.0.1` |

The database directory must be writable by the server. Keep `.env` and the database out of the public web directory.

`APP_ORIGIN` has no path, query, or wildcard. It controls browser write requests and WebSocket connections. An HTTPS origin enables secure session cookies. Cookies also use `HttpOnly` and `SameSite=Strict`.

## Reverse proxy

Configure HTTPS at your reverse proxy. Route the whole origin to Bun, including `/api/` and `/ws`. Keep the browser's `Origin` header unchanged.

For a single Nginx proxy on the same host, add this block inside your HTTPS server configuration:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 75s;
}
```

The upgrade headers support WebSocket connections. See the [Nginx WebSocket guide](https://nginx.org/en/docs/http/websocket.html). Set `TRUSTED_PROXIES=127.0.0.1` for this example. The server ignores forwarded client addresses from other peers.

## First administrator

Use the same `DATABASE_PATH` as the server. In Bash, enter a password without echo:

```bash
read -r -s -p 'Admin password: ' ADMIN_PASSWORD
printf '\n'
export ADMIN_PASSWORD
bun run admin pool_admin
unset ADMIN_PASSWORD
```

Passwords need 10–128 characters. Usernames need 3–20 letters, digits, or underscores. The command converts usernames to lowercase. `ADMIN_NAME` optionally sets a new account's display name.

For an existing username, this command grants admin access, resets its password, and revokes its sessions. Normal registration never grants admin access.

## Updates and backups

Stop the process cleanly before copying the database directory for a backup. Keep a backup before each update. Startup applies database migrations. Restart the server after the new build completes.

The live world stays in memory. Multiple server processes do not share a pool. Accounts and saved progress remain in SQLite. Use `/api/health` to check server status after startup. This guide does not claim a public deployment or a measured internet capacity.
