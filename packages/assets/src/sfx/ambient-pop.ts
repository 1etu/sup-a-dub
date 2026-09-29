import type { SoundRecipe } from '@supadub/audioengine';
import { bubble } from './voices';
export const ambientPop: SoundRecipe = {
  id: 'ambient-pop',
  bus: 'ambience',
  cooldown: 0.1,
  priority: 0,
  create: ({ random }) => ({
    voices: [{ ...bubble(480 + random() * 500, 0.14, 0.12), pan: random() * 1.2 - 0.6 }],
  }),
};
