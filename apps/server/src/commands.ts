import type { AccountRole, CommandSuggestion, ModerationAction, RankingPeriod } from '@supadub/protocol';
import type { PoolRuntime, PoolSocket } from './pool';
import type { ServerFeatures } from './features';
import type { ModerationService } from './moderation-service';
import { RateLimiter } from './security';

export function commandSuggestions(
  role: AccountRole | 'guest',
  features: ServerFeatures,
): CommandSuggestion[] {
  const commands: CommandSuggestion[] = [
    { command: '/help', usage: '/help', description: 'Show the commands you can use.' },
  ];
  if (features.enabled('profiles'))
    commands.push({
      command: '/profile',
      usage: '/profile <player-id>',
      description: 'Open a public player profile.',
    });
  if (features.enabled('rankings'))
    commands.push({
      command: '/leaderboard',
      usage: '/leaderboard <endless|practice> <day|week|all-time>',
      description: 'Open the saved rankings.',
    });
  if (role !== 'guest' && role !== 'player' && features.enabled('moderation')) {
    commands.push(
      {
        command: '/kick',
        usage: '/kick <player-id> <reason>',
        description: 'End a lower-role player connection.',
      },
      {
        command: '/mute',
        usage: '/mute <player-id> <10m|1h|1d> <reason>',
        description: 'Temporarily stop an account from sending chat.',
      },
      {
        command: '/unmute',
        usage: '/unmute <player-id> [case-id]',
        description: 'Revoke a mute you can manage.',
      },
      {
        command: '/ban',
        usage:
          role === 'admin'
            ? '/ban <player-id> <10m|1h|1d|permanent> <reason>'
            : '/ban <player-id> <10m|1h|1d> <reason>',
        description: 'Restrict a lower-role player from the pool.',
      },
      {
        command: '/unban',
        usage: '/unban <player-id> [case-id]',
        description: 'Revoke a ban you can manage.',
      },
      {
        command: '/delete',
        usage: '/delete <message-id>',
        description: 'Remove a lower-role player message.',
      },
    );
    if (role === 'admin')
      commands.push(
        { command: '/mod', usage: '/mod <player-id>', description: 'Appoint a moderator.' },
        {
          command: '/unmod',
          usage: '/unmod <player-id>',
          description: 'Return a moderator to player access.',
        },
      );
  }
  return commands;
}

function durationSeconds(value: string): number | null | undefined {
  if (value === 'permanent') return null;
  const match = /^(\d{1,8})(s|m|h|d)$/.exec(value);
  if (!match) return undefined;
  return Number(match[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2]!] ?? 0);
}

export class CommandService {
  private readonly limiter = new RateLimiter();
  constructor(
    private readonly runtime: PoolRuntime,
    private readonly moderation: ModerationService,
  ) {}

  async execute(socket: PoolSocket, requestId: string, text: string): Promise<void> {
    const send = (
      ok: boolean,
      message: string,
      extra: Partial<{
        profileId: string;
        ranking: { mode: 'endless' | 'practice'; period: RankingPeriod };
        suggestions: CommandSuggestion[];
      }> = {},
    ) => this.runtime.send(socket, { type: 'command-result', requestId, ok, message, ...extra });
    if (!this.limiter.take(socket.data.identity.id, 12, 10000)) {
      send(false, 'Wait before another command.');
      return;
    }
    const user = this.runtime.freshUser(socket);
    if (socket.data.identity.userId && !user) return;
    const [command, target, ...rest] = text.trim().split(/\s+/);
    const suggestions = commandSuggestions(user?.role ?? 'guest', this.runtime.features);
    if (!suggestions.some((entry) => entry.command === command)) {
      send(false, 'This command is not available.', { suggestions });
      return;
    }
    if (command === '/help') {
      send(true, 'Choose a command from the list.', { suggestions });
      return;
    }
    if (command === '/profile') {
      const id = target ?? user?.id;
      const profile = id ? this.runtime.store.profiles.publicProfile(id) : null;
      send(
        !!profile,
        profile ? 'The player profile is ready.' : 'Use the account ID from a player profile.',
        profile ? { profileId: profile.id } : {},
      );
      return;
    }
    if (command === '/leaderboard') {
      const mode = target ?? 'endless';
      const period = rest[0] ?? 'day';
      if (!['endless', 'practice'].includes(mode) || !['day', 'week', 'all-time'].includes(period)) {
        send(false, 'Use /leaderboard endless day, week, or all-time.');
        return;
      }
      send(true, 'The rankings are ready.', {
        ranking: { mode: mode as 'endless' | 'practice', period: period as RankingPeriod },
      });
      return;
    }
    if (!target) {
      send(false, 'Select a target ID first.');
      return;
    }
    let action: ModerationAction;
    if (command === '/ban' || command === '/mute')
      action = {
        requestId,
        action: command === '/ban' ? 'ban' : 'mute',
        targetId: target,
        durationSeconds: durationSeconds(rest[0] ?? ''),
        reason: rest.slice(1).join(' '),
      };
    else if (command === '/unban' || command === '/unmute')
      action = {
        requestId,
        action: command === '/unban' ? 'unban' : 'unmute',
        targetId: target,
        caseId: rest[0],
      };
    else if (command === '/mod' || command === '/unmod')
      action = {
        requestId,
        action: 'set-role',
        targetId: target,
        role: command === '/mod' ? 'moderator' : 'player',
      };
    else
      action = {
        requestId,
        action: command === '/delete' ? 'delete-message' : 'kick',
        targetId: target,
        reason: rest.join(' '),
      };
    const result = await this.moderation.act(socket.data.sessionToken, action, socket.data.identity.guestId);
    send(result.result.ok, result.result.message);
  }
}
