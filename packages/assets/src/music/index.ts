import { validMusicCatalog } from '@supadub/audioengine';
import type { MusicCatalog } from '@supadub/audioengine';
import catalog from './catalog.json';
const authored: unknown = catalog;
if (!validMusicCatalog(authored)) throw new Error('The authored music catalog is invalid.');
export const GAME_MUSIC: MusicCatalog = authored;
export type GameMusicCue =
  'bubble-lobby' | 'tile-trails' | 'rubber-run' | 'deep-end' | 'flock-frenzy' | 'home-with-ducks';
