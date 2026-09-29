import type { GameVisuals, DuckDetail, AvatarInstances, AvatarLoadout } from './visuals';
import { avatarKey } from './avatar-key';
import * as THREE from 'three';
import { ENDLESS, SKINS, type BodyState, type PlayerState, type Vec2 } from '@supadub/protocol';
import type { ControlState } from './input';
import { BodyMotion, type VisualBody } from './body-motion';

type Batch = { instances: AvatarInstances; capacity: number; lastUsed: number };
type DrawGroup = {
  skin: BodyState['skin'];
  detail: DuckDetail;
  loadout?: AvatarLoadout;
  bodies: VisualBody[];
};
export const BODY_BATCH_LIMIT = ENDLESS.hardBodyLimit * 2 + SKINS.length * 3 * 8;
const IDLE_SECONDS = 15;
export function bodyBatchCapacity(count: number): number {
  return Math.min(ENDLESS.hardBodyLimit, Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, count)))));
}

export class Bodies {
  readonly group = new THREE.Group();
  private readonly motion = new BodyMotion();
  private readonly batches = new Map<string, Batch>();
  private readonly draws = new Map<string, DrawGroup>();
  private readonly labels = new Map<string, HTMLDivElement>();
  private players = new Map<string, PlayerState>();
  private readonly projected = new THREE.Vector3();
  private selfId = '';
  private disposed = false;

  constructor(
    private readonly labelRoot: HTMLElement,
    private readonly visuals: GameVisuals,
  ) {}

  update(states: BodyState[], players: PlayerState[], selfId: string, now: number, serverTime: number): void {
    this.selfId = selfId;
    this.players = new Map(players.map((player) => [player.id, player]));
    this.motion.update(states, selfId, now, serverTime);
    const owners = new Set([...this.motion.bodies.values()].map((body) => body.state.ownerId));
    for (const [id, label] of this.labels)
      if (!owners.has(id)) {
        label.remove();
        this.labels.delete(id);
      }
  }

  animate(time: number, dt: number, input: ControlState, active: boolean, _reducedMotion: boolean) {
    return this.motion.animate(time, dt, input, active);
  }

  private release(key: string): void {
    this.batches.get(key)?.instances.dispose();
    this.batches.delete(key);
  }

  private prepare(time: number): void {
    for (const [key, batch] of this.batches)
      if (!this.draws.get(key)?.bodies.length && time - batch.lastUsed >= IDLE_SECONDS) this.release(key);
    let reserved = 0;
    for (const [key, batch] of this.batches)
      reserved += Math.max(batch.capacity, bodyBatchCapacity(this.draws.get(key)?.bodies.length ?? 0));
    for (const [key, draw] of this.draws)
      if (draw.bodies.length && !this.batches.has(key)) reserved += bodyBatchCapacity(draw.bodies.length);
    if (reserved > BODY_BATCH_LIMIT) {
      for (const [key, batch] of this.batches) {
        const count = this.draws.get(key)?.bodies.length ?? 0;
        if (!count || batch.capacity > bodyBatchCapacity(count)) this.release(key);
      }
    }
    for (const [key, draw] of this.draws) {
      if (!draw.bodies.length) continue;
      const capacity = bodyBatchCapacity(draw.bodies.length);
      let batch = this.batches.get(key);
      if (batch && batch.capacity < capacity) {
        this.release(key);
        batch = undefined;
      }
      if (!batch) {
        batch = {
          instances: this.visuals.create('avatars', capacity, draw.skin, draw.detail, draw.loadout),
          capacity,
          lastUsed: time,
        };
        this.batches.set(key, batch);
        this.group.add(batch.instances.group);
      }
      batch.lastUsed = time;
    }
  }

  render(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    time: number,
    reducedMotion: boolean,
  ): void {
    if (this.disposed) return;
    for (const draw of this.draws.values()) draw.bodies.length = 0;
    const owners = new Map<string, VisualBody>();
    const projectionScale = (1.45 * height) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5));
    for (const body of this.motion.bodies.values()) {
      const state = body.state;
      const pixels =
        ((state.radius / 0.62) * projectionScale) /
        camera.position.distanceTo(this.projected.set(body.x, 0, body.z));
      const detail: DuckDetail = pixels > 90 ? 'high' : pixels > 35 ? 'medium' : 'low';
      const loadout = detail === 'low' ? undefined : this.players.get(state.ownerId)?.loadout;
      const key = `${avatarKey(state.skin, loadout)}:${detail}`;
      let draw = this.draws.get(key);
      if (!draw) {
        draw = { skin: state.skin, detail, loadout, bodies: [] };
        this.draws.set(key, draw);
      }
      draw.bodies.push(body);
      if (!owners.has(state.ownerId) || owners.get(state.ownerId)!.state.mass < state.mass)
        owners.set(state.ownerId, body);
    }
    this.prepare(time);
    for (const [key, batch] of this.batches) {
      const bodies = this.draws.get(key)?.bodies ?? [];
      for (const [index, body] of bodies.entries())
        batch.instances.set(
          index,
          body.x,
          body.z,
          body.angle,
          body.state.radius / 0.62,
          reducedMotion ? 0 : Math.sin(time * 2.5 + body.x) * 0.026,
        );
      batch.instances.commit(bodies.length);
      batch.instances.update(time, reducedMotion);
    }
    for (const [key, draw] of this.draws)
      if (!draw.bodies.length && !this.batches.has(key)) this.draws.delete(key);
    for (const [id, body] of owners) {
      let label = this.labels.get(id);
      if (!label) {
        label = document.createElement('div');
        label.className = `duck-label${id === this.selfId ? ' own' : ''}`;
        this.labelRoot.append(label);
        this.labels.set(id, label);
      }
      const player = this.players.get(id);
      const text = id === this.selfId ? 'YOU' : `${player?.name ?? 'Duck'}${player?.bot ? ' · BOT' : ''}`;
      if (label.textContent !== text) label.textContent = text;
      this.projected.set(body.x, (body.state.radius / 0.62) * 1.65, body.z).project(camera);
      label.hidden =
        Math.abs(this.projected.x) > 1.04 ||
        Math.abs(this.projected.y) > 1.04 ||
        this.projected.z > 1 ||
        !this.group.visible;
      if (!label.hidden)
        label.style.transform = `translate(${(this.projected.x * 0.5 + 0.5) * width}px,${(-this.projected.y * 0.5 + 0.5) * height}px) translate(-50%,-100%)`;
    }
  }

  center(): Vec2 {
    return this.motion.center();
  }
  get resources() {
    return {
      bodies: this.motion.bodies.size,
      batches: this.batches.size,
      instanceSlots: [...this.batches.values()].reduce((sum, batch) => sum + batch.capacity, 0),
    };
  }
  clear(): void {
    this.motion.clear();
    this.players.clear();
    for (const label of this.labels.values()) label.remove();
    this.labels.clear();
    for (const key of this.batches.keys()) this.release(key);
    this.draws.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.group.removeFromParent();
  }
}
