export interface PacketPeer {
  readonly bufferedAmount: number;
  readonly open: boolean;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface PacketCodec<T> {
  encode(value: T): string;
  decode(raw: unknown): T | null;
}

export type ChannelOptions = {
  maxMessages?: number;
  maxBytes?: number;
  maxPacketBytes?: number;
  highWaterBytes?: number;
  hardLimitBytes?: number;
};

export type ChannelMetrics = {
  queuedMessages: number;
  queuedBytes: number;
  sentPackets: number;
  sentBytes: number;
  replacedPackets: number;
  rejectedPackets: number;
};
