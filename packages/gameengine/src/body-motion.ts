import { bodySpeed, ENDLESS, type BodyState, type Vec2 } from '@supadub/protocol';
import type { ControlState } from './input';

export type VisualBody = { state: BodyState; x: number; z: number; angle: number };
export type FlockBounds = Vec2 & { radius: number };

export class BodyMotion {
  readonly bodies = new Map<string, VisualBody>();
  private received = 0;
  private serverTime = 0;
  private selfId = '';
  private bounds: FlockBounds = { x: 0, z: 0, radius: 8 };

  update(states: readonly BodyState[], selfId: string, now: number, serverTime: number): void {
    this.received = now;
    this.serverTime = serverTime;
    this.selfId = selfId;
    const live = new Set<string>();
    for (const state of states.slice(0, ENDLESS.hardBodyLimit)) {
      live.add(state.id);
      const body = this.bodies.get(state.id);
      if (body) body.state = state;
      else this.bodies.set(state.id, { state, x: state.x, z: state.z, angle: state.angle });
    }
    for (const id of this.bodies.keys()) if (!live.has(id)) this.bodies.delete(id);
  }

  animate(time: number, dt: number, input: ControlState, active: boolean): FlockBounds {
    const lag = Math.min(0.16, Math.max(0, time - this.received));
    const alpha = 1 - Math.exp(-dt * 15);
    const turn = 1 - Math.exp(-dt * 14);
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const body of this.bodies.values()) {
      const state = body.state;
      let vx = state.vx,
        vz = state.vz;
      if (
        state.ownerId === this.selfId &&
        active &&
        time - this.received < 0.6 &&
        state.launchUntil <= this.serverTime
      ) {
        let x = input.x,
          z = input.z;
        if (input.target) {
          x = input.target.x - state.x;
          z = input.target.z - state.z;
          const length = Math.hypot(x, z);
          if (length > 0.2) {
            x /= Math.max(1, length);
            z /= Math.max(1, length);
          } else {
            x = 0;
            z = 0;
          }
        }
        vx = x * bodySpeed(state.mass);
        vz = z * bodySpeed(state.mass);
      }
      body.x += (state.x + vx * lag - body.x) * alpha;
      body.z += (state.z + vz * lag - body.z) * alpha;
      const desired = Math.hypot(vx, vz) > 0.05 ? Math.atan2(vx, vz) : state.angle;
      body.angle += Math.atan2(Math.sin(desired - body.angle), Math.cos(desired - body.angle)) * turn;
      if (state.ownerId === this.selfId) {
        minX = Math.min(minX, body.x - state.radius);
        maxX = Math.max(maxX, body.x + state.radius);
        minZ = Math.min(minZ, body.z - state.radius);
        maxZ = Math.max(maxZ, body.z + state.radius);
      }
    }
    if (Number.isFinite(minX))
      this.bounds = {
        x: (minX + maxX) / 2,
        z: (minZ + maxZ) / 2,
        radius: Math.max(8, Math.hypot(maxX - minX, maxZ - minZ) * 0.5 + 3),
      };
    return this.bounds;
  }

  center(): FlockBounds {
    return this.bounds;
  }
  clear(): void {
    this.bodies.clear();
    this.bounds = { x: 0, z: 0, radius: 8 };
  }
}
