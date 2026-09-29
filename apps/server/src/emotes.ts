import { WORLD, type ClientMessage, type ServerMessage } from '@supadub/protocol';
import type { GameWorld } from '@supadub/simulation';
import type { Store } from './store';
import { RateLimiter } from './security';

type EmoteMessage = Extract<ServerMessage, { type: 'emote' }>;
export class EmoteService {
  private readonly limiter = new RateLimiter();
  constructor(private readonly store: Store) {}

  send(
    userId: string,
    world: GameWorld,
    playerId: string,
    input: Extract<ClientMessage, { type: 'emote' }>,
    now = Date.now(),
  ): EmoteMessage | { error: string } {
    const player = world.players.get(playerId);
    if (!player?.alive || player.identityId !== userId || player.controlEpoch !== input.controlEpoch)
      return { error: 'This controller is no longer active.' };
    if (this.store.activeMute(userId)) return { error: 'Your chat access is paused.' };
    const inventory = this.store.progression.inventory(userId);
    if (!inventory.ownedItemIds.includes(input.itemId) || !inventory.loadout.emotes.includes(input.itemId))
      return { error: 'Equip an owned emote before using it.' };
    if (!this.limiter.take(userId, 1, 3000, now))
      return { error: 'Wait three seconds before another emote.' };
    return { type: 'emote', playerId, itemId: input.itemId, at: now };
  }
}

export function emoteVisibleTo(world: GameWorld, sourceId: string, viewerId: string): boolean {
  if (sourceId === viewerId) return true;
  const source = world.players.get(sourceId);
  const viewer = world.players.get(viewerId);
  if (!source || !viewer) return false;
  const sourceBodies = [...world.bodies.values()].filter((body) => body.ownerId === sourceId);
  const viewerBodies = [...world.bodies.values()].filter((body) => body.ownerId === viewerId);
  const sources = sourceBodies.length ? sourceBodies : [{ ...source, radius: 0 }];
  const viewers = viewerBodies.length ? viewerBodies : [{ ...viewer, radius: 0 }];
  return sources.some((a) =>
    viewers.some((b) => Math.hypot(a.x - b.x, a.z - b.z) <= WORLD.interestRadius + a.radius + b.radius),
  );
}
