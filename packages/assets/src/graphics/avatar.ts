import * as THREE from 'three';
import { cosmetic } from '@supadub/cosmetics';
import { createDuck, type DuckDetail } from './duck';
import { accessoryPart, accessoryResourceCount, disposeAccessoryResources } from './accessories';
import { createAnimalGeometry } from './avatar/animals';
import { createDuckDesign } from './avatar/duck-designs';
import type {
  AttachmentSlot,
  AvatarAnchors,
  AvatarInstances,
  AvatarLoadout,
  AvatarModel,
  AvatarOptions,
  AvatarPart,
} from './avatar/types';

export type { AvatarLoadout, AvatarOptions, AvatarInstances, AvatarAnchors } from './avatar/types';

const models = new Map<string, AvatarModel>();
const geometries = new Set<THREE.BufferGeometry>();
const materials = new Map<string, THREE.MeshStandardMaterial>();
const timeUniform = { value: 0 };
const slots: readonly AttachmentSlot[] = ['head', 'face', 'neck'];

function toyMaterial(detail: DuckDetail, metal = false): THREE.MeshStandardMaterial {
  const key = `${detail === 'high' ? 'polished' : 'simple'}:${metal}`;
  const cached = materials.get(key);
  if (cached) return cached;
  const parameters = {
    vertexColors: true,
    roughness: metal ? 0.24 : 0.29,
    metalness: metal ? 0.7 : 0.025,
    envMapIntensity: 0.82,
  };
  const material =
    detail === 'high'
      ? new THREE.MeshPhysicalMaterial({ ...parameters, clearcoat: 0.62, clearcoatRoughness: 0.16 })
      : new THREE.MeshStandardMaterial(parameters);
  material.name = `avatar-toy-${key}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.toyTime = timeUniform;
    shader.vertexShader = 'uniform float toyTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
float toyRear=1.0-smoothstep(-1.0,-.25,position.z);
transformed.x+=sin(toyTime*3.2+position.z*4.0)*toyRear*.025;
`,
    );
  };
  material.customProgramCacheKey = () => 'supadub-avatar-toy-1';
  materials.set(key, material);
  return material;
}

function duckAnchors(): AvatarAnchors {
  return {
    head: { position: new THREE.Vector3(0, 1.35, 0.39), scale: new THREE.Vector3(1, 1, 1) },
    face: {
      position: new THREE.Vector3(0.078, 1.26, 0.46),
      scale: new THREE.Vector3(1.22, 1, 1),
      rotationY: 0.281,
    },
    neck: { position: new THREE.Vector3(0, 0.76, 0.3), scale: new THREE.Vector3(1, 1, 1) },
  };
}

function model(skin: string, detail: DuckDetail): AvatarModel {
  const palette = cosmetic(skin);
  const key = `${palette.id}:${detail}`;
  const cached = models.get(key);
  if (cached) return cached;
  let result: AvatarModel;
  if (palette.modelFamily === 'duck') {
    const source = createDuck({ skin: palette.id, detail });
    const mesh = source.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const parts: AvatarPart[] = [{ geometry: mesh.geometry, material: mesh.material }];
    source.clear();
    const design = createDuckDesign(palette.id, detail);
    if (design) {
      geometries.add(design);
      parts.push({
        geometry: design,
        material: toyMaterial(detail, palette.id === 'tin-toy' || palette.id === 'clockwork'),
      });
    }
    result = { parts, anchors: duckAnchors(), family: 'duck' };
  } else {
    const animal = createAnimalGeometry(palette.id, detail);
    geometries.add(animal.geometry);
    const faceWidth = { shark: 1.8, axolotl: 1.2, turtle: 1.05, frog: 1.65, whale: 2.1, octopus: 0.9 }[
      palette.modelFamily
    ];
    animal.anchors.face.scale.x *= faceWidth;
    result = {
      parts: [{ geometry: animal.geometry, material: toyMaterial(detail) }],
      anchors: animal.anchors,
      family: palette.modelFamily,
    };
  }
  models.set(key, result);
  return result;
}

function detailLevel(value: DuckDetail): DuckDetail {
  return value === 'high' || value === 'low' ? value : 'medium';
}

function partsFor(
  skin: string,
  detail: DuckDetail,
  loadout?: AvatarLoadout,
): { model: AvatarModel; parts: AvatarPart[] } {
  const base = model(skin, detail);
  const parts = [...base.parts];
  for (const slot of slots) {
    const part = accessoryPart(loadout?.[slot], slot, detail, base.family === 'duck');
    if (!part) continue;
    const anchor = base.anchors[slot];
    parts.push({
      ...part,
      transform: new THREE.Matrix4().compose(
        anchor.position,
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), anchor.rotationY ?? 0),
        anchor.scale,
      ),
    });
  }
  return { model: base, parts };
}

export function createAvatarPreview({
  skin = 'yellow',
  detail = 'high',
  loadout,
}: AvatarOptions = {}): THREE.Group {
  detail = detailLevel(detail);
  const { model: base, parts } = partsFor(skin, detail, loadout);
  const group = new THREE.Group();
  group.name = `avatar-${cosmetic(skin).id}`;
  group.userData.family = base.family;
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    if (part.transform) mesh.applyMatrix4(part.transform);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const slot of slots) {
    const anchor = new THREE.Group();
    anchor.name = `avatar:${slot}`;
    anchor.position.copy(base.anchors[slot].position);
    anchor.scale.copy(base.anchors[slot].scale);
    anchor.rotation.y = base.anchors[slot].rotationY ?? 0;
    group.add(anchor);
  }
  return group;
}

export function createAvatarInstances(
  capacity: number,
  skin = 'yellow',
  detail: DuckDetail = 'medium',
  loadout?: AvatarLoadout,
): AvatarInstances {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4096)
    throw new RangeError('The avatar capacity must be an integer from 1 to 4096.');
  const { parts } = partsFor(skin, detailLevel(detail), loadout);
  const group = new THREE.Group();
  group.name = `avatar-batch-${cosmetic(skin).id}`;
  const batches = parts.map((part) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return { mesh, transform: part.transform };
  });
  const matrix = new THREE.Matrix4();
  const transformed = new THREE.Matrix4();
  const size = new THREE.Vector3();
  let disposed = false;
  return {
    group,
    set(index, x, z, angle, scale = 1, y = 0) {
      if (disposed || !Number.isInteger(index) || index < 0 || index >= capacity) return;
      if (
        ![x, z, angle, scale, y].every(Number.isFinite) ||
        Math.abs(x) > 1e7 ||
        Math.abs(z) > 1e7 ||
        Math.abs(y) > 1e6
      )
        return;
      matrix.makeRotationY(angle % (Math.PI * 2));
      matrix.scale(size.setScalar(THREE.MathUtils.clamp(scale, 0.001, 1e4)));
      matrix.setPosition(x, y, z);
      for (const { mesh, transform } of batches)
        mesh.setMatrixAt(index, transform ? transformed.multiplyMatrices(matrix, transform) : matrix);
    },
    commit(count) {
      if (disposed) return;
      const active = Number.isFinite(count) ? Math.max(0, Math.min(capacity, Math.floor(count))) : 0;
      for (const { mesh } of batches) {
        mesh.count = active;
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    update(time, reducedMotion = false) {
      if (!disposed) updateAvatarTime(time, reducedMotion);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { mesh } of batches) mesh.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}

export function updateAvatarTime(time: number, reducedMotion = false): void {
  timeUniform.value = reducedMotion || !Number.isFinite(time) ? 0 : time % 4096;
}

export function avatarResourceCounts(): Readonly<{
  models: number;
  geometries: number;
  materials: number;
  accessoryGeometries: number;
  accessoryMaterials: number;
}> {
  const accessories = accessoryResourceCount();
  return {
    models: models.size,
    geometries: geometries.size,
    materials: materials.size,
    accessoryGeometries: accessories.geometries,
    accessoryMaterials: accessories.materials,
  };
}

export function disposeAvatarResources(): void {
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials.values()) material.dispose();
  geometries.clear();
  materials.clear();
  models.clear();
  disposeAccessoryResources();
}
