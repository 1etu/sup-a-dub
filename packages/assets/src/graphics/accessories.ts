import * as THREE from 'three';
import { FACE_ITEMS, HEAD_ITEMS, NECK_ITEMS } from '@supadub/cosmetics';
import type { DuckDetail } from './duck';
import { ToyGeometry, type Point } from './avatar/geometry';
import type { AttachmentSlot, AvatarPart } from './avatar/types';

const geometries = new Map<string, THREE.BufferGeometry>();
const materials = new Map<string, THREE.MeshPhysicalMaterial>();
const slots = { head: HEAD_ITEMS, face: FACE_ITEMS, neck: NECK_ITEMS };

function star(radius: number, inner = radius * 0.46, points = 5): [number, number][] {
  return Array.from({ length: points * 2 }, (_, index) => {
    const angle = (index / points) * Math.PI + Math.PI * 0.5;
    const length = index % 2 ? inner : radius;
    return [Math.cos(angle) * length, Math.sin(angle) * length];
  });
}

function flower(builder: ToyGeometry, center: Point, size: number, color: string): void {
  for (let petal = 0; petal < 6; petal++) {
    const angle = (petal / 6) * Math.PI * 2;
    builder.blob(
      [center[0] + Math.cos(angle) * size * 0.65, center[1] + Math.sin(angle) * size * 0.65, center[2]],
      [size * 0.46, size * 0.32, size * 0.19],
      color,
      [0, 0, angle],
    );
  }
  builder.blob(
    [center[0], center[1], center[2] + size * 0.15],
    [size * 0.35, size * 0.35, size * 0.24],
    '#ffd54b',
  );
}

function headwear(id: string, b: ToyGeometry): void {
  if (id === 'head-sail-cap') {
    b.ring([0, 0.035, 0], 0.31, 0.055, '#f5f5e9', [Math.PI / 2, 0, 0], [1, 1, 0.82]);
    b.shape(
      [
        [-0.31, 0],
        [0, 0.26],
        [0.31, 0],
        [0.18, -0.07],
        [-0.18, -0.07],
      ],
      0.27,
      '#ffffff',
      [0, 0.13, 0],
    );
    b.tube(
      [
        [-0.27, 0.07, 0.14],
        [0, 0.045, 0.19],
        [0.27, 0.07, 0.14],
      ],
      0.02,
      '#285487',
    );
    b.shape(star(0.065), 0.012, '#e4b843', [0, 0.13, 0.158]);
  } else if (id === 'head-bucket') {
    const geometry = new THREE.CylinderGeometry(0.25, 0.34, 0.29, b.radial, 2, false);
    geometry.translate(0, 0.15, 0);
    b.add(geometry, '#50c7c1');
    b.ring([0, 0.01, 0], 0.34, 0.055, '#b7ece0', [Math.PI / 2, 0, 0], [1, 1, 0.85]);
    b.tube(
      [
        [-0.23, 0.15, 0.24],
        [0, 0.11, 0.28],
        [0.23, 0.15, 0.24],
      ],
      0.018,
      '#ffffff',
    );
  } else if (id === 'head-crown') {
    b.ring([0, 0.08, 0], 0.29, 0.045, '#f0bb42', [Math.PI / 2, 0, 0]);
    for (let tip = 0; tip < 5; tip++) {
      const angle = (tip / 5) * Math.PI * 2;
      const x = Math.sin(angle) * 0.29,
        z = Math.cos(angle) * 0.29;
      b.shape(
        [
          [-0.15, 0],
          [0, 0.26],
          [0.15, 0],
        ],
        0.045,
        '#ffd76b',
        [x, 0.105, z],
        [0, angle, 0],
      );
      b.blob([x, 0.37, z], [0.047, 0.047, 0.047], tip % 2 ? '#f07dac' : '#7ce0e1');
    }
  } else if (id === 'head-flower') {
    b.ring([0, 0.02, 0], 0.28, 0.025, '#80ba73', [Math.PI / 2, 0, 0]);
    flower(b, [-0.2, 0.17, 0.17], 0.22, '#fff5e4');
    b.fin(
      [
        [0.08, 0.015, 0.2],
        [0.18, 0.12, 0.15],
        [0.33, 0.17, 0.08],
      ],
      0.085,
      0.023,
      '#77b578',
      [0, 0, 1],
    );
  } else if (id === 'head-propeller') {
    b.blob([0, 0.03, 0], [0.32, 0.21, 0.29], '#f26066');
    b.ring([0, 0.01, 0], 0.3, 0.025, '#fff0bb', [Math.PI / 2, 0, 0], [1, 1, 0.92]);
    b.tube(
      [
        [0, 0.15, 0],
        [0, 0.33, 0],
      ],
      0.02,
      '#f9ce4e',
    );
    b.blob([0, 0.34, 0], [0.46, 0.022, 0.075], '#85d9ec', [0, 0.35, 0]);
    b.blob([0, 0.375, 0], [0.055, 0.045, 0.055], '#ffd95b');
  } else if (id === 'head-diver') {
    b.blob([0, 0.17, 0], [0.32, 0.28, 0.31], '#d4a357');
    b.ring([0, 0.2, 0.287], 0.125, 0.032, '#ffe4a1');
    b.blob([0, 0.2, 0.291], [0.102, 0.102, 0.012], '#5ab8c9');
    b.ring([0, 0.01, 0], 0.31, 0.04, '#9c713c', [Math.PI / 2, 0, 0]);
    b.tube(
      [
        [-0.11, 0.2, 0.308],
        [0.11, 0.2, 0.308],
      ],
      0.012,
      '#efcc83',
    );
    b.tube(
      [
        [0, 0.1, 0.308],
        [0, 0.3, 0.308],
      ],
      0.012,
      '#efcc83',
    );
    for (const side of [-1, 1]) b.blob([side * 0.315, 0.17, 0], [0.045, 0.075, 0.075], '#efcf89');
  } else if (id === 'head-captain') {
    b.blob([0, 0.11, 0], [0.33, 0.15, 0.31], '#fff9e6');
    b.ring([0, 0.035, 0], 0.3, 0.035, '#18385d', [Math.PI / 2, 0, 0], [1, 1, 0.9]);
    b.blob([0, 0.025, 0.26], [0.29, 0.035, 0.22], '#234367');
    b.shape(star(0.068), 0.014, '#eeca53', [0, 0.12, 0.293]);
  } else if (id === 'head-party') {
    const cone = new THREE.ConeGeometry(0.26, 0.55, b.radial, 1, false);
    cone.translate(0, 0.275, 0);
    b.add(cone, '#ac8bdd');
    for (let index = 0; index < 3; index++)
      b.ring([0, 0.075 + index * 0.12, 0], 0.224 - index * 0.056, 0.018, index % 2 ? '#fff0a5' : '#f69fbf', [
        Math.PI / 2,
        0,
        0,
      ]);
    b.blob([0, 0.57, 0], [0.075, 0.075, 0.075], '#ffe88e');
  }
}

function facewear(id: string, b: ToyGeometry): void {
  if (id === 'face-sleep-mask') {
    b.blob([0, 0, 0.025], [0.43, 0.16, 0.04], '#9176c6');
    for (const side of [-1, 1])
      b.tube(
        [
          [side * 0.1, -0.015, 0.06],
          [side * 0.2, -0.035, 0.069],
          [side * 0.28, 0.005, 0.06],
        ],
        0.014,
        '#f2ddff',
      );
    b.shape(star(0.045), 0.009, '#ffe78f', [0.29, 0.077, 0.068]);
    return;
  }
  const mono = id === 'face-monocle';
  const sunglasses = id === 'face-sunglasses';
  const goggles = id === 'face-goggles';
  const color = mono
    ? '#e0b94e'
    : id === 'face-star-glasses'
      ? '#ed8fbb'
      : sunglasses
        ? '#203b5c'
        : goggles
          ? '#f5eee0'
          : '#4870a7';
  for (const side of mono ? [1] : [-1, 1]) {
    const x = side * 0.205;
    if (id === 'face-star-glasses') {
      b.shape(star(0.205), 0.033, color, [x, 0, 0]);
      b.shape(star(0.133), 0.036, '#7297bc', [x, 0, 0.028]);
    } else {
      b.ring([x, 0, 0.018], goggles ? 0.177 : 0.15, goggles ? 0.038 : 0.022, color, [0, 0, 0], [1, 0.88, 1]);
      if (sunglasses) b.blob([x, 0, 0.022], [0.133, 0.114, 0.012], '#172b46');
    }
    b.tube(
      [
        [x - 0.055, 0.047, 0.052],
        [x + 0.032, 0.077, 0.052],
      ],
      0.01,
      '#d6f5f7',
    );
    if (!mono)
      b.tube(
        [
          [side * 0.35, 0.025, 0.005],
          [side * 0.4, 0.035, -0.12],
          [side * 0.4, 0.01, -0.27],
        ],
        0.018,
        color,
      );
  }
  if (mono)
    b.tube(
      [
        [0.35, -0.02, 0],
        [0.42, -0.18, -0.015],
        [0.34, -0.36, -0.06],
      ],
      0.011,
      '#d2b052',
    );
  else
    b.tube(
      [
        [-0.06, 0.025, 0.025],
        [0, 0.054, 0.031],
        [0.06, 0.025, 0.025],
      ],
      0.019,
      color,
    );
}

function neckwear(id: string, b: ToyGeometry): void {
  if (id === 'neck-life-ring') {
    b.ring([0, 0, 0], 0.47, 0.095, '#ffefd7', [Math.PI / 2, 0, 0], [1, 1, 0.85]);
    for (let band = 0; band < 4; band++) {
      const a = (band / 4) * Math.PI * 2;
      b.blob([Math.sin(a) * 0.47, 0, Math.cos(a) * 0.4], [0.1, 0.1, 0.12], '#e96557', [0, a, 0]);
    }
  } else if (id === 'neck-bowtie') {
    b.ring([0, 0, 0], 0.32, 0.025, '#78cfc6', [Math.PI / 2, 0, 0], [1, 1, 0.9]);
    for (const side of [-1, 1])
      b.shape(
        [
          [0, 0],
          [side * 0.22, 0.12],
          [side * 0.23, -0.12],
        ],
        0.055,
        '#8bddd0',
        [side * 0.025, -0.035, 0.31],
      );
    b.blob([0, -0.035, 0.34], [0.075, 0.07, 0.065], '#4caeac');
  } else if (id === 'neck-scarf') {
    b.ring([0, 0, 0], 0.32, 0.06, '#e78a54', [Math.PI / 2, 0, 0], [1, 1, 0.9]);
    b.shape(
      [
        [-0.16, 0],
        [0.12, 0],
        [0.13, -0.31],
        [-0.02, -0.38],
        [-0.1, -0.24],
      ],
      0.045,
      '#f5a561',
      [0.08, -0.03, 0.32],
    );
    b.tube(
      [
        [-0.01, -0.21, 0.353],
        [0.2, -0.18, 0.353],
      ],
      0.018,
      '#ffe5a6',
    );
    b.tube(
      [
        [0.005, -0.29, 0.353],
        [0.205, -0.25, 0.353],
      ],
      0.015,
      '#ffe5a6',
    );
  } else if (id === 'neck-medallion') {
    b.ring([0, 0, 0], 0.33, 0.022, '#dfb34a', [Math.PI / 2, 0, 0], [1, 1, 0.9]);
    b.blob([0, -0.12, 0.33], [0.115, 0.135, 0.03], '#f5cb5c');
    b.shape(star(0.075), 0.012, '#fff0a3', [0, -0.105, 0.365]);
  } else if (id === 'neck-flower-lei') {
    for (let index = 0; index < 10; index++) {
      const a = (index / 10) * Math.PI * 2;
      const center: Point = [Math.sin(a) * 0.35, -0.04 - Math.cos(a) * 0.04, Math.cos(a) * 0.3];
      flower(b, center, 0.09, index % 2 ? '#f8cbe4' : '#fff0ab');
    }
  } else {
    b.ring([0, 0, 0], 0.32, 0.045, '#dc6671', [Math.PI / 2, 0, 0], [1, 1, 0.9]);
    b.shape(
      [
        [-0.24, 0],
        [0.24, 0],
        [0, -0.34],
      ],
      0.026,
      '#e87580',
      [0, -0.025, 0.295],
    );
    b.shape(
      [
        [-0.15, -0.025],
        [0.15, -0.025],
        [0, -0.23],
      ],
      0.008,
      '#fff0c4',
      [0, -0.025, 0.315],
    );
    b.blob([0, 0, 0.33], [0.065, 0.06, 0.035], '#cf4f61');
  }
}

export function accessoryPart(
  id: string | undefined | null,
  slot: AttachmentSlot,
  detail: DuckDetail,
  curvedFace = false,
): AvatarPart | undefined {
  if (!id || !(slots[slot] as readonly string[]).includes(id)) return;
  const wrap = slot === 'face' && curvedFace;
  const key = `${id}:${detail}:${wrap}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    const builder = new ToyGeometry(detail);
    if (slot === 'head') headwear(id, builder);
    else if (slot === 'face') facewear(id, builder);
    else neckwear(id, builder);
    geometry = builder.finish();
    if (wrap) {
      const positions = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      const normal = new THREE.Vector3();
      for (let index = 0; index < positions.count; index++) {
        const x = positions.getX(index);
        const curve = Math.exp(-Math.pow(x / 0.28, 2));
        positions.setZ(index, positions.getZ(index) + 0.04 + 0.2 * curve);
        normal.fromBufferAttribute(normals, index);
        normal.x += ((0.4 * x) / (0.28 * 0.28)) * curve * normal.z;
        normal.normalize();
        normals.setXYZ(index, normal.x, normal.y, normal.z);
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
    geometries.set(key, geometry);
  }
  const metal = ['head-crown', 'head-diver', 'face-monocle', 'neck-medallion'].includes(id);
  const materialKey = metal ? 'metal' : 'plastic';
  let material = materials.get(materialKey);
  if (!material) {
    material = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: metal ? 0.25 : 0.26,
      metalness: metal ? 0.72 : 0.02,
      clearcoat: 0.48,
      clearcoatRoughness: 0.17,
      envMapIntensity: 0.8,
    });
    material.name = `toy-accessory-${materialKey}`;
    materials.set(materialKey, material);
  }
  return { geometry, material };
}

export function accessoryResourceCount(): Readonly<{ geometries: number; materials: number }> {
  return { geometries: geometries.size, materials: materials.size };
}

export function disposeAccessoryResources(): void {
  for (const geometry of geometries.values()) geometry.dispose();
  for (const material of materials.values()) material.dispose();
  geometries.clear();
  materials.clear();
}
