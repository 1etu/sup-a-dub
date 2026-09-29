import type { SoundRecipe } from '@supadub/audioengine';
import { bell, pitch } from './voices';
export const achievement: SoundRecipe = {
  id: 'achievement',
  cooldown: 0.8,
  priority: 8,
  create: () => ({
    voices: [74, 78, 81, 86, 90].flatMap((note, index) => bell(pitch(note), 0.85, 0.16, index * 0.12)),
  }),
};
