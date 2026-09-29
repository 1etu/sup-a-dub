import type { AudioAdapter } from './types';

function browserContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const Constructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor({ latencyHint: 'interactive' }) : undefined;
}

export class BrowserAudioAdapter implements AudioAdapter {
  private value?: AudioContext;
  private closed = false;
  private pending?: Promise<BaseAudioContext | undefined>;
  private wakeup?: AudioBufferSourceNode;

  constructor(private readonly createContext: () => AudioContext | undefined = browserContext) {}

  get context(): AudioContext | undefined {
    return this.value;
  }

  get running(): boolean {
    return this.value?.state === 'running' && !this.closed;
  }

  prepare(): AudioContext | undefined {
    if (this.closed) return undefined;
    this.value ??= this.createContext();
    return this.value;
  }

  unlock(): Promise<BaseAudioContext | undefined> {
    if (this.closed) return Promise.resolve(undefined);
    if (this.pending) return this.pending;
    this.pending = this.resume().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  async suspend(): Promise<void> {
    if (this.value?.state === 'running') await this.value.suspend();
  }

  async dispose(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.releaseWakeup();
    const context = this.value;
    this.value = undefined;
    if (context && context.state !== 'closed') await context.close();
  }

  private async resume(): Promise<BaseAudioContext | undefined> {
    const context = this.prepare();
    if (context?.state === 'suspended') {
      const source = context.createBufferSource();
      this.wakeup = source;
      try {
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(context.destination);
        source.onended = () => this.releaseWakeup();
        source.start();
        await context.resume();
      } finally {
        this.releaseWakeup();
      }
    }
    return this.closed ? undefined : context;
  }

  private releaseWakeup(): void {
    const source = this.wakeup;
    if (!source) return;
    this.wakeup = undefined;
    source.onended = null;
    try {
      source.stop();
    } catch {}
    source.disconnect();
  }
}

export class ContextAudioAdapter implements AudioAdapter {
  private closed = false;

  constructor(private readonly value: BaseAudioContext) {}

  get context(): BaseAudioContext | undefined {
    return this.closed ? undefined : this.value;
  }

  get running(): boolean {
    return !this.closed;
  }

  async unlock(): Promise<BaseAudioContext | undefined> {
    return this.context;
  }

  async suspend(): Promise<void> {}

  async dispose(): Promise<void> {
    this.closed = true;
  }
}
