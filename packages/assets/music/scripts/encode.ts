import { mkdir, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { SCORES } from './scores';
import { SAMPLE_RATE } from './instruments';
import type { MusicCatalog, MusicChunk, MusicEncodings, MusicSample } from '@supadub/audioengine';

const root = resolve(import.meta.dir, '..');
const ffmpeg = process.env.FFMPEG_PATH ?? 'C:/Program Files/ShareX/ffmpeg.exe';
const selected = process.argv[2];
const layers = ['melody', 'harmony', 'bass', 'rhythm'] as const;
const qualities = ['normal', 'low'] as const;
const catalog: MusicCatalog[number][] = [];
const evidence: unknown[] = [];
await mkdir(join(root, 'browser'), { recursive: true });
await mkdir(join(root, 'previews'), { recursive: true });
await mkdir(join(root, '.chunks'), { recursive: true });
await mkdir(resolve(root, '../src/music'), { recursive: true });
const header = (frames: number) => {
  const bytes = new Uint8Array(44 + frames * 4);
  const view = new DataView(bytes.buffer);
  for (const [offset, value] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ] as const)
    [...value].forEach((letter, index) => (bytes[offset + index] = letter.charCodeAt(0)));
  view.setUint32(4, bytes.length - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, frames * 4, true);
  return bytes;
};
const sha = (data: ArrayBuffer) => new Bun.CryptoHasher('sha256').update(data).digest('hex');
const bounded = async <T>(values: readonly T[], run: (value: T) => Promise<void>) => {
  let index = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < values.length) await run(values[index++]);
    }),
  );
};

for (const score of SCORES.filter((score) => !selected || score.id === selected)) {
  const bars = score.sections.reduce((sum, section) => sum + section.bars, 0);
  const chunkSeconds = (16 * 60) / score.bpm;
  const seconds = (bars * 4 * 60) / score.bpm;
  const chunkFrames = Math.round((chunkSeconds + 0.4) * SAMPLE_RATE);
  const masters = Object.fromEntries(
    await Promise.all(
      layers.map(async (layer) => [
        layer,
        new Uint8Array(
          await Bun.file(join(root, 'masters', `${score.id}-${layer}.wav`)).arrayBuffer(),
        ).subarray(44),
      ]),
    ),
  ) as Record<(typeof layers)[number], Uint8Array>;
  const chunks: MusicChunk[] = [];
  for (let index = 0; index < bars / 4; index++)
    chunks.push({ stems: Object.fromEntries(layers.map((layer) => [layer, {}])) as MusicChunk['stems'] });
  const jobs = chunks.flatMap((_, chunk) => layers.map((layer) => ({ layer, chunk })));
  await bounded(jobs, async ({ layer, chunk }) => {
    const startFrame = Math.round(chunk * chunkSeconds * SAMPLE_RATE);
    const input = header(chunkFrames);
    const data = masters[layer];
    const startByte = (startFrame * 4) % data.length;
    const head = Math.min(input.length - 44, data.length - startByte);
    input.set(data.subarray(startByte, startByte + head), 44);
    if (head < input.length - 44) input.set(data.subarray(0, input.length - 44 - head), 44 + head);
    const stem = `${score.id}-${String(chunk).padStart(2, '0')}-${layer}`;
    const inputPath = join(root, '.chunks', `${stem}.wav`);
    await Bun.write(inputPath, input);
    const command = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath];
    for (const quality of qualities) {
      const channels = quality === 'normal' ? '2' : '1';
      const downmix = quality === 'low' ? ['-af', 'pan=mono|c0=0.5*c0+0.5*c1'] : [];
      const reproducible = ['-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1'];
      command.push(
        '-map',
        '0:a',
        ...downmix,
        '-ac',
        channels,
        '-c:a',
        'libopus',
        ...reproducible,
        '-b:a',
        quality === 'normal' ? '64k' : '40k',
        '-vbr',
        'on',
        '-application',
        'audio',
        '-frame_duration',
        '20',
        join(root, 'browser', `${stem}-${quality}.opus`),
      );
      command.push(
        '-map',
        '0:a',
        ...downmix,
        '-ac',
        channels,
        '-c:a',
        'aac',
        ...reproducible,
        '-b:a',
        quality === 'normal' ? '80k' : '48k',
        '-ar',
        '32000',
        '-movflags',
        '+faststart',
        join(root, 'browser', `${stem}-${quality}.m4a`),
      );
    }
    const process = Bun.spawn(command, { stdout: 'ignore', stderr: 'pipe' });
    const error = await new Response(process.stderr).text();
    if ((await process.exited) !== 0) throw new Error(error.slice(-2000));
    const metadata = {} as Record<(typeof qualities)[number], MusicEncodings>;
    for (const quality of qualities) {
      const formats = {} as Record<'opus' | 'aac', MusicSample>;
      for (const codec of ['opus', 'aac'] as const) {
        const filename = `${stem}-${quality}.${codec === 'opus' ? 'opus' : 'm4a'}`;
        const bytes = await Bun.file(join(root, 'browser', filename)).arrayBuffer();
        formats[codec] = {
          url: `/assets/music/${filename}`,
          sha256: sha(bytes),
          bytes: bytes.byteLength,
          seconds: chunkFrames / SAMPLE_RATE,
          channels: quality === 'normal' ? 2 : 1,
        };
      }
      metadata[quality] = formats;
    }
    (chunks[chunk].stems as Record<(typeof layers)[number], typeof metadata>)[layer] = metadata;
    evidence.push({
      cue: score.id,
      chunk,
      layer,
      intendedStartFrame: startFrame,
      intendedStartSeconds: startFrame / SAMPLE_RATE,
      intendedDecodedFrames: chunkFrames,
      sampleRate: SAMPLE_RATE,
      overlapSeconds: 0.4,
      formats: metadata,
    });
    await unlink(inputPath);
  });
  const cue = {
    id: score.id,
    title: score.title,
    bpm: score.bpm,
    beatsPerBar: 4,
    barsPerChunk: 4,
    seconds,
    chunks,
  };
  catalog.push(cue);
  const preview = Bun.spawn(
    [
      ffmpeg,
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      join(root, 'masters', `${score.id}-mix.wav`),
      '-c:a',
      'libopus',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      '-map_metadata',
      '-1',
      '-b:a',
      '112k',
      join(root, 'previews', `${score.id}.opus`),
    ],
    { stdout: 'ignore', stderr: 'pipe' },
  );
  const previewError = await new Response(preview.stderr).text();
  if ((await preview.exited) !== 0) throw new Error(previewError);
  await Bun.write(join(root, 'scores', `${score.id}-catalog.json`), JSON.stringify(cue));
  console.log(JSON.stringify({ cue: score.id, chunks: chunks.length, encodedFiles: chunks.length * 16 }));
}
if (selected) {
  catalog.length = 0;
  for (const score of SCORES)
    catalog.push(await Bun.file(join(root, 'scores', `${score.id}-catalog.json`)).json());
}
const assets = catalog.flatMap((cue) =>
  cue.chunks.flatMap((chunk) =>
    layers.flatMap((layer) => qualities.flatMap((quality) => Object.values(chunk.stems[layer][quality]))),
  ),
);
await Bun.write(resolve(root, '../src/music/catalog.json'), JSON.stringify(catalog, null, 2));
await Bun.write(
  resolve(root, '../src/music/index.ts'),
  `import { validMusicCatalog } from '@supadub/audioengine';\nimport type { MusicCatalog } from '@supadub/audioengine';\nimport catalog from './catalog.json';\nconst authored: unknown = catalog;\nif (!validMusicCatalog(authored)) throw new Error('The authored music catalog is invalid.');\nexport const GAME_MUSIC: MusicCatalog = authored;\nexport type GameMusicCue = 'bubble-lobby' | 'tile-trails' | 'rubber-run' | 'deep-end' | 'flock-frenzy' | 'home-with-ducks';\n`,
);
await Bun.write(join(root, 'browser', 'catalog.json'), JSON.stringify(catalog));
await Bun.write(
  join(root, 'encode-manifest.json'),
  JSON.stringify(
    {
      version: 1,
      encoder: ffmpeg,
      sourceSampleRate: SAMPLE_RATE,
      overlapSeconds: 0.4,
      cues: catalog.map((cue) => ({ id: cue.id, seconds: cue.seconds, chunks: cue.chunks.length })),
      assets: assets.length,
      bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
      files: evidence,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    complete: true,
    assets: assets.length,
    bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  }),
);
