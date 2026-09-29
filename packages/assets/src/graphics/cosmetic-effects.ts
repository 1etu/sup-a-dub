import * as THREE from 'three';
import { CELEBRATION_ITEMS, EMOTE_ITEMS, WAKE_ITEMS } from '@supadub/cosmetics';
import { acquireEffectAtlas, EFFECT_TILES } from './effects/atlas';
import { createEffectMaterial } from './effects/material';

export interface CosmeticEffects {
  readonly group: THREE.Group;
  readonly resources: Readonly<{
    capacity: number;
    active: number;
    geometries: number;
    materials: number;
    textures: number;
    atlasBytes: number;
  }>;
  wake(id: string, x: number, z: number, angle: number, scale?: number): void;
  emote(id: string, x: number, y: number, z: number, scale?: number): void;
  celebrate(id: string, x: number, y: number, z: number, scale?: number): void;
  update(time: number, reducedMotion?: boolean): void;
  dispose(): void;
}

type Particle = {
  active: boolean;
  born: number;
  life: number;
  tile: number;
  horizontal: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  growth: number;
  angle: number;
  spin: number;
  gravity: number;
  opacity: number;
  color: readonly [number, number, number];
};

const wakeTiles = [
  EFFECT_TILES.ring,
  EFFECT_TILES.bubble,
  EFFECT_TILES.star,
  EFFECT_TILES.heart,
  EFFECT_TILES.rainbow,
  EFFECT_TILES.sparkle,
];
const emoteTiles = [
  EFFECT_TILES.wave,
  EFFECT_TILES.heart,
  EFFECT_TILES.laugh,
  EFFECT_TILES.wow,
  EFFECT_TILES.cheer,
  EFFECT_TILES.splash,
];
const white = [1, 1, 1] as const;
const confettiColors = [
  [1, 0.52, 0.72],
  [0.56, 0.94, 1],
  [1, 0.92, 0.51],
  [0.77, 1, 0.66],
  [0.88, 0.73, 1],
] as const;
const valid = (...values: number[]) =>
  values.every((value) => Number.isFinite(value) && Math.abs(value) <= 1e7);

export function createCosmeticEffects(capacity = 256): CosmeticEffects {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1024)
    throw new RangeError('The effect capacity must be an integer from 1 to 1024.');
  const group = new THREE.Group();
  group.name = 'cosmetic-effects';
  const plane = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  for (const [name, attribute] of Object.entries(plane.attributes)) geometry.setAttribute(name, attribute);
  plane.dispose();
  const positions = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(
    THREE.DynamicDrawUsage,
  );
  const styles = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(
    THREE.DynamicDrawUsage,
  );
  const colors = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(
    THREE.DynamicDrawUsage,
  );
  geometry.setAttribute('effectPosition', positions);
  geometry.setAttribute('effectStyle', styles);
  geometry.setAttribute('effectColor', colors);
  geometry.instanceCount = 0;
  const atlas = acquireEffectAtlas();
  const texture = atlas.texture;
  const material = createEffectMaterial(texture);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  group.add(mesh);
  const particles: Particle[] = Array.from({ length: capacity }, () => ({
    active: false,
    born: 0,
    life: 0,
    tile: 0,
    horizontal: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    size: 1,
    growth: 0,
    angle: 0,
    spin: 0,
    gravity: 0,
    opacity: 1,
    color: white,
  }));
  let cursor = 0,
    now = 0,
    initialized = false,
    reduced = false,
    disposed = false;
  let lastWake = -Infinity;
  let wakeBurstCount = 0;

  function emit(tile: number, x: number, y: number, z: number, size: number, life: number): Particle {
    const particle = particles[cursor]!;
    cursor = (cursor + 1) % capacity;
    Object.assign(particle, {
      active: true,
      born: now,
      life,
      tile,
      horizontal: false,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      size,
      growth: 0,
      angle: 0,
      spin: 0,
      gravity: 0,
      opacity: 1,
      color: white,
    });
    return particle;
  }

  return {
    group,
    get resources() {
      return {
        capacity,
        active: geometry.instanceCount,
        geometries: disposed ? 0 : 1,
        materials: disposed ? 0 : 1,
        textures: disposed ? 0 : 1,
        atlasBytes: disposed ? 0 : texture.image.data.byteLength,
      };
    },
    wake(id, x, z, angle, scale = 1) {
      if (disposed || !valid(x, z, angle, scale) || scale <= 0) return;
      const index = (WAKE_ITEMS as readonly string[]).indexOf(id);
      if (index < 0) return;
      if (now - lastWake > 0.001) {
        lastWake = now;
        wakeBurstCount = 0;
      }
      if (wakeBurstCount++ >= (reduced ? 4 : 32)) return;
      const size = Math.min(scale, 40);
      const particle = emit(
        wakeTiles[index]!,
        x,
        0.055,
        z,
        size * (index === 0 ? 1.0 : 0.6),
        index === 0 ? 0.9 : 1.1,
      );
      particle.horizontal = index !== 1;
      particle.angle = angle;
      particle.growth = index === 0 ? size * 1.35 : size * 0.14;
      particle.opacity = index === 4 ? 0.6 : 0.76;
      particle.vy = index === 1 ? 0.15 * size : 0;
      particle.spin = index === 2 || index === 5 ? 0.45 : 0;
    },
    emote(id, x, y, z, scale = 1) {
      if (disposed || !valid(x, y, z, scale) || scale <= 0) return;
      const index = (EMOTE_ITEMS as readonly string[]).indexOf(id);
      if (index < 0) return;
      const size = Math.min(scale, 40);
      const particle = emit(emoteTiles[index]!, x, y, z, size * 1.25, 2.1);
      particle.vy = 0.23 * size;
      particle.growth = size * 0.08;
      if (index === 0) particle.spin = -0.18;
    },
    celebrate(id, x, y, z, scale = 1) {
      if (disposed || !valid(x, y, z, scale) || scale <= 0) return;
      const index = (CELEBRATION_ITEMS as readonly string[]).indexOf(id);
      if (index < 0) return;
      const size = Math.min(scale, 40);
      const count = reduced ? 8 : index === 3 ? 36 : 24;
      for (let item = 0; item < count; item++) {
        const theta = item * 2.399963229728653;
        const radius = 0.3 + (item % 7) * 0.13;
        const tile =
          index === 0
            ? EFFECT_TILES.confetti
            : index === 1
              ? EFFECT_TILES.star
              : index === 2
                ? EFFECT_TILES.bubble
                : EFFECT_TILES.sparkle;
        const particle = emit(tile, x, y, z, size * (index === 2 ? 0.4 : 0.25), index === 2 ? 2.5 : 2.1);
        particle.vx = Math.cos(theta) * radius * size;
        particle.vz = Math.sin(theta) * radius * size;
        particle.vy = (index === 3 ? Math.sin(item * 0.9) * 1.2 + 1.8 : 1.3 + (item % 5) * 0.22) * size;
        particle.gravity = index === 2 ? 0.2 * size : 1.8 * size;
        particle.spin = index === 0 ? (item % 2 ? 1 : -1) * 2.2 : 0.3;
        particle.angle = theta;
        particle.color = index === 0 || index === 3 ? confettiColors[item % confettiColors.length]! : white;
        particle.growth = index === 2 ? size * 0.09 : 0;
      }
    },
    update(time, reducedMotion = false) {
      if (disposed || !Number.isFinite(time) || time < 0 || time > 1e9) return;
      if (!initialized) {
        for (const particle of particles) if (particle.active) particle.born += time;
        initialized = true;
      }
      if (time < now) for (const particle of particles) particle.active = false;
      now = time;
      reduced = reducedMotion;
      let count = 0;
      for (const particle of particles) {
        if (!particle.active) continue;
        const age = now - particle.born;
        if (age >= particle.life) {
          particle.active = false;
          continue;
        }
        const progress = age / particle.life;
        const travel = reduced ? age * 0.12 : age;
        const size = particle.size + particle.growth * (reduced ? Math.min(age, 0.2) : age);
        positions.setXYZW(
          count,
          particle.x + particle.vx * travel,
          Math.max(0.05, particle.y + particle.vy * travel - 0.5 * particle.gravity * travel * travel),
          particle.z + particle.vz * travel,
          size,
        );
        const opacity = particle.opacity * Math.min(1, age * 16 + 0.15) * Math.min(1, (1 - progress) * 3.5);
        styles.setXYZW(
          count,
          particle.angle + particle.spin * travel,
          opacity,
          particle.horizontal ? 1 : 0,
          particle.tile,
        );
        colors.setXYZ(count, ...particle.color);
        count++;
      }
      geometry.instanceCount = count;
      positions.needsUpdate = true;
      styles.needsUpdate = true;
      colors.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.instanceCount = 0;
      geometry.dispose();
      material.dispose();
      atlas.release();
      group.clear();
      group.removeFromParent();
    },
  };
}
