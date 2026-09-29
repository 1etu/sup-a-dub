import type { Skin, Loadout } from '@supadub/cosmetics';
import type { AchievementAward } from './endless';
import type { GameMode, PracticeBest } from './index';

export const ACCOUNT_ROLES = ['player', 'moderator', 'admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type RankingPeriod = 'day' | 'week' | 'all-time';
export type RankingEntry = {
  id: string;
  name: string;
  role: AccountRole;
  countryCode: string | null;
  skin: Skin;
  rank: number;
  score: number;
  longestChain: number | null;
  achievedAt: number | null;
};
export type RankingResponse = {
  mode: GameMode;
  period: RankingPeriod;
  metric: 'peak-mass' | 'adjusted-time';
  direction: 'asc' | 'desc';
  periodStart: number | null;
  periodEnd: number | null;
  generatedAt: number;
  entries: RankingEntry[];
  viewer: RankingEntry | null;
};
export type PublicProfile = {
  id: string;
  name: string;
  role: AccountRole;
  countryCode: string | null;
  skin: Skin;
  loadout?: Loadout;
  createdAt: number;
  bestMass: number;
  totalDucks: number;
  practiceBest: PracticeBest | null;
  badges: AchievementAward[];
  revision: number;
};
export type ProfileEdit = { name: string; countryCode: string | null; revision: number };
export type ModerationAction = {
  requestId: string;
  action: 'kick' | 'ban' | 'unban' | 'mute' | 'unmute' | 'delete-message' | 'set-role';
  targetId: string;
  caseId?: string;
  durationSeconds?: number | null;
  reason?: string;
  role?: 'player' | 'moderator';
};
export type ModerationResult = {
  requestId: string;
  ok: boolean;
  code: string;
  message: string;
  caseId?: string;
  expiresAt?: number | null;
};
export type ModerationCase = {
  id: string;
  kind: 'ban' | 'mute';
  targetId: string;
  actorId: string;
  reason: string;
  createdAt: number;
  expiresAt: number | null;
};
export type CommandSuggestion = { command: string; usage: string; description: string };
export type CommandResult = {
  type: 'command-result';
  requestId: string;
  ok: boolean;
  message: string;
  profileId?: string;
  ranking?: { mode: GameMode; period: RankingPeriod };
  suggestions?: CommandSuggestion[];
};
export type LiveLeaderboardEntry = {
  id: string;
  profileId: string | null;
  name: string;
  role: AccountRole | 'guest' | 'bot';
  countryCode: string | null;
  score: number;
  rank: number;
  bot: boolean;
};
export type LiveLeaderboardMessage = {
  type: 'live-leaderboard';
  at: number;
  entries: LiveLeaderboardEntry[];
  viewer: LiveLeaderboardEntry | null;
};

export function rankingWindow(period: RankingPeriod, at: number): { start: number; end: number | null } {
  if (period === 'all-time') return { start: 0, end: null };
  const day = Math.floor(at / 86400000) * 86400000;
  if (period === 'day') return { start: day, end: day + 86400000 };
  const start = day - ((new Date(day).getUTCDay() + 6) % 7) * 86400000;
  return { start, end: start + 7 * 86400000 };
}
