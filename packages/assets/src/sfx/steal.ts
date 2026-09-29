import type { SoundRecipe } from '@supadub/audioengine';
import { bell, pitch, squeak } from './voices';
export const steal: SoundRecipe = {
  id: 'steal',
  cooldown: 0.16,
  priority: 5,
  create: () => ({
    voices: [
      ...[78, 81, 86, 90].flatMap((note, index) => bell(pitch(note), 0.4, 0.19, index * 0.055)),
      squeak(1.18, 0.04),
    ],
  }),
};
