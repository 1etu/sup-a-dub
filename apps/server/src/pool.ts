import { BunPeer, OutboundChannel } from '@supadub/network';
import { ServerFeatures } from './features';
import { RankingCollector } from './ranking-collector';
import { isStarterSkin, defaultLoadout } from '@supadub/cosmetics';
import { EmoteService, emoteVisibleTo } from './emotes';
import {
  ENDLESS,
  PROTOCOL_VERSION,
  parseServerMessage,
  type LiveLeaderboardEntry,
  WORLD,
  snapshotDelta,
  type ClientMessage,
  type GameMode,
  type ProgressGrant,
  type ServerMessage,
  type WorldSnapshot,
} from '@supadub/protocol';
import { GameWorld, type SnapshotReader } from '@supadub/simulation';
import { PoolChat } from './chat';
import { PersistenceQueue } from './persistence';
import { Store, type Identity, type UserRecord } from './store';
import { RateLimiter } from './security';

export type SocketData = {
  id: string;
  identity: Identity;
  roomId: string | null;
  playerId: string | null;
  phase: 'new' | 'lobby' | 'game';
  joinedAt: number;
  lastMessageAt: number;
  invalid: number;
  sessionToken: string | undefined;
  previousSnapshot: WorldSnapshot | null;
  lastFullAt: number;
};
export type PoolSocket = Bun.ServerWebSocket<SocketData>;
type Socket = PoolSocket;
type Lease = {
  identity: Identity;
  playerId: string;
  controller: string | null;
  expiresAt: number;
  epoch: number;
};

export class PoolRuntime {
  readonly sockets = new Map<string, Socket>();
  readonly rooms = new Map<string, GameWorld>();
  readonly leases = new Map<string, Lease>();
  readonly persistence: PersistenceQueue;
  readonly chat: PoolChat;
  readonly emotes: EmoteService;
  readonly rankings: RankingCollector;
  readonly channels = new Map<string, OutboundChannel<ServerMessage>>();
  onCommand: (socket: PoolSocket, requestId: string, text: string) => Promise<void> = async () => {};
  private frame = 0;
  private stopping = false;
  private readonly saved = new Map<string, number>();
  private readonly saving = new Set<string>();
  private readonly joins = new RateLimiter();
  private readonly durations: number[] = [];
  private durationIndex = 0;
  private maximumBufferedBytes = 0;
  private skippedSnapshots = 0;
  private readonly interval: ReturnType<typeof setInterval>;

  constructor(
    readonly store: Store,
    private readonly botCount: number,
    readonly features: ServerFeatures,
  ) {
    this.persistence = new PersistenceQueue(store);
    this.chat = new PoolChat(store);
    this.emotes = new EmoteService(store);
    this.rankings = new RankingCollector(this.persistence);
    this.interval = setInterval(() => this.tick(), 1000 / WORLD.tickRate);
  }

  get online(): number {
    return new Set(
      [...this.sockets.values()]
        .filter((socket) => socket.data.phase !== 'new')
        .map((socket) => socket.data.identity.id),
    ).size;
  }

  performance() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    return {
      samples: sorted.length,
      meanTickMs: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0,
      p99TickMs: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
      maximumTickMs: sorted.at(-1) ?? 0,
      maximumBufferedBytes: this.maximumBufferedBytes,
      skippedSnapshots: this.skippedSnapshots,
    };
  }

  send(socket: Socket, message: ServerMessage): boolean {
    const channel = this.channels.get(socket.data.id);
    if (!channel) return false;
    if (
      socket.getBufferedAmount() + channel.metrics.queuedBytes >
      ENDLESS.maxSocketBytes - ENDLESS.maxFrameBytes
    ) {
      socket.close(1013, 'The connection queue is full.');
      return false;
    }
    return message.type === 'presence' || message.type === 'live-leaderboard'
      ? channel.latest(message.type, message)
      : channel.ordered(message);
  }

  drain(socket: Socket): void {
    this.channels.get(socket.data.id)?.flush();
  }

  error(socket: Socket, code: string, message: string): void {
    this.send(socket, { type: 'error', code, message });
  }

  freshUser(socket: Socket): UserRecord | null {
    const user = this.store.sessionUser(socket.data.sessionToken);
    if (socket.data.identity.userId && (!user || user.id !== socket.data.identity.userId)) {
      this.error(socket, 'session_expired', 'Sign in again to continue.');
      socket.close(4001, 'Session expired');
      return null;
    }
    if (this.store.activeBan(socket.data.identity)) {
      this.error(socket, 'banned', 'This player cannot join the pool.');
      socket.close(4003, 'Access denied');
      return null;
    }
    return user;
  }

  open(socket: Socket): void {
    if (
      this.sockets.size >= ENDLESS.maxSockets ||
      [...this.sockets.values()].filter((existing) => existing.data.identity.id === socket.data.identity.id)
        .length >= 4
    ) {
      socket.close(1013, 'Close another game tab first');
      return;
    }
    this.sockets.set(socket.data.id, socket);
    this.channels.set(
      socket.data.id,
      new OutboundChannel(
        new BunPeer(socket, true),
        { encode: (message) => JSON.stringify(message), decode: (raw) => parseServerMessage(raw) },
        {
          highWaterBytes: 128 * 1024,
          hardLimitBytes: ENDLESS.maxSocketBytes,
          maxBytes: ENDLESS.maxSocketBytes - ENDLESS.maxFrameBytes,
          maxPacketBytes: ENDLESS.maxFrameBytes,
          maxMessages: 64,
        },
      ),
    );
  }

  private socketForPlayer(id: string): Socket | undefined {
    return [...this.sockets.values()].find((socket) => socket.data.playerId === id);
  }

  private room(mode: GameMode, id: string): GameWorld {
    const key = mode === 'endless' ? 'endless' : `practice:${id}`;
    const existing = this.rooms.get(key);
    if (existing) return existing;
    const world = new GameWorld({
      mode,
      bots: this.botCount,
      onEvent: (player, event) => {
        const socket = this.socketForPlayer(player);
        if (socket) this.send(socket, event);
      },
      onPracticeComplete: (player, result) => {
        const socket = this.socketForPlayer(player);
        if (!socket) return;
        const userId = socket.data.identity.userId;
        if (userId) {
          this.flush(world, player, userId);
          if (this.features.enabled('rankings'))
            this.rankings.observe(
              userId,
              result.runId,
              'practice',
              result.finalTimeMs,
              result.longestChain,
              Date.now(),
            );
          this.queue({ kind: 'practice', userId, result });
        }
        this.send(socket, { type: 'practice-complete', result });
      },
      onRunEnded: (player, result) => {
        const lease = [...this.leases.values()].find((entry) => entry.playerId === player);
        if (lease?.identity.userId) this.flush(world, player, lease.identity.userId);
        const socket = this.socketForPlayer(player);
        if (socket) this.send(socket, { type: 'run-ended', ...result });
      },
    });
    this.rooms.set(key, world);
    return world;
  }

  private queue(task: Parameters<PersistenceQueue['enqueue']>[0]): void {
    void this.persistence
      .enqueue(task)
      .catch((error) =>
        console.error('Save failed', error instanceof Error ? error.message : 'Unknown error'),
      );
  }

  private flush(world: GameWorld, playerId: string, userId: string): void {
    if (!this.features.enabled('collection')) return;
    const metrics = world.metrics(playerId);
    if (!metrics || (this.saved.get(metrics.runId) ?? -1) >= metrics.sequence) return;
    this.saving.add(metrics.runId);
    void this.persistence
      .enqueue({ kind: 'progress', batch: { userId, ...metrics } })
      .then((result) => {
        this.saved.set(metrics.runId, Math.max(metrics.sequence, this.saved.get(metrics.runId) ?? -1));
        while (this.saved.size > 1024) this.saved.delete(this.saved.keys().next().value!);
        const grant = result as ProgressGrant;
        if (grant.awards.length || grant.itemIds.length)
          for (const socket of this.sockets.values())
            if (socket.data.identity.userId === userId)
              this.send(socket, { type: 'achievement-earned', ...grant });
      })
      .catch((error) =>
        console.error('Progress save failed', error instanceof Error ? error.message : 'Unknown error'),
      )
      .finally(() => this.saving.delete(metrics.runId));
  }

  message(socket: Socket, message: ClientMessage): void {
    const data = socket.data;
    if (message.type === 'ping') {
      this.send(socket, { type: 'pong', time: message.time, serverTime: Date.now() });
      return;
    }
    if (message.type === 'lobby') {
      if (data.phase === 'new') {
        data.phase = 'lobby';
        this.send(socket, { type: 'presence', online: this.online });
      }
      return;
    }
    if (message.type === 'leave') {
      this.leave(socket);
      return;
    }
    if (message.type === 'join') {
      this.join(socket, message);
      return;
    }
    if (message.type === 'command' || (message.type === 'chat-send' && message.text.startsWith('/'))) {
      const requestId = message.type === 'command' ? message.requestId : message.clientMessageId;
      void this.onCommand(socket, requestId, message.text).catch(() =>
        this.send(socket, {
          type: 'command-result',
          requestId,
          ok: false,
          message: 'The command could not finish. Try again.',
        }),
      );
      return;
    }
    if (message.type === 'chat-send') {
      if (!this.features.enabled('chat')) {
        this.error(socket, 'feature_disabled', 'Chat is unavailable.');
        return;
      }
      if (data.roomId !== 'endless') {
        this.error(socket, 'chat_unavailable', 'Join the shared pool to chat.');
        return;
      }
      const user = this.freshUser(socket);
      if (!user) {
        if (!data.identity.userId) this.error(socket, 'sign_in_required', 'Sign in to send a message.');
        return;
      }
      const result = this.chat.submit(user, message.clientMessageId, message.text);
      if (result.error) this.error(socket, 'chat_limited', result.error);
      else if (result.message && !result.repeated)
        this.broadcastChat({ type: 'chat', message: result.message });
      return;
    }
    const world = data.roomId ? this.rooms.get(data.roomId) : null;
    if (!world || !data.playerId) return;
    if (message.type === 'emote') {
      if (!this.features.enabled('chat')) {
        this.error(socket, 'feature_disabled', 'Emotes are unavailable.');
        return;
      }
      const user = this.freshUser(socket);
      if (!user) {
        if (!data.identity.userId) this.error(socket, 'sign_in_required', 'Sign in to use an emote.');
        return;
      }
      const result = this.emotes.send(user.id, world, data.playerId, message);
      if ('error' in result) this.error(socket, 'emote_limited', result.error);
      else
        for (const recipient of this.sockets.values())
          if (
            recipient.data.roomId === data.roomId &&
            recipient.data.playerId &&
            emoteVisibleTo(world, data.playerId, recipient.data.playerId)
          )
            this.send(recipient, result);
      return;
    }
    if (message.type === 'input') world.setInput(data.playerId, message, Date.now());
    if (message.type === 'action') {
      const result = world.action(data.playerId, message, Date.now());
      this.send(socket, { type: 'action-result', commandId: message.commandId, ...result });
    }
    if (message.type === 'resync' && Date.now() - data.lastFullAt >= 1000) {
      data.previousSnapshot = null;
      this.snapshot(socket, world, Date.now());
    }
    if (
      message.type === 'restart-practice' &&
      world.mode === 'practice' &&
      world.practice?.runId === message.runId
    ) {
      if (data.identity.userId) {
        this.flush(world, data.playerId, data.identity.userId);
        if (world.practice.phase !== 'complete')
          this.queue({ kind: 'abandon', userId: data.identity.userId, runId: message.runId });
      }
      if (world.restartPractice(data.playerId, message.runId, Date.now())) {
        data.previousSnapshot = null;
        this.snapshot(socket, world, Date.now());
      }
    }
  }

  private join(socket: Socket, message: Extract<ClientMessage, { type: 'join' }>): void {
    const data = socket.data;
    if (data.roomId) return;
    const user = this.freshUser(socket);
    if (data.identity.userId && !user) return;
    if (this.store.activeBan(data.identity)) return;
    const inventory = user ? this.store.progression.inventory(user.id) : null;
    const skin = inventory ? inventory.equippedSkin : isStarterSkin(message.skin) ? message.skin : 'gold';
    const loadout = inventory?.loadout ?? defaultLoadout(skin);
    if (message.mode === 'endless') {
      const prior = this.leases.get(data.identity.id);
      const world = this.room('endless', '');
      const retained = prior && world.players.get(prior.playerId);
      if (prior?.controller && this.sockets.has(prior.controller)) {
        this.error(socket, 'already_playing', 'This account already has a duck in the shared pool.');
        return;
      }
      if (prior && retained?.alive && prior.expiresAt > Date.now()) {
        prior.controller = data.id;
        prior.epoch++;
        prior.expiresAt = Infinity;
        data.playerId = prior.playerId;
        data.roomId = 'endless';
        data.phase = 'game';
        world.setController(prior.playerId, prior.epoch);
        world.setLoadout(prior.playerId, loadout);
        this.welcome(socket, world);
        return;
      }
      if (prior) this.removeLease(data.identity.id);
      if ([...world.players.values()].filter((player) => !player.bot).length >= ENDLESS.maxHumans) {
        this.error(socket, 'pool_full', 'The shared pool is full. Try again soon.');
        return;
      }
    }
    const id = crypto.randomUUID();
    if (!this.joins.take(data.identity.id, 30, 60000)) {
      this.error(socket, 'join_limited', 'Wait before starting another run.');
      return;
    }
    const world = this.room(message.mode, id);
    const player = world.addPlayer(id, user?.name ?? message.name, skin, Date.now());
    world.setLoadout(id, loadout);
    world.setIdentity(id, data.identity.id, user?.role ?? 'guest');
    data.playerId = id;
    data.roomId = message.mode === 'endless' ? 'endless' : `practice:${id}`;
    data.phase = 'game';
    data.previousSnapshot = null;
    if (message.mode === 'endless')
      this.leases.set(data.identity.id, {
        identity: data.identity,
        playerId: id,
        controller: data.id,
        epoch: player.controlEpoch,
        expiresAt: Infinity,
      });
    this.store.renameGuest(data.identity.guestId, message.name);
    this.welcome(socket, world);
  }

  private welcome(socket: Socket, world: GameWorld): void {
    const player = world.players.get(socket.data.playerId!)!;
    this.send(socket, {
      type: 'welcome',
      id: player.id,
      time: Date.now(),
      mode: world.mode,
      protocolVersion: PROTOCOL_VERSION,
      runId: player.runId,
      controlEpoch: player.controlEpoch,
    });
    this.snapshot(socket, world, Date.now());
    if (world.mode === 'endless' && this.features.enabled('chat'))
      this.send(socket, { type: 'chat-history', messages: this.chat.history() });
  }

  leave(socket: Socket): void {
    const data = socket.data;
    const world = data.roomId ? this.rooms.get(data.roomId) : null;
    const player = data.playerId ? world?.players.get(data.playerId) : null;
    if (world && player) {
      if (data.identity.userId) this.flush(world, player.id, data.identity.userId);
      if (world.mode === 'endless') {
        const lease = this.leases.get(data.identity.id);
        if (lease?.controller === data.id) {
          lease.controller = null;
          lease.expiresAt = Date.now() + ENDLESS.reconnectMs;
          world.setController(player.id, ++lease.epoch);
        }
      } else {
        if (data.identity.userId && world.practice?.phase !== 'complete')
          this.queue({ kind: 'abandon', userId: data.identity.userId, runId: player.runId });
        world.removePlayer(player.id);
        this.rooms.delete(data.roomId!);
      }
    }
    data.playerId = null;
    data.roomId = null;
    data.phase = 'lobby';
    data.previousSnapshot = null;
  }

  disconnect(socket: Socket): void {
    if (this.sockets.has(socket.data.id)) {
      this.leave(socket);
      this.sockets.delete(socket.data.id);
      this.channels.get(socket.data.id)?.dispose();
      this.channels.delete(socket.data.id);
    }
  }

  private removeLease(identityId: string): void {
    const lease = this.leases.get(identityId);
    if (!lease) return;
    const world = this.rooms.get('endless');
    if (world && lease.identity.userId) this.flush(world, lease.playerId, lease.identity.userId);
    world?.removePlayer(lease.playerId);
    this.leases.delete(identityId);
  }

  broadcastChat(message: ServerMessage): void {
    for (const socket of this.sockets.values())
      if (socket.data.roomId === 'endless') this.send(socket, message);
  }

  private snapshot(
    socket: Socket,
    world: GameWorld,
    now: number,
    frames?: Map<GameWorld, SnapshotReader>,
  ): void {
    const buffered =
      socket.getBufferedAmount() + (this.channels.get(socket.data.id)?.metrics.queuedBytes ?? 0);
    this.maximumBufferedBytes = Math.max(this.maximumBufferedBytes, buffered);
    if (!socket.data.playerId || buffered >= 128 * 1024) {
      this.skippedSnapshots++;
      return;
    }
    let frame = frames?.get(world);
    if (!frame) {
      frame = world.prepareSnapshots();
      frames?.set(world, frame);
    }
    const snapshot = frame(socket.data.playerId, 1024);
    const previous = socket.data.previousSnapshot;
    const full = !previous || now - socket.data.lastFullAt >= 3000 || previous.mode !== snapshot.mode;
    if (this.send(socket, full ? snapshot : snapshotDelta(previous, snapshot))) {
      socket.data.previousSnapshot = snapshot;
      if (full) socket.data.lastFullAt = now;
    }
  }

  private tick(): void {
    const started = performance.now();
    const now = Date.now();
    this.frame++;
    for (const world of this.rooms.values()) world.step(1 / WORLD.tickRate, now);
    if (this.features.enabled('rankings')) {
      const endless = this.rooms.get('endless');
      for (const lease of this.leases.values()) {
        const player = endless?.players.get(lease.playerId);
        if (lease.identity.userId && player?.alive)
          this.rankings.observe(
            lease.identity.userId,
            player.runId,
            'endless',
            player.totalMass ?? player.score,
            0,
            now,
          );
      }
    }
    for (const [identity, lease] of this.leases)
      if (!lease.controller && lease.expiresAt <= now) this.removeLease(identity);
    let cohort = 0;
    const frames = new Map<GameWorld, SnapshotReader>();
    for (const socket of this.sockets.values()) {
      const data = socket.data;
      if (now - data.lastMessageAt > 20000 || (data.phase === 'new' && now - data.joinedAt > 10000)) {
        socket.close(1000, 'Idle connection');
        continue;
      }
      const world = data.roomId ? this.rooms.get(data.roomId) : null;
      if (
        world &&
        cohort++ % (WORLD.tickRate / WORLD.snapshotRate) ===
          this.frame % (WORLD.tickRate / WORLD.snapshotRate)
      )
        this.snapshot(socket, world, now, frames);
    }
    if (this.frame % WORLD.tickRate === 0) {
      const online = this.online;
      const live = this.liveLeaderboard();
      for (const socket of this.sockets.values()) {
        if (socket.data.phase !== 'new') this.send(socket, { type: 'presence', online });
        if (socket.data.roomId === 'endless' && this.features.enabled('rankings'))
          this.send(socket, {
            type: 'live-leaderboard',
            at: now,
            entries: live.slice(0, 10),
            viewer: live.find((entry) => entry.id === socket.data.playerId) ?? null,
          });
      }
    }
    if (this.frame % (WORLD.tickRate * 2) === 0) {
      void this.rankings
        .flush()
        .catch((error) =>
          console.error('Ranking save failed', error instanceof Error ? error.message : 'Unknown error'),
        );
      for (const lease of this.leases.values()) {
        const world = this.rooms.get('endless');
        if (world && lease.identity.userId) this.flush(world, lease.playerId, lease.identity.userId);
      }
      for (const socket of this.sockets.values())
        if (
          socket.data.roomId?.startsWith('practice:') &&
          socket.data.identity.userId &&
          socket.data.playerId
        ) {
          const world = this.rooms.get(socket.data.roomId);
          if (world) this.flush(world, socket.data.playerId, socket.data.identity.userId);
        }
    }
    if (this.frame % (WORLD.tickRate * 15) === 0)
      for (const socket of this.sockets.values()) this.freshUser(socket);
    if (this.frame % (WORLD.tickRate * 300) === 0) {
      this.queue({ kind: 'maintenance' });
      this.joins.prune();
    }
    this.durations[this.durationIndex] = performance.now() - started;
    this.durationIndex = (this.durationIndex + 1) % 1800;
  }

  kick(identityId: string): void {
    for (const socket of this.sockets.values())
      if (socket.data.identity.id === identityId) {
        this.error(socket, 'kicked', 'A staff member ended this connection.');
        socket.close(4004, 'Kicked');
      }
  }

  enforceBans(): void {
    for (const socket of this.sockets.values())
      if (this.store.activeBan(socket.data.identity)) {
        this.error(socket, 'banned', 'This player cannot join the pool.');
        socket.close(4003, 'Access denied');
      }
  }

  refreshAccount(userId: string): void {
    const user = this.store.userById(userId);
    if (!user) return;
    for (const socket of this.sockets.values())
      if (socket.data.identity.userId === userId) socket.data.identity.user = user;
    const lease = this.leases.get(userId);
    if (lease) lease.identity.user = user;
    for (const world of this.rooms.values())
      for (const player of world.players.values())
        if (player.identityId === userId) {
          player.name = user.name;
          player.role = user.role;
        }
  }

  liveLeaderboard(): LiveLeaderboardEntry[] {
    return [...(this.rooms.get('endless')?.players.values() ?? [])]
      .filter((player) => player.alive)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .map((player, index) => {
        const user = this.leases.get(player.identityId)?.identity.user;
        return {
          id: player.id,
          profileId: user?.id ?? null,
          name: player.name,
          role: player.bot ? 'bot' : (user?.role ?? 'guest'),
          countryCode: user?.country_code ?? null,
          score: player.score,
          rank: index + 1,
          bot: player.bot,
        };
      });
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    clearInterval(this.interval);
    for (const socket of [...this.sockets.values()]) {
      this.disconnect(socket);
      socket.close(1001, 'Server stopped');
    }
    for (const id of [...this.leases.keys()]) this.removeLease(id);
    try {
      await this.rankings.drain();
    } finally {
      await this.persistence.close();
    }
  }
}
