import {
  PROTOCOL_VERSION,
  type GameMode,
  type RankingPeriod,
  type ModerationAction,
} from '@supadub/protocol';
import { Store, tokenHash, type Identity } from './store';
import type { PoolRuntime } from './pool';
import type { ModerationService } from './moderation-service';
import type { ProfileResult } from './profiles';
import { commandSuggestions } from './commands';
import { staffPlayers } from './staff-players';
import { readCookies, readJson } from './security';

type ApiContext = {
  request: Request;
  url: URL;
  current: Identity;
  headers: Headers;
  response: (body: unknown, status?: number, headers?: Headers) => Response;
  fail: (message: string, status: number, headers?: Headers) => Response;
};

export class CommunityApi {
  constructor(
    private readonly store: Store,
    private readonly runtime: PoolRuntime,
    private readonly moderation: ModerationService,
  ) {}

  async handle(context: ApiContext): Promise<Response | undefined> {
    const { request, url, current, headers, response, fail } = context;
    const path = url.pathname;
    if (path === '/api/features' && request.method === 'GET')
      return response(
        { protocolVersion: PROTOCOL_VERSION, features: this.runtime.features.manifest() },
        200,
        headers,
      );
    if (path === '/api/commands' && request.method === 'GET')
      return response(
        { suggestions: commandSuggestions(current.user?.role ?? 'guest', this.runtime.features) },
        200,
        headers,
      );
    if (path === '/api/rankings' && request.method === 'GET') {
      if (!this.runtime.features.enabled('rankings')) return fail('Rankings are unavailable.', 404, headers);
      const mode = url.searchParams.get('mode') ?? 'endless';
      const period = url.searchParams.get('period') ?? 'day';
      const limit = Number(url.searchParams.get('limit') ?? 20);
      if (
        !['endless', 'practice'].includes(mode) ||
        !['day', 'week', 'all-time'].includes(period) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        return fail('Use a valid ranking mode, period, and limit.', 400, headers);
      return response(
        this.store.rankings.board(mode as GameMode, period as RankingPeriod, current.userId, limit),
        200,
        headers,
      );
    }
    if (path.startsWith('/api/profiles/') && request.method === 'GET') {
      if (!this.runtime.features.enabled('profiles')) return fail('Profiles are unavailable.', 404, headers);
      const id = path.slice('/api/profiles/'.length);
      if (!/^[A-Za-z0-9:_.-]{1,128}$/.test(id)) return fail('Use a valid profile ID.', 400, headers);
      const profile = this.store.profiles.publicProfile(id);
      return profile ? response(profile, 200, headers) : fail('This profile does not exist.', 404, headers);
    }
    if (path === '/api/profile' && request.method === 'POST') {
      if (!this.runtime.features.enabled('profiles')) return fail('Profiles are unavailable.', 404, headers);
      if (!current.user || this.store.activeBan(current))
        return fail('Sign in to edit your profile.', 401, headers);
      const body = await readJson(request);
      if (
        !body ||
        typeof body.name !== 'string' ||
        typeof body.revision !== 'number' ||
        (body.countryCode !== null && typeof body.countryCode !== 'string')
      )
        return fail('Use a valid name and country.', 400, headers);
      const token = readCookies(request).get('sd_session');
      if (!token) return fail('Sign in to edit your profile.', 401, headers);
      const result = (await this.runtime.persistence.enqueue({
        kind: 'profile',
        sessionHash: tokenHash(token),
        guestId: current.guestId,
        edit: { name: body.name, countryCode: body.countryCode, revision: body.revision },
      })) as ProfileResult;
      if (!result.ok) return fail(result.error, result.status, headers);
      this.runtime.refreshAccount(current.user.id);
      return response(result.profile, 200, headers);
    }
    if (!path.startsWith('/api/moderation/') && !path.startsWith('/api/admin/')) return undefined;
    if (!this.runtime.features.enabled('moderation'))
      return fail('Moderation controls are unavailable.', 404, headers);
    if (!current.user || current.user.role === 'player' || this.store.activeBan(current))
      return fail('Staff access is required.', 403, headers);
    if ((path === '/api/moderation/players' || path === '/api/admin/players') && request.method === 'GET')
      return response(
        {
          players: staffPlayers(this.store, this.runtime),
          audit: this.store
            .audits()
            .filter((entry) => current.user?.role === 'admin' || entry.actor_id === current.userId),
        },
        200,
        headers,
      );
    if (request.method !== 'POST') return fail('This page does not exist.', 404, headers);
    const body = await readJson(request);
    if (!body) return fail('Use a valid moderation action.', 400, headers);
    let action: ModerationAction;
    if (path === '/api/moderation/actions') {
      if (
        typeof body.requestId !== 'string' ||
        typeof body.action !== 'string' ||
        typeof body.targetId !== 'string' ||
        (body.caseId !== undefined && typeof body.caseId !== 'string') ||
        (body.reason !== undefined && typeof body.reason !== 'string') ||
        (body.durationSeconds !== undefined &&
          body.durationSeconds !== null &&
          typeof body.durationSeconds !== 'number') ||
        (body.role !== undefined && body.role !== 'player' && body.role !== 'moderator')
      )
        return fail('Use a valid moderation action.', 400, headers);
      action = {
        requestId: body.requestId,
        action: body.action as ModerationAction['action'],
        targetId: body.targetId,
        caseId: body.caseId as string | undefined,
        reason: body.reason as string | undefined,
        durationSeconds: body.durationSeconds as number | null | undefined,
        role: body.role as 'player' | 'moderator' | undefined,
      };
    } else {
      const legacy = new Map<string, ModerationAction['action']>([
        ['/api/admin/ban', 'ban'],
        ['/api/admin/unban', 'unban'],
        ['/api/admin/mute', 'mute'],
        ['/api/admin/unmute', 'unmute'],
        ['/api/admin/chat-delete', 'delete-message'],
      ]);
      const kind = legacy.get(path);
      if (!kind) return fail('This page does not exist.', 404, headers);
      if (
        typeof body.id !== 'string' ||
        (body.reason !== undefined && typeof body.reason !== 'string') ||
        (body.durationHours !== undefined && typeof body.durationHours !== 'number') ||
        (body.durationMinutes !== undefined && typeof body.durationMinutes !== 'number')
      )
        return fail('Use a valid moderation action.', 400, headers);
      action = {
        requestId: typeof body.requestId === 'string' ? body.requestId : crypto.randomUUID(),
        action: kind,
        targetId: body.id,
        reason: body.reason as string | undefined,
        durationSeconds:
          kind === 'ban'
            ? body.durationHours === undefined
              ? null
              : (body.durationHours as number) * 3600
            : kind === 'mute'
              ? (body.durationMinutes as number) * 60
              : undefined,
      };
    }
    const result = await this.moderation.act(readCookies(request).get('sd_session'), action, current.guestId);
    return response(
      {
        ...result.result,
        ...(!result.result.ok
          ? { error: result.result.message }
          : path.startsWith('/api/admin/')
            ? { players: staffPlayers(this.store, this.runtime) }
            : {}),
      },
      result.status,
      headers,
    );
  }
}
