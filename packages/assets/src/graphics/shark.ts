import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export interface SharkPose {
  time?: number;
  jaw?: number;
  tail?: number;
  key?: number;
  charge?: number;
  launched?: boolean;
  y?: number;
}

export interface SharkInstances {
  group: Group;
  set(index: number, x: number, z: number, angle: number, scale?: number, pose?: SharkPose): void;
  commit(count: number): void;
  dispose(): void;
}

type Section = { z: number; width: number; height: number; y: number };
type Part = {
  name: string;
  geometry: BufferGeometry;
  material: MeshPhysicalMaterial;
  motion: 'head' | 'jaw' | 'body' | 'tail' | 'key';
};
export const SHARK_MOTION = Object.freeze({
  cycleSeconds: 1,
  closedStart: 0.316667,
  closedEnd: 0.666667,
  closedAngle: (46.674065282510476 * Math.PI) / 180,
  openUpperAngle: (58.41429078906921 * Math.PI) / 180,
  openLowerAngle: (-32.98984280429599 * Math.PI) / 180,
});
export const SHARK_LANDMARKS = Object.freeze({
  upperSnout: [0, 0.54, 1.39] as const,
  lowerSnout: [0, 0.43, 1.46] as const,
  leftEye: [-0.71, 0.838, 0.515] as const,
  rightEye: [0.71, 0.838, 0.515] as const,
  tailTop: [0, 1.08, -2.24] as const,
});
let shared: Part[] | undefined;
const pivot = new Vector3(0, 0.42, -0.58);
const tailPivot = new Vector3(0, 0.46, -1.34);
const keyPivot = new Vector3(0.7, 0.47, -0.6);

function painted(source: BufferGeometry, color: number): BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  geometry.deleteAttribute('uv');
  const tint = new Color(color);
  const values = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let index = 0; index < values.length; index += 3) tint.toArray(values, index);
  geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
  return geometry;
}

function combine(parts: BufferGeometry[]): BufferGeometry {
  const result = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!result) throw new Error('The shark parts could not be merged.');
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

function hull(sections: Section[], lower = false, profilePower = 1): BufferGeometry {
  const segments = 20;
  const profile = new CatmullRomCurve3(
    sections.map((section) => new Vector3(section.width, section.height, section.z)),
  );
  const centers = new CatmullRomCurve3(sections.map((section) => new Vector3(0, section.y, section.z)));
  const rows = sections.length * 2;
  const points: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const sample = profile.getPoint(row / rows);
    const center = centers.getPoint(row / rows);
    for (let column = 0; column <= segments; column++) {
      const angle = (column / segments + (lower ? 1 : 0)) * Math.PI;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      points.push(
        Math.sign(cosine) * Math.pow(Math.abs(cosine), profilePower) * Math.max(0, sample.x),
        center.y + Math.sign(sine) * Math.pow(Math.abs(sine), profilePower) * Math.max(0, sample.y),
        sample.z,
      );
      if (row < rows && column < segments) {
        const index = row * (segments + 1) + column;
        indices.push(
          index,
          index + 1,
          index + segments + 1,
          index + 1,
          index + segments + 2,
          index + segments + 1,
        );
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ellipsoid(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: number,
  segments = 12,
): BufferGeometry {
  const shape = new SphereGeometry(1, segments, Math.max(8, Math.floor(segments * 0.7)));
  shape.scale(sx, sy, sz);
  shape.translate(x, y, z);
  return painted(shape, color);
}

function curveFin(source: BufferGeometry, outline: Vector2[], bulge: number): BufferGeometry {
  const positions = source.getAttribute('position');
  const normals = source.getAttribute('normal');
  const values: number[] = [];
  const write = (point: Vector3, direction: number) => {
    let distance = Infinity;
    if (direction !== 0) {
      for (let index = 0; index < outline.length; index++) {
        const a = outline[index]!;
        const b = outline[(index + 1) % outline.length]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = dx * dx + dy * dy;
        const fraction =
          length > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
        distance = Math.min(
          distance,
          Math.hypot(point.x - a.x - dx * fraction, point.y - a.y - dy * fraction),
        );
      }
    }
    const curvature =
      direction === 0
        ? 0
        : Math.sin(Math.min(1, Math.max(0, distance - 0.0201) / 0.3) * Math.PI * 0.5) * bulge * direction;
    values.push(point.x, point.y, point.z + curvature);
  };
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const bc = new Vector3();
  const ca = new Vector3();
  for (let index = 0; index < positions.count; index += 3) {
    a.fromBufferAttribute(positions, index);
    b.fromBufferAttribute(positions, index + 1);
    c.fromBufferAttribute(positions, index + 2);
    const cap =
      Math.abs(normals.getZ(index)) > 0.999 && Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.z - c.z) < 1e-6;
    if (!cap) {
      write(a, 0);
      write(b, 0);
      write(c, 0);
      continue;
    }
    const direction = Math.sign(normals.getZ(index));
    ab.copy(a).add(b).multiplyScalar(0.5);
    bc.copy(b).add(c).multiplyScalar(0.5);
    ca.copy(c).add(a).multiplyScalar(0.5);
    for (const point of [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca]) write(point, direction);
  }
  source.dispose();
  const expanded = new BufferGeometry();
  expanded.setAttribute('position', new Float32BufferAttribute(values, 3));
  const geometry = mergeVertices(expanded);
  expanded.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

function verticalFin(shape: Shape, thickness: number, color: number, bulge = 0.04): BufferGeometry {
  const extruded = new ExtrudeGeometry(shape, {
    depth: thickness,
    steps: 1,
    bevelEnabled: true,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    bevelSegments: 2,
    curveSegments: 8,
  });
  const geometry = curveFin(extruded, shape.getPoints(8), bulge);
  geometry.translate(0, 0, -thickness * 0.5);
  geometry.rotateY(Math.PI / 2);
  return painted(geometry, color);
}

function mouthRim(lower: boolean): BufferGeometry {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.59, lower ? 0.45 : 0.48, -0.3),
    new Vector3(-0.72, lower ? 0.45 : 0.49, 0.35),
    new Vector3(-0.47, lower ? 0.45 : 0.5, 1.02),
    new Vector3(0, lower ? 0.46 : 0.51, 1.3),
    new Vector3(0.47, lower ? 0.45 : 0.5, 1.02),
    new Vector3(0.72, lower ? 0.45 : 0.49, 0.35),
    new Vector3(0.59, lower ? 0.45 : 0.48, -0.3),
  ]);
  return painted(new TubeGeometry(curve, 28, lower ? 0.035 : 0.04, 6, false), 0xe3e9f3);
}

function mouthBowl(lower: boolean): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = 24;
  const rings = 5;
  for (let ring = 0; ring <= rings; ring++) {
    const radius = ring / rings;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      positions.push(
        Math.cos(angle) * radius * 0.655,
        lower ? 0.17 + radius * radius * 0.28 : 0.69 - radius * radius * 0.2,
        0.35 + Math.sin(angle) * radius * 0.94,
      );
      if (ring < rings && segment < segments) {
        const index = ring * (segments + 1) + segment;
        const triangles = [
          index,
          index + 1,
          index + segments + 1,
          index + 1,
          index + segments + 2,
          index + segments + 1,
        ];
        indices.push(...(lower ? triangles : triangles.reverse()));
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return painted(geometry, lower ? 0x663344 : 0x502339);
}

function teeth(lower: boolean): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  for (let index = 0; index < 13; index++) {
    const angle = (index / 12) * Math.PI;
    const x = Math.cos(angle) * 0.65;
    const z = 0.17 + Math.sin(angle) * 1.0;
    const length = (0.125 + Math.sin(angle) * 0.025 + (index % 2) * 0.015) * (lower ? 0.85 : 1);
    const tooth = new CylinderGeometry(lower ? 0.034 : 0.022, lower ? 0.074 : 0.065, length, 6, 1);
    if (!lower) tooth.rotateZ(Math.PI);
    tooth.rotateX(lower ? -0.16 : 0.16);
    tooth.translate(x, lower ? 0.45 + length * 0.48 : 0.49 - length * 0.48, z);
    parts.push(painted(tooth, 0xfffae8));
  }
  return parts;
}

function resources(): Part[] {
  if (shared) return shared;
  const silver = new MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0.93,
    roughness: 0.12,
    clearcoat: 0.24,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.55,
  });
  const detail = new MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0,
    roughness: 0.29,
    clearcoat: 0.32,
    clearcoatRoughness: 0.2,
  });
  const upper = painted(
    hull(
      [
        { z: -0.63, width: 0.56, height: 0.49, y: 0.43 },
        { z: -0.4, width: 0.71, height: 0.59, y: 0.45 },
        { z: 0.1, width: 0.74, height: 0.63, y: 0.47 },
        { z: 0.55, width: 0.7, height: 0.55, y: 0.49 },
        { z: 0.95, width: 0.59, height: 0.36, y: 0.51 },
        { z: 1.21, width: 0.38, height: 0.15, y: 0.53 },
        { z: 1.34, width: 0.16, height: 0.035, y: 0.54 },
        { z: 1.39, width: 0, height: 0, y: 0.54 },
      ],
      false,
      0.32,
    ),
    0xe5e8ef,
  );
  const abdomen: Section[] = [
    { z: -1.5, width: 0.06, height: 0.04, y: 0.39 },
    { z: -1.26, width: 0.44, height: 0.16, y: 0.34 },
    { z: -0.97, width: 0.69, height: 0.25, y: 0.31 },
    { z: -0.65, width: 0.72, height: 0.29, y: 0.28 },
    { z: -0.4, width: 0.62, height: 0.25, y: 0.25 },
    { z: -0.2, width: 0.4, height: 0.18, y: 0.22 },
    { z: -0.04, width: 0, height: 0.02, y: 0.2 },
  ];
  const rear = painted(hull(abdomen, false, 0.8), 0xd8dee8);
  const belly = painted(
    hull(
      abdomen.map((section) => ({ ...section, height: section.height * 1.18 })),
      true,
      0.8,
    ),
    0xd8dee8,
  );
  const dorsal = new Shape();
  dorsal.moveTo(0.72, 0.81);
  dorsal.quadraticCurveTo(0.8, 1.05, 1.1, 1.3);
  dorsal.quadraticCurveTo(1.05, 0.88, 1.48, 0.59);
  dorsal.lineTo(0.72, 0.81);
  const headParts = [upper, mouthRim(false)];
  const bodyParts = [rear, belly, verticalFin(dorsal, 0.08, 0xc5cfe3)];
  for (const side of [-1, 1]) {
    const fin = new Shape();
    fin.moveTo(side * 0.68, -0.08);
    fin.quadraticCurveTo(side * 0.823, -0.179, side * 0.9385, -0.5255);
    fin.quadraticCurveTo(side * 0.7295, -0.3495, side * 0.647, -0.4925);
    fin.closePath();
    const shape = new ExtrudeGeometry(fin, {
      depth: 0.055,
      bevelEnabled: true,
      bevelSize: 0.022,
      bevelThickness: 0.015,
      bevelSegments: 2,
      curveSegments: 5,
      steps: 1,
    });
    shape.rotateX(Math.PI / 2);
    shape.translate(0, 0.4, 0);
    bodyParts.push(painted(shape, 0xcad4e6));
    for (let slit = 0; slit < 3; slit++) {
      const groove = new CatmullRomCurve3([
        new Vector3(side * (0.7 - slit * 0.026), 0.51, -0.11 - slit * 0.14),
        new Vector3(side * (0.72 - slit * 0.026), 0.69, -0.09 - slit * 0.14),
        new Vector3(side * (0.66 - slit * 0.026), 0.86, -0.07 - slit * 0.14),
      ]);
      headParts.push(painted(new TubeGeometry(groove, 5, 0.012, 4), 0x7d8aa5));
    }
  }
  const headDetails = [mouthBowl(false), ...teeth(false)];
  for (const side of [-1, 1]) {
    headParts.push(ellipsoid(side * 0.684, 0.815, 0.49, 0.035, 0.14, 0.2, 0xa2abbf));
    headDetails.push(
      ellipsoid(
        side * SHARK_LANDMARKS.rightEye[0],
        SHARK_LANDMARKS.rightEye[1],
        SHARK_LANDMARKS.rightEye[2],
        0.021,
        0.115,
        0.18,
        0x10131b,
        14,
      ),
    );
    headDetails.push(ellipsoid(side * 0.732, 0.906, 0.57, 0.006, 0.024, 0.027, 0xf5fcff, 10));
  }
  const lower = painted(
    hull(
      [
        { z: -0.63, width: 0.03, height: 0.035, y: 0.44 },
        { z: -0.36, width: 0.56, height: 0.23, y: 0.44 },
        { z: 0.05, width: 0.69, height: 0.31, y: 0.44 },
        { z: 0.5, width: 0.71, height: 0.29, y: 0.44 },
        { z: 0.9, width: 0.52, height: 0.24, y: 0.44 },
        { z: 1.2, width: 0.29, height: 0.22, y: 0.44 },
        { z: 1.4, width: 0.08, height: 0.13, y: 0.43 },
        { z: 1.46, width: 0, height: 0.06, y: 0.43 },
      ],
      true,
    ),
    0xe3e9f5,
  );
  const tail = new Shape();
  tail.moveTo(1.31, 0.5);
  tail.quadraticCurveTo(1.82, 0.9, 2.24, 1.08);
  tail.quadraticCurveTo(2.02, 0.66, 2.02, 0.47);
  tail.quadraticCurveTo(2.05, 0.19, 2.24, 0.05);
  tail.quadraticCurveTo(1.75, 0.13, 1.31, 0.43);
  tail.closePath();
  const tailParts = [
    verticalFin(tail, 0.065, 0xd8dee8, 0.08),
    ellipsoid(0, 0.455, -1.34, 0.2, 0.15, 0.28, 0xb7c1d8),
  ];
  const shaft = new CylinderGeometry(0.047, 0.047, 0.47, 12);
  shaft.rotateZ(Math.PI / 2);
  shaft.translate(0.85, 0.47, -0.6);
  const keyParts = [painted(shaft, 0xd8dfeb)];
  for (const side of [-1, 1]) {
    const loop = new TorusGeometry(0.105, 0.04, 6, 14);
    loop.scale(1.0, 0.88, 1.0);
    loop.rotateY(Math.PI / 2);
    loop.translate(1.1, 0.47, -0.6 + side * 0.088);
    keyParts.push(painted(loop, 0xecf0fa));
  }
  shared = [
    { name: 'upper-shell', geometry: combine(headParts), material: silver, motion: 'head' },
    { name: 'eyes-mouth-upper-teeth', geometry: combine(headDetails), material: detail, motion: 'head' },
    {
      name: 'lower-shell',
      geometry: combine([lower, mouthRim(true)]),
      material: silver,
      motion: 'jaw',
    },
    {
      name: 'lower-mouth-teeth',
      geometry: combine([
        mouthBowl(true),
        ellipsoid(0, 0.48, -0.5, 0.51, 0.31, 0.16, 0x4f263d),
        ...teeth(true),
      ]),
      material: detail,
      motion: 'jaw',
    },
    { name: 'body-shell', geometry: combine(bodyParts), material: silver, motion: 'body' },
    { name: 'tail', geometry: combine(tailParts), material: silver, motion: 'tail' },
    { name: 'winding-key', geometry: combine(keyParts), material: detail, motion: 'key' },
  ];
  return shared;
}

const localMatrix = new Matrix4();
const worldMatrix = new Matrix4();
const offsetMatrix = new Matrix4();
const scaleVector = new Vector3();

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function angleAt(time: number, rate: number): number {
  return (time % ((Math.PI * 2) / rate)) * rate;
}

export function sharkJawAt(time: number, charge = 0): number {
  const phase = (((finite(time, 0) / SHARK_MOTION.cycleSeconds) % 1) + 1) % 1;
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const cycle =
    phase < SHARK_MOTION.closedStart
      ? 1 - smooth(phase / SHARK_MOTION.closedStart)
      : phase > SHARK_MOTION.closedEnd
        ? smooth((phase - SHARK_MOTION.closedEnd) / (1 - SHARK_MOTION.closedEnd))
        : 0;
  return Math.max(cycle, Math.max(0, Math.min(1, finite(charge, 0))));
}

function partMatrix(target: Matrix4, motion: Part['motion'], pose: SharkPose): void {
  const time = finite(pose.time, 0);
  const charge = Math.max(0, Math.min(1, finite(pose.charge, 0)));
  const jaw = Math.max(0, Math.min(1, finite(pose.jaw, sharkJawAt(time, charge))));
  if (motion === 'body') {
    target.identity();
    return;
  }
  let center: Vector3;
  if (motion === 'head') {
    center = pivot;
    target.makeRotationX(
      -SHARK_MOTION.closedAngle - jaw * (SHARK_MOTION.openUpperAngle - SHARK_MOTION.closedAngle),
    );
  } else if (motion === 'jaw') {
    center = pivot;
    target.makeRotationX(
      -SHARK_MOTION.closedAngle - jaw * (SHARK_MOTION.openLowerAngle - SHARK_MOTION.closedAngle),
    );
  } else if (motion === 'tail') {
    center = tailPivot;
    const tail = finite(pose.tail, Math.sin(angleAt(time, pose.launched ? 13 : 6)) * (0.16 + charge * 0.09));
    target.makeRotationY(tail % (Math.PI * 2));
  } else {
    center = keyPivot;
    target.makeRotationX(finite(pose.key, angleAt(time, 2.8 + charge * 8)) % (Math.PI * 2));
  }
  target.premultiply(offsetMatrix.makeTranslation(center.x, center.y, center.z));
  target.multiply(offsetMatrix.makeTranslation(-center.x, -center.y, -center.z));
}

export function createShark(): Group {
  const group = new Group();
  group.name = 'silver-windup-shark';
  for (const part of resources()) {
    const mesh = new Mesh(part.geometry, part.material);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  updateShark(group, 0);
  return group;
}

export function updateShark(shark: Group, time: number, pose: SharkPose = {}): void {
  const parts = resources();
  const frame = { ...pose, time };
  for (let index = 0; index < parts.length; index++) {
    const mesh = shark.children[index];
    if (!mesh) continue;
    partMatrix(mesh.matrix, parts[index]!.motion, frame);
    mesh.matrixWorldNeedsUpdate = true;
  }
}

export function createSharkInstances(capacity = 64): SharkInstances {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 64)
    throw new RangeError('The shark capacity must be from 1 to 64.');
  const group = new Group();
  group.name = 'windup-shark-batch';
  const parts = resources();
  const meshes = parts.map((part) => {
    const mesh = new InstancedMesh(part.geometry, part.material, capacity);
    mesh.name = part.name;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  });
  let disposed = false;
  return {
    group,
    set(index, x, z, angle, scale = 1, pose = {}) {
      if (disposed || !Number.isInteger(index) || index < 0 || index >= capacity) return;
      if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(angle) || !Number.isFinite(scale))
        return;
      if (Math.abs(x) > 1e9 || Math.abs(z) > 1e9) return;
      worldMatrix.makeRotationY(angle);
      worldMatrix.scale(scaleVector.setScalar(Math.max(0.01, Math.min(64, scale))));
      const height = finite(pose.y, 0.05 + Math.sin(angleAt(finite(pose.time, 0), 2) + index) * 0.025);
      worldMatrix.setPosition(x, Math.max(-128, Math.min(128, height)), z);
      for (let part = 0; part < parts.length; part++) {
        partMatrix(localMatrix, parts[part]!.motion, pose);
        localMatrix.premultiply(worldMatrix);
        meshes[part]!.setMatrixAt(index, localMatrix);
      }
    },
    commit(count) {
      if (disposed) return;
      const active = Number.isFinite(count) ? Math.max(0, Math.min(capacity, Math.floor(count))) : 0;
      for (const mesh of meshes) {
        mesh.count = active;
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of meshes) mesh.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}

export function disposeSharkResources(): void {
  if (!shared) return;
  const materials = new Set(shared.map((part) => part.material));
  for (const part of shared) part.geometry.dispose();
  for (const material of materials) material.dispose();
  shared = undefined;
}
