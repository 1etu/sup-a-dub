import type { SoundRecipe } from '@supadub/audioengine';
import { bell, bubble, pitch } from './voices';
const notes = [74, 78, 81, 83, 86, 90];
export const collect: SoundRecipe = {
  id: 'collect',
  cooldown: 0.045,
  priority: 3,
  create({ occurrence, elapsed, parameters }) {
    const step = Math.max(0, Math.floor(parameters.chain ?? (elapsed > 1.4 ? 0 : occurrence)));
    const frequency = pitch(notes[step % notes.length]!);
    return { voices: [bubble(frequency * 0.78), ...bell(frequency, 0.26, 0.09, 0.035)] };
  },
};
