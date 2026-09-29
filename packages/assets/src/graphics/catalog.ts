import { FactoryCatalog } from '@supadub/graphics';
import { createDuck, createDuckInstances } from './duck';
import { captiveDuckHeight, createBubbleInstances, updateSpriteTime } from './bubble';
import { createSharkInstances } from './shark';
import { createExitBuoy } from './buoy';
import { Pool, Backdrop, Picture, SurfaceMarks, Foam, createSkyEnvironment } from './environment';
import { createMenuMaterial } from './environment/menu-material';
import { MENU_TIMING } from './environment/menu-timing';
import { createAwardPresentation } from './award-presentation';
import { createAwardEnvironment } from './award-environment';
import { createAvatarInstances, createAvatarPreview, updateAvatarTime } from './avatar';
import { createCosmeticEffects } from './cosmetic-effects';
import { createBubblePops } from './bubble-pop';

const factories = {
  duck: createDuck,
  ducks: createDuckInstances,
  avatar: createAvatarPreview,
  avatars: createAvatarInstances,
  'cosmetic-effects': createCosmeticEffects,
  'bubble-pop': createBubblePops,
  bubbles: createBubbleInstances,
  sharks: createSharkInstances,
  exit: createExitBuoy,
  pool: () => new Pool(),
  backdrop: () => new Backdrop(),
  picture: () => new Picture(),
  surface: (capacity: number) => new SurfaceMarks(capacity),
  foam: () => new Foam(),
  sky: createSkyEnvironment,
  animation: () => ({
    captive: Object.freeze({ radius: 1.2, centerHeight: 1.1, duckScale: 0.46 }),
    update: (time: number) => {
      updateSpriteTime(time);
      updateAvatarTime(time);
    },
    captiveHeight: captiveDuckHeight,
  }),
  'menu-material': createMenuMaterial,
  'menu-timing': () => MENU_TIMING,
  award: createAwardPresentation,
  'award-environment': createAwardEnvironment,
};

export type GameAssetFactories = typeof factories;

export function createGameGraphics(): FactoryCatalog<GameAssetFactories> {
  return new FactoryCatalog<GameAssetFactories>(24)
    .register('duck', factories.duck)
    .register('ducks', factories.ducks)
    .register('avatar', factories.avatar)
    .register('avatars', factories.avatars)
    .register('cosmetic-effects', factories['cosmetic-effects'])
    .register('bubble-pop', factories['bubble-pop'])
    .register('bubbles', factories.bubbles)
    .register('sharks', factories.sharks)
    .register('exit', factories.exit)
    .register('pool', factories.pool)
    .register('backdrop', factories.backdrop)
    .register('picture', factories.picture)
    .register('surface', factories.surface)
    .register('foam', factories.foam)
    .register('sky', factories.sky)
    .register('animation', factories.animation)
    .register('menu-material', factories['menu-material'])
    .register('menu-timing', factories['menu-timing'])
    .register('award', factories.award)
    .register('award-environment', factories['award-environment']);
}
