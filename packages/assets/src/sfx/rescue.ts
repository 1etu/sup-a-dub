import type { SoundRecipe } from '@supadub/audioengine';
import { bell, bubble, pitch } from './voices';
export const rescue: SoundRecipe = {
  id: 'rescue',
  cooldown: 0.25,
  priority: 7,
  create: () => ({
    voices: [
      ...[74, 78, 81, 86].flatMap((note, index) => bell(pitch(note), 0.52, 0.18, index * 0.09)),
      bubble(600, 0.16, 0.2, 0.06),
    ],
  }),
};
