import { ServerFeatures, type ServerFeatureFlags } from './features';
import { CommunityApi } from './community-api';
import { PreferencesApi } from './preferences-api';
import { ModerationService } from './moderation-service';
import { CommandService } from './commands';
import { parseEquipRequest } from '@supadub/cosmetics';
import { resolve, sep } from 'node:path';
import {
  cleanName,
  parseClientMessage,
  WORLD,
  ENDLESS,
  CONTROL_PREFERENCES_MAX_BYTES,
  PROTOCOL_VERSION,
  type AdminPlayer,
  type GameMode,
  type LeaderboardResponse,
  type ServerMessage,
} from '@supadub/protocol';
import { PoolRuntime, type SocketData } from './pool';
import type { EquipResult } from './progression';
import { Store, profile, tokenHash, type Identity } from './store';
import {
  clientAddress,
  RateLimiter,
  readCookies,
  readJson,
  sessionCookie,
  trustedProxies,
  validCredentials,
  originAllowed as matchesOrigin,
} from './security';

export type ServerOptions = {
  port?: number;
  hostname?: string;
  databasePath?: string;
  appOrigin?: string;
  staticDir?: string;
  bots?: number;
  trustedProxies?: string;
  features?: ServerFeatureFlags;
};

export async function createGameServer(options: ServerOptions = {}) {
  const store = new Store(options.databasePath ?? process.env.DATABASE_PATH ?? 'data/supadub.sqlite');
  const limiter = new RateLimiter();
  const features = new ServerFeatures(options.features);
  await features.start();
  const runtime = new PoolRuntime(store, options.bots ?? 6, features);
  const moderation = new ModerationService(store, runtime);
  const commands = new CommandService(runtime, moderation);
  runtime.onCommand = (socket, id, text) => commands.execute(socket, id, text);
  const community = new CommunityApi(store, runtime, moderation);
  const preferences = new PreferencesApi(store, runtime.persistence);
  const { sockets, rooms } = runtime;
  const startedAt = Date.now();
  const staticRoot = resolve(options.staticDir ?? 'apps/web/dist');
  const appOrigin = options.appOrigin ?? process.env.APP_ORIGIN;
  const proxies = trustedProxies(options.trustedProxies ?? process.env.TRUSTED_PROXIES ?? '');
  const secureCookies = appOrigin?.startsWith('https://') ?? false;
  const dummyHash = await Bun.password.hash(crypto.randomUUID());
  let authJobs = 0;
  let stopTask: Promise<void> | null = null;
  let server: Bun.Server<SocketData>;

  const send = runtime.send.bind(runtime);

  function originAllowed(request: Request): boolean {
    return matchesOrigin(request.headers.get('origin'), appOrigin, server.port!);
  }

  function identity(request: Request, addressHash: string, headers: Headers): Identity {
    const cookies = readCookies(request);
    let guest = cookies.get('sd_guest') ? store.guest(cookies.get('sd_guest')!) : null;
    if (!guest) {
      const created = store.makeGuest(addressHash);
      guest = { id: created.id, address_hash: addressHash };
      headers.append('set-cookie', sessionCookie('sd_guest', created.token, 365 * 86400, secureCookies));
    }
    const user = store.sessionUser(cookies.get('sd_session'));
    return { id: user?.id ?? guest.id, userId: user?.id ?? null, user, guestId: guest.id, addressHash };
  }

  function response(body: unknown, status = 200, headers = new Headers()): Response {
    headers.set('cache-control', 'no-store');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'same-origin');
    headers.set('cross-origin-resource-policy', 'same-origin');
    return Response.json(body, { status, headers });
  }

  function fail(message: string, status: number, headers?: Headers): Response {
    return response({ error: message }, status, headers);
  }

  async function handle(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url);
    const addressHash = store.addressHash(
      clientAddress(
        server.requestIP(request)?.address ?? 'unknown',
        request.headers.get('x-forwarded-for'),
        proxies,
      ),
    );
    const headers = new Headers();
    const allowed = originAllowed(request);
    if (allowed) {
      headers.set('access-control-allow-origin', request.headers.get('origin')!);
      headers.set('access-control-allow-credentials', 'true');
      headers.set('vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      if (!allowed) return fail('This origin is not allowed.', 403, headers);
      headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
      headers.set('access-control-allow-headers', 'Content-Type');
      return new Response(null, { status: 204, headers });
    }
    if (url.pathname === '/api/health' && request.method === 'GET') {
      const all = [...rooms.values()];
      return response(
        {
          status: 'ok',
          protocolVersion: PROTOCOL_VERSION,
          rulesVersion: ENDLESS.rulesVersion,
          players: all.reduce(
            (sum, world) => sum + [...world.players.values()].filter((player) => !player.bot).length,
            0,
          ),
          connections: sockets.size,
          online: runtime.online,
          pendingSaves: runtime.persistence.size,
          pendingRankings: runtime.rankings.size,
          rankingSaveFailures: runtime.rankings.failures,
          performance: runtime.performance(),
          bodies: all.reduce((sum, world) => sum + world.bodies.size, 0),
          pellets: all.reduce((sum, world) => sum + world.pellets.size, 0),
          sharks: all.reduce((sum, world) => sum + world.sharks.size, 0),
          bots: all.reduce(
            (sum, world) => sum + [...world.players.values()].filter((player) => player.bot).length,
            0,
          ),
          rooms: all.length,
          chunks: all.reduce((sum, world) => sum + world.chunks.size, 0),
          tickRate: WORLD.tickRate,
          snapshotRate: WORLD.snapshotRate,
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        },
        200,
        headers,
      );
    }
    if (url.pathname === '/ws') {
      if (!allowed || request.method !== 'GET') return fail('This origin is not allowed.', 403, headers);
      if (!limiter.take(`connect:${addressHash}`, 30, 60000))
        return fail('Too many connections. Try again in a minute.', 429, headers);
      if (sockets.size >= ENDLESS.maxSockets) return fail('This pool is full. Try again soon.', 503, headers);
      const user = identity(request, addressHash, headers);
      if (store.activeBan(user)) return fail('This player cannot join the pool.', 403, headers);
      if ([...sockets.values()].filter((socket) => socket.data.identity.id === user.id).length >= 4)
        return fail('Close another game tab first.', 429, headers);
      const upgraded = server.upgrade(request, {
        headers,
        data: {
          id: crypto.randomUUID(),
          identity: user,
          roomId: null,
          joinedAt: Date.now(),
          lastMessageAt: Date.now(),
          invalid: 0,
          playerId: null,
          phase: 'new',
          previousSnapshot: null,
          lastFullAt: 0,
          sessionToken: readCookies(request).get('sd_session'),
        },
      });
      return upgraded ? undefined : fail('The connection could not start.', 400, headers);
    }
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'GET' && request.method !== 'POST')
        return fail('Use GET or POST for this request.', 405, headers);
      if (request.method === 'POST' && !allowed) return fail('This origin is not allowed.', 403, headers);
      if (!limiter.take(`api:${addressHash}`, 240, 60000))
        return fail('Too many requests. Try again in a minute.', 429, headers);
      if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
        if (!features.enabled('rankings')) return fail('Rankings are unavailable.', 404, headers);
        const live = [...(rooms.get('endless')?.players.values() ?? [])]
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
          .slice(0, 20)
          .map((player) => ({ id: player.id, name: player.name, score: player.score, bot: player.bot }));
        const boards: LeaderboardResponse = {
          allTime: store.massHighScores(),
          legacy: store.highScores(),
          live,
          practice: store.practiceLeaderboard(),
        };
        return response(boards, 200, headers);
      }
      const current = identity(request, addressHash, headers);
      if (url.pathname === '/api/preferences/controls') {
        const result = await preferences.controls(request, current);
        return response(result.body, result.status, headers);
      }
      const communityResponse = await community.handle({ request, url, current, headers, response, fail });
      if (communityResponse) return communityResponse;
      if (
        url.pathname === '/api/inventory' ||
        url.pathname === '/api/achievements' ||
        url.pathname === '/api/inventory/equip'
      ) {
        if (!features.enabled('collection')) return fail('The collection is unavailable.', 404, headers);
        if (!current.user || store.activeBan(current))
          return fail('Sign in to open your collection.', 401, headers);
        if (url.pathname === '/api/inventory' && request.method === 'GET')
          return response(store.progression.inventory(current.user.id), 200, headers);
        if (url.pathname === '/api/achievements' && request.method === 'GET')
          return response(store.progression.achievements(current.user.id), 200, headers);
        if (url.pathname === '/api/inventory/equip' && request.method === 'POST') {
          const data = await readJson(request);
          const edit = parseEquipRequest(data);
          if (!edit) return fail('Select a valid item and slot.', 400, headers);
          const result = (await runtime.persistence.enqueue({
            kind: 'equip',
            userId: current.user.id,
            edit,
            sessionHash: tokenHash(readCookies(request).get('sd_session') ?? ''),
            guestId: current.guestId,
          })) as EquipResult;
          if (!result.ok) return fail(result.error, result.status, headers);
          for (const world of rooms.values())
            for (const player of world.players.values())
              if (player.identityId === current.user.id) {
                world.setLoadout(player.id, result.inventory.loadout);
              }
          return response(result.inventory, 200, headers);
        }
        return fail('Use the correct method for this request.', 405, headers);
      }
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        return response(
          {
            user: current.user
              ? profile(
                  current.user,
                  store.progression.inventory(current.user.id).equippedSkin,
                  store.progression.inventory(current.user.id).loadout,
                )
              : null,
            guestId: current.guestId,
            practiceBest: current.userId ? store.practiceBest(current.userId) : null,
          },
          200,
          headers,
        );
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        const token = readCookies(request).get('sd_session');
        store.revokeSession(token);
        headers.append('set-cookie', sessionCookie('sd_session', '', 0, secureCookies));
        for (const socket of sockets.values())
          if (token && socket.data.sessionToken === token) socket.close(1000, 'Signed out');
        return response({ user: null, guestId: current.guestId, practiceBest: null }, 200, headers);
      }
      if (
        (url.pathname === '/api/auth/register' || url.pathname === '/api/auth/login') &&
        request.method === 'POST'
      ) {
        const register = url.pathname.endsWith('register');
        if (!limiter.take(`auth:${addressHash}`, 20, 15 * 60000) || authJobs >= 4)
          return fail('Too many sign-in attempts. Try again later.', 429, headers);
        const data = await readJson(request);
        const credentials = validCredentials(data);
        if (!credentials)
          return fail('Use a 3–20 character username and a 10–128 character password.', 400, headers);
        let user = store.userByUsername(credentials.username);
        if (register && store.activeBan(current))
          return fail('This player cannot join the pool.', 403, headers);
        if (register && user) return fail('This username is already in use.', 409, headers);
        if (authJobs >= 4) return fail('Too many sign-in attempts. Try again later.', 429, headers);
        authJobs++;
        try {
          if (register) {
            const name = cleanName(data?.name ?? credentials.username);
            if (!name) return fail('Use a display name with 1–20 characters.', 400, headers);
            const hash = await Bun.password.hash(credentials.password);
            if (store.activeBan(current)) return fail('This player cannot join the pool.', 403, headers);
            try {
              user = store.createUser(credentials.username, name, hash);
            } catch {
              return fail('This username is already in use.', 409, headers);
            }
          } else {
            const correct = await Bun.password.verify(credentials.password, user?.password_hash ?? dummyHash);
            if (!correct || !user) return fail('The username or password is incorrect.', 401, headers);
          }
          if (!user) return fail('The account could not open.', 500, headers);
          if (store.activeBan({ id: user.id, userId: user.id, guestId: current.guestId, addressHash }))
            return fail('This player cannot join the pool.', 403, headers);
          store.revokeSession(readCookies(request).get('sd_session'));
          const token = store.makeSession(user.id);
          headers.append('set-cookie', sessionCookie('sd_session', token, 30 * 86400, secureCookies));
          return response(
            {
              user: profile(
                user,
                store.progression.inventory(user.id).equippedSkin,
                store.progression.inventory(user.id).loadout,
              ),
              guestId: current.guestId,
              practiceBest: store.practiceBest(user.id),
            },
            register ? 201 : 200,
            headers,
          );
        } finally {
          authJobs--;
        }
      }
      return fail('This page does not exist.', 404, headers);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return fail('This page does not exist.', 404, headers);
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return fail('This path is invalid.', 400, headers);
    }
    const candidate = resolve(staticRoot, `.${pathname}`);
    if (candidate !== staticRoot && !candidate.startsWith(`${staticRoot}${sep}`))
      return fail('This page does not exist.', 404, headers);
    const file = Bun.file(pathname === '/' ? resolve(staticRoot, 'index.html') : candidate);
    if (await file.exists())
      return new Response(request.method === 'HEAD' ? null : file, {
        headers: {
          'content-type': file.type,
          'cache-control': pathname.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
          'x-content-type-options': 'nosniff',
        },
      });
    const index = Bun.file(resolve(staticRoot, 'index.html'));
    if (!pathname.includes('.') && (await index.exists()))
      return new Response(index, { headers: { 'content-type': 'text/html', 'cache-control': 'no-cache' } });
    return fail('This page does not exist.', 404, headers);
  }

  server = Bun.serve({
    port: options.port ?? Number(process.env.PORT ?? 3001),
    hostname: options.hostname ?? process.env.HOST ?? '127.0.0.1',
    maxRequestBodySize: CONTROL_PREFERENCES_MAX_BYTES,
    idleTimeout: 15,
    async fetch(request) {
      try {
        return await handle(request);
      } catch (error) {
        console.error('Request failed', error instanceof Error ? error.message : 'Unknown error');
        return fail('This request could not finish. Try again.', 500);
      }
    },
    websocket: {
      data: {} as SocketData,
      maxPayloadLength: 2048,
      idleTimeout: 30,
      backpressureLimit: ENDLESS.maxSocketBytes,
      closeOnBackpressureLimit: true,
      sendPings: true,
      perMessageDeflate: true,
      open(socket) {
        runtime.open(socket);
      },
      message(socket, raw) {
        if (!sockets.has(socket.data.id)) return;
        if (typeof raw !== 'string' || !limiter.take(`ws:${socket.data.id}`, 100, 1000)) {
          socket.close(1008, 'Too many messages');
          return;
        }
        socket.data.lastMessageAt = Date.now();
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          'type' in parsed &&
          (parsed.type === 'join' || parsed.type === 'lobby') &&
          (!('protocolVersion' in parsed) || parsed.protocolVersion !== PROTOCOL_VERSION)
        ) {
          send(socket, {
            type: 'error',
            code: 'reload_required',
            message: 'The pool uses a newer game version. Reload the page.',
          });
          socket.close(4006, 'Reload required');
          return;
        }
        const message = parseClientMessage(parsed);
        if (!message) {
          send(socket, { type: 'error', code: 'invalid_input', message: 'This input is invalid.' });
          if (++socket.data.invalid >= 4) socket.close(1008, 'Invalid input');
          return;
        }
        runtime.message(socket, message);
      },
      drain(socket) {
        runtime.drain(socket);
      },
      close(socket) {
        runtime.disconnect(socket);
      },
    },
  });

  return {
    server,
    store,
    rooms,
    sockets,
    runtime,
    stop(): Promise<void> {
      stopTask ??= (async () => {
        try {
          await runtime.stop();
        } finally {
          try {
            await server.stop(true);
          } finally {
            try {
              await features.stop();
            } finally {
              store.close();
            }
          }
        }
      })();
      return stopTask;
    },
  };
}
