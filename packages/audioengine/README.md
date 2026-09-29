# Audio engine

Create an engine with an injected sound catalog. The application owns that catalog. This package has no game assets.

```ts
import { AudioEngine } from '@supadub/audioengine';
import { GAME_AUDIO } from '@supadub/assets/sfx';

const audio = new AudioEngine(GAME_AUDIO);
audio.prepare();
audio.startAmbience();

button.addEventListener('click', () => {
  void audio.unlock();
  showNextScreen();
});
```

## Gesture activation

Call `unlock()` directly from a user gesture. Do not await audio activation before navigation, form submission, or game input. A pending `resume()` must not block those actions. `play()` returns false when the device cannot accept a sound.

Optional `prepare()` creates the context and mixer during startup. It does not resume the context or start sources. Without `prepare()`, context creation waits for `unlock()`. The legacy `AudioEngine` name exports the same controller as `AudioController`.

For a suspended context, `BrowserAudioAdapter` starts a silent buffer during the gesture before it awaits `resume()`. The buffer has one channel and one zero-valued sample. One active source and one activation promise form the limit. Repeated activation calls share that promise. This temporary source is separate from the sound voice pool. The adapter stops and disconnects it after activation, when it ends, or during disposal.

The application keeps only the latest pending navigation cue. It plays that cue only within 150 milliseconds. Audio activation does not replay earlier input. This queue belongs to the application, not the audio engine. The engine keeps its normal mute, cooldown, and voice limits.

## Parts

| Part           | Role                                                         |
| -------------- | ------------------------------------------------------------ |
| Adapter        | Owns context creation, resume, suspend, and close            |
| Registry       | Stores recipes and sequences with unique IDs                 |
| Mixer          | Routes named buses through the master gain and compressor    |
| Scheduler      | Uses the audio clock and a bounded lookahead                 |
| Voice pool     | Admits whole plans and releases completed voices             |
| Voice renderer | Creates oscillator, noise, filter, gain, and pan nodes       |
| Controller     | Applies settings, cooldowns, recipe parameters, and lifetime |

`ContextAudioAdapter` wraps an external BaseAudioContext. It does not close that context. This supports OfflineAudioContext checks and external ownership. Its `running` state permits offline scheduling before rendering starts.

Recipes return declarative voices. Each voice defines its source, duration, envelope, optional filter, and pan. Each oscillator defines a frequency curve. The controller checks plans before it creates nodes. It rejects invalid values, unsupported sources, and values outside the bounds.

## Bounds

| Resource                  |                           Limit |
| ------------------------- | ------------------------------: |
| Registered sounds         |                             128 |
| Registered sequences      |                              32 |
| Active sequences          |                              16 |
| Voices per plan           |                              16 |
| Default active voices     |                              42 |
| Maximum configured voices |                             128 |
| Curve points              |                              24 |
| Voice duration            |                      12 seconds |
| Voice delay               |                       4 seconds |
| Events per scheduler tick |                              32 |
| Lookahead                 |                160 milliseconds |
| Cached noise buffers      | Three buffers, two seconds each |

The pool can stop lower-priority voices when a higher-priority plan needs space. A failed plan never keeps a partial node graph. The scheduler skips a hidden tab's elapsed steps. It does not replay an unlimited backlog.

## Lifetime and settings

The controller exposes master mute, master volume, music mute, and named bus settings. Gain changes use short ramps. Muting a bus also stops its active voices. `stopSequence()` stops both its timer entries and its voices. `dispose()` releases timers, voices, nodes, buffers, and an owned context. Repeated disposal is safe.

A recipe or device error reaches `onError`. A failing error hook cannot interrupt cleanup. Read `diagnostics` to inspect active voices, rejected plans, scheduler state, and buffer counts.

## Stem music

Create a music controller with an injected catalog. This package does not import game compositions.

```ts
import { GAME_MUSIC } from '@supadub/assets/music';

const music = audio.createMusic({ catalog: GAME_MUSIC, quality: 'normal' });
audio.setBusGain('music', 0.45);
music.setCue('bubble-lobby');
music.setIntensity(0.3);
```

`setCue()` queues a cue without awaiting its files. It returns false for an unknown ID. Cue changes occur at four-bar boundaries. `setLayers()` accepts gains for melody, harmony, bass, and rhythm. Gains change at bar boundaries. `setIntensity()` supplies a simple mapping for those four gains. The application owns threat, progress, and movement logic.

Call the existing `audio.unlock()` from a gesture. It also starts queued music when the context runs. Do not await music before navigation. Global mute, music mute, suspension, and disposal reach the music controller. `setEnabled()` adds a separate music preference. Reenabling music does not override an explicit suspension.

Stop any earlier music sequence when the stem controller replaces it. Water and other ambience can remain active. `createMusic()` disposes the previous music controller, so one audio controller owns at most one transport.

The transport schedules starts against the audio clock with a 120-millisecond lookahead. It computes each boundary from the absolute origin. It does not accumulate rounded durations. Four stems share each start time. Adjacent chunks overlap for 260 milliseconds. Catalog assets need at least that much tail. A missing next chunk repeats the retained phrase while a bounded retry waits.

The sample bank checks sizes and optional SHA-256 hashes before decoding. It tries AAC when Opus fails. Network requests time out after ten seconds. Decoding uses a separate 32 kHz offline context, so the device sample rate does not increase retained memory.

| Music resource         |                                              Limit |
| ---------------------- | -------------------------------------------------: |
| Active music sources   | 10 hard limit, eight during the measured crossfade |
| Concurrent asset loads |                                               Four |
| Encoded asset size     |                                              2 MiB |
| Decoded memory, normal |                                             48 MiB |
| Decoded memory, low    |                                             24 MiB |
| Transport timer        |                         One, every 25 milliseconds |
| Catalog cues           |                                                 16 |
| Chunks per cue         |                                                 24 |

Current assets use stereo normal chunks and mono low chunks. The memory budget includes reservations for pending decodes. Leases protect active samples from eviction. Muting and suspension stop sources, cancel loads, and release unused buffers. Resume starts the requested cue again. Disposal releases the bank and timer.

Read `audio.diagnostics.music` for the current cue, requested cue, source counts, late chunks, loading state, and bank usage. Error callbacks cannot interrupt cleanup. The [music asset package](../assets/music/README.md) contains the compositions and render scripts.
