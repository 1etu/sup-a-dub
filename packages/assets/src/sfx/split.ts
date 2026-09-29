import type { SoundRecipe } from '@supadub/audioengine';
import { bubble, rush } from './voices';
export const split: SoundRecipe = {
  id: 'split',
  cooldown: 0.1,
  priority: 5,
  create: () => ({
    voices: [
      bubble(520, 0.12, 0.23),
      { ...bubble(860, 0.14, 0.17, 0.04), pan: -0.35 },
      { ...bubble(1140, 0.11, 0.15, 0.07), pan: 0.35 },
      rush(0.2, 0.12, 900, 2400),
    ],
  }),
};
