import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { instrumentSample, SAMPLE_RATE, writeWave } from './instruments';
import { SCORES, scoreNotes } from './scores';
import type { Instrument, Layer } from './scores';

const root = resolve(import.meta.dir, '..');
const layers: readonly Layer[] = ['melody', 'harmony', 'bass', 'rhythm'];
const selection = process.argv[2];
const reports: unknown[] = [];
await mkdir(join(root, 'masters'), { recursive: true });
await mkdir(join(root, 'scores'), { recursive: true });
await mkdir(join(root, 'instruments'), { recursive: true });

for (const score of SCORES.filter((score) => !selection || score.id === selection)) {
  const bars = score.sections.reduce((sum, section) => sum + section.bars, 0);
  const seconds = (bars * 4 * 60) / score.bpm;
  const frames = Math.round(seconds * SAMPLE_RATE);
  const notes = scoreNotes(score);
  const stems = Object.fromEntries(
    layers.map((layer) => [layer, [new Float32Array(frames), new Float32Array(frames)]]),
  ) as Record<Layer, [Float32Array, Float32Array]>;
  const cache = new Map<string, Float32Array>();
  const sample = (instrument: Instrument, midi: number) => {
    const key = `${instrument}-${midi}`;
    let value = cache.get(key);
    if (!value) {
      value = instrumentSample(instrument, midi);
      cache.set(key, value);
    }
    return value;
  };
  for (const note of notes) {
    const source = sample(note.instrument, note.midi);
    const start = Math.round(((note.beat * 60) / score.bpm) * SAMPLE_RATE);
    const sustained = note.instrument === 'strings' || note.instrument === 'flute';
    const hold = Math.round(((note.length * 60) / score.bpm) * SAMPLE_RATE);
    const tail = Math.round((sustained ? 0.22 : note.instrument === 'piano' ? 0.6 : 0.3) * SAMPLE_RATE);
    const length = Math.min(source.length, hold + tail);
    const angle = ((note.pan + 1) * Math.PI) / 4;
    const left = Math.cos(angle) * note.velocity;
    const right = Math.sin(angle) * note.velocity;
    const stereo = stems[note.layer];
    for (let frame = 0; frame < length; frame++) {
      const position = (start + frame) % frames;
      const envelope = frame > hold ? Math.max(0, 1 - (frame - hold) / tail) ** 2 : 1;
      const value = source[frame] * envelope;
      stereo[0][position] += value * left;
      stereo[1][position] += value * right;
    }
  }
  for (const layer of layers) {
    const stereo = stems[layer];
    const wet = layer === 'rhythm' ? 0.05 : layer === 'bass' ? 0.025 : 0.17;
    for (const [delay, gain] of [
      [0.071, 0.52],
      [0.113, 0.4],
      [0.179, 0.3],
      [0.263, 0.2],
      [0.337, 0.15],
      [0.419, 0.1],
    ]) {
      const offset = Math.round(delay * SAMPLE_RATE);
      for (let frame = 0; frame < frames; frame++) {
        const other = (frame + offset) % frames;
        stereo[0][other] += stereo[1][frame] * wet * gain;
        stereo[1][other] += stereo[0][frame] * wet * gain;
      }
    }
  }
  let peak = 0;
  let power = 0;
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < 2; channel++) {
      const value = layers.reduce((sum, layer) => sum + stems[layer][channel][frame], 0);
      peak = Math.max(peak, Math.abs(value));
      power += value * value;
    }
  const gain = 0.76 / Math.max(0.001, peak);
  const mixed = [new Float32Array(frames), new Float32Array(frames)];
  const paths = [];
  for (const layer of layers) {
    const stereo = stems[layer];
    for (let frame = 0; frame < frames; frame++)
      for (let channel = 0; channel < 2; channel++) {
        stereo[channel][frame] *= gain;
        mixed[channel][frame] += stereo[channel][frame];
      }
    const path = join(root, 'masters', `${score.id}-${layer}.wav`);
    await Bun.write(path, writeWave(stereo));
    const bytes = await Bun.file(path).arrayBuffer();
    paths.push({
      layer,
      file: `masters/${score.id}-${layer}.wav`,
      bytes: bytes.byteLength,
      sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
    });
  }
  await Bun.write(join(root, 'masters', `${score.id}-mix.wav`), writeWave(mixed));
  await Bun.write(
    join(root, 'scores', `${score.id}.json`),
    JSON.stringify({ score, bars, seconds, sampleRate: SAMPLE_RATE, notes }, null, 2),
  );
  const sectionLevels = [];
  let bar = 0;
  for (const section of score.sections) {
    const start = Math.round(((bar * 4 * 60) / score.bpm) * SAMPLE_RATE);
    bar += section.bars;
    const end = Math.min(frames, Math.round(((bar * 4 * 60) / score.bpm) * SAMPLE_RATE));
    let sum = 0;
    for (let frame = start; frame < end; frame++) sum += mixed[0][frame] ** 2 + mixed[1][frame] ** 2;
    sectionLevels.push({
      name: section.name,
      startSeconds: start / SAMPLE_RATE,
      endSeconds: end / SAMPLE_RATE,
      rms: Math.sqrt(sum / Math.max(1, (end - start) * 2)),
    });
  }
  const report = {
    id: score.id,
    title: score.title,
    bpm: score.bpm,
    bars,
    seconds,
    frames,
    sampleRate: SAMPLE_RATE,
    channels: 2,
    notes: notes.length,
    instruments: [...new Set(notes.map((note) => note.instrument))],
    originalPeak: peak,
    gain,
    peak: 0.76,
    rms: Math.sqrt(power / (frames * 2)) * gain,
    sections: sectionLevels,
    stems: paths,
  };
  reports.push(report);
  await Bun.write(join(root, 'scores', `${score.id}-render.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cue: score.id, seconds, notes: notes.length, peak: 0.76, rms: report.rms }));
}
for (const instrument of [
  'piano',
  'flute',
  'pizzicato',
  'marimba',
  'glockenspiel',
  'strings',
  'bass',
  'kick',
  'snare',
  'tom',
  'shaker',
  'cymbal',
] as const) {
  await Bun.write(
    join(root, 'instruments', `${instrument}.wav`),
    writeWave([
      instrumentSample(
        instrument,
        instrument === 'bass' ? 40 : instrument === 'kick' ? 36 : instrument === 'tom' ? 45 : 60,
      ),
    ]),
  );
}
if (!selection)
  await Bun.write(
    join(root, 'render-manifest.json'),
    JSON.stringify(
      { version: 1, authoredInstruments: true, externalSamplesUsed: false, cues: reports },
      null,
      2,
    ),
  );
