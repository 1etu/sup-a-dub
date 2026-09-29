import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const AWARD_GRADES = ['gold', 'silver', 'bronze'] as const;
export type AwardGrade = (typeof AWARD_GRADES)[number];

export interface AwardMedal {
  object: THREE.Group;
  resources: Readonly<{ geometries: number; materials: number; textures: number; triangles: number }>;
  dispose(): void;
}

const metals: Record<AwardGrade, string> = {
  gold: '#e9b546',
  silver: '#c2cad3',
  bronze: '#b87544',
};

function brushedMetal(): THREE.DataTexture {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 91483;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const random = seed / 4294967296;
      const brush = Math.sin(y * 7.1 + Math.sin(x * 0.08) * 0.35);
      const value = Math.round(126 + brush * 13 + (random - 0.5) * 22);
      const offset = (y * size + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function duckOutline(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.395, 0.155);
  shape.quadraticCurveTo(-0.335, 0.2, -0.29, 0.195);
  shape.bezierCurveTo(-0.33, 0.28, -0.29, 0.395, -0.175, 0.405);
  shape.bezierCurveTo(-0.045, 0.427, 0.065, 0.325, 0.018, 0.213);
  shape.quadraticCurveTo(-0.012, 0.12, -0.089, 0.097);
  shape.quadraticCurveTo(-0.025, 0.04, 0.102, 0.047);
  shape.quadraticCurveTo(0.251, 0.047, 0.334, 0.177);
  shape.quadraticCurveTo(0.384, 0.119, 0.338, 0.012);
  shape.bezierCurveTo(0.455, -0.044, 0.444, -0.231, 0.3, -0.324);
  shape.bezierCurveTo(0.184, -0.402, -0.113, -0.405, -0.253, -0.324);
  shape.bezierCurveTo(-0.404, -0.245, -0.414, -0.119, -0.288, 0.001);
  shape.quadraticCurveTo(-0.225, 0.06, -0.253, 0.11);
  shape.quadraticCurveTo(-0.34, 0.092, -0.395, 0.155);
  shape.closePath();
  return shape;
}

function leafGeometry(): THREE.BufferGeometry {
  const length = 0.166;
  const rows = 16;
  const columns = 10;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const taper = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.72);
    for (let column = 0; column <= columns; column++) {
      const across = (column / columns) * 2 - 1;
      const width = across * 0.043 * taper;
      const ridge = 0.027 * Math.sin(Math.PI * t) * (1 - Math.pow(Math.abs(across), 0.85));
      positions.push(width + Math.sin(t * Math.PI) * 0.014, t * length, ridge);
      uvs.push(column / columns, t);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mergedCopies(geometry: THREE.BufferGeometry, transforms: THREE.Matrix4[]): THREE.BufferGeometry {
  const copies = transforms.map((matrix) => geometry.clone().applyMatrix4(matrix));
  const merged = mergeGeometries(copies);
  for (const copy of copies) copy.dispose();
  geometry.dispose();
  if (!merged) throw new Error('The award ornament could not be built.');
  return merged;
}

export function createAwardMedal(grade: AwardGrade): AwardMedal {
  if (!AWARD_GRADES.includes(grade)) throw new Error('Use a valid award grade.');
  const object = new THREE.Group();
  object.name = `award-${grade}`;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const brush = brushedMetal();
  const material = (roughness: number, brightness = 1): THREE.MeshPhysicalMaterial => {
    const value = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(metals[grade]).multiplyScalar(brightness),
      metalness: 1,
      roughness,
      bumpMap: brush,
      bumpScale: 0.0012,
      clearcoat: 0.13,
      clearcoatRoughness: 0.19,
    });
    materials.add(value);
    return value;
  };
  const face = material(0.285);
  const polished = material(0.19, 1.035);
  const engraving = material(0.4, 0.53);
  const relief = material(0.24);
  const add = (geometry: THREE.BufferGeometry, surface: THREE.Material, name: string): THREE.Mesh => {
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const radial = 1 - (x * x + y * y) / (0.86 * 0.86);
      if (z <= 0.05 || radial <= 0) continue;
      positions.setZ(index, z + 0.07 * Math.pow(radial, 1.3));
      const slope = (-0.07 * 1.3 * 2 * Math.pow(radial, 0.3)) / (0.86 * 0.86);
      const nz = normals.getZ(index);
      const nx = normals.getX(index) - nz * slope * x;
      const ny = normals.getY(index) - nz * slope * y;
      const length = Math.hypot(nx, ny, nz) || 1;
      normals.setXYZ(index, nx / length, ny / length, nz / length);
    }
    positions.needsUpdate = true;
    normals.needsUpdate = true;
    geometry.computeBoundingSphere();
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
    return mesh;
  };
  const profile = [
    [0, -0.076],
    [0.9, -0.076],
    [0.966, -0.064],
    [0.991, -0.038],
    [1, 0.006],
    [0.998, 0.05],
    [0.987, 0.093],
    [0.965, 0.123],
    [0.939, 0.135],
    [0.913, 0.114],
    [0.896, 0.081],
    [0.88, 0.06],
    [0.78, 0.063],
    [0.6, 0.077],
    [0.3, 0.087],
    [0, 0.091],
  ];
  const coin = new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius!, height!)),
    192,
  );
  coin.rotateX(Math.PI / 2);
  add(coin, face, 'chamfered-coin');
  const ring = (
    radius: number,
    thickness: number,
    z: number,
    surface: THREE.Material,
    name: string,
  ): void => {
    const geometry = new THREE.TorusGeometry(radius, thickness, 12, 192);
    geometry.translate(0, 0, z);
    add(geometry, surface, name);
  };
  ring(0.947, 0.022, 0.127, polished, 'rolled-outer-rim');
  ring(0.879, 0.0045, 0.067, engraving, 'inner-rim-groove');
  ring(0.863, 0.006, 0.071, polished, 'inner-rim-lip');
  ring(0.99, 0.006, -0.03, polished, 'rear-edge');

  const ridges: THREE.Matrix4[] = [];
  for (let index = 0; index < 128; index++) {
    const angle = (index / 128) * Math.PI * 2;
    const position = new THREE.Vector3(Math.cos(angle) * 0.993, Math.sin(angle) * 0.993, 0.002);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    ridges.push(new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1)));
  }
  add(
    mergedCopies(new THREE.SphereGeometry(1, 8, 6).scale(0.008, 0.004, 0.036), ridges),
    polished,
    'reeded-edge',
  );

  const leaves: THREE.Matrix4[] = [];
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = (2.83 * index) / 32;
      return new THREE.Vector3(side * 0.684 * Math.sin(angle), -0.684 * Math.cos(angle), 0.095);
    });
    add(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, 0.009, 8, false),
      relief,
      `laurel-stem-${side}`,
    );
    for (let index = 0; index < 9; index++) {
      const angle = 0.2 + index * 0.298;
      const base = new THREE.Vector3(side * 0.684 * Math.sin(angle), -0.684 * Math.cos(angle), 0.096);
      const tangent = new THREE.Vector2(side * Math.cos(angle), Math.sin(angle));
      const radial = new THREE.Vector2(side * Math.sin(angle), -Math.cos(angle));
      for (const direction of [-1, 1]) {
        const tip = tangent
          .clone()
          .multiplyScalar(0.78)
          .addScaledVector(radial, direction * 0.66)
          .normalize();
        const rotation = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          Math.atan2(-tip.x, tip.y),
        );
        leaves.push(new THREE.Matrix4().compose(base, rotation, new THREE.Vector3(1, 1, 1)));
      }
    }
  }
  add(mergedCopies(leafGeometry(), leaves), relief, 'raised-laurel-leaves');

  const duck = new THREE.ExtrudeGeometry(duckOutline(), {
    depth: 0.016,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.014,
    bevelSegments: 5,
    curveSegments: 24,
  });
  duck.translate(0, 0.016, 0.1);
  add(duck, polished, 'duck-relief');
  const wing = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-0.143, -0.084, 0.135),
    new THREE.Vector3(-0.031, -0.015, 0.135),
    new THREE.Vector3(0.173, -0.087, 0.135),
    new THREE.Vector3(0.175, -0.179, 0.135),
  );
  add(new THREE.TubeGeometry(wing, 40, 0.004, 8, false), engraving, 'wing-engraving');
  const eye = new THREE.SphereGeometry(1, 20, 12);
  eye.scale(0.011, 0.014, 0.003);
  eye.translate(-0.228, 0.304, 0.135);
  add(eye, engraving, 'eye-recess');
  const bow = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.076, -0.694, 0.115),
    new THREE.Vector3(-0.024, -0.677, 0.13),
    new THREE.Vector3(0.028, -0.712, 0.13),
    new THREE.Vector3(0.076, -0.702, 0.115),
  ]);
  add(new THREE.TubeGeometry(bow, 24, 0.011, 8, false), polished, 'laurel-tie');

  let triangles = 0;
  for (const geometry of geometries)
    triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  let disposed = false;
  return {
    object,
    resources: Object.freeze({
      geometries: geometries.size,
      materials: materials.size,
      textures: 1,
      triangles,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      object.removeFromParent();
      object.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const surface of materials) surface.dispose();
      geometries.clear();
      materials.clear();
      brush.dispose();
    },
  };
}
