import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DuckDetail } from '../duck';

export type Point = readonly [number, number, number];
export type Section = readonly [number, number, number, number];
export const point = (value: Point) => new THREE.Vector3(...value);

export class ToyGeometry {
  readonly pieces: THREE.BufferGeometry[] = [];
  readonly radial: number;
  readonly steps: number;

  constructor(readonly detail: DuckDetail) {
    this.radial = detail === 'high' ? 24 : detail === 'medium' ? 16 : 10;
    this.steps = detail === 'high' ? 16 : detail === 'medium' ? 10 : 6;
  }

  add(source: THREE.BufferGeometry, color: THREE.ColorRepresentation): void {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.deleteAttribute('uv');
    const count = geometry.getAttribute('position').count;
    const tint = new THREE.Color(color);
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) tint.toArray(colors, index * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.pieces.push(geometry);
  }

  blob(center: Point, radius: Point, color: THREE.ColorRepresentation, rotation?: Point): void {
    const geometry = new THREE.SphereGeometry(1, this.radial, Math.max(6, this.steps));
    geometry.scale(...radius);
    if (rotation)
      geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    geometry.translate(...center);
    this.add(geometry, color);
  }

  hull(sections: readonly Section[], color: THREE.ColorRepresentation, power = 1): void {
    const spine = new THREE.CatmullRomCurve3(
      sections.map(([z, width, height, y]) => new THREE.Vector3(width, height, y)),
    );
    const rings = (sections.length - 1) * (this.detail === 'high' ? 3 : this.detail === 'medium' ? 2 : 1);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings;
      const scaled = t * (sections.length - 1);
      const lower = Math.min(sections.length - 2, Math.floor(scaled));
      const blend = scaled - lower;
      const z = THREE.MathUtils.lerp(sections[lower]![0], sections[lower + 1]![0], blend);
      const size = spine.getPoint(t);
      for (let edge = 0; edge <= this.radial; edge++) {
        const angle = (edge / this.radial) * Math.PI * 2;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        positions.push(
          Math.sign(x) * Math.pow(Math.abs(x), power) * Math.max(0.001, size.x),
          size.z + Math.sign(y) * Math.pow(Math.abs(y), power) * Math.max(0.001, size.y),
          z,
        );
        if (ring < rings && edge < this.radial) {
          const a = ring * (this.radial + 1) + edge;
          const b = a + this.radial + 1;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.smoothRingSeams(geometry, rings, this.radial);
    this.add(geometry, color);
  }

  tube(points: readonly Point[], radius: number, color: THREE.ColorRepresentation): void {
    const curve = new THREE.CatmullRomCurve3(points.map(point));
    this.add(
      new THREE.TubeGeometry(curve, Math.max(4, this.steps), radius, this.detail === 'low' ? 5 : 8, false),
      color,
    );
  }

  fin(
    points: readonly Point[],
    width: number,
    thickness: number,
    color: THREE.ColorRepresentation,
    normal: Point = [0, 1, 0],
  ): void {
    const curve = new THREE.CatmullRomCurve3(points.map(point));
    const rings = this.steps;
    const sides = this.detail === 'low' ? 6 : 10;
    const positions: number[] = [];
    const indices: number[] = [];
    const face = point(normal).normalize();
    const across = new THREE.Vector3();
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings;
      const center = curve.getPoint(t);
      across.crossVectors(face, curve.getTangent(t)).normalize();
      const taper = Math.max(0.045, Math.pow(Math.sin(t * Math.PI), 0.7));
      for (let side = 0; side <= sides; side++) {
        const angle = (side / sides) * Math.PI * 2;
        const vertex = center
          .clone()
          .addScaledVector(across, Math.cos(angle) * width * taper)
          .addScaledVector(face, Math.sin(angle) * thickness * taper);
        positions.push(vertex.x, vertex.y, vertex.z);
        if (ring < rings && side < sides) {
          const a = ring * (sides + 1) + side;
          const b = a + sides + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.smoothRingSeams(geometry, rings, sides);
    this.add(geometry, color);
  }

  private smoothRingSeams(geometry: THREE.BufferGeometry, rings: number, sides: number): void {
    const normals = geometry.getAttribute('normal');
    const normal = new THREE.Vector3();
    const peer = new THREE.Vector3();
    for (let ring = 0; ring <= rings; ring++) {
      const first = ring * (sides + 1);
      const last = first + sides;
      normal.fromBufferAttribute(normals, first);
      peer.fromBufferAttribute(normals, last);
      normal.add(peer).normalize();
      normals.setXYZ(first, normal.x, normal.y, normal.z);
      normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
  }

  ring(
    center: Point,
    radius: number,
    tube: number,
    color: THREE.ColorRepresentation,
    rotation: Point = [0, 0, 0],
    scale: Point = [1, 1, 1],
  ): void {
    const geometry = new THREE.TorusGeometry(radius, tube, this.detail === 'low' ? 6 : 8, this.radial);
    geometry.scale(...scale);
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    geometry.translate(...center);
    this.add(geometry, color);
  }

  shape(
    points: readonly [number, number][],
    depth: number,
    color: THREE.ColorRepresentation,
    center: Point = [0, 0, 0],
    rotation: Point = [0, 0, 0],
  ): void {
    const outline = new THREE.Shape();
    points.forEach(([x, y], index) => (index ? outline.lineTo(x, y) : outline.moveTo(x, y)));
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth,
      bevelEnabled: true,
      bevelSize: Math.min(0.025, depth * 0.4),
      bevelThickness: Math.min(0.025, depth * 0.4),
      bevelSegments: 2,
      steps: 1,
    });
    geometry.translate(0, 0, -depth * 0.5);
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    geometry.translate(...center);
    this.add(geometry, color);
  }

  eye(center: Point, size = 0.11, side = 0): void {
    this.blob(center, [size, size * 1.12, size * 0.65], '#f7fbff');
    this.blob(
      [center[0] + side * size * 0.06, center[1], center[2] + size * 0.5],
      [size * 0.67, size * 0.78, size * 0.42],
      '#17223b',
    );
    this.blob(
      [center[0] - size * 0.21, center[1] + size * 0.32, center[2] + size * 0.83],
      [size * 0.2, size * 0.22, size * 0.12],
      '#ffffff',
    );
  }

  smile(width: number, y: number, z: number, color = '#56394b'): void {
    this.tube(
      [
        [-width, y + 0.035, z - 0.025],
        [-width * 0.5, y - 0.025, z + 0.015],
        [0, y - 0.055, z + 0.025],
        [width * 0.5, y - 0.025, z + 0.015],
        [width, y + 0.035, z - 0.025],
      ],
      0.017,
      color,
    );
  }

  finish(): THREE.BufferGeometry {
    if (!this.pieces.length) return new THREE.BufferGeometry();
    const geometry = mergeGeometries(this.pieces);
    for (const piece of this.pieces) piece.dispose();
    this.pieces.length = 0;
    if (!geometry) throw new Error('The toy geometry could not be built.');
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
