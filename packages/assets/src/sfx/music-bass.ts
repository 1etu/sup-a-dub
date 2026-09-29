import type { SoundRecipe } from '@supadub/audioengine';
import { pitch, tone } from './voices';
export const musicBass: SoundRecipe = {
  id: 'music-bass',
  bus: 'music',
  cooldown: 0,
  priority: 0,
  create: ({ parameters }) => {
    const frequency = pitch(Math.max(24, Math.min(72, parameters.note ?? 50)));
    return { voices: [tone(frequency, frequency, 0.58, 0.15)] };
  },
};
