import type { Metrics } from '@supadub/achievements';
import type { Loadout } from '@supadub/cosmetics';
import type {
  ActionMessage,
  BodyState,
  DuckState,
  GameEvent,
  GameMode,
  InputMessage,
  ObstacleState,
  PelletState,
  PlayerRole,
  PlayerState,
  PracticeResult,
  RunResult,
  SharkState,
} from '@supadub/protocol';

export type SimulationPlayer = PlayerState & {
  loadout: Loadout;
  appearanceSince: number;
  usedAvatars: Set<import('@supadub/cosmetics').Skin>;
  spawnX: number;
  spawnZ: number;
  chartedChunks: Set<string>;
  feedingChunks: Set<string>;
  lostHumanBody: boolean;
  practiceDistance: number;
  lastDeliveryAt: number;
  input: InputMessage;
  lastInputAt: number;
  totalCollected: number;
  bestScore: number;
  identityId: string;
  role: PlayerRole;
  runId: string;
  controlEpoch: number;
  startedAt: number;
  alive: boolean;
  metrics: Metrics;
  metricSequence: number;
  lastActionSeq: number;
  splitReadyAt: number;
  ejectReadyAt: number;
  actionResults: Map<string, ActionResult>;
  collectedAt: number[];
  sharkSurvivalAt: number[];
};
export type ActionResult = { accepted: boolean; reason?: string };
export type Chunk = {
  key: string;
  x: number;
  z: number;
  ducks: Map<string, DuckState>;
  respawns: Map<string, number>;
  obstacles: ObstacleState[];
  lastSeen: number;
};
export type SimBody = BodyState & {
  decayRemainder: number;
  previousX: number;
  previousZ: number;
  launchX: number;
  launchZ: number;
  launchStartedAt: number;
  launchDurationMs: number;
  launchSource: 'manual' | 'shark' | 'overflow' | null;
  separatedAt: number;
};
export type SimPellet = PelletState & {
  originX?: number;
  originZ?: number;
  createdAt: number;
  expiresAt: number;
  directionX: number;
  directionZ: number;
  sourceIdentity: string;
  sourceBot: boolean;
};
export type SimShark = SharkState & {
  directionX: number;
  directionZ: number;
  launchStartedAt: number;
  spawnId: string;
  originX: number;
  originZ: number;
};
export type WorldOptions = {
  seed?: number;
  bots?: number;
  maxChunks?: number;
  mode?: GameMode;
  onEvent?: (id: string, event: GameEvent) => void;
  onPracticeComplete?: (id: string, result: PracticeResult) => void;
  onRunEnded?: (id: string, result: RunResult) => void;
};
export type WorldAction = (id: string, action: ActionMessage, now: number) => ActionResult;
