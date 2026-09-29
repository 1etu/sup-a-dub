import * as THREE from 'three';
import { createAwardStudioTexture } from './award-studio';

type EnvironmentFilter = Pick<THREE.PMREMGenerator, 'fromEquirectangular' | 'dispose'>;
type FilterFactory = (renderer: THREE.WebGLRenderer) => EnvironmentFilter;

export type AwardEnvironment = Readonly<{
  texture: THREE.Texture;
  intensity: number;
  resources: Readonly<{
    sourceWidth: number;
    sourceHeight: number;
    sourceBytes: number;
    targetWidth: number;
    targetHeight: number;
    retainedTextures: number;
    retainedTargets: number;
  }>;
  dispose(): void;
}>;

export function createAwardEnvironment(
  renderer: THREE.WebGLRenderer,
  createFilter: FilterFactory = (context) => new THREE.PMREMGenerator(context),
): AwardEnvironment {
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousLevel = renderer.getActiveMipmapLevel();
  const previousAutoClear = renderer.autoClear;
  const previousXr = renderer.xr.enabled;
  const source = createAwardStudioTexture();
  let filter: EnvironmentFilter | undefined;
  let target: THREE.WebGLRenderTarget | undefined;
  try {
    try {
      filter = createFilter(renderer);
      target = filter.fromEquirectangular(source);
    } finally {
      try {
        filter?.dispose();
      } finally {
        source.dispose();
        renderer.autoClear = previousAutoClear;
        renderer.xr.enabled = previousXr;
        renderer.setRenderTarget(previousTarget, previousFace, previousLevel);
      }
    }
    target.texture.name = 'award-studio-environment';
    const ownedTarget = target;
    let disposed = false;
    return Object.freeze({
      texture: ownedTarget.texture,
      intensity: 1.05,
      resources: Object.freeze({
        sourceWidth: source.image.width,
        sourceHeight: source.image.height,
        sourceBytes: source.image.data.byteLength,
        targetWidth: ownedTarget.width,
        targetHeight: ownedTarget.height,
        retainedTextures: 1,
        retainedTargets: 1,
      }),
      dispose() {
        if (disposed) return;
        disposed = true;
        ownedTarget.dispose();
      },
    });
  } catch (error) {
    target?.dispose();
    throw error;
  }
}
