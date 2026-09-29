import type { SoundRecipe } from '@supadub/audioengine';
import { bubble } from './voices';
export const select: SoundRecipe = {
  id: 'select',
  cooldown: 0.045,
  priority: 4,
  create: ({ random }) => ({ voices: [bubble(800 + random() * 90, 0.065, 0.27)] }),
};
