import * as THREE from 'three';
import type { GameMode, Vec2 } from '@supadub/protocol';
import type { FlockBounds } from './body-motion';

export const PRACTICE_REPLAY_HANDOFF_MS = (32 / 60) * 1000;

export type CanvasBounds = { left: number; top: number; width: number; height: number };
export type CameraPresentation = {
  replay?: boolean;
  replayCut?: boolean;
  replayFocus?: Vec2;
  reducedMotion?: boolean;
};

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(37, 16 / 9, 0.1, 1800);
  readonly center = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly aim = new THREE.Vector3();
  private viewport: CanvasBounds = { left: 0, top: 0, width: 1280, height: 720 };
  private replayBlend = 0;
  private flockZoom = 1.08;

  reset(): void {
    this.center.set(0, 0, 0);
    this.replayBlend = 0;
    this.flockZoom = 1.08;
  }
  resize(bounds: CanvasBounds): void {
    this.viewport = {
      left: bounds.left,
      top: bounds.top,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    };
    this.camera.aspect = this.viewport.width / this.viewport.height;
    this.camera.updateProjectionMatrix();
  }
  update(
    mode: GameMode,
    playing: boolean,
    preview: boolean,
    owned: FlockBounds,
    dt: number,
    presentation: CameraPresentation = {},
  ): void {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    const replay = mode === 'practice' && playing && presentation.replay && !presentation.reducedMotion;
    if (mode !== 'practice' || presentation.reducedMotion) {
      this.replayBlend = 0;
    } else if (replay) {
      this.replayBlend = presentation.replayCut
        ? 1
        : Math.min(1, this.replayBlend + (step * 1000) / PRACTICE_REPLAY_HANDOFF_MS);
    } else {
      this.replayBlend = Math.max(0, this.replayBlend - step / 0.7);
    }
    if (mode === 'endless' && playing) {
      this.target.set(owned.x, 0, owned.z);
      this.center.lerp(this.target, 1 - Math.exp(-step * 4.8));
    } else if (replay && presentation.replayFocus) {
      this.target.set(
        THREE.MathUtils.clamp(presentation.replayFocus.x * 0.65, -7.5, 7.5),
        0,
        THREE.MathUtils.clamp(presentation.replayFocus.z * 0.65, -4, 4),
      );
      this.center.lerp(this.target, 1 - Math.exp(-step * 2.4));
    } else if (presentation.reducedMotion && mode === 'practice') this.center.set(0, 0, 0);
    else this.center.lerp(this.target.set(0, 0, 0), 1 - Math.exp(-step * 5));
    const aspect = this.viewport.width / this.viewport.height;
    const distance =
      aspect < 1.15 ? (playing && mode === 'practice' ? 1.42 / aspect : preview ? 1.35 : 1.08) : 1;
    const targetZoom = Math.max(1.08, owned.radius / 7.3, (owned.largestRadius ?? 0) * 0.47);
    if (mode === 'endless' && playing) {
      this.flockZoom = presentation.reducedMotion
        ? targetZoom
        : THREE.MathUtils.lerp(this.flockZoom, targetZoom, 1 - Math.exp(-step * 4.5));
    } else this.flockZoom = 1.08;
    const zoom = playing ? (mode === 'endless' ? this.flockZoom / Math.min(1, this.camera.aspect) : 1.2) : 1;
    const blend = this.replayBlend * this.replayBlend * (3 - 2 * this.replayBlend);
    const practice = mode === 'practice' && playing;
    const fieldOfView = THREE.MathUtils.lerp(practice ? 34.792 : 37, 37, blend);
    if (this.camera.fov !== fieldOfView) {
      this.camera.fov = fieldOfView;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(
      this.center.x,
      THREE.MathUtils.lerp((practice ? 19.5641667 : 17.8) * distance * zoom, 15.4 * distance, blend),
      this.center.z +
        THREE.MathUtils.lerp((practice ? 24.3725 : 22.8) * distance * zoom, 18.2 * distance, blend),
    );
    this.camera.lookAt(
      this.center.x,
      THREE.MathUtils.lerp(practice ? -1.6755 : -0.15, -0.35, blend),
      this.center.z,
    );
    this.camera.updateMatrixWorld();
  }
  worldPoint(x: number, y: number): Vec2 | undefined {
    const rect = this.viewport;
    this.pointer.set(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.waterPlane, this.aim)
      ? { x: this.aim.x, z: this.aim.z }
      : undefined;
  }
  screenPoint(point: Vec2): { x: number; y: number } {
    this.projected.set(point.x, 0, point.z).project(this.camera);
    return {
      x: this.viewport.left + (this.projected.x * 0.5 + 0.5) * this.viewport.width,
      y: this.viewport.top + (-this.projected.y * 0.5 + 0.5) * this.viewport.height,
    };
  }
}
