# Music

Six original scores follow the pool's pace. Each has melody, harmony, bass, and rhythm stems. The client mixes those parts as the flock grows, danger approaches, or a rescue ends.

| Score           |   Tempo |         Length |
| --------------- | ------: | -------------: |
| Bubble Lobby    | 112 BPM |    120 seconds |
| Tile Trails     | 108 BPM | 106.67 seconds |
| Rubber Run      | 128 BPM |    105 seconds |
| Deep End        | 100 BPM |  115.2 seconds |
| Flock Frenzy    | 144 BPM | 106.67 seconds |
| Home With Ducks |  96 BPM |    120 seconds |

The instruments are synthesized piano, flute, pizzicato, mallets, strings, bass, and percussion. They are original sound recipes, not acoustic recordings or samples from the reference games.

## Runtime

`browser/` holds four-bar Opus and AAC chunks. Normal quality uses stereo. Low quality uses mono. A 400-millisecond tail supports transitions between chunks. The player loads the current and next phrases instead of the whole soundtrack.

`@supadub/assets/music` exports the catalog. The audio engine handles decoding, scheduling, memory limits, and disposal. The client music director decides which cue and layers to request.

## Rebuild

The written phrases and instrument recipes live in `scripts/`. The renderer writes WAV masters and score data. The encoder needs FFmpeg with Opus and AAC support.

```sh
bun packages/assets/music/scripts/render.ts
bun packages/assets/music/scripts/encode.ts
bun run assets
```

Set `FFMPEG_PATH` to your FFmpeg executable. Keep the same encoder version for byte-identical output.
