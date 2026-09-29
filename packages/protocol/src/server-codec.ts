import { TOTAL_MEDAL_TIERS } from '@supadub/achievements';
import { SKINS, ITEMS, isSkin, isCosmetic, validLoadout, type Skin, type EmoteId } from '@supadub/cosmetics';
import { ENDLESS, PROTOCOL_VERSION, bodyRadius, type ChatMessage } from './endless';
import { WORLD, type ServerMessage, type WorldSnapshot, type GameEvent } from './wire-types';
import type { SnapshotDelta } from './snapshots';
import { parseCommunityMessage } from './community-codec';
import {
  object,
  integer,
  finite,
  identifier,
  position,
  named,
  list,
  practiceResult,
  practiceState,
  bounds,
  cleanChat,
} from './validation';

export function parseServerMessage(value: unknown): ServerMessage | null {
  if (!object(value)) return null;
  if (value.type === 'command-result' || value.type === 'live-leaderboard')
    return parseCommunityMessage(value);
  if (value.type === 'snapshot-delta') {
    if (!integer(value.baseTick) || !integer(value.tick, value.baseTick + 1)) return null;
    const limits = {
      bodies: ENDLESS.hardBodyLimit,
      ducks: 2048,
      pellets: ENDLESS.maxPellets,
      sharks: ENDLESS.maxSharks,
      obstacles: 256,
    };
    const probe: Record<string, unknown> = { ...value, type: 'snapshot' };
    for (const [key, limit] of Object.entries(limits)) {
      const patch = value[key];
      if (
        !object(patch) ||
        !Array.isArray(patch.remove) ||
        patch.remove.length > limit ||
        !patch.remove.every(identifier) ||
        new Set(patch.remove).size !== patch.remove.length ||
        !Array.isArray(patch.upsert)
      )
        return null;
      probe[key] = patch.upsert;
    }
    return parseServerMessage(probe) ? (value as unknown as SnapshotDelta) : null;
  }
  if (value.type === 'presence')
    return integer(value.online, 0, ENDLESS.maxSockets) ? { type: 'presence', online: value.online } : null;
  if (value.type === 'emote')
    return identifier(value.playerId) && isCosmetic(value.itemId, 'emote') && integer(value.at)
      ? { type: 'emote', playerId: value.playerId, itemId: value.itemId as EmoteId, at: value.at }
      : null;
  if (value.type === 'action-result')
    return identifier(value.commandId) &&
      typeof value.accepted === 'boolean' &&
      (value.reason === undefined || (typeof value.reason === 'string' && value.reason.length <= 120))
      ? (value as Extract<ServerMessage, { type: 'action-result' }>)
      : null;
  if (value.type === 'run-ended')
    return identifier(value.runId) &&
      integer(value.totalMass, 0, ENDLESS.maxMass * ENDLESS.maxBodies) &&
      integer(value.peakMass, 0, ENDLESS.maxMass * ENDLESS.maxBodies) &&
      integer(value.absorbed, 0, 1e9)
      ? (value as Extract<ServerMessage, { type: 'run-ended' }>)
      : null;
  if (value.type === 'chat')
    return validChatMessage(value.message) ? { type: 'chat', message: value.message } : null;
  if (value.type === 'chat-history')
    return list(value.messages, 100, validChatMessage)
      ? (value as Extract<ServerMessage, { type: 'chat-history' }>)
      : null;
  if (value.type === 'chat-deleted')
    return identifier(value.id) ? { type: 'chat-deleted', id: value.id } : null;
  if (value.type === 'achievement-earned') {
    if (
      !Array.isArray(value.awards) ||
      value.awards.length > TOTAL_MEDAL_TIERS ||
      !value.awards.every(
        (award) =>
          object(award) &&
          identifier(award.id) &&
          ['bronze', 'silver', 'gold'].includes(award.tier as string),
      ) ||
      new Set(value.awards.map((award) => `${award.id}:${award.tier}`)).size !== value.awards.length ||
      !Array.isArray(value.skinIds) ||
      value.skinIds.length > SKINS.length ||
      !value.skinIds.every(isSkin) ||
      !Array.isArray(value.itemIds) ||
      value.itemIds.length > ITEMS.length ||
      !value.itemIds.every((id) => isCosmetic(id)) ||
      new Set(value.itemIds).size !== value.itemIds.length
    )
      return null;
    return value as Extract<ServerMessage, { type: 'achievement-earned' }>;
  }
  if (value.type === 'welcome') {
    return identifier(value.id) &&
      integer(value.time) &&
      (value.protocolVersion === undefined || value.protocolVersion === PROTOCOL_VERSION) &&
      (value.controlEpoch === undefined || integer(value.controlEpoch, 1)) &&
      (value.runId === undefined || identifier(value.runId)) &&
      (value.mode === 'endless' || value.mode === 'practice')
      ? (value as Extract<ServerMessage, { type: 'welcome' }>)
      : null;
  }
  if (value.type === 'pong') {
    return finite(value.time, 0, Number.MAX_SAFE_INTEGER) && integer(value.serverTime)
      ? (value as Extract<ServerMessage, { type: 'pong' }>)
      : null;
  }
  if (value.type === 'error') {
    return typeof value.code === 'string' &&
      /^[A-Za-z0-9_-]{1,64}$/.test(value.code) &&
      typeof value.message === 'string' &&
      value.message.length <= 240
      ? (value as Extract<ServerMessage, { type: 'error' }>)
      : null;
  }
  if (value.type === 'event')
    return [
      'collect',
      'steal',
      'lost',
      'saved',
      'split',
      'eject',
      'merge',
      'shark',
      'shark-feed',
      'shark-launch',
    ].includes(value.event as string) && integer(value.amount, 1, 1e8)
      ? (value as GameEvent)
      : null;
  if (value.type === 'practice-complete')
    return practiceResult(value.result) ? { type: 'practice-complete', result: value.result } : null;
  if (
    value.type !== 'snapshot' ||
    !integer(value.tick) ||
    !integer(value.time) ||
    !integer(value.online, 0, WORLD.maxPlayers)
  )
    return null;
  if (value.mode === 'practice') {
    if (!practiceState(value.practice) || !bounds(value.bounds) || value.online !== 1) return null;
  } else if (value.mode !== 'endless' || value.practice !== null || value.bounds !== null) return null;
  if (
    !list(
      value.players,
      WORLD.maxPlayers + 20,
      (entry) =>
        named(entry) &&
        position(entry) &&
        finite(entry.angle, -1e7, 1e7) &&
        integer(entry.score, 0, 1e9) &&
        integer(entry.chain, 0, 1e8) &&
        SKINS.includes(entry.skin as Skin) &&
        (entry.loadout === undefined ||
          (validLoadout(entry.loadout) && entry.loadout.avatar === entry.skin)) &&
        typeof entry.boosting === 'boolean' &&
        typeof entry.bot === 'boolean' &&
        integer(entry.protectedUntil) &&
        integer(entry.lastInputSeq) &&
        (entry.totalMass === undefined || integer(entry.totalMass, 0, ENDLESS.maxMass * ENDLESS.maxBodies)) &&
        (entry.bodyCount === undefined || integer(entry.bodyCount, 0, ENDLESS.maxBodies)) &&
        (entry.alive === undefined || typeof entry.alive === 'boolean') &&
        (entry.role === undefined ||
          ['guest', 'player', 'moderator', 'admin', 'bot'].includes(entry.role as string)) &&
        (entry.runId === undefined || identifier(entry.runId)),
    )
  )
    return null;
  if (!list(value.ducks, 2048, (entry) => identifier(entry.id) && position(entry))) return null;
  if (
    !list(
      value.obstacles,
      256,
      (entry) =>
        identifier(entry.id) &&
        position(entry) &&
        finite(entry.width, 0.01, 1000) &&
        finite(entry.depth, 0.01, 1000),
    )
  )
    return null;
  if (
    !list(
      value.exits,
      128,
      (entry) =>
        identifier(entry.id) &&
        position(entry) &&
        finite(entry.radius, 0.01, 100) &&
        (entry.kind === 'finish' || entry.kind === 'bank') &&
        typeof entry.active === 'boolean',
    )
  )
    return null;
  if (
    !list(
      value.leaderboard,
      20,
      (entry) => named(entry) && integer(entry.score, 0, 1e9) && typeof entry.bot === 'boolean',
    )
  )
    return null;
  if (value.protocolVersion !== undefined && value.protocolVersion !== PROTOCOL_VERSION) return null;
  if (value.protocolVersion === PROTOCOL_VERSION) {
    if (
      !list(
        value.bodies,
        ENDLESS.hardBodyLimit,
        (body) =>
          identifier(body.id) &&
          identifier(body.ownerId) &&
          position(body) &&
          finite(body.vx, -100, 100) &&
          finite(body.vz, -100, 100) &&
          finite(body.angle, -1e7, 1e7) &&
          integer(body.mass, 1, ENDLESS.maxMass) &&
          finite(body.radius, 0.01, 15) &&
          Math.abs(body.radius - bodyRadius(body.mass)) < 0.001 &&
          isSkin(body.skin) &&
          integer(body.launchUntil) &&
          integer(body.mergeAt) &&
          integer(body.protectedUntil),
      )
    )
      return null;
    const counts = new Map<string, number>();
    const owners = new Set((value.players as Record<string, unknown>[]).map((player) => player.id));
    for (const body of value.bodies) {
      if (!owners.has(body.ownerId)) return null;
      const count = (counts.get(body.ownerId as string) ?? 0) + 1;
      if (count > ENDLESS.maxBodies) return null;
      counts.set(body.ownerId as string, count);
    }
    if (
      !list(
        value.pellets,
        ENDLESS.maxPellets,
        (pellet) =>
          identifier(pellet.id) &&
          identifier(pellet.ownerId) &&
          position(pellet) &&
          finite(pellet.vx, -40, 40) &&
          finite(pellet.vz, -40, 40) &&
          pellet.mass === ENDLESS.pelletMass,
      )
    )
      return null;
    if (
      !list(
        value.sharks,
        ENDLESS.maxSharks,
        (shark) =>
          identifier(shark.id) &&
          position(shark) &&
          finite(shark.vx, -50, 50) &&
          finite(shark.vz, -50, 50) &&
          shark.mass === ENDLESS.sharkMass &&
          finite(shark.radius, 0.9, 1.1) &&
          integer(shark.feedCount, 0, 6) &&
          integer(shark.launchUntil),
      )
    )
      return null;
  }
  return value as unknown as WorldSnapshot;
}

function validChatMessage(value: unknown): value is ChatMessage {
  return (
    object(value) &&
    named(value) &&
    identifier(value.senderId) &&
    (value.role === 'player' || value.role === 'moderator' || value.role === 'admin') &&
    cleanChat(value.text) === value.text &&
    integer(value.createdAt)
  );
}
