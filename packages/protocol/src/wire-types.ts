import type { AccountRole, CommandResult, LiveLeaderboardMessage, ModerationCase } from './community';
import { SKINS, isSkin, type Skin, type Loadout, type EmoteId } from '@supadub/cosmetics';
import {
  ENDLESS,
  bodyRadius,
  bodySpeed,
  type BodyState,
  type PelletState,
  type SharkState,
  type PlayerRole,
  type ActionMessage,
  type ChatMessage,
  type ProgressGrant,
  type RunResult,
} from './endless';
import type { SnapshotDelta } from './snapshots';
export { SKINS, type Skin } from '@supadub/cosmetics';
export type GameMode = 'endless' | 'practice';
export type Vec2 = { x: number; z: number };

export const WORLD = Object.freeze({
  chunkSize: 64,
  moveSpeed: 7.2,
  boostSpeed: 12.5,
  playerRadius: 0.62,
  snapshotRate: 10,
  tickRate: 30,
  interestRadius: 55,
  protectionMs: 8000,
  stealRatio: 1.1,
  maxPlayers: 128,
});

export const PRACTICE = Object.freeze({ width: 28, depth: 17, exitRadius: 1.25, totalDucks: 12 });

export type ExitState = Vec2 & { id: string; radius: number; kind: 'finish' | 'bank'; active: boolean };
export type PoolBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type PracticeResult = {
  runId: string;
  levelId: string;
  rawTimeMs: number;
  finalTimeMs: number;
  chainBonusMs: number;
  totalDucks: number;
  savedDucks: number;
  longestChain: number;
  medal: 'gold' | 'silver' | 'bronze';
};
export type PracticeState = {
  runId: string;
  levelId: string;
  phase: 'ready' | 'playing' | 'complete';
  startedAt: number | null;
  elapsedMs: number;
  totalDucks: number;
  savedDucks: number;
  longestChain: number;
  result: PracticeResult | null;
};

export function playerScale(score: number): number {
  return Math.sqrt(Math.max(40, score) / 40);
}

export function movementSpeed(score: number, boost = false): number {
  return bodySpeed(score);
}

export type PlayerState = Vec2 & {
  id: string;
  name: string;
  angle: number;
  score: number;
  chain: number;
  skin: Skin;
  loadout?: Loadout;
  boosting: boolean;
  bot: boolean;
  protectedUntil: number;
  lastInputSeq: number;
  totalMass?: number;
  bodyCount?: number;
  alive?: boolean;
  role?: PlayerRole;
  runId?: string;
};

export type DuckState = Vec2 & { id: string };
export type ObstacleState = Vec2 & { id: string; width: number; depth: number };
export type LeaderboardEntry = { id: string; name: string; score: number; bot: boolean };
export type PracticeBest = {
  finalTimeMs: number;
  rawTimeMs: number;
  longestChain: number;
  savedDucks: number;
};
export type PracticeLeaderboardEntry = {
  id: string;
  name: string;
  finalTimeMs: number;
  longestChain: number;
};
export type LeaderboardResponse = {
  allTime: LeaderboardEntry[];
  legacy?: LeaderboardEntry[];
  live: LeaderboardEntry[];
  practice: PracticeLeaderboardEntry[];
};

export type WorldSnapshot = {
  type: 'snapshot';
  tick: number;
  time: number;
  mode: GameMode;
  exits: ExitState[];
  bounds: PoolBounds | null;
  practice: PracticeState | null;
  players: PlayerState[];
  ducks: DuckState[];
  obstacles: ObstacleState[];
  leaderboard: LeaderboardEntry[];
  online: number;
  protocolVersion?: 4;
  bodies?: BodyState[];
  pellets?: PelletState[];
  sharks?: SharkState[];
};

export type JoinMessage = {
  type: 'join';
  name: string;
  skin: Skin;
  mode: GameMode;
  protocolVersion?: 4;
};

export type InputMessage = Vec2 & {
  type: 'input';
  seq: number;
  boost: boolean;
  controlEpoch?: number;
  target?: Vec2;
};

export type ClientMessage =
  | JoinMessage
  | InputMessage
  | ActionMessage
  | { type: 'lobby'; protocolVersion: 4 }
  | { type: 'leave' }
  | { type: 'resync' }
  | { type: 'command'; requestId: string; text: string }
  | { type: 'chat-send'; clientMessageId: string; text: string }
  | { type: 'emote'; itemId: EmoteId; controlEpoch: number }
  | { type: 'ping'; time: number }
  | { type: 'restart-practice'; runId: string };
export type GameEvent = {
  type: 'event';
  event:
    | 'collect'
    | 'steal'
    | 'lost'
    | 'saved'
    | 'split'
    | 'eject'
    | 'merge'
    | 'shark'
    | 'shark-feed'
    | 'shark-launch';
  amount: number;
};

export type ServerMessage =
  | CommandResult
  | LiveLeaderboardMessage
  | WorldSnapshot
  | SnapshotDelta
  | {
      type: 'welcome';
      id: string;
      time: number;
      mode: GameMode;
      protocolVersion?: 4;
      runId?: string;
      controlEpoch?: number;
    }
  | { type: 'presence'; online: number }
  | { type: 'action-result'; commandId: string; accepted: boolean; reason?: string }
  | ({ type: 'run-ended' } & RunResult)
  | { type: 'chat'; message: ChatMessage }
  | { type: 'chat-history'; messages: ChatMessage[] }
  | { type: 'chat-deleted'; id: string }
  | { type: 'emote'; playerId: string; itemId: EmoteId; at: number }
  | ({ type: 'achievement-earned' } & ProgressGrant)
  | GameEvent
  | { type: 'practice-complete'; result: PracticeResult }
  | { type: 'pong'; time: number; serverTime: number }
  | { type: 'error'; code: string; message: string };

export type UserProfile = {
  id: string;
  username: string;
  name: string;
  role: AccountRole;
  equippedSkin?: Skin;
  loadout?: Loadout;
  countryCode?: string | null;
  revision?: number;
  bestScore: number;
  bestMass?: number;
  totalDucks: number;
  createdAt: number;
};

export type SessionResponse = {
  user: UserProfile | null;
  guestId: string;
  practiceBest: PracticeBest | null;
};

export type AdminPlayer = {
  id: string;
  name: string;
  username: string | null;
  role: AccountRole | 'guest' | 'bot';
  countryCode?: string | null;
  cases?: ModerationCase[];
  score: number;
  online: boolean;
  banned: boolean;
  banReason: string | null;
  joinedAt: number;
  muted?: boolean;
  muteReason?: string | null;
  muteExpiresAt?: number | null;
};
