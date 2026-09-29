import type { SoundRecipe } from '@supadub/audioengine';
import { bell, bubble, pitch } from './voices';
export const confirm: SoundRecipe = {
  id: 'confirm',
  cooldown: 0.1,
  priority: 6,
  create: () => ({
    voices: [
      ...[74, 78, 81].flatMap((note, index) => bell(pitch(note), 0.42, 0.24, index * 0.075)),
      bubble(500, 0.09, 0.16),
    ],
  }),
};
