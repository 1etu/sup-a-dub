import * as THREE from 'three';
import { movementSpeed, WORLD, type PlayerState, type Vec2, type WorldSnapshot } from '@supadub/protocol';
import type { ControlState } from './input';
import type { DuckInstances, GameVisuals, SurfaceVisual } from './visuals';
import { avatarKey } from './avatar-key';

type Avatar = {
  object: THREE.Group;
  appearance: string;
  target: PlayerState;
  x: number;
  z: number;
  path: Vec2[];
  label: HTMLDivElement;
};
type WaterEffects = {
  ripple(x: number, z: number, strength: number): void;
  foam(x: number, z: number, angle: number, strength: number): void;
};

export class PracticeView {
  readonly group = new THREE.Group();
  private readonly avatars = new Map<string, Avatar>();
  private readonly exits = new Map<string, THREE.Group>();
  private readonly projected = new THREE.Vector3();
  private selfId = '';
  private snapshot: WorldSnapshot | null = null;
  private received = 0;
  private lastRipple = 0;
  private playback = false;
  private labelsVisible = true;

  constructor(
    private readonly labels: HTMLElement,
    private readonly visuals: GameVisuals,
    private readonly effects: WaterEffects,
  ) {}
  start(selfId: string): void {
    this.clear();
    this.selfId = selfId;
  }
  point(): Vec2 | undefined {
    return this.avatars.get(this.selfId);
  }
  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) for (const avatar of this.avatars.values()) avatar.label.hidden = true;
  }
  setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    if (!visible) for (const avatar of this.avatars.values()) avatar.label.hidden = true;
  }

  update(snapshot: WorldSnapshot, now: number, playback = false, resetTrail = false): void {
    this.snapshot = snapshot;
    this.received = now;
    this.playback = playback;
    const live = new Set<string>();
    for (const state of snapshot.mode === 'practice' ? snapshot.players : []) {
      live.add(state.id);
      let avatar = this.avatars.get(state.id);
      if (!avatar) {
        const object = this.visuals.create('avatar', { skin: state.skin, loadout: state.loadout });
        const label = document.createElement('div');
        label.className = `duck-label${state.id === this.selfId ? ' own' : ''}`;
        label.textContent = state.id === this.selfId ? 'YOU' : `${state.name}${state.bot ? ' · BOT' : ''}`;
        this.labels.append(label);
        avatar = {
          object,
          appearance: avatarKey(state.skin, state.loadout),
          target: state,
          x: state.x,
          z: state.z,
          path: [],
          label,
        };
        this.avatars.set(state.id, avatar);
        this.group.add(object);
      }
      const appearance = avatarKey(state.skin, state.loadout);
      if (avatar.appearance !== appearance) {
        const object = this.visuals.create('avatar', { skin: state.skin, loadout: state.loadout });
        object.position.copy(avatar.object.position);
        object.rotation.copy(avatar.object.rotation);
        avatar.object.removeFromParent();
        avatar.object = object;
        avatar.appearance = appearance;
        this.group.add(object);
      }
      avatar.target = state;
      if (
        playback ||
        (state.id === this.selfId && Math.hypot(avatar.x - state.x, avatar.z - state.z) > 2.8)
      ) {
        avatar.x = state.x;
        avatar.z = state.z;
      }
      if (playback) avatar.object.rotation.y = state.angle;
      if (resetTrail) avatar.path.length = 0;
    }
    for (const [id, avatar] of this.avatars)
      if (!live.has(id)) {
        avatar.object.removeFromParent();
        avatar.label.remove();
        this.avatars.delete(id);
      }
    const exits = new Set<string>();
    for (const state of snapshot.exits) {
      exits.add(state.id);
      if (this.exits.has(state.id)) continue;
      const exit = this.visuals.create('exit');
      exit.scale.setScalar(2.2);
      exit.position.set(state.x, 0, state.z);
      this.exits.set(state.id, exit);
      this.group.add(exit);
    }
    for (const [id, exit] of this.exits)
      if (!exits.has(id)) {
        exit.removeFromParent();
        this.exits.delete(id);
      }
  }

  effect(strength: number, reducedMotion: boolean): boolean {
    const avatar = this.avatars.get(this.selfId);
    if (!avatar) return false;
    this.effects.ripple(avatar.x, avatar.z, strength);
    if (!reducedMotion) this.effects.foam(avatar.x, avatar.z, avatar.object.rotation.y, strength);
    return true;
  }

  private collide(position: Vec2): void {
    const radius = WORLD.playerRadius;
    if (this.snapshot?.bounds) {
      const bounds = this.snapshot.bounds;
      position.x = THREE.MathUtils.clamp(position.x, bounds.minX + radius, bounds.maxX - radius);
      position.z = THREE.MathUtils.clamp(position.z, bounds.minZ + radius, bounds.maxZ - radius);
    }
    for (const obstacle of this.snapshot?.obstacles ?? []) {
      const x = THREE.MathUtils.clamp(
        position.x,
        obstacle.x - obstacle.width / 2,
        obstacle.x + obstacle.width / 2,
      );
      const z = THREE.MathUtils.clamp(
        position.z,
        obstacle.z - obstacle.depth / 2,
        obstacle.z + obstacle.depth / 2,
      );
      const dx = position.x - x,
        dz = position.z - z,
        distance = Math.hypot(dx, dz);
      if (distance > 0 && distance < radius) {
        position.x += (dx / distance) * (radius - distance);
        position.z += (dz / distance) * (radius - distance);
      }
    }
  }

  predict(time: number, dt: number, input: ControlState, active: boolean, reducedMotion: boolean): void {
    const self = this.avatars.get(this.selfId);
    if (!self || this.playback || !active || time - this.received >= 1) return;
    const speed = movementSpeed(0, false);
    self.x += input.x * speed * dt;
    self.z += input.z * speed * dt;
    const lag = Math.min(0.16, time - this.received),
      correction = 1 - Math.exp(-dt * 7);
    self.x += (self.target.x + input.x * speed * lag - self.x) * correction;
    self.z += (self.target.z + input.z * speed * lag - self.z) * correction;
    this.collide(self);
    if (Math.hypot(input.x, input.z) > 0.1 && time - this.lastRipple > 0.17) {
      this.effects.ripple(self.x, self.z, input.boost ? 0.9 : 0.35);
      if (!reducedMotion)
        this.effects.foam(self.x, self.z, Math.atan2(input.x, input.z), input.boost ? 0.8 : 0.25);
      this.lastRipple = time;
    }
  }

  render(
    time: number,
    dt: number,
    input: ControlState,
    active: boolean,
    reducedMotion: boolean,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    babies: DuckInstances,
    surface: SurfaceVisual,
  ): { babyCount: number; surfaceCount: number } {
    let babyCount = 0,
      surfaceCount = 0;
    for (const [id, avatar] of this.avatars) {
      if (!this.playback && (id !== this.selfId || !active)) {
        const alpha = 1 - Math.exp(-dt * 10);
        avatar.x += (avatar.target.x - avatar.x) * alpha;
        avatar.z += (avatar.target.z - avatar.z) * alpha;
      }
      avatar.object.position.set(avatar.x, 0.02 + Math.sin(time * 2.5 + avatar.x) * 0.035, avatar.z);
      const desired =
        active && !this.playback && id === this.selfId && Math.hypot(input.x, input.z) > 0.1
          ? Math.atan2(input.x, input.z)
          : avatar.target.angle;
      const delta = Math.atan2(
        Math.sin(desired - avatar.object.rotation.y),
        Math.cos(desired - avatar.object.rotation.y),
      );
      if (!this.playback) avatar.object.rotation.y += delta * (1 - Math.exp(-dt * 12));
      avatar.object.rotation.z = reducedMotion ? 0 : Math.sin(time * 3.6 + avatar.z) * 0.027;
      avatar.object.scale.setScalar(1);
      surface.set(surfaceCount++, avatar.x, avatar.z, 0.93);
      if (
        !avatar.path.length ||
        Math.hypot(avatar.path[0]!.x - avatar.x, avatar.path[0]!.z - avatar.z) > 0.09
      ) {
        avatar.path.unshift({ x: avatar.x, z: avatar.z });
        if (avatar.path.length > 220) avatar.path.length = 220;
      }
      let last = { x: avatar.x, z: avatar.z };
      const chain = Math.min(avatar.target.chain, 18);
      for (let index = 0; index < chain && babyCount < 450; index++) {
        const point = avatar.path[Math.min(avatar.path.length - 1, (index + 1) * 7)] ?? last;
        const fallback = avatar.path.length < (index + 1) * 7;
        const x = fallback ? last.x - Math.sin(avatar.object.rotation.y) * 0.72 : point.x;
        const z = fallback ? last.z - Math.cos(avatar.object.rotation.y) * 0.72 : point.z;
        babies.set(
          babyCount++,
          x,
          z,
          Math.atan2(last.x - x, last.z - z),
          0.45,
          Math.sin(time * 3.2 + index) * 0.025,
        );
        surface.set(surfaceCount++, x, z, 0.4);
        last = { x, z };
      }
      this.projected.set(avatar.x, 1.65, avatar.z).project(camera);
      const visible =
        Math.abs(this.projected.x) < 1.05 &&
        Math.abs(this.projected.y) < 1.05 &&
        this.projected.z < 1 &&
        this.group.visible &&
        this.labelsVisible;
      avatar.label.hidden = !visible;
      if (visible)
        avatar.label.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * width}px,${(-this.projected.y * 0.5 + 0.5) * height}px) translate(-50%,-100%)`;
    }
    for (const exit of this.exits.values()) {
      const ball = exit.children[2];
      if (ball) ball.position.y = 0.86 + Math.sin(time * 2) * 0.045;
    }
    return { babyCount, surfaceCount };
  }

  clear(): void {
    for (const avatar of this.avatars.values()) avatar.label.remove();
    this.group.clear();
    this.avatars.clear();
    this.exits.clear();
    this.snapshot = null;
    this.playback = false;
    this.received = 0;
    this.lastRipple = 0;
  }
  dispose(): void {
    this.clear();
    this.group.removeFromParent();
  }
}
