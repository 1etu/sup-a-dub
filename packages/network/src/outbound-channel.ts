import type { ChannelMetrics, ChannelOptions, PacketCodec, PacketPeer } from './contracts';

type Packet = { data: string; bytes: number; key?: string };

export class OutboundChannel<T> {
  private readonly queue: Packet[] = [];
  private readonly latestPackets = new Map<string, Packet>();
  private readonly encoder = new TextEncoder();
  private readonly limits: Required<ChannelOptions>;
  private ended = false;
  private readonly counts: ChannelMetrics = {
    queuedMessages: 0,
    queuedBytes: 0,
    sentPackets: 0,
    sentBytes: 0,
    replacedPackets: 0,
    rejectedPackets: 0,
  };

  constructor(
    private readonly peer: PacketPeer,
    private readonly codec: PacketCodec<T>,
    options: ChannelOptions = {},
  ) {
    this.limits = {
      maxMessages: options.maxMessages ?? 64,
      maxBytes: options.maxBytes ?? 1024 * 1024,
      maxPacketBytes: options.maxPacketBytes ?? 512 * 1024,
      highWaterBytes: options.highWaterBytes ?? 64 * 1024,
      hardLimitBytes: options.hardLimitBytes ?? 1024 * 1024,
    };
    if (
      Object.values(this.limits).some((n) => !Number.isSafeInteger(n) || n < 1) ||
      this.limits.highWaterBytes > this.limits.hardLimitBytes
    )
      throw new RangeError('The channel limits are invalid.');
  }

  get metrics(): Readonly<ChannelMetrics> {
    return { ...this.counts };
  }

  ordered(message: T): boolean {
    return this.enqueue(message);
  }

  latest(key: string, message: T): boolean {
    if (!key || key.length > 128) throw new RangeError('The state key is invalid.');
    return this.enqueue(message, key);
  }

  flush(): void {
    if (this.ended || !this.peer.open) return;
    if (this.peer.bufferedAmount >= this.limits.hardLimitBytes) {
      this.fail();
      return;
    }
    while (this.queue.length && this.peer.bufferedAmount < this.limits.highWaterBytes) {
      const packet = this.queue[0];
      try {
        this.peer.send(packet.data);
      } catch {
        this.fail();
        return;
      }
      this.queue.shift();
      if (packet.key) this.latestPackets.delete(packet.key);
      this.counts.queuedMessages--;
      this.counts.queuedBytes -= packet.bytes;
      this.counts.sentPackets++;
      this.counts.sentBytes += packet.bytes;
    }
  }

  dispose(): void {
    this.ended = true;
    this.queue.length = 0;
    this.latestPackets.clear();
    this.counts.queuedBytes = 0;
    this.counts.queuedMessages = 0;
  }

  private enqueue(message: T, key?: string): boolean {
    if (this.ended || !this.peer.open) return false;
    let data: string;
    try {
      data = this.codec.encode(message);
    } catch {
      this.counts.rejectedPackets++;
      return false;
    }
    const bytes = this.encoder.encode(data).byteLength;
    const previous = key ? this.latestPackets.get(key) : undefined;
    if (
      bytes > this.limits.maxPacketBytes ||
      this.counts.queuedBytes - (previous?.bytes ?? 0) + bytes > this.limits.maxBytes ||
      (!previous && this.queue.length >= this.limits.maxMessages)
    ) {
      this.counts.rejectedPackets++;
      this.fail();
      return false;
    }
    if (previous) {
      this.counts.queuedBytes += bytes - previous.bytes;
      previous.data = data;
      previous.bytes = bytes;
      this.counts.replacedPackets++;
    } else {
      const packet: Packet = { data, bytes, key };
      this.queue.push(packet);
      if (key) this.latestPackets.set(key, packet);
      this.counts.queuedBytes += bytes;
      this.counts.queuedMessages++;
    }
    this.flush();
    return !this.ended;
  }

  private fail(): void {
    this.dispose();
    this.peer.close(1013, 'The connection queue is full.');
  }
}
