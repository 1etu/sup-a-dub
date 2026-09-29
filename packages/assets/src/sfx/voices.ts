import type { AudioCurve, SoundVoice } from '@supadub/audioengine';

export const pitch = (note: number): number => 440 * 2 ** ((note - 69) / 12);
export const envelope = (duration: number, gain: number, attack = 0.006): AudioCurve => [
  { time: 0, value: 0.0001 },
  { time: Math.min(attack, duration * 0.4), value: gain, curve: 'linear' },
  { time: duration, value: 0.0001, curve: 'exponential' },
];
export function tone(
  from: number,
  to: number,
  duration: number,
  gain: number,
  wave: OscillatorType = 'sine',
  delay = 0,
): SoundVoice {
  return {
    source: {
      kind: 'oscillator',
      wave,
      frequency: [
        { time: 0, value: from },
        { time: duration, value: to, curve: 'exponential' },
      ],
    },
    duration,
    delay,
    envelope: envelope(duration, gain),
  };
}
export function bubble(frequency: number, duration = 0.12, gain = 0.22, delay = 0): SoundVoice {
  return tone(frequency * 0.62, frequency * 1.7, duration, gain, 'sine', delay);
}
export function bell(frequency: number, duration: number, gain: number, delay = 0): SoundVoice[] {
  return [
    tone(frequency, frequency * 0.999, duration, gain, 'sine', delay),
    tone(frequency * 2.005, frequency * 2, duration * 0.46, gain * 0.17, 'sine', delay),
  ];
}
export function rush(duration: number, gain: number, from: number, to: number, delay = 0): SoundVoice {
  return {
    source: { kind: 'noise', color: 'pink' },
    duration,
    delay,
    envelope: envelope(duration, gain, 0.012),
    filter: {
      type: 'bandpass',
      q: 0.65,
      frequency: [
        { time: 0, value: from },
        { time: duration, value: to, curve: 'exponential' },
      ],
    },
  };
}
export function squeak(ratio = 1, delay = 0): SoundVoice {
  return {
    source: {
      kind: 'oscillator',
      wave: 'sawtooth',
      frequency: [
        { time: 0, value: 350 * ratio },
        { time: 0.03, value: 630 * ratio, curve: 'exponential' },
        { time: 0.19, value: 260 * ratio, curve: 'exponential' },
      ],
    },
    duration: 0.25,
    delay,
    envelope: [
      { time: 0, value: 0.0001 },
      { time: 0.018, value: 0.16, curve: 'linear' },
      { time: 0.07, value: 0.055, curve: 'linear' },
      { time: 0.11, value: 0.12, curve: 'linear' },
      { time: 0.24, value: 0.0001, curve: 'exponential' },
    ],
    filter: {
      type: 'bandpass',
      q: 2.8,
      frequency: [
        { time: 0, value: 1650 * ratio },
        { time: 0.21, value: 850 * ratio, curve: 'exponential' },
      ],
    },
  };
}
