import type { AdminPlayer } from '@supadub/protocol';
import type { Store } from './store';
import type { PoolRuntime } from './pool';

export function staffPlayers(store: Store, runtime: PoolRuntime): AdminPlayer[] {
  const { sockets, rooms } = runtime;
  const result = new Map<string, AdminPlayer>();
  const bans = store.activeBans();
  for (const user of store.listUsers()) {
    const ban = bans.find((entry) => entry.target_id === user.id);
    const mute = store.activeMute(user.id);
    result.set(user.id, {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      countryCode: user.country_code,
      cases: store.moderation.cases(user.id),
      score: user.best_mass,
      online: false,
      banned: !!ban,
      banReason: ban?.reason ?? null,
      joinedAt: user.created_at,
      muted: !!mute,
      muteReason: mute?.reason ?? null,
      muteExpiresAt: mute?.expiresAt ?? null,
    });
  }
  for (const socket of sockets.values()) {
    const data = socket.data;
    const player = data.roomId ? rooms.get(data.roomId)?.players.get(data.playerId ?? '') : null;
    if (data.phase === 'new') continue;
    const ban = store.activeBan(data.identity);
    const mute = data.identity.userId ? store.activeMute(data.identity.userId) : null;
    result.set(data.identity.id, {
      id: data.identity.id,
      name:
        player?.name ??
        data.identity.user?.name ??
        store.guestById(data.identity.guestId)?.name ??
        'Little Ducky',
      username: data.identity.user?.username ?? null,
      role: data.identity.user?.role ?? 'guest',
      countryCode: data.identity.user?.country_code ?? null,
      cases: store.moderation.cases(data.identity.id),
      score: player?.score ?? data.identity.user?.best_mass ?? 0,
      online: true,
      banned: !!ban,
      banReason: ban?.reason ?? null,
      joinedAt: data.joinedAt,
      muted: !!mute,
      muteReason: mute?.reason ?? null,
      muteExpiresAt: mute?.expiresAt ?? null,
    });
  }
  for (const ban of bans) {
    if (result.has(ban.target_id)) continue;
    const guest = store.guestById(ban.target_id);
    if (guest)
      result.set(guest.id, {
        id: guest.id,
        name: guest.name,
        username: null,
        role: 'guest',
        score: 0,
        online: false,
        banned: true,
        banReason: ban.reason,
        joinedAt: guest.created_at,
      });
  }
  return [...result.values()]
    .sort((a, b) => Number(b.online) - Number(a.online) || b.score - a.score)
    .slice(0, 500);
}
