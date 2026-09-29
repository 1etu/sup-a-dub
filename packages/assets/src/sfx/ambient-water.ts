import type { SoundRecipe } from '@supadub/audioengine';
export const ambientWater: SoundRecipe = {
  id: 'ambient-water',
  bus: 'ambience',
  priority: 0,
  cooldown: 1.5,
  create: ({ random }) => ({
    voices: [
      {
        source: { kind: 'noise', color: 'brown' },
        duration: 2.8,
        envelope: [
          { time: 0, value: 0.0001 },
          { time: 0.65, value: 0.22, curve: 'linear' },
          { time: 1.9, value: 0.16, curve: 'linear' },
          { time: 2.8, value: 0.0001, curve: 'linear' },
        ],
        filter: {
          type: 'bandpass',
          q: 0.38,
          frequency: [
            { time: 0, value: 540 },
            { time: 2.8, value: 540 + random() * 190, curve: 'linear' },
          ],
        },
      },
    ],
  }),
};
