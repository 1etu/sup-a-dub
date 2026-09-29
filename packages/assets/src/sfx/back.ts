import type { SoundRecipe } from '@supadub/audioengine';
import { tone } from './voices';
export const back: SoundRecipe = {
  id: 'back',
  cooldown: 0.06,
  priority: 4,
  create: () => ({ voices: [tone(580, 230, 0.15, 0.19)] }),
};
