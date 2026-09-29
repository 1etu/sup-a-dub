import type { SoundRecipe } from '@supadub/audioengine';
import { pitch, rush, tone } from './voices';
export const lost: SoundRecipe = {
  id: 'lost',
  cooldown: 0.25,
  priority: 6,
  create: () => ({
    voices: [
      ...[66, 62, 59].map((note, index) =>
        tone(pitch(note), pitch(note - 2), 0.18, 0.18, 'triangle', index * 0.1),
      ),
      rush(0.35, 0.09, 1400, 380),
    ],
  }),
};
