import type { SoundRecipe } from '@supadub/audioengine';
import { rush, tone } from './voices';
export const sharkBite: SoundRecipe = {
  id: 'shark-bite',
  cooldown: 0.18,
  priority: 7,
  create: () => ({
    voices: [
      tone(930, 270, 0.07, 0.2, 'triangle'),
      tone(1400, 340, 0.08, 0.1, 'square', 0.018),
      rush(0.16, 0.15, 2400, 520),
    ],
  }),
};
