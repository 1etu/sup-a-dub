import {
  parseClientMessage,
  PROTOCOL_VERSION,
  parseServerMessage,
  applySnapshotDelta,
  type ClientMessage,
  type JoinMessage,
  type ServerMessage,
  type WorldSnapshot,
} from '@supadub/protocol';
import { BrowserPeer, OutboundChannel, jsonCodec } from '@supadub/network';

const clientCodec = jsonCodec(parseClientMessage, 8192);
const serverCodec = jsonCodec(parseServerMessage);

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type ConnectionOptions = {
  url?: string;
  createSocket?: (url: string) => WebSocket;
  retryDelays?: readonly number[];
  handshakeTimeoutMs?: number;
  heartbeatMs?: number;
  serverTimeoutMs?: number;
};

export class GameConnection {
  private socket: WebSocket | null = null;
  private outbound: OutboundChannel<ClientMessage> | null = null;
  private drain: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private handshake: ReturnType<typeof setTimeout> | null = null;
  private disposed = true;
  private attempts = 0;
  private generation = 0;
  private joined: JoinMessage | null = null;
  private welcomed = false;
  private discardRetiredGame = false;
  private lastReceived = 0;
  private connectedAt = 0;
  private pendingPing: number | null = null;
  private status: ConnectionStatus = 'disconnected';
  controlEpoch = 0;
  online = 0;
  latency = 0;
  id = '';
  snapshot: WorldSnapshot | null = null;
  onMessage: (message: ServerMessage) => void = () => {};
  onStatus: (status: ConnectionStatus) => void = () => {};

  constructor(private readonly options: ConnectionOptions = {}) {}

  connect(join: Omit<JoinMessage, 'type'>): void {
    const parsed = parseClientMessage({ type: 'join', protocolVersion: PROTOCOL_VERSION, ...join });
    if (!parsed || parsed.type !== 'join') {
      this.terminate('invalid_join', 'Use a duck name with 1–20 characters.');
      return;
    }
    const lobbySocket = !this.disposed && !this.joined && this.socket?.readyState === 1 ? this.socket : null;
    if (!lobbySocket) this.releaseSocket();
    this.disposed = false;
    this.attempts = 0;
    this.id = '';
    this.controlEpoch = 0;
    this.snapshot = null;
    this.latency = 0;
    this.joined = parsed;
    if (lobbySocket) {
      this.setStatus('connecting');
      this.awaitHandshake(lobbySocket, this.generation);
      this.send(parsed);
      return;
    }
    this.open();
  }

  lobby(): void {
    if (!this.disposed && this.socket?.readyState === 1 && (!this.joined || this.welcomed)) {
      this.discardRetiredGame ||= this.joined !== null;
      this.send({ type: 'leave' });
      this.joined = null;
      this.welcomed = false;
      this.snapshot = null;
      this.id = '';
      this.controlEpoch = 0;
      this.setStatus('connecting');
      this.awaitHandshake(this.socket, this.generation);
      this.send({ type: 'lobby', protocolVersion: PROTOCOL_VERSION });
      return;
    }
    this.releaseSocket();
    this.disposed = false;
    this.attempts = 0;
    this.joined = null;
    this.id = '';
    this.controlEpoch = 0;
    this.snapshot = null;
    this.open();
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }

  private releaseSocket(): void {
    this.generation++;
    if (this.drain) clearInterval(this.drain);
    this.drain = null;
    this.outbound?.dispose();
    this.outbound = null;
    if (this.retry) clearTimeout(this.retry);
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.handshake) clearTimeout(this.handshake);
    this.retry = null;
    this.heartbeat = null;
    this.handshake = null;
    this.pendingPing = null;
    this.welcomed = false;
    this.discardRetiredGame = false;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < 2) socket.close(1000, 'Left the tub');
  }

  private connectionLost(socket: WebSocket, generation: number): void {
    if (this.disposed || this.socket !== socket || generation !== this.generation) return;
    if (this.welcomed && Date.now() - this.connectedAt >= 10000) this.attempts = 0;
    this.releaseSocket();
    this.id = '';
    this.controlEpoch = 0;
    this.snapshot = null;
    this.scheduleRetry();
  }

  private awaitHandshake(socket: WebSocket, generation: number): void {
    if (this.handshake) clearTimeout(this.handshake);
    this.handshake = setTimeout(
      () => this.connectionLost(socket, generation),
      this.options.handshakeTimeoutMs ?? 8000,
    );
  }

  private open(): void {
    if (this.disposed) return;
    this.setStatus(this.attempts ? 'reconnecting' : 'connecting');
    let socket: WebSocket;
    try {
      const url =
        this.options.url ?? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
      socket = (this.options.createSocket ?? ((address) => new WebSocket(address)))(url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    this.outbound = new OutboundChannel(new BrowserPeer(socket), clientCodec, {
      maxMessages: 32,
      maxBytes: 64 * 1024,
      maxPacketBytes: 8192,
      hardLimitBytes: 256 * 1024,
    });
    const generation = ++this.generation;
    let invalidMessages = 0;
    const current = () => !this.disposed && this.socket === socket && generation === this.generation;
    const lost = () => this.connectionLost(socket, generation);
    const invalid = () => {
      if (++invalidMessages >= 3)
        this.terminate('invalid_server_message', 'The pool sent invalid data. Please rejoin.');
    };
    this.awaitHandshake(socket, generation);
    socket.addEventListener('open', () => {
      if (!current()) return;
      this.lastReceived = Date.now();
      this.send(this.joined ?? { type: 'lobby', protocolVersion: PROTOCOL_VERSION });
      this.drain = setInterval(() => {
        if (current()) this.outbound?.flush();
      }, 50);
      this.heartbeat = setInterval(() => {
        if (!current()) return;
        if (
          Date.now() - this.lastReceived > (this.options.serverTimeoutMs ?? 10000) ||
          socket.bufferedAmount > 256 * 1024
        ) {
          lost();
          return;
        }
        this.ping();
      }, this.options.heartbeatMs ?? 5000);
      this.ping();
    });
    socket.addEventListener('message', (event) => {
      if (!current()) return;
      if (typeof event.data !== 'string' || event.data.length > 512 * 1024) {
        invalid();
        return;
      }
      let message = serverCodec.decode(event.data);
      if (!message) {
        invalid();
        return;
      }
      if (
        this.discardRetiredGame &&
        !this.welcomed &&
        ['snapshot', 'snapshot-delta', 'event', 'practice-complete', 'action-result', 'run-ended'].includes(
          message.type,
        )
      ) {
        this.lastReceived = Date.now();
        return;
      }
      if (message.type === 'snapshot-delta') {
        const merged = applySnapshotDelta(this.snapshot, message);
        const checked = merged ? parseServerMessage(merged) : null;
        if (!checked || checked.type !== 'snapshot') {
          this.send({ type: 'resync' });
          return;
        }
        message = checked;
      }
      if (message.type === 'presence') {
        this.online = message.online;
        if (!this.joined) {
          if (this.handshake) clearTimeout(this.handshake);
          this.handshake = null;
          this.setStatus('connected');
        }
      } else if (message.type === 'welcome') {
        if (message.protocolVersion !== PROTOCOL_VERSION || !message.controlEpoch) {
          this.terminate(
            'incompatible_server',
            'This pool uses an old game version. Reload the current game.',
          );
          return;
        }
        if (this.welcomed || message.mode !== this.joined?.mode) {
          invalid();
          return;
        }
        if (this.handshake) clearTimeout(this.handshake);
        this.handshake = null;
        this.welcomed = true;
        this.discardRetiredGame = false;
        this.connectedAt = Date.now();
        this.id = message.id;
        this.controlEpoch = message.controlEpoch;
        this.setStatus('connected');
      } else if (message.type === 'snapshot') {
        if (
          !this.welcomed ||
          message.mode !== this.joined?.mode ||
          !message.players.some((player) => player.id === this.id)
        ) {
          invalid();
          return;
        }
        if (this.snapshot && message.tick < this.snapshot.tick) return;
        this.snapshot = message;
      } else if (message.type === 'pong') {
        if (message.time !== this.pendingPing) return;
        this.latency = Math.min(60000, Math.max(0, Date.now() - message.time));
        this.pendingPing = null;
      } else if (message.type === 'error') {
        if (
          [
            'banned',
            'kicked',
            'already_playing',
            'pool_full',
            'join_limited',
            'session_expired',
            'protocol_version',
            'incompatible_version',
            'reload_required',
          ].includes(message.code.toLowerCase())
        ) {
          this.terminate(message.code, message.message);
          return;
        }
      } else {
        if (
          !this.welcomed &&
          ![
            'chat',
            'chat-history',
            'chat-deleted',
            'achievement-earned',
            'command-result',
            'live-leaderboard',
          ].includes(message.type)
        ) {
          invalid();
          return;
        }
        if (
          message.type === 'practice-complete' &&
          (this.joined?.mode !== 'practice' || message.result.runId !== this.snapshot?.practice?.runId)
        ) {
          invalid();
          return;
        }
      }
      this.lastReceived = Date.now();
      this.onMessage(message);
    });
    socket.addEventListener('error', lost);
    socket.addEventListener('close', (event) => {
      if (!current()) return;
      if (event.code === 4004) {
        this.terminate('kicked', 'A staff member ended this connection.');
        return;
      }
      if ([1000, 1002, 1003, 1008, 4003, 4006].includes(event.code)) {
        this.terminate(
          event.code === 4003 ? 'banned' : 'connection_closed',
          event.code === 4003 ? 'This player cannot join the pool.' : 'The connection closed. Please rejoin.',
        );
        return;
      }
      lost();
    });
  }

  private ping(): void {
    this.pendingPing = Date.now();
    this.send({ type: 'ping', time: this.pendingPing });
  }

  private scheduleRetry(): void {
    if (this.disposed || this.retry) return;
    const delays = this.options.retryDelays ?? [750, 1500, 3000, 5000, 8000, 12000];
    const delay = delays[this.attempts++];
    if (delay === undefined) {
      this.terminate('connection_failed', 'The pool is unavailable. Please try again.');
      return;
    }
    this.setStatus('reconnecting');
    const generation = this.generation;
    this.retry = setTimeout(() => {
      this.retry = null;
      if (!this.disposed && generation === this.generation) this.open();
    }, delay);
  }

  private terminate(code: string, message: string): void {
    this.disconnect();
    this.onMessage({ type: 'error', code, message });
  }

  send(message: ClientMessage): void {
    const socket = this.socket;
    if (this.disposed || !socket || socket.readyState !== 1) return;
    if (!this.welcomed && !['join', 'ping', 'lobby', 'leave', 'command', 'chat-send'].includes(message.type))
      return;
    if (message.type === 'input') this.outbound?.latest('input', message);
    else this.outbound?.ordered(message);
  }

  disconnect(): void {
    this.disposed = true;
    this.joined = null;
    this.releaseSocket();
    this.snapshot = null;
    this.id = '';
    this.controlEpoch = 0;
    this.latency = 0;
    this.setStatus('disconnected');
  }
}
