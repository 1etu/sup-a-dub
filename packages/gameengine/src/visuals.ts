import type * as THREE from 'three';
import type { GraphicsCatalog } from '@supadub/graphics';
import type { ObstacleState, Vec2 } from '@supadub/protocol';

export type PoolTheme = 'blue' | 'hearts' | 'stars' | 'dots';
export type DuckDetail = 'high' | 'medium' | 'low';
export type DuckOptions = { skin?: string; baby?: boolean; detail?: DuckDetail };
export type AvatarLoadout = { head?: string | null; face?: string | null; neck?: string | null };
export type AvatarOptions = { skin?: string; detail?: DuckDetail; loadout?: AvatarLoadout };
export type AvatarInstances = DuckInstances & { update(time: number, reducedMotion?: boolean): void };
export type CosmeticEffects = {
  group: THREE.Group;
  wake(id: string, x: number, z: number, angle: number, scale?: number): void;
  emote(id: string, x: number, y: number, z: number, scale?: number): void;
  celebrate(id: string, x: number, y: number, z: number, scale?: number): void;
  update(time: number, reducedMotion?: boolean): void;
  dispose(): void;
  readonly resources: Readonly<Record<string, number>>;
};
export type DuckInstances = {
  group: THREE.Group;
  set(index: number, x: number, z: number, angle: number, scale?: number, y?: number): void;
  commit(count: number): void;
  dispose(): void;
};
export type BubbleInstances = {
  group: THREE.Group;
  set(index: number, x: number, y: number, z: number, radius?: number): void;
  commit(count: number, camera?: THREE.Camera): void;
  dispose(): void;
};
export type BubblePops = {
  group: THREE.Group;
  pop(x: number, y: number, z: number, radius?: number, seed?: number): void;
  update(time: number, reducedMotion?: boolean): void;
  clear(): void;
  dispose(): void;
  readonly resources: Readonly<Record<string, number>>;
};
export type SharkPose = {
  time?: number;
  jaw?: number;
  tail?: number;
  key?: number;
  charge?: number;
  launched?: boolean;
  y?: number;
};
export type SharkInstances = {
  group: THREE.Group;
  set(index: number, x: number, z: number, angle: number, scale?: number, pose?: SharkPose): void;
  commit(count: number): void;
  dispose(): void;
};
export type PoolVisual = {
  group: THREE.Group;
  setFinite(finite: boolean): void;
  setTheme(theme: PoolTheme): void;
  setSky(texture: THREE.Texture): void;
  update(time: number, center: Vec2, reducedMotion?: boolean): void;
  capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  prepare?(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    target: THREE.WebGLRenderTarget,
  ): void;
  ripple(x: number, z: number, strength?: number): void;
  setObstacles(states: ObstacleState[]): void;
  dispose(): void;
};
export type BackdropVisual = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  update(time: number, menu: boolean, aspect: number, reducedMotion: boolean): void;
  dispose(): void;
};
export type PictureVisual = {
  target: THREE.WebGLRenderTarget;
  beginTransition?(renderer: THREE.WebGLRenderer): void;
  setTransition?(progress: number): void;
  endTransition?(): void;
  resize(width: number, height: number): void;
  render(renderer: THREE.WebGLRenderer, soft: boolean): void;
  dispose(): void;
};
export type SurfaceVisual = {
  mesh: THREE.InstancedMesh;
  set(index: number, x: number, z: number, radius: number): void;
  commit(count: number, time: number): void;
  dispose(): void;
};
export type FoamVisual = {
  points: THREE.Points;
  spawn(x: number, z: number, angle: number, strength: number): void;
  update(dt: number, height: number): void;
  dispose(): void;
};
export type SkyVisual = { sky: THREE.Texture; environment: THREE.WebGLRenderTarget };
export type AwardVisual = {
  object: THREE.Group;
  update(time: number, reducedMotion: boolean): void;
  dispose(): void;
};
export type EnvironmentVisual = {
  texture: THREE.Texture;
  intensity: number;
  dispose(): void;
};
export type MenuTiming = {
  selectionMs: number;
  growStartMs: number;
  growPeakMs: number;
  rowsGoneMs: number;
  confirmMs: number;
  titleSettleMs: number;
  titleExitMs: number;
  entryPeakMs: number;
  entryBaseMs: number;
  entryArrowsMs: number;
  entrySelectedMs: number;
  entryStartScale: number;
  entryPeakScale: number;
  confirmPeakScale: number;
  selectedScale: number;
};

export type GameVisualFactories = {
  'menu-material': (
    background: THREE.Texture,
    blank: THREE.Texture,
    scrollOffset: THREE.Vector2,
  ) => THREE.ShaderMaterial;
  'menu-timing': () => MenuTiming;
  'award-environment': (renderer: THREE.WebGLRenderer) => EnvironmentVisual;
  award: (grade: 'gold' | 'silver' | 'bronze') => AwardVisual;
  duck: (options?: DuckOptions) => THREE.Group;
  avatar: (options?: AvatarOptions) => THREE.Group;
  avatars: (capacity: number, skin?: string, detail?: DuckDetail, loadout?: AvatarLoadout) => AvatarInstances;
  'cosmetic-effects': (capacity?: number) => CosmeticEffects;
  ducks: (capacity: number, skin?: string, detail?: DuckDetail, baby?: boolean) => DuckInstances;
  bubbles: (capacity: number) => BubbleInstances;
  'bubble-pop': (capacity?: number) => BubblePops;
  sharks: (capacity: number) => SharkInstances;
  exit: () => THREE.Group;
  pool: () => PoolVisual;
  backdrop: () => BackdropVisual;
  picture: () => PictureVisual;
  surface: (capacity: number) => SurfaceVisual;
  foam: () => FoamVisual;
  sky: (renderer: THREE.WebGLRenderer) => SkyVisual;
  animation: () => {
    readonly captive: Readonly<{ radius: number; centerHeight: number; duckScale: number }>;
    update(time: number): void;
    captiveHeight(radius?: number, scale?: number): number;
  };
};
export type GameVisuals = GraphicsCatalog<GameVisualFactories>;
