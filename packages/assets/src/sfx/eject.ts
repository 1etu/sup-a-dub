import type { SoundRecipe } from '@supadub/audioengine';
import { bubble, tone } from './voices';
export const eject: SoundRecipe = {
  id: 'eject',
  cooldown: 0.12,
  priority: 2,
  create: ({ random }) => ({
    voices: [bubble(580 + random() * 180, 0.085, 0.18), tone(240, 130, 0.075, 0.06, 'triangle')],
  }),
};
