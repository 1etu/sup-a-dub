import type { SoundRecipe } from '@supadub/audioengine';
import { bubble, tone } from './voices';
export const sharkFeed: SoundRecipe = {
  id: 'shark-feed',
  cooldown: 0.08,
  priority: 4,
  create: ({ random }) => ({
    voices: [tone(1900, 780, 0.055, 0.13, 'triangle'), bubble(220 + random() * 80, 0.13, 0.2, 0.015)],
  }),
};
