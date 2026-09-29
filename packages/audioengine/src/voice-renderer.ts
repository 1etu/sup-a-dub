import type { AudioCurve, NoiseColor, SoundVoice, VoiceHandle } from './types';

function automate(parameter: AudioParam, points: AudioCurve, start: number, gain = 1): void {
  for (const point of points) {
    const value = point.value * gain;
    if (point.curve === 'exponential')
      parameter.exponentialRampToValueAtTime(Math.max(0.00001, value), start + point.time);
    else if (point.curve === 'linear') parameter.linearRampToValueAtTime(value, start + point.time);
    else parameter.setValueAtTime(value, start + point.time);
  }
}

export class WebAudioVoiceRenderer {
  private readonly noise = new Map<NoiseColor, AudioBuffer>();
  private seed = 12378431;

  constructor(private readonly context: BaseAudioContext) {}

  render(voice: SoundVoice, output: AudioNode, when: number, volume = 1, pan = 0): VoiceHandle {
    const context = this.context;
    const nodes: AudioNode[] = [];
    const source =
      voice.source.kind === 'oscillator' ? context.createOscillator() : context.createBufferSource();
    let finished = false;
    let listener: (() => void) | undefined;
    const release = () => {
      if (finished) return;
      finished = true;
      source.onended = null;
      for (const node of nodes) node.disconnect();
      source.disconnect();
      listener?.();
    };
    try {
      const start = Math.max(context.currentTime, when) + (voice.delay ?? 0);
      if (voice.source.kind === 'oscillator') {
        const oscillator = source as OscillatorNode;
        oscillator.type = voice.source.wave;
        automate(oscillator.frequency, voice.source.frequency, start);
      } else {
        const buffer = source as AudioBufferSourceNode;
        buffer.buffer = this.noiseBuffer(voice.source.color);
        buffer.loop = true;
      }
      let tail: AudioNode = source;
      if (voice.filter) {
        const filter = context.createBiquadFilter();
        nodes.push(filter);
        filter.type = voice.filter.type;
        filter.Q.value = voice.filter.q ?? 1;
        automate(filter.frequency, voice.filter.frequency, start);
        tail.connect(filter);
        tail = filter;
      }
      const stereo = Math.max(-1, Math.min(1, pan + (voice.pan ?? 0)));
      if (Math.abs(stereo) > 0.001) {
        const panner = context.createStereoPanner();
        nodes.push(panner);
        panner.pan.value = stereo;
        tail.connect(panner);
        tail = panner;
      }
      const gain = context.createGain();
      nodes.push(gain);
      gain.gain.value = 0;
      automate(gain.gain, voice.envelope, start, volume);
      tail.connect(gain);
      gain.connect(output);
      source.onended = release;
      if (voice.source.kind === 'noise') (source as AudioBufferSourceNode).start(start, this.random() * 1.5);
      else source.start(start);
      source.stop(start + voice.duration + 0.015);
      return {
        onEnded(callback) {
          listener = callback;
          if (finished) callback();
        },
        stop() {
          if (finished) return;
          try {
            source.stop();
          } finally {
            release();
          }
        },
      };
    } catch (error) {
      try {
        source.stop();
      } catch {}
      release();
      throw error;
    }
  }

  get diagnostics() {
    let samples = 0;
    for (const buffer of this.noise.values()) samples += buffer.length;
    return { noiseBuffers: this.noise.size, noiseBytes: samples * 4 };
  }

  dispose(): void {
    this.noise.clear();
  }

  private noiseBuffer(color: NoiseColor): AudioBuffer {
    const existing = this.noise.get(color);
    if (existing) return existing;
    const buffer = this.context.createBuffer(
      1,
      Math.ceil(this.context.sampleRate * 2),
      this.context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let slow = 0;
    let medium = 0;
    let fast = 0;
    for (let index = 0; index < samples.length; index++) {
      const white = this.random() * 2 - 1;
      slow = slow * 0.998 + white * 0.023;
      medium = medium * 0.96 + white * 0.07;
      fast = fast * 0.57 + white * 0.19;
      samples[index] =
        color === 'white' ? white : color === 'brown' ? slow * 2 : (slow + medium + fast + white * 0.1) * 0.8;
    }
    this.noise.set(color, buffer);
    return buffer;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
