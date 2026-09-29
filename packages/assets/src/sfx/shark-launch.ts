import type { SoundRecipe } from '@supadub/audioengine';
import { rush, tone } from './voices';
export const sharkLaunch: SoundRecipe = {
  id: 'shark-launch',
  cooldown: 0.2,
  priority: 7,
  create: () => ({
    voices: [
      tone(340, 1100, 0.25, 0.16, 'triangle'),
      tone(640, 165, 0.28, 0.1, 'square', 0.02),
      rush(0.35, 0.24, 600, 3200, 0.03),
    ],
  }),
};
