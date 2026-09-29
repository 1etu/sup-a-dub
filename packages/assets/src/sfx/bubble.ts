import type { SoundRecipe } from '@supadub/audioengine';
import { bubble as voice } from './voices';
export const bubble: SoundRecipe = {
  id: 'bubble',
  cooldown: 0.04,
  priority: 1,
  create: ({ random }) => ({ voices: [voice(620 + random() * 430, 0.075, 0.18)] }),
};
