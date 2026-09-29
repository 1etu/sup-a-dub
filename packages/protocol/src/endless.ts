import type { Skin, CosmeticId, Loadout } from '@supadub/cosmetics';
import type { AchievementDefinition, Tier } from '@supadub/achievements';

export const PROTOCOL_VERSION = 4 as const;
export const ENDLESS = Object.freeze({
  rulesVersion: 3,
  startMass: 40,
  decayFloorMass: 40,
  decayRatePerSecond: 0.002,
  foodMass: 10,
  maxMass: 22500,
  maxBodies: 16,
  maxHumans: 32,
  maxBots: 6,
  hardHumanLimit: 128,
  hardBodyLimit: 2144,
  maxChunks: 4096,
  splitMinimum: 80,
  splitCooldownMs: 250,
  launchSpeed: 60,
  launchMs: 750,
  overflowLaunchSpeed: 20,
  overflowLaunchMs: 500,
  mergeMs: 20000,
  ejectCost: 16,
  pelletMass: 12,
  ejectCooldownMs: 200,
  pelletSpeed: 36,
  pelletLaunchMs: 500,
  pelletLifeMs: 20000,
  pelletRecaptureMs: 500,
  pelletsPerOwner: 128,
  maxPellets: 4096,
  sharkMass: 100,
  sharkContactMass: 110,
  sharkFeedCount: 7,
  sharkLaunchSpeed: 48,
  sharkLaunchMs: 1000,
  sharkRespawnMs: 30000,
  maxSharks: 64,
  reconnectMs: 10000,
  pinMargin: 6,
  maxSockets: 512,
  maxSocketBytes: 1048576,
  maxFrameBytes: 524288,
});

export type PlayerRole = 'player' | 'moderator' | 'admin' | 'guest' | 'bot';
export type BodyState = {
  id: string;
  ownerId: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  angle: number;
  mass: number;
  radius: number;
  skin: Skin;
  launchUntil: number;
  mergeAt: number;
  protectedUntil: number;
};
export type PelletState = {
  id: string;
  ownerId: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  mass: number;
};
export type SharkState = {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  mass: number;
  radius: number;
  feedCount: number;
  launchUntil: number;
};
export type ActionMessage = {
  type: 'action';
  action: 'split' | 'eject';
  seq: number;
  commandId: string;
  controlEpoch: number;
  x: number;
  z: number;
};
export type ChatMessage = {
  id: string;
  senderId: string;
  name: string;
  role: 'player' | 'moderator' | 'admin';
  text: string;
  createdAt: number;
};
export type InventoryItem = { id: CosmeticId; earnedAt: number; source: string };
export type InventoryResponse = {
  revision: number;
  equippedSkin: Skin;
  ownedSkinIds: Skin[];
  ownedItemIds: CosmeticId[];
  loadout: Loadout;
  items: InventoryItem[];
};
export type AchievementProgress = AchievementDefinition & {
  progress: number | null;
  tierProgress?: Partial<Record<Tier, number>>;
  earnedTiers: Tier[];
  earnedAt: Partial<Record<Tier, number>>;
};
export type AchievementResponse = {
  catalogVersion: number;
  achievements: AchievementProgress[];
  earnedTiers: number;
  totalTiers: number;
};
export type AchievementAward = { id: string; tier: Tier };
export type ProgressGrant = { awards: AchievementAward[]; skinIds: Skin[]; itemIds: CosmeticId[] };
export type RunResult = { runId: string; totalMass: number; peakMass: number; absorbed: number };

export function bodyRadius(mass: number): number {
  return 0.62 * Math.sqrt(Math.max(0, mass) / ENDLESS.startMass);
}

export function bodySpeed(mass: number): number {
  return 7.2 / Math.pow(Math.max(ENDLESS.startMass, mass) / ENDLESS.startMass, 0.15);
}
