import { ACCOUNT_ROLES, type CommandResult, type LiveLeaderboardMessage } from './community';
import { object, identifier, integer, list, named } from './validation';
import { isCountryCode } from './countries';

export function parseCommunityMessage(
  value: Record<string, unknown>,
): CommandResult | LiveLeaderboardMessage | null {
  if (value.type === 'command-result') {
    if (
      !identifier(value.requestId) ||
      typeof value.ok !== 'boolean' ||
      typeof value.message !== 'string' ||
      value.message.length > 1000
    )
      return null;
    if (value.profileId !== undefined && !identifier(value.profileId)) return null;
    if (
      value.ranking !== undefined &&
      (!object(value.ranking) ||
        !['endless', 'practice'].includes(value.ranking.mode as string) ||
        !['day', 'week', 'all-time'].includes(value.ranking.period as string))
    )
      return null;
    if (
      value.suggestions !== undefined &&
      !list(
        value.suggestions,
        12,
        (entry) =>
          typeof entry.command === 'string' &&
          /^\/[a-z-]{1,24}$/.test(entry.command) &&
          typeof entry.usage === 'string' &&
          entry.usage.length <= 120 &&
          typeof entry.description === 'string' &&
          entry.description.length <= 200,
      )
    )
      return null;
    return value as CommandResult;
  }
  const validEntry = (entry: Record<string, unknown>) =>
    named(entry) &&
    (entry.profileId === null || identifier(entry.profileId)) &&
    (entry.countryCode === null || isCountryCode(entry.countryCode)) &&
    [...ACCOUNT_ROLES, 'guest', 'bot'].includes(entry.role as string) &&
    integer(entry.score, 0, 360000) &&
    integer(entry.rank, 1, 134) &&
    typeof entry.bot === 'boolean';
  if (
    value.type === 'live-leaderboard' &&
    integer(value.at) &&
    list(value.entries, 10, validEntry) &&
    (value.viewer === null || (object(value.viewer) && validEntry(value.viewer)))
  )
    return value as LiveLeaderboardMessage;
  return null;
}
