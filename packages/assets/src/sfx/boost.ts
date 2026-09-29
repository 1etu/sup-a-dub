import type { SoundRecipe } from '@supadub/audioengine';
import { rush, tone } from './voices';
export const boost: SoundRecipe = {
  id: 'boost',
  cooldown: 0.18,
  priority: 2,
  create: () => ({ voices: [rush(0.34, 0.18, 550, 3000), tone(190, 780, 0.24, 0.1, 'triangle')] }),
};
