import type { SoundRecipe } from '@supadub/audioengine';
import { bell, pitch } from './voices';
export const musicNote: SoundRecipe = {
  id: 'music-note',
  bus: 'music',
  cooldown: 0,
  priority: 0,
  create: ({ parameters }) => ({
    voices: bell(pitch(Math.max(24, Math.min(100, parameters.note ?? 74))), 0.68, 0.17),
  }),
};
