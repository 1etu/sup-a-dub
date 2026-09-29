import * as THREE from 'three';
import { createBubblePopMaterial } from './bubble-pop-material';

export interface BubblePops {
  readonly group: THREE.Group;
  readonly resources: Readonly<{
    capacity: number;
    active: number;
    particles: number;
    instanceSlots: number;
    geometries: number;
    materials: number;
    textures: number;
    maxLifetime: number;
  }>;
  pop(x: number, y: number, z: number, radius?: number, seed?: number): void;
  update(time: number, reducedMotion?: boolean): void;
  clear(): void;
  dispose(): void;
}

type Burst = { active: boolean; born: number; x: number; y: number; z: number; radius: number; seed: number };
const sprayCount = 12;
const lifetime = 0.64;
const tau = Math.PI * 2;

export function createBubblePops(capacity = 32): BubblePops {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 32)
    throw new RangeError('The bubble pop capacity must be an integer from 1 to 32.');
  const group = new THREE.Group();
  group.name = 'bubble-pop-film-and-spray';
  const geometry = new THREE.PlaneGeometry(2, 2);
  const slots = capacity * (sprayCount + 1);
  const styles = new THREE.InstancedBufferAttribute(new Float32Array(slots * 4), 4);
  styles.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('popStyle', styles);
  const material = createBubblePopMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, slots);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  group.add(mesh);
  const bursts: Burst[] = Array.from({ length: capacity }, () => ({
    active: false,
    born: 0,
    x: 0,
    y: 0,
    z: 0,
    radius: 1,
    seed: 0,
  }));
  const matrix = new THREE.Matrix4();
  let cursor = 0,
    now = 0,
    active = 0,
    initialized = false,
    disposed = false;

  function instance(
    index: number,
    x: number,
    y: number,
    z: number,
    radius: number,
    age: number,
    phase: number,
    kind: number,
    strength: number,
  ): void {
    matrix.makeScale(radius, radius, radius);
    matrix.setPosition(x, y, z);
    mesh.setMatrixAt(index, matrix);
    styles.setXYZW(index, age, phase, kind, strength);
  }

  return {
    group,
    get resources() {
      return {
        capacity,
        active,
        particles: mesh.count,
        instanceSlots: slots,
        geometries: disposed ? 0 : 1,
        materials: disposed ? 0 : 1,
        textures: 0,
        maxLifetime: lifetime,
      };
    },
    pop(x, y, z, radius = 1.2, seed = 0) {
      if (
        disposed ||
        ![x, y, z, radius].every(Number.isFinite) ||
        Math.abs(x) > 1e7 ||
        Math.abs(y) > 1e6 ||
        Math.abs(z) > 1e7 ||
        radius <= 0
      )
        return;
      const burst = bursts[cursor]!;
      cursor = (cursor + 1) % capacity;
      burst.active = true;
      burst.born = now;
      burst.x = x;
      burst.y = y;
      burst.z = z;
      burst.radius = Math.min(radius, 100);
      burst.seed = Number.isFinite(seed) ? (((seed % 997) + 997) % 997) / 997 : 0;
    },
    update(time, reducedMotion = false) {
      if (disposed || !Number.isFinite(time) || time < 0 || time > 1e9) return;
      if (!initialized) {
        for (const burst of bursts) if (burst.active) burst.born += time;
        initialized = true;
      }
      if (time < now) for (const burst of bursts) burst.active = false;
      now = time;
      material.uniforms.time!.value = time;
      let count = 0;
      active = 0;
      for (const burst of bursts) {
        if (!burst.active) continue;
        const age = time - burst.born;
        if (age >= lifetime) {
          burst.active = false;
          continue;
        }
        active++;
        if (age < 0.18)
          instance(
            count++,
            burst.x,
            burst.y,
            burst.z,
            burst.radius,
            age,
            burst.seed,
            0,
            reducedMotion ? 0.18 : 1,
          );
        if (age < 0.012) continue;
        for (let index = 0; index < (reducedMotion ? 4 : sprayCount); index++) {
          const phase = (burst.seed + index * 0.61803398875) % 1;
          const life = 0.36 + ((phase * 7.13) % 1) * 0.22;
          if (age >= life) continue;
          const angle = phase * tau;
          const travel = age * (reducedMotion ? 0.2 : 1);
          const spread = 0.14 + (index % 4) * 0.035 + travel * (0.65 + (index % 5) * 0.18);
          const x = burst.x + Math.cos(angle) * burst.radius * spread;
          const z = burst.z + Math.sin(angle) * burst.radius * spread;
          const y =
            burst.y +
            burst.radius *
              (-0.27 + (index % 4) * 0.16 + travel * (0.75 + (index % 3) * 0.24) - travel * travel * 0.55);
          const size = burst.radius * (0.055 + (index % 5) * 0.015) * (1 + age * 0.48);
          instance(count++, x, Math.max(size * 0.35, y), z, size, age, phase, 1, 0);
        }
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      styles.needsUpdate = true;
    },
    clear() {
      if (disposed) return;
      for (const burst of bursts) burst.active = false;
      active = 0;
      mesh.count = 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = 0;
      mesh.count = 0;
      mesh.dispose();
      geometry.dispose();
      material.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
