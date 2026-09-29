import * as THREE from 'three';
import type { GameMode, WorldSnapshot } from '@supadub/protocol';
import type { ControlState } from './input';
import type {
  GameVisuals,
  PoolTheme,
  PoolVisual,
  BackdropVisual,
  DuckInstances,
  BubbleInstances,
  BubblePops,
  SharkInstances,
  SurfaceVisual,
  PictureVisual,
  FoamVisual,
  AwardVisual,
  EnvironmentVisual,
  CosmeticEffects,
} from './visuals';
import { WebGLBackend, FrameBudget, RenderPipeline, ObjectOverlay } from '@supadub/graphics';
import { Bodies } from './bodies';
import { CameraRig, PRACTICE_REPLAY_HANDOFF_MS } from './camera-rig';
import { PracticeView } from './practice-view';
import { PracticeReplay, type PracticeReplaySample, type PracticeReplayStatus } from './practice-replay';
import { PreviewRenderer } from './preview-renderer';
import { BubbleRemovals } from './bubble-removals';

export type GraphicsQuality = 'auto' | 'high' | 'low';

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private readonly rig = new CameraRig();
  readonly camera = this.rig.camera;
  readonly pool: PoolVisual;
  private readonly backend: WebGLBackend;
  private readonly pipeline = new RenderPipeline<{ playing: boolean; time: number }>();
  private readonly animation: {
    readonly captive: Readonly<{ radius: number; centerHeight: number; duckScale: number }>;
    update(time: number): void;
    captiveHeight(radius?: number, scale?: number): number;
  };
  private backdrop: BackdropVisual;
  private babies: DuckInstances;
  private bubbles: BubbleInstances;
  private readonly bubblePops: BubblePops;
  private readonly bubbleRemovals = new BubbleRemovals();
  private popCount = 0;
  private sharks: SharkInstances;
  private pellets: DuckInstances;
  private surface: SurfaceVisual;
  private bodies: Bodies;
  private picture: PictureVisual;
  private softPicture = true;
  private readonly practice: PracticeView;
  private readonly replay = new PracticeReplay();
  private readonly preview: PreviewRenderer;
  private foam: FoamVisual;
  private readonly cosmetics: CosmeticEffects;
  private lastWake = 0;
  private readonly wakePositions = new Map<string, { x: number; z: number }>();
  private environment: THREE.WebGLRenderTarget;
  private skyTexture: THREE.Texture;
  private readonly awardEnvironment: EnvironmentVisual;
  private readonly awardOverlay: ObjectOverlay;
  private award?: AwardVisual;
  private awardGrade?: 'gold' | 'silver' | 'bronze';
  private awardPose: { x: number; y: number; diameter: number; time: number } | null = null;
  private mode: GameMode = 'endless';
  private screen = 'main';
  private selfId = '';
  private snapshot: WorldSnapshot | null = null;
  private playbackSnapshot: WorldSnapshot | null = null;
  private replayTransition = false;
  private replayTransitionMs = 0;
  private quality: GraphicsQuality = 'auto';
  private reducedMotion = false;
  private readonly frameBudget = new FrameBudget(90);
  private lastRenderTime = 0;
  private lastFpsUpdate = 0;
  private autoDpr = Math.min(devicePixelRatio, 1.5);
  private width = 1280;
  private height = 720;
  fps = 60;
  drawCalls = 0;
  triangles = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private labels: HTMLElement,
    private readonly visuals: GameVisuals,
  ) {
    this.backend = new WebGLBackend(canvas, { pixelRatio: this.autoDpr });
    this.renderer = this.backend.renderer;
    this.pool = visuals.create('pool');
    this.backdrop = visuals.create('backdrop');
    this.babies = visuals.create('ducks', 1200);
    this.bubbles = visuals.create('bubbles', 1200);
    this.bubblePops = visuals.create('bubble-pop', 32);
    this.sharks = visuals.create('sharks', 64);
    this.pellets = visuals.create('ducks', 4096, 'yellow', 'low', true);
    this.surface = visuals.create('surface', 1800);
    this.picture = visuals.create('picture');
    this.foam = visuals.create('foam');
    this.cosmetics = visuals.create('cosmetic-effects', 256);
    this.animation = visuals.create('animation');
    this.bodies = new Bodies(labels, visuals);
    this.practice = new PracticeView(labels, visuals, {
      ripple: (x, z, strength) => this.pool.ripple(x, z, strength),
      foam: (x, z, angle, strength) => this.foam.spawn(x, z, angle, strength),
    });
    this.preview = new PreviewRenderer(canvas, this.scene, visuals);
    const hemisphere = new THREE.HemisphereLight(0xe7f6ff, 0x9d92b9, 1.0);
    const key = new THREE.DirectionalLight(0xfff9ec, 1.8);
    key.position.set(-12, 25, 9);
    const fill = new THREE.DirectionalLight(0xcedcff, 0.5);
    fill.position.set(10, 8, -15);
    this.scene.add(
      hemisphere,
      key,
      fill,
      this.pool.group,
      this.babies.group,
      this.bubbles.group,
      this.bubblePops.group,
      this.surface.mesh,
      this.foam.points,
      this.cosmetics.group,
      this.practice.group,
      this.bodies.group,
      this.pellets.group,
      this.sharks.group,
    );
    const sky = visuals.create('sky', this.renderer);
    this.environment = sky.environment;
    this.skyTexture = sky.sky;
    this.pool.setSky(sky.sky);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.8;
    this.awardEnvironment = visuals.create('award-environment', this.renderer);
    this.awardOverlay = new ObjectOverlay({
      environment: this.awardEnvironment.texture,
      environmentIntensity: this.awardEnvironment.intensity,
    });
    this.pipeline
      .add('reflections', {
        render: ({ playing }) => {
          this.renderer.info.reset();
          if (playing) this.pool.capture(this.renderer, this.scene, this.camera);
        },
      })
      .add('world', {
        render: ({ playing, time }) => {
          this.renderer.setRenderTarget(this.picture.target);
          this.renderer.clear();
          this.renderer.render(this.backdrop.scene, this.backdrop.camera);
          this.renderer.clearDepth();
          if (playing) this.renderer.render(this.scene, this.camera);
          if (this.preview.group.visible) this.preview.render(this.renderer, time, this.reducedMotion);
        },
      })
      .add('award', {
        render: () => {
          if (!this.award || !this.awardPose) return;
          this.award.update(this.awardPose.time, this.reducedMotion);
          this.awardOverlay.render(this.renderer, this.width, this.height, this.awardPose);
        },
      })
      .add('finish', { render: () => this.picture.render(this.renderer, this.softPicture) });
    this.resize();
    this.pool.prepare?.(this.renderer, this.scene, this.camera, this.picture.target);
  }

  setScreen(screen: string) {
    const previous = this.screen;
    this.screen = screen;
    if (screen !== 'results') this.setAward(null);
    if (screen !== 'results') this.endReplayTransition();
    if (this.mode === 'practice' && screen === 'results' && previous !== 'results') this.restartReplay();
    else if (screen !== 'results' && this.replay.status.playing) {
      this.replay.stop();
      this.playbackSnapshot = null;
      if (this.snapshot) {
        this.practice.update(this.snapshot, this.lastRenderTime);
        this.pool.setObstacles(this.snapshot.obstacles);
      }
    }
    if (['main', 'title', 'tub', 'duck'].includes(screen)) this.clearReplay();
    this.preview.setVisible(['duck', 'collection', 'profile'].includes(screen));
    const gameplay = ['playing', 'pause', 'results', 'success'].includes(screen);
    this.pool.group.visible = gameplay;
    this.babies.group.visible = gameplay;
    this.bubbles.group.visible = gameplay;
    this.bubblePops.group.visible = gameplay;
    this.surface.mesh.visible = gameplay;
    this.foam.points.visible = gameplay;
    this.cosmetics.group.visible = gameplay;
    this.bodies.group.visible = gameplay && this.mode === 'endless';
    this.sharks.group.visible = gameplay && this.mode === 'endless';
    this.pellets.group.visible = gameplay && this.mode === 'endless';
    this.practice.setVisible(gameplay && this.mode === 'practice');
    const practiceLabels = !['success', 'results'].includes(screen);
    this.practice.setLabelsVisible(practiceLabels);
    this.labels.hidden = !gameplay || (this.mode === 'practice' && !practiceLabels);
    if (!gameplay) this.rig.reset();
  }

  setQuality(quality: GraphicsQuality, reducedMotion: boolean) {
    this.quality = quality;
    this.reducedMotion = reducedMotion;
    if (reducedMotion) this.endReplayTransition();
    this.renderer.setPixelRatio(
      quality === 'high' ? Math.min(2, devicePixelRatio) : quality === 'low' ? 1 : this.autoDpr,
    );
    this.resize();
  }

  setTheme(theme: PoolTheme) {
    this.pool.setTheme(theme);
  }

  setSoftness(value: boolean) {
    this.softPicture = value;
  }

  worldPoint(x: number, y: number) {
    return this.rig.worldPoint(x, y);
  }

  start(mode: GameMode, id: string) {
    this.clearReplay();
    this.bodies.clear();
    this.practice.start(id);
    this.mode = mode;
    this.selfId = id;
    this.snapshot = null;
    this.bubblePops.clear();
    this.bubbleRemovals.clear();
    this.popCount = 0;
    this.wakePositions.clear();
    this.pool.setFinite(mode === 'practice');
    this.pool.setObstacles([]);
    this.rig.reset();
    this.setScreen('playing');
  }

  updateSnapshot(snapshot: WorldSnapshot, now: number) {
    this.snapshot = snapshot;
    if (snapshot.mode === 'practice') {
      this.replay.record(snapshot);
      if (this.screen === 'results' && !this.replay.status.playing) this.restartReplay();
      if (this.replay.status.playing) return;
    }
    this.playbackSnapshot = null;
    this.popBubbles(snapshot);
    this.pool.setObstacles(snapshot.obstacles);
    if (snapshot.mode === 'endless')
      this.bodies.update(snapshot.bodies ?? [], snapshot.players, this.selfId, now, snapshot.time);
    this.practice.update(snapshot, now);
  }

  emote(playerId: string, itemId: string): void {
    const player = this.snapshot?.players.find((entry) => entry.id === playerId);
    if (!player) return;
    const largest = this.snapshot?.bodies
      ?.filter((body) => body.ownerId === playerId)
      .sort((a, b) => b.mass - a.mass)[0];
    const scale = largest ? Math.min(3, largest.radius / 0.62) : 1;
    this.cosmetics.emote(itemId, largest?.x ?? player.x, scale * 1.9, largest?.z ?? player.z, scale);
  }

  private popBubbles(snapshot: WorldSnapshot): void {
    const captive = this.animation.captive;
    for (const duck of this.bubbleRemovals.update(snapshot, this.selfId)) {
      const bob = this.reducedMotion
        ? 0
        : Math.sin(this.lastRenderTime * 1.7 + duck.x * 0.7 + duck.z) * 0.045;
      this.bubblePops.pop(
        duck.x,
        captive.centerHeight + bob,
        duck.z,
        captive.radius,
        snapshot.tick + duck.x * 13 + duck.z * 7,
      );
      this.pool.ripple(duck.x, duck.z, this.reducedMotion ? 0.12 : 0.4);
      this.popCount++;
    }
  }

  get bubblePopResources(): Readonly<Record<string, number>> {
    return { ...this.bubblePops.resources, totalPops: this.popCount };
  }

  celebrate(): void {
    const player = this.snapshot?.players.find((entry) => entry.id === this.selfId);
    if (player?.loadout?.celebration)
      this.cosmetics.celebrate(player.loadout.celebration, player.x, 1.5, player.z);
  }

  private updateCosmetics(time: number): void {
    this.cosmetics.update(time, this.reducedMotion);
    if (this.reducedMotion || !this.cosmetics.group.visible || time - this.lastWake < 0.16) return;
    this.lastWake = time;
    const players = this.snapshot?.players ?? [];
    const live = new Set(players.map((player) => player.id));
    for (const id of this.wakePositions.keys()) if (!live.has(id)) this.wakePositions.delete(id);
    for (const player of players.slice(0, 32)) {
      const previous = this.wakePositions.get(player.id);
      if (previous && player.loadout?.wake && Math.hypot(player.x - previous.x, player.z - previous.z) > 0.04)
        this.cosmetics.wake(player.loadout.wake, player.x, player.z, player.angle);
      this.wakePositions.set(player.id, { x: player.x, z: player.z });
    }
  }

  get replayStatus(): PracticeReplayStatus {
    return this.replay.status;
  }

  restartReplay(): boolean {
    if (this.mode !== 'practice' || this.screen !== 'results' || !this.replay.start()) return false;
    this.bubblePops.clear();
    this.bubbleRemovals.clear();
    this.endReplayTransition();
    if (
      !this.reducedMotion &&
      this.picture.beginTransition &&
      this.picture.setTransition &&
      this.picture.endTransition
    ) {
      this.picture.beginTransition(this.renderer);
      this.picture.setTransition(0);
      this.replayTransition = true;
    }
    const frame = this.replay.advance(0);
    if (frame) this.presentReplay(frame, this.lastRenderTime);
    return true;
  }

  clearReplay(): void {
    this.bubblePops.clear();
    this.bubbleRemovals.clear();
    this.endReplayTransition();
    this.replay.clear();
    this.playbackSnapshot = null;
  }

  private endReplayTransition(): void {
    if (this.replayTransition) this.picture.endTransition?.();
    this.replayTransition = false;
    this.replayTransitionMs = 0;
  }

  private presentReplay(frame: PracticeReplaySample, time: number): void {
    if (this.playbackSnapshot?.obstacles !== frame.snapshot.obstacles)
      this.pool.setObstacles(frame.snapshot.obstacles);
    this.playbackSnapshot = frame.snapshot;
    if (frame.resetTrail) {
      this.bubblePops.clear();
      this.bubbleRemovals.clear();
    }
    this.popBubbles(frame.snapshot);
    this.practice.update(frame.snapshot, time, true, frame.resetTrail);
  }

  effect(strength = 1) {
    if (!this.practice.effect(strength, this.reducedMotion) && this.mode === 'endless') {
      const point = this.bodies.center();
      this.pool.ripple(point.x, point.z, strength);
      if (!this.reducedMotion) this.foam.spawn(point.x, point.z, 0, strength);
    }
  }

  playerScreenPosition() {
    const point = this.practice.point() ?? (this.mode === 'endless' ? this.bodies.center() : undefined);
    return point ? this.rig.screenPoint(point) : undefined;
  }

  render(time: number, dt: number, input: ControlState) {
    const frameDuration = this.lastRenderTime ? time - this.lastRenderTime : dt;
    this.lastRenderTime = time;
    const playing = ['playing', 'pause', 'results', 'success'].includes(this.screen);
    const menu = !playing;
    const replayCut = this.replayTransition;
    if (this.replayTransition) {
      const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      this.replayTransitionMs += step * 1000;
      this.picture.setTransition?.(Math.min(1, this.replayTransitionMs / PRACTICE_REPLAY_HANDOFF_MS));
      if (this.replayTransitionMs >= PRACTICE_REPLAY_HANDOFF_MS) this.endReplayTransition();
    }
    if (this.screen === 'results' && this.mode === 'practice') {
      const frame = this.replay.advance(dt);
      if (frame) this.presentReplay(frame, time);
    }
    const visualSnapshot = this.playbackSnapshot ?? this.snapshot;
    this.backdrop.update(time, menu, this.width / this.height, this.reducedMotion);
    this.animation.update(time);
    this.practice.predict(time, dt, input, this.screen === 'playing', this.reducedMotion);
    const owned = this.bodies.animate(time, dt, input, this.screen === 'playing', this.reducedMotion);
    this.rig.update(this.mode, playing, this.preview.group.visible, owned, dt, {
      replay: this.screen === 'results' && this.replay.status.playing,
      replayCut,
      replayFocus: this.practice.point(),
      reducedMotion: this.reducedMotion,
    });
    this.pool.update(time, { x: this.rig.center.x, z: this.rig.center.z }, this.reducedMotion);
    this.bodies.render(this.camera, this.width, this.height, time, this.reducedMotion);
    const counts = this.practice.render(
      time,
      dt,
      input,
      this.screen === 'playing',
      this.reducedMotion,
      this.camera,
      this.width,
      this.height,
      this.babies,
      this.surface,
    );
    let babyCount = counts.babyCount;
    let surfaceCount = counts.surfaceCount;
    let bubbleCount = 0;
    const captive = this.animation.captive;
    for (const duck of visualSnapshot?.ducks ?? []) {
      if (babyCount >= 1200 || bubbleCount >= 1200) break;
      const bob = this.reducedMotion ? 0 : Math.sin(time * 1.7 + duck.x * 0.7 + duck.z) * 0.045;
      this.babies.set(
        babyCount++,
        duck.x,
        duck.z,
        Math.sin(duck.x + duck.z) * 2 + time * 0.12,
        captive.duckScale,
        this.animation.captiveHeight(captive.radius, captive.duckScale) + bob,
      );
      this.bubbles.set(bubbleCount++, duck.x, captive.centerHeight + bob, duck.z, captive.radius);
      this.surface.set(surfaceCount++, duck.x, duck.z, 0.49);
    }
    this.babies.commit(babyCount);
    this.bubbles.commit(bubbleCount, this.camera);
    this.surface.commit(surfaceCount, this.reducedMotion ? 0 : time);
    this.foam.update(dt, this.height * this.renderer.getPixelRatio());
    this.bubblePops.update(time, this.reducedMotion);
    this.updateCosmetics(time);
    let sharkCount = 0;
    for (const shark of visualSnapshot?.sharks ?? [])
      this.sharks.set(sharkCount++, shark.x, shark.z, Math.atan2(shark.vx, shark.vz), shark.radius / 0.98, {
        time: this.reducedMotion ? 0 : time,
        charge: shark.feedCount / 7,
        launched: shark.launchUntil > (visualSnapshot?.time ?? 0),
      });
    this.sharks.commit(sharkCount);
    let pelletCount = 0;
    for (const pellet of visualSnapshot?.pellets ?? [])
      this.pellets.set(pelletCount++, pellet.x, pellet.z, Math.atan2(pellet.vx, pellet.vz), 0.26, 0.03);
    this.pellets.commit(pelletCount);
    this.pipeline.render({ playing, time });
    this.drawCalls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
    this.frameBudget.sample(frameDuration);
    if (time - this.lastFpsUpdate >= 0.5 && this.frameBudget.count >= 10) {
      this.fps = Math.round(this.frameBudget.fps);
      if (this.quality === 'auto' && this.fps < 42 && this.autoDpr > 1) {
        this.autoDpr = Math.max(1, this.autoDpr - 0.25);
        this.endReplayTransition();
        this.renderer.setPixelRatio(this.autoDpr);
        this.renderer.setSize(this.width, this.height, false);
        this.picture.resize(
          this.width * this.renderer.getPixelRatio(),
          this.height * this.renderer.getPixelRatio(),
        );
      }
      this.lastFpsUpdate = time;
    }
  }

  resize() {
    this.endReplayTransition();
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.rig.resize(rect);
    this.preview.resize(rect);
    this.renderer.setSize(this.width, this.height, false);
    this.picture.resize(
      this.width * this.renderer.getPixelRatio(),
      this.height * this.renderer.getPixelRatio(),
    );
  }

  setAward(grade: 'gold' | 'silver' | 'bronze' | null): void {
    if (this.awardGrade === (grade ?? undefined)) return;
    this.awardOverlay.setObject(null);
    this.award?.dispose();
    this.award = undefined;
    this.awardGrade = grade ?? undefined;
    this.awardPose = null;
    if (grade) {
      this.award = this.visuals.create('award', grade);
      this.awardOverlay.setObject(this.award.object);
      this.awardOverlay.prepare(this.renderer, this.picture.target);
    }
  }

  setAwardPose(pose: { x: number; y: number; diameter: number; time: number } | null): void {
    this.awardPose = pose;
  }

  dispose() {
    this.setAward(null);
    this.awardOverlay.dispose();
    this.awardEnvironment.dispose();
    this.clearReplay();
    this.practice.dispose();
    this.preview.dispose();
    this.pool.dispose();
    this.backdrop.dispose();
    this.babies.dispose();
    this.bubbles.dispose();
    this.bubblePops.dispose();
    this.surface.dispose();
    this.foam.dispose();
    this.cosmetics.dispose();
    this.environment.dispose();
    this.skyTexture.dispose();
    this.bodies.dispose();
    this.sharks.dispose();
    this.pellets.dispose();
    this.picture.dispose();
    this.pipeline.dispose();
    this.backend.dispose();
  }
}
