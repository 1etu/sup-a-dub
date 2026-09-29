import type { Instrument } from './scores';
export const SAMPLE_RATE = 32000;
const tau = Math.PI * 2;

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
}

function modes(
  output: Float32Array,
  frequency: number,
  ratios: readonly number[],
  weights: readonly number[],
  decay: number,
  inharmonic = 0,
  detune = 0,
): void {
  for (let partial = 0; partial < ratios.length; partial++) {
    const ratio = ratios[partial] * Math.sqrt(1 + inharmonic * ratios[partial] ** 2);
    const step = (tau * frequency * ratio * (1 + detune * (partial % 2 ? -1 : 1))) / SAMPLE_RATE;
    if (step > Math.PI * 0.9) continue;
    const rotation = Math.cos(step);
    const loss = Math.exp(-1 / ((SAMPLE_RATE * decay) / (1 + partial * 0.32)));
    const coefficient = 2 * rotation * loss;
    const lossSquared = loss * loss;
    let previous = 0;
    let current = Math.sin(step) * weights[partial];
    for (let index = 0; index < output.length; index++) {
      output[index] += current;
      const next = coefficient * current - lossSquared * previous;
      previous = current;
      current = next;
    }
  }
}

export function instrumentSample(instrument: Instrument, midi: number): Float32Array {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const seconds =
    instrument === 'shaker'
      ? 0.22
      : instrument === 'snare'
        ? 0.48
        : instrument === 'kick' || instrument === 'tom'
          ? 1.1
          : 4;
  const output = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  const noise = random(midi * 173 + [...instrument].reduce((sum, letter) => sum + letter.charCodeAt(0), 0));
  if (instrument === 'piano') {
    modes(
      output,
      frequency,
      [1, 2, 3, 4, 5, 6, 7, 8, 10],
      [0.48, 0.25, 0.17, 0.09, 0.05, 0.03, 0.019, 0.01, 0.006],
      1.8 + 90 / frequency,
      0.00009,
      0.00085,
    );
    modes(
      output,
      frequency,
      [1, 2, 3, 4, 5],
      [0.28, 0.15, 0.1, 0.05, 0.018],
      1.9 + 95 / frequency,
      0.0001,
      -0.0011,
    );
  } else if (instrument === 'pizzicato') {
    modes(
      output,
      frequency,
      [1, 2, 3, 4, 5, 6, 7, 8],
      [0.55, 0.2, 0.14, 0.02, 0.08, 0.024, 0.01, 0.02],
      0.68 + 30 / frequency,
      0.000035,
    );
  } else if (instrument === 'marimba') {
    modes(output, frequency, [1, 3.97, 9.2, 16.1], [0.7, 0.21, 0.055, 0.014], 1.35, 0.00001);
  } else if (instrument === 'glockenspiel') {
    modes(output, frequency, [1, 2.76, 5.4, 8.93], [0.48, 0.25, 0.1, 0.035], 2.5);
  } else if (instrument === 'bass') {
    modes(
      output,
      frequency,
      [1, 2, 3, 4, 5, 7],
      [0.7, 0.2, 0.08, 0.035, 0.02, 0.009],
      1.8 + 60 / frequency,
      0.00001,
    );
  } else if (instrument === 'flute') {
    let air = 0;
    for (let index = 0; index < output.length; index++) {
      const time = index / SAMPLE_RATE;
      const vibrato = 0.0035 * Math.sin(tau * 5.05 * time) * Math.min(1, time * 2);
      const phase = tau * frequency * time + (vibrato * frequency) / 5.05;
      air = air * 0.7 + noise() * 0.3;
      const breath = 0.62 + 0.025 * Math.sin(tau * 3.17 * time) + 0.018 * Math.sin(tau * 0.83 * time);
      output[index] =
        breath *
          (Math.sin(phase) +
            0.17 * Math.sin(phase * 2 + 0.3) +
            0.055 * Math.sin(phase * 3) +
            0.022 * Math.sin(phase * 4)) +
        air * 0.018;
    }
  } else if (instrument === 'strings') {
    for (const detune of [-0.0015, 0.0019])
      modes(
        output,
        frequency,
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        [0.32, 0.1, 0.08, 0.058, 0.045, 0.035, 0.025, 0.019, 0.013, 0.01, 0.007, 0.005],
        12,
        0.000001,
        detune,
      );
  } else {
    let high = 0;
    let low = 0;
    let phase = 0;
    for (let index = 0; index < output.length; index++) {
      const time = index / SAMPLE_RATE;
      const white = noise();
      low += 0.12 * (white - low);
      high = white - low;
      if (instrument === 'kick') {
        phase += (tau * (48 + 115 * Math.exp(-time * 28))) / SAMPLE_RATE;
        output[index] = Math.sin(phase) * Math.exp(-time * 7.7) + high * 0.17 * Math.exp(-time * 95);
      } else if (instrument === 'tom') {
        phase += (tau * frequency * (0.75 + 0.4 * Math.exp(-time * 18))) / SAMPLE_RATE;
        output[index] =
          (0.8 * Math.sin(phase) + 0.17 * Math.sin(phase * 1.59)) * Math.exp(-time * 6) +
          high * 0.07 * Math.exp(-time * 40);
      } else if (instrument === 'snare')
        output[index] =
          high * 0.62 * Math.exp(-time * 19) +
          low * 0.5 * Math.exp(-time * 15) +
          Math.sin(tau * 183 * time) * 0.23 * Math.exp(-time * 24);
      else if (instrument === 'shaker')
        output[index] = high * 0.6 * Math.exp(-time * 40) * Math.min(1, time * 1400);
      else
        output[index] =
          (high * 0.35 + Math.sin(tau * 3713 * time) * Math.sin(tau * 5267 * time) * 0.08) *
          Math.exp(-time * 1.9);
    }
  }
  const attack =
    instrument === 'strings' ? 0.22 : instrument === 'flute' ? 0.045 : instrument === 'bass' ? 0.008 : 0.0025;
  for (let index = 0; index < output.length; index++) {
    const time = index / SAMPLE_RATE;
    output[index] *= Math.min(1, time / attack) * Math.min(1, (seconds - time) / 0.035);
    if (instrument === 'piano') output[index] += noise() * 0.018 * Math.exp(-time * 180);
  }
  return output;
}

export function writeWave(channels: readonly Float32Array[], sampleRate = SAMPLE_RATE): Uint8Array {
  const frames = channels[0].length;
  const dataBytes = frames * channels.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((letter, index) => (bytes[offset + index] = letter.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, dataBytes + 36, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < channels.length; channel++)
      view.setInt16(
        44 + (frame * channels.length + channel) * 2,
        Math.round(Math.max(-1, Math.min(1, channels[channel][frame])) * 32767),
        true,
      );
  return bytes;
}
