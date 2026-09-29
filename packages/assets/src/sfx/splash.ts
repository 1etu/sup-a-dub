import type { SoundRecipe } from '@supadub/audioengine';
import { bubble, rush } from './voices';
export const splash: SoundRecipe = {
  id: 'splash',
  cooldown: 0.1,
  priority: 2,
  create: ({ random }) => ({
    voices: [
      rush(0.29, 0.22, 2600, 420),
      ...[0, 0.05, 0.12].map((delay, index) => bubble(420 + index * 210 + random() * 80, 0.11, 0.13, delay)),
    ],
  }),
};
