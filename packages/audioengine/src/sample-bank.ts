import type { MusicSample, SampleFetcher, SampleLease } from './music-types';

type Entry = { buffer: AudioBuffer; bytes: number; pins: number; touched: number };
type Pending = { promise: Promise<Entry>; abort: AbortController; reserved: number };
const aborted = () => new DOMException('Music loading was canceled.', 'AbortError');

async function defaultFetch(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`Music asset returned ${response.status}.`);
  const size = Number(response.headers.get('content-length') ?? 0);
  if (size > 2_097_152) throw new RangeError('The music asset exceeds its encoded size limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The music asset has no response body.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 2_097_152) throw new RangeError('The music asset exceeds its encoded size limit.');
      chunks.push(result.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const output = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

export class SampleBank {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Pending>();
  private closed = false;
  private sequence = 0;
  private used = 0;
  private reserved = 0;
  private peak = 0;
  private failures = 0;

  constructor(
    private readonly context: BaseAudioContext,
    readonly maxBytes = 48 * 1024 * 1024,
    private readonly fetcher: SampleFetcher = defaultFetch,
  ) {
    if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 48 * 1024 * 1024)
      throw new RangeError('The music memory budget is invalid.');
  }

  async acquire(sample: MusicSample, signal?: AbortSignal): Promise<SampleLease> {
    if (this.closed || signal?.aborted) throw aborted();
    if (
      !sample ||
      typeof sample.url !== 'string' ||
      !sample.url.startsWith('/assets/') ||
      sample.url.includes('..') ||
      sample.url.length > 300 ||
      !Number.isInteger(sample.bytes) ||
      sample.bytes < 1 ||
      sample.bytes > 2_097_152 ||
      !Number.isFinite(sample.seconds) ||
      sample.seconds <= 0 ||
      sample.seconds > 12.5 ||
      ![1, 2].includes(sample.channels)
    )
      throw new TypeError('The music sample descriptor is invalid.');
    let entry = this.entries.get(sample.url);
    if (!entry) {
      let pending = this.pending.get(sample.url);
      if (!pending) {
        if (this.pending.size >= 4) throw new RangeError('The music load queue is full.');
        const reserved = Math.ceil((sample.seconds + 0.1) * this.context.sampleRate) * sample.channels * 4;
        this.makeRoom(reserved);
        const abort = new AbortController();
        const promise = this.load(sample, abort.signal, reserved);
        pending = { promise, abort, reserved };
        this.reserved += reserved;
        this.peak = Math.max(this.peak, this.used + this.reserved);
        this.pending.set(sample.url, pending);
        void promise
          .finally(() => {
            if (this.pending.get(sample.url)?.promise === promise) {
              this.pending.delete(sample.url);
              this.reserved -= reserved;
            }
          })
          .catch(() => undefined);
      }
      entry = await this.withSignal(pending.promise, signal);
    }
    if (this.closed || signal?.aborted) throw aborted();
    return this.lease(entry);
  }

  cancelPending(): void {
    for (const pending of this.pending.values()) pending.abort.abort();
  }

  trim(): void {
    for (const [id, entry] of this.entries)
      if (entry.pins === 0) {
        this.entries.delete(id);
        this.used -= entry.bytes;
      }
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.cancelPending();
    this.pending.clear();
    this.reserved = 0;
    this.entries.clear();
    this.used = 0;
  }

  get diagnostics() {
    return {
      bytes: this.used,
      reservedBytes: this.reserved,
      peakBytes: this.peak,
      maxBytes: this.maxBytes,
      entries: this.entries.size,
      loading: this.pending.size,
      pinned: [...this.entries.values()].filter((entry) => entry.pins > 0).length,
      failures: this.failures,
      disposed: this.closed,
    };
  }

  private async load(sample: MusicSample, signal: AbortSignal, reservation: number): Promise<Entry> {
    try {
      const data = await this.fetcher(sample.url, signal);
      if (signal.aborted || this.closed) throw aborted();
      if (data.byteLength !== sample.bytes || data.byteLength > 2_097_152)
        throw new RangeError('The music asset size does not match its catalog.');
      if (sample.sha256) {
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
        const value = [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('');
        if (value !== sample.sha256) throw new Error('The music asset checksum does not match its catalog.');
      }
      if (signal.aborted || this.closed) throw aborted();
      const buffer = await this.context.decodeAudioData(data);
      if (signal.aborted || this.closed) throw aborted();
      const bytes = buffer.length * buffer.numberOfChannels * 4;
      if (
        buffer.numberOfChannels !== sample.channels ||
        bytes > reservation ||
        buffer.duration < sample.seconds - 0.15
      )
        throw new RangeError('The decoded music asset exceeds its declared bounds.');
      const entry = { buffer, bytes, pins: 0, touched: ++this.sequence };
      const pending = this.pending.get(sample.url);
      if (pending?.abort.signal === signal) {
        this.pending.delete(sample.url);
        this.reserved -= pending.reserved;
      }
      this.entries.set(sample.url, entry);
      this.used += bytes;
      this.peak = Math.max(this.peak, this.used + this.reserved);
      return entry;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) this.failures++;
      throw error;
    }
  }

  private makeRoom(bytes: number): void {
    const free = [...this.entries]
      .filter(([, entry]) => entry.pins === 0)
      .sort((a, b) => a[1].touched - b[1].touched);
    while (this.used + this.reserved + bytes > this.maxBytes && free.length) {
      const [key, entry] = free.shift()!;
      this.entries.delete(key);
      this.used -= entry.bytes;
    }
    if (this.used + this.reserved + bytes > this.maxBytes)
      throw new RangeError('The decoded music budget is full.');
  }

  private lease(entry: Entry): SampleLease {
    entry.pins++;
    entry.touched = ++this.sequence;
    let released = false;
    return {
      buffer: entry.buffer,
      retain: () => {
        if (released || this.closed) throw new Error('The music sample lease is closed.');
        return this.lease(entry);
      },
      release: () => {
        if (released) return;
        released = true;
        entry.pins = Math.max(0, entry.pins - 1);
      },
    };
  }

  private withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    return new Promise((resolve, reject) => {
      const abort = () => reject(aborted());
      signal.addEventListener('abort', abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }
}
