import type { SoundRecipe } from '@supadub/audioengine';
import { squeak } from './voices';
export const quack: SoundRecipe = {
  id: 'quack',
  cooldown: 0.32,
  priority: 3,
  create: ({ random }) => ({ voices: [squeak(0.96 + random() * 0.08)] }),
};
