import type { BufferGeometry, Group, Material, Matrix4, Vector3 } from 'three';
import type { AvatarFamily } from '@supadub/cosmetics';
import type { DuckDetail } from '../duck';

export type AvatarLoadout = Readonly<{ head?: string | null; face?: string | null; neck?: string | null }>;
export type AvatarOptions = Readonly<{ skin?: string; detail?: DuckDetail; loadout?: AvatarLoadout }>;
export type AttachmentSlot = 'head' | 'face' | 'neck';
export type AvatarAnchor = Readonly<{ position: Vector3; scale: Vector3; rotationY?: number }>;
export type AvatarAnchors = Readonly<Record<AttachmentSlot, AvatarAnchor>>;
export type AvatarPart = Readonly<{ geometry: BufferGeometry; material: Material; transform?: Matrix4 }>;
export type AvatarModel = Readonly<{
  parts: readonly AvatarPart[];
  anchors: AvatarAnchors;
  family: AvatarFamily;
}>;

export interface AvatarInstances {
  group: Group;
  set(index: number, x: number, z: number, angle: number, scale?: number, y?: number): void;
  commit(count: number): void;
  update(time: number, reducedMotion?: boolean): void;
  dispose(): void;
}
