import type { AudioCatalog } from '@supadub/audioengine';
import { select } from './select';
import { confirm } from './confirm';
import { back } from './back';
import { collect } from './collect';
import { boost } from './boost';
import { quack } from './quack';
import { steal } from './steal';
import { lost } from './lost';
import { splash } from './splash';
import { bubble } from './bubble';
import { rescue } from './rescue';
import { sharkFeed } from './shark-feed';
import { sharkLaunch } from './shark-launch';
import { sharkBite } from './shark-bite';
import { split } from './split';
import { eject } from './eject';
import { achievement } from './achievement';
import { ambientWater } from './ambient-water';
import { ambientPop } from './ambient-pop';
import { musicNote } from './music-note';
import { musicBass } from './music-bass';
import { poolMusic, poolWater, poolBubbles } from './sequences';
export const GAME_SOUNDS = Object.freeze([
  select,
  confirm,
  back,
  collect,
  boost,
  quack,
  steal,
  lost,
  splash,
  bubble,
  rescue,
  sharkFeed,
  sharkLaunch,
  sharkBite,
  split,
  eject,
  achievement,
  ambientWater,
  ambientPop,
  musicNote,
  musicBass,
]);
export const GAME_SEQUENCES = Object.freeze([poolMusic, poolWater, poolBubbles]);
export const GAME_AUDIO: AudioCatalog = Object.freeze({
  sounds: GAME_SOUNDS,
  sequences: GAME_SEQUENCES,
  ambience: ['pool-music', 'pool-water', 'pool-bubbles'],
});
export type GameSoundName =
  | 'select'
  | 'confirm'
  | 'back'
  | 'collect'
  | 'boost'
  | 'quack'
  | 'steal'
  | 'lost'
  | 'splash'
  | 'bubble'
  | 'rescue'
  | 'shark-feed'
  | 'shark-launch'
  | 'shark-bite'
  | 'split'
  | 'eject'
  | 'achievement';
