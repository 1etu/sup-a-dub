import type { PacketPeer } from './contracts';

export class BrowserPeer implements PacketPeer {
  constructor(readonly socket: Pick<WebSocket, 'readyState' | 'bufferedAmount' | 'send' | 'close'>) {}
  get open(): boolean {
    return this.socket.readyState === 1;
  }
  get bufferedAmount(): number {
    return this.socket.bufferedAmount;
  }
  send(data: string): void {
    this.socket.send(data);
  }
  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }
}

export interface ServerSocket {
  readonly readyState: number;
  getBufferedAmount(): number;
  send(data: string, compress?: boolean): number;
  close(code?: number, reason?: string): void;
}

export class BunPeer implements PacketPeer {
  constructor(
    readonly socket: ServerSocket,
    private readonly compress = false,
  ) {}
  get open(): boolean {
    return this.socket.readyState === 1;
  }
  get bufferedAmount(): number {
    return this.socket.getBufferedAmount();
  }
  send(data: string): void {
    if (this.socket.send(data, this.compress) === 0) throw new Error('The socket cannot send the packet.');
  }
  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }
}
