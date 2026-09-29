import { SKINS, isCosmetic, type Skin, type EmoteId } from '@supadub/cosmetics';
import { PROTOCOL_VERSION } from './endless';
import type { ClientMessage, Vec2 } from './wire-types';
import { object, cleanName, identifier, cleanChat, integer, finite, position } from './validation';

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!object(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.type === 'lobby')
    return data.protocolVersion === PROTOCOL_VERSION
      ? { type: 'lobby', protocolVersion: PROTOCOL_VERSION }
      : null;
  if (data.type === 'leave') return { type: 'leave' };
  if (data.type === 'resync') return { type: 'resync' };
  if (data.type === 'emote')
    return isCosmetic(data.itemId, 'emote') && integer(data.controlEpoch, 1)
      ? { type: 'emote', itemId: data.itemId as EmoteId, controlEpoch: data.controlEpoch }
      : null;
  if (data.type === 'command') {
    const text = cleanChat(data.text);
    return identifier(data.requestId) && text && text.startsWith('/')
      ? { type: 'command', requestId: data.requestId, text }
      : null;
  }
  if (data.type === 'chat-send') {
    if (!identifier(data.clientMessageId)) return null;
    const text = cleanChat(data.text);
    return text ? { type: 'chat-send', clientMessageId: data.clientMessageId, text } : null;
  }
  if (data.type === 'action') {
    if (
      (data.action !== 'split' && data.action !== 'eject') ||
      !integer(data.seq) ||
      !integer(data.controlEpoch, 1) ||
      !identifier(data.commandId) ||
      !finite(data.x, -1, 1) ||
      !finite(data.z, -1, 1)
    )
      return null;
    const length = Math.hypot(data.x, data.z);
    if (length < 0.001) return null;
    return {
      type: 'action',
      action: data.action,
      seq: data.seq,
      commandId: data.commandId,
      controlEpoch: data.controlEpoch,
      x: data.x / length,
      z: data.z / length,
    };
  }
  if (data.type === 'join') {
    const name = cleanName(data.name);
    if (!name || !SKINS.includes(data.skin as Skin)) return null;
    if (data.mode !== 'endless' && data.mode !== 'practice') return null;
    if (data.protocolVersion !== PROTOCOL_VERSION) return null;
    return {
      type: 'join',
      name,
      skin: data.skin as Skin,
      mode: data.mode,
      protocolVersion: PROTOCOL_VERSION,
    };
  }
  if (data.type === 'input') {
    if (typeof data.seq !== 'number' || !Number.isSafeInteger(data.seq) || data.seq < 0) return null;
    if (typeof data.x !== 'number' || typeof data.z !== 'number' || typeof data.boost !== 'boolean')
      return null;
    if (!Number.isFinite(data.x) || !Number.isFinite(data.z) || Math.abs(data.x) > 1 || Math.abs(data.z) > 1)
      return null;
    const magnitude = Math.hypot(data.x, data.z);
    const divisor = Math.max(1, magnitude);
    if (data.controlEpoch !== undefined && !integer(data.controlEpoch, 1)) return null;
    if (data.target !== undefined && (!object(data.target) || !position(data.target))) return null;
    return {
      type: 'input',
      seq: data.seq,
      x: data.x / divisor,
      z: data.z / divisor,
      boost: data.boost,
      ...(data.controlEpoch === undefined ? {} : { controlEpoch: data.controlEpoch as number }),
      ...(data.target === undefined
        ? {}
        : { target: { x: (data.target as Vec2).x, z: (data.target as Vec2).z } }),
    };
  }
  if (data.type === 'ping' && typeof data.time === 'number' && Number.isFinite(data.time) && data.time >= 0) {
    return { type: 'ping', time: data.time };
  }
  if (data.type === 'restart-practice' && typeof data.runId === 'string' && data.runId.length <= 64) {
    return { type: 'restart-practice', runId: data.runId };
  }
  return null;
}
