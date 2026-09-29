import { disposeBubbleResources } from './bubble';
import { disposeBuoyResources } from './buoy';
import { disposeDuckResources } from './duck';
import { disposeSharkResources } from './shark';
import { disposeAvatarResources } from './avatar';

export { createDuck, createDuckInstances, loadSpriteAssets } from './duck';
export type { DuckOptions, DuckSkin, DuckInstances, DuckDetail } from './duck';
export {
  createBubble,
  createBubbleInstances,
  updateBubble,
  updateSpriteTime,
  captiveDuckHeight,
} from './bubble';
export type { BubbleInstances } from './bubble';
export { createExitBuoy } from './buoy';
export { createShark, createSharkInstances, updateShark } from './shark';
export type { SharkInstances, SharkPose } from './shark';
export { createGameGraphics } from './catalog';
export type { GameAssetFactories } from './catalog';
export { createAwardPresentation } from './award-presentation';
export type { AwardPresentation } from './award-presentation';
export type { AwardGrade } from './award-medal';
export { createAwardEnvironment } from './award-environment';
export type { AwardEnvironment } from './award-environment';
export {
  createAvatarPreview,
  createAvatarInstances,
  updateAvatarTime,
  avatarResourceCounts,
  disposeAvatarResources,
} from './avatar';
export type { AvatarOptions, AvatarLoadout, AvatarInstances, AvatarAnchors } from './avatar';
export { createCosmeticEffects } from './cosmetic-effects';
export type { CosmeticEffects } from './cosmetic-effects';
export { createBubblePops } from './bubble-pop';
export type { BubblePops } from './bubble-pop';

export function disposeSpriteResources(): void {
  disposeAvatarResources();
  disposeDuckResources();
  disposeBubbleResources();
  disposeBuoyResources();
  disposeSharkResources();
}
