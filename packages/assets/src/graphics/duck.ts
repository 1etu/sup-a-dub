import {
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { duckMaterial, disposeDuckMaterials } from './materials/duck-material';

export type DuckSkin = string;
export type DuckDetail = 'high' | 'medium' | 'low';

export interface DuckOptions {
  skin?: DuckSkin;
  baby?: boolean;
  detail?: DuckDetail;
}

export interface DuckInstances {
  group: Group;
  set(index: number, x: number, z: number, angle: number, scale?: number, y?: number): void;
  commit(count: number): void;
  dispose(): void;
}

let geometry: BufferGeometry | undefined;
const detailGeometries = new Map<DuckDetail, BufferGeometry>();
let texture: Texture | undefined;
let assetPromise: Promise<void> | undefined;
let resourceGeneration = 0;

function releaseTexture(map?: Texture): void {
  if (!map) return;
  map.dispose();
  const source = map.source.data as { close?: () => void } | undefined;
  source?.close?.();
}

type DuckLods = { version: number; vertices: number; levels: Record<string, { indices: number[] }> };

function readLods(value: unknown, vertexCount: number): DuckLods | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as Partial<DuckLods>;
  if (data.version !== 1 || data.vertices !== vertexCount || !data.levels) return;
  for (const name of ['medium', 'low']) {
    const indices = data.levels[name]?.indices;
    if (
      !Array.isArray(indices) ||
      indices.length === 0 ||
      indices.length % 3 !== 0 ||
      indices.length > 12636 ||
      indices.some(
        (index: unknown) =>
          typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= vertexCount,
      )
    )
      return;
  }
  return data as DuckLods;
}

export function loadSpriteAssets(
  url = '/assets/models/duck.glb',
  lodUrl = url.replace(/[^/?]+(?:\?.*)?$/, 'duck-lods.json'),
): Promise<void> {
  if (geometry) return Promise.resolve();
  if (assetPromise) return assetPromise;
  const generation = resourceGeneration;
  assetPromise = new GLTFLoader()
    .loadAsync(url)
    .then(async (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const meshes: Mesh<BufferGeometry, MeshStandardMaterial>[] = [];
      gltf.scene.traverse((object) => {
        if (object instanceof Mesh) meshes.push(object as Mesh<BufferGeometry, MeshStandardMaterial>);
      });
      const source = meshes[0];
      if (!source || Array.isArray(source.material))
        throw new Error('The duck asset must contain a textured mesh.');
      const normalized = source.geometry.clone().applyMatrix4(source.matrixWorld);
      normalized.rotateY(-Math.PI / 2);
      normalized.computeBoundingBox();
      const bounds = normalized.boundingBox!;
      const size = bounds.getSize(new Vector3());
      const center = bounds.getCenter(new Vector3());
      if (size.y <= 0) throw new Error('The duck asset has no height.');
      normalized.translate(-center.x, -bounds.min.y, -center.z);
      const scale = 1.45 / size.y;
      normalized.scale(scale, scale, scale);
      normalized.computeBoundingBox();
      normalized.computeBoundingSphere();
      const map = source.material.map ?? undefined;
      if (map) {
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = 4;
      }
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      }
      let lods: DuckLods | undefined;
      try {
        const response = await fetch(lodUrl);
        if (response.ok) lods = readLods(await response.json(), normalized.getAttribute('position').count);
      } catch {
        lods = undefined;
      }
      if (generation !== resourceGeneration) {
        normalized.dispose();
        releaseTexture(map);
        return;
      }
      geometry = normalized;
      for (const detail of ['medium', 'low'] as const) {
        const variant = normalized.clone();
        if (lods) variant.setIndex(lods.levels[detail]!.indices);
        variant.computeBoundingBox();
        variant.computeBoundingSphere();
        detailGeometries.set(detail, variant);
      }
      texture = map;
    })
    .catch((error: unknown) => {
      if (generation === resourceGeneration) assetPromise = undefined;
      throw error;
    });
  return assetPromise;
}

function loadedGeometry(detail: DuckDetail = 'high'): BufferGeometry {
  if (!geometry) throw new Error('Call loadSpriteAssets() before creating ducks.');
  return detailGeometries.get(detail) ?? geometry;
}

export function createDuck({
  skin = 'yellow',
  baby = false,
  detail = baby ? 'medium' : 'high',
}: DuckOptions = {}): Group {
  const group = new Group();
  group.name = baby ? 'duckling' : 'rubber-duck';
  const mesh = new Mesh(loadedGeometry(detail), duckMaterial(skin, baby, texture));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.scale.setScalar(baby ? 0.46 : 1);
  return group;
}

export function createDuckInstances(
  capacity: number,
  skin: DuckSkin = 'yellow',
  detail: DuckDetail = 'medium',
  baby = true,
): DuckInstances {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
    throw new RangeError('The duck capacity must be an integer from 1 to 10000.');
  }
  const group = new Group();
  group.name = 'duckling-batch';
  const mesh = new InstancedMesh(loadedGeometry(detail), duckMaterial(skin, baby, texture), capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  const matrix = new Matrix4();
  const scaleVector = new Vector3();
  let disposed = false;
  return {
    group,
    set(index, x, z, angle, scale = 0.46, y = 0) {
      if (disposed || !Number.isInteger(index) || index < 0 || index >= capacity) return;
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(z) ||
        !Number.isFinite(angle) ||
        !Number.isFinite(scale) ||
        !Number.isFinite(y)
      )
        return;
      matrix.makeRotationY(angle);
      matrix.scale(scaleVector.setScalar(Math.max(0.001, scale)));
      matrix.setPosition(x, y, z);
      mesh.setMatrixAt(index, matrix);
    },
    commit(count) {
      if (disposed) return;
      mesh.count = Number.isFinite(count) ? Math.max(0, Math.min(capacity, Math.floor(count))) : 0;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}

export function disposeDuckResources(): void {
  resourceGeneration++;
  geometry?.dispose();
  for (const entry of detailGeometries.values()) entry.dispose();
  detailGeometries.clear();
  releaseTexture(texture);
  geometry = undefined;
  texture = undefined;
  assetPromise = undefined;
  disposeDuckMaterials();
}
