import type { AudioSequence, SoundRequest } from '@supadub/audioengine';
const melody = [
  74, 0, 78, 81, 0, 78, 76, 0, 74, 0, 71, 0, 69, 0, 71, 0, 74, 0, 78, 81, 83, 0, 81, 0, 78, 0, 76, 0, 74, 0,
  0, 0,
];
const bass = [50, 50, 47, 47, 43, 43, 45, 45];
export const poolMusic: AudioSequence = {
  id: 'pool-music',
  interval: 60 / 108 / 2,
  create({ step }) {
    const requests: SoundRequest[] = [];
    const note = melody[step % melody.length]!;
    if (note) requests.push({ id: 'music-note', parameters: { note } });
    if (step % 4 === 0)
      requests.push({ id: 'music-bass', parameters: { note: bass[Math.floor(step / 4) % bass.length]! } });
    return requests;
  },
};
export const poolWater: AudioSequence = {
  id: 'pool-water',
  interval: 2,
  create: () => [{ id: 'ambient-water' }],
};
export const poolBubbles: AudioSequence = {
  id: 'pool-bubbles',
  interval: 1.94,
  create: () => [{ id: 'ambient-pop' }],
};
