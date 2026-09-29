import * as THREE from 'three';
import { WebGLBackend } from '@supadub/graphics';
import type { GameVisuals, BackdropVisual, MenuTiming, AvatarLoadout } from './visuals';
import { MenuPreviews } from './menu-previews';

export interface MenuRowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
}

export interface MenuArtwork {
  rows: HTMLCanvasElement;
  chrome: HTMLCanvasElement;
  rowBounds: MenuRowBounds[];
  arrows?: HTMLCanvasElement;
  caret?: MenuRowBounds;
  normalizedRows?: boolean;
  selectionKey?: string;
  previews?: readonly MenuPreview[];
  scroll?: MenuScrollArtwork;
}

export interface MenuRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MenuPreview {
  skin: string;
  loadout?: AvatarLoadout;
  viewport: MenuRect;
  scrollId?: string;
}

export interface MenuScrollArtwork {
  id: string;
  viewport: MenuRect;
  contentSize: { width: number; height: number };
  scrollUnit: { x: number; y: number };
  initialOffset: { x: number; y: number };
  maxOffset: { x: number; y: number };
  tiles: readonly { canvas: HTMLCanvasElement; top: number; height: number }[];
}

type NextArtwork = MenuArtwork | void;

const emptyCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas;
};

const ease = (start: number, end: number, value: number): number => {
  const fraction = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return fraction * fraction * (3 - 2 * fraction);
};

export class MenuMotion {
  readonly canvas: HTMLCanvasElement;
  onError?: (error: unknown) => void;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly backdrop: BackdropVisual;
  private readonly backend: WebGLBackend;
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, samples: 2 });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly blank = new THREE.CanvasTexture(emptyCanvas());
  private readonly material: THREE.ShaderMaterial;
  private readonly timing: MenuTiming;
  private rows?: THREE.CanvasTexture;
  private chrome?: THREE.CanvasTexture;
  private arrows?: THREE.CanvasTexture;
  private scrollTextures: THREE.CanvasTexture[] = [];
  private readonly scrollOffset = new THREE.Vector2();
  private selectionIndex = -1;
  private selectionStarted = 0;
  private selectionFrom: number[] = Array.from({ length: 8 }, () => 1);
  private artworkRevision = 0;
  private textureRevision = 0;
  private previews?: MenuPreviews;
  private artwork?: MenuArtwork;
  private pendingArtwork?: MenuArtwork;
  private keepVisible = false;
  private reduced = false;
  private idleFrame = 0;
  private rippleIndex = 0;
  private lastDraw = 0;
  private frames: number[] = [];
  private busy = false;
  private disposed = false;
  private frameId = 0;
  private finishFrame?: () => void;
  private readonly resizeListener = () => this.resize();
  private readonly contextLostListener = () => this.fail(new Error('The menu graphics context was lost.'));

  constructor(
    root: HTMLElement,
    private readonly visuals: GameVisuals,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.menuMotion = 'true';
    Object.assign(this.canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '100',
      pointerEvents: 'none',
      display: 'none',
    });
    root.append(this.canvas);
    this.backdrop = visuals.create('backdrop');
    this.timing = visuals.create('menu-timing');
    this.backend = new WebGLBackend(this.canvas, {
      alpha: true,
      antialias: false,
      lowLatency: true,
      pixelRatio: Math.min(devicePixelRatio, 1.5),
    });
    this.renderer = this.backend.renderer;
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.info.autoReset = false;
    this.material = visuals.create('menu-material', this.target.texture, this.blank, this.scrollOffset);
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
    this.canvas.addEventListener('webglcontextlost', this.contextLostListener);
    window.addEventListener('resize', this.resizeListener);
    this.resize();
  }

  get active(): boolean {
    return this.busy;
  }

  get visible(): boolean {
    return this.keepVisible || this.busy;
  }

  present(artwork: MenuArtwork, reducedMotion = false): void {
    if (this.disposed) return;
    this.keepVisible = true;
    this.reduced = reducedMotion;
    if (this.busy) {
      this.pendingArtwork = artwork;
      return;
    }
    this.setArtwork(artwork);
    this.rest();
    this.canvas.style.display = 'block';
    if (!this.idleFrame) this.idle();
  }

  hide(): void {
    this.keepVisible = false;
    this.pendingArtwork = undefined;
    cancelAnimationFrame(this.idleFrame);
    this.idleFrame = 0;
    if (!this.busy) this.end();
  }

  ripple(x: number, y: number, strength = 1): void {
    if (this.reduced || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const ripples = this.material.uniforms.uRipples!.value as THREE.Vector4[];
    ripples[this.rippleIndex]!.set(
      Math.max(0, Math.min(1, x)),
      1 - Math.max(0, Math.min(1, y)),
      performance.now() / 1000,
      Math.max(0, Math.min(1.5, strength)),
    );
    this.rippleIndex = (this.rippleIndex + 1) % ripples.length;
  }

  setScroll(id: string, left: number, top: number): void {
    const scroll = this.artwork?.scroll;
    if (!scroll || scroll.id !== id || !Number.isFinite(left) || !Number.isFinite(top)) return;
    this.scrollOffset.set(
      Math.max(0, Math.min(scroll.maxOffset.x, left)) * scroll.scrollUnit.x,
      Math.max(0, Math.min(scroll.maxOffset.y, top)) * scroll.scrollUnit.y,
    );
  }

  setSelection(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= (this.artwork?.rowBounds.length ?? 0)) return;
    if (this.selectionIndex === index) return;
    this.selectionIndex = index;
    this.selectionStarted = performance.now();
    this.selectionFrom = [...(this.material.uniforms.uScales!.value as number[])];
    this.updateArrowPosition();
  }

  private capturedScale(index: number): number {
    return this.artwork?.normalizedRows
      ? 1
      : this.artwork?.rowBounds[index]?.selected
        ? this.timing.selectedScale
        : 1;
  }

  private updateArrowPosition(): void {
    const rows = this.artwork?.rowBounds;
    const source = rows?.find((row) => row.selected);
    const target = rows?.[this.selectionIndex];
    this.material.uniforms.uArrowShift!.value = source && target ? target.y - source.y : 0;
    this.material.uniforms.uSelection!.value = this.selectionIndex;
  }

  private updateSelection(immediate = false): void {
    const scales = this.material.uniforms.uScales!.value as number[];
    const progress =
      immediate || this.reduced
        ? 1
        : ease(0, this.timing.selectionMs, performance.now() - this.selectionStarted);
    for (let index = 0; index < scales.length; index++) {
      const target =
        (index === this.selectionIndex ? this.timing.selectedScale : 1) / this.capturedScale(index);
      scales[index] = (this.selectionFrom[index] ?? 1) * (1 - progress) + target * progress;
    }
  }

  private rest(): void {
    const uniforms = this.material.uniforms;
    uniforms.uOpacity!.value = 1;
    uniforms.uRowsAlpha!.value = 1;
    uniforms.uChromeAlpha!.value = 1;
    uniforms.uArrowsAlpha!.value = 1;
    uniforms.uBoot!.value = 0;
    uniforms.uWarp!.value = this.reduced ? 0 : 0.0013;
    this.updateSelection(true);
    this.updateArrowPosition();
  }

  private idle(): void {
    if (!this.keepVisible || this.busy || this.disposed) {
      this.idleFrame = 0;
      return;
    }
    try {
      this.draw(this.reduced);
    } catch (error) {
      this.fail(error);
      return;
    }
    this.idleFrame = requestAnimationFrame(() => this.idle());
  }

  private fail(error: unknown): void {
    this.keepVisible = false;
    this.pendingArtwork = undefined;
    cancelAnimationFrame(this.idleFrame);
    this.idleFrame = 0;
    this.canvas.style.display = 'none';
    this.onError?.(error);
  }

  get resources() {
    return {
      drawCalls: this.renderer.info.render.calls,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      width: this.target.width,
      height: this.target.height,
      scrollTiles: this.scrollTextures.length,
      scrollPixels:
        this.artwork?.scroll?.tiles.reduce((sum, tile) => sum + tile.canvas.width * tile.canvas.height, 0) ??
        0,
      previewSlots: this.artwork?.previews?.length ?? 0,
      artworkRevision: this.artworkRevision,
      textureRevision: this.textureRevision,
      scroll: this.artwork?.scroll
        ? {
            id: this.artwork.scroll.id,
            left: this.scrollOffset.x / this.artwork.scroll.scrollUnit.x,
            top: this.scrollOffset.y / this.artwork.scroll.scrollUnit.y,
            offset: { x: this.scrollOffset.x, y: this.scrollOffset.y },
            viewport: { ...this.artwork.scroll.viewport },
          }
        : null,
      previewDraws: this.artwork?.previews?.length ? (this.previews?.draws ?? []) : [],
      previewsPrepared: this.previews?.prepared ?? true,
      preparedModels: this.previews?.modelCount ?? 0,
      fps: this.frames.length
        ? 1 / (this.frames.reduce((sum, value) => sum + value, 0) / this.frames.length)
        : 0,
    };
  }

  private resize(): void {
    if (this.disposed) return;
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const scale = Math.min(1, 1920 / width, 1080 / height);
    const renderWidth = Math.max(1, Math.round(width * scale));
    const renderHeight = Math.max(1, Math.round(height * scale));
    this.renderer.setSize(renderWidth, renderHeight, false);
    this.target.setSize(renderWidth, renderHeight);
    this.material.uniforms.uAspect!.value = width / height;
    this.material.uniforms.uTexel!.value.set(1 / renderWidth, 1 / renderHeight);
  }

  private setArtwork(artwork: MenuArtwork): void {
    if (this.artwork === artwork) return;
    const previousSelection =
      this.artwork?.selectionKey && this.artwork.selectionKey === artwork.selectionKey
        ? this.selectionIndex
        : -1;
    this.artworkRevision++;
    this.textureRevision++;
    this.rows?.dispose();
    this.chrome?.dispose();
    this.arrows?.dispose();
    for (const texture of this.scrollTextures) texture.dispose();
    this.rows =
      artwork.rows.width > 1 || artwork.rows.height > 1 ? new THREE.CanvasTexture(artwork.rows) : undefined;
    this.chrome = new THREE.CanvasTexture(artwork.chrome);
    this.arrows =
      artwork.arrows && (artwork.arrows.width > 1 || artwork.arrows.height > 1)
        ? new THREE.CanvasTexture(artwork.arrows)
        : undefined;
    this.scrollTextures =
      artwork.scroll?.tiles.slice(0, 4).map((tile) => new THREE.CanvasTexture(tile.canvas)) ?? [];
    for (const texture of [this.rows, this.chrome, this.arrows, ...this.scrollTextures]) {
      if (!texture) continue;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
    }
    this.material.uniforms.uRows!.value = this.rows ?? this.blank;
    this.material.uniforms.uChrome!.value = this.chrome;
    this.material.uniforms.uArrows!.value = this.arrows ?? this.blank;
    const caret = artwork.caret;
    this.material.uniforms.uCaret!.value.set(
      caret?.x ?? 0,
      caret ? 1 - caret.y : 0,
      caret?.width ?? 0,
      caret?.height ?? 0,
    );
    this.artwork = artwork;
    this.selectionIndex =
      previousSelection >= 0 && previousSelection < artwork.rowBounds.length
        ? previousSelection
        : artwork.rowBounds.findIndex((row) => row.selected);
    this.selectionStarted = 0;
    this.updateSelection(true);
    this.updateArrowPosition();
    const scroll = artwork.scroll;
    this.material.uniforms.uScrollCount!.value = this.scrollTextures.length;
    this.material.uniforms.uScrollBounds!.value.set(
      scroll?.viewport.left ?? 0,
      scroll?.viewport.top ?? 0,
      scroll?.viewport.width ?? 0,
      scroll?.viewport.height ?? 0,
    );
    this.material.uniforms.uScrollSize!.value.set(
      scroll?.contentSize.width ?? 1,
      scroll?.contentSize.height ?? 1,
    );
    for (let index = 0; index < 4; index++) {
      this.material.uniforms[`uScroll${index}`]!.value = this.scrollTextures[index] ?? this.blank;
      const tile = scroll?.tiles[index];
      this.material.uniforms.uScrollTiles!.value[index].set(tile?.top ?? 0, tile?.height ?? 0);
    }
    this.scrollOffset.set(0, 0);
    if (scroll) this.setScroll(scroll.id, scroll.initialOffset.x, scroll.initialOffset.y);
    const count = Math.min(8, artwork.rowBounds.length);
    this.material.uniforms.uCount!.value = count;
    const bounds = this.material.uniforms.uBounds!.value as THREE.Vector4[];
    for (let index = 0; index < count; index++) {
      const row = artwork.rowBounds[index]!;
      bounds[index]!.set(row.x, 1 - row.y, row.width, row.height);
    }
    if (artwork.previews?.length) {
      this.previews ??= new MenuPreviews(this.renderer, this.visuals);
      const previousTarget = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.target);
      try {
        void this.previews.prepare(this.renderer, artwork.previews).catch((error) => this.fail(error));
      } finally {
        this.renderer.setRenderTarget(previousTarget);
      }
    }
  }

  private begin(artwork: MenuArtwork): void {
    cancelAnimationFrame(this.idleFrame);
    this.idleFrame = 0;
    this.pendingArtwork = undefined;
    this.busy = true;
    this.setArtwork(artwork);
    this.rest();
    this.canvas.style.display = 'block';
    const uniforms = this.material.uniforms;
    uniforms.uOpacity!.value = 1;
    uniforms.uRowsAlpha!.value = 1;
    uniforms.uChromeAlpha!.value = 1;
    uniforms.uArrowsAlpha!.value = 0;
    uniforms.uBoot!.value = 0;
    uniforms.uWarp!.value = 0;
    this.updateSelection(true);
  }

  private end(): void {
    this.busy = false;
    if (this.keepVisible && !this.disposed) {
      if (this.pendingArtwork) this.setArtwork(this.pendingArtwork);
      this.pendingArtwork = undefined;
      this.rest();
      this.canvas.style.display = 'block';
      if (!this.idleFrame) this.idle();
      return;
    }
    this.canvas.style.display = 'none';
    this.rows?.dispose();
    this.chrome?.dispose();
    this.arrows?.dispose();
    for (const texture of this.scrollTextures) texture.dispose();
    this.scrollTextures = [];
    this.rows = undefined;
    this.chrome = undefined;
    this.arrows = undefined;
    this.artwork = undefined;
    this.material.uniforms.uRows!.value = this.blank;
    this.material.uniforms.uChrome!.value = this.blank;
    this.material.uniforms.uArrows!.value = this.blank;
    this.material.uniforms.uCaret!.value.set(0, 0, 0, 0);
    this.material.uniforms.uScrollCount!.value = 0;
    for (let index = 0; index < 4; index++) this.material.uniforms[`uScroll${index}`]!.value = this.blank;
  }

  private draw(reducedMotion: boolean): void {
    if (this.disposed) return;
    const time = performance.now() / 1000;
    if (!this.busy) this.updateSelection();
    if (this.lastDraw && time - this.lastDraw < 1) {
      this.frames.push(time - this.lastDraw);
      if (this.frames.length > 90) this.frames.shift();
    }
    this.lastDraw = time;
    this.material.uniforms.uTime!.value = reducedMotion ? 0 : time;
    this.backdrop.update(time, true, this.material.uniforms.uAspect!.value as number, reducedMotion);
    this.renderer.info.reset();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.backdrop.scene, this.backdrop.camera);
    if (this.artwork?.previews?.length) {
      this.previews ??= new MenuPreviews(this.renderer, this.visuals);
      this.renderer.setRenderTarget(this.target);
      this.previews.render(
        this.renderer,
        this.target.width,
        this.target.height,
        time,
        reducedMotion,
        this.artwork.previews,
        this.artwork.scroll,
        this.scrollOffset,
      );
    }
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  private animate(
    durationMs: number,
    update: (elapsedMs: number) => void,
    reducedMotion = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const started = performance.now();
      this.finishFrame = resolve;
      const frame = () => {
        if (this.disposed) {
          resolve();
          return;
        }
        const elapsed = Math.min(durationMs, performance.now() - started);
        try {
          update(elapsed);
          this.draw(reducedMotion);
        } catch (error) {
          this.finishFrame = undefined;
          this.fail(error);
          reject(error);
          return;
        }
        if (elapsed < durationMs) this.frameId = requestAnimationFrame(frame);
        else {
          this.finishFrame = undefined;
          resolve();
        }
      };
      frame();
    });
  }

  private hold(ready: Promise<unknown>, minimumMs: number, reducedMotion = false): Promise<void> {
    let finished = false;
    void ready.then(
      () => {
        finished = true;
      },
      () => {
        finished = true;
      },
    );
    return new Promise((resolve, reject) => {
      const started = performance.now();
      this.finishFrame = resolve;
      const frame = () => {
        if (this.disposed || (finished && performance.now() - started >= minimumMs)) {
          this.finishFrame = undefined;
          resolve();
          return;
        }
        try {
          this.draw(reducedMotion);
        } catch (error) {
          this.finishFrame = undefined;
          this.fail(error);
          reject(error);
          return;
        }
        this.frameId = requestAnimationFrame(frame);
      };
      frame();
    });
  }

  async boot(ready: Promise<unknown>, artwork: MenuArtwork, reducedMotion = false): Promise<void> {
    if (this.busy || this.disposed) {
      await ready;
      return;
    }
    this.reduced = reducedMotion;
    this.keepVisible = true;
    this.begin(artwork);
    const status = ready.then(
      () => ({ error: undefined }),
      (error: unknown) => ({ error }),
    );
    const uniforms = this.material.uniforms;
    try {
      if (reducedMotion) {
        this.draw(true);
        await this.hold(status, 0, true);
        if (this.disposed) return;
        await this.animate(
          160,
          (elapsed) => {
            uniforms.uOpacity!.value = 1 - elapsed / 160;
          },
          true,
        );
        const result = await status;
        if (result.error) throw result.error;
        return;
      }
      uniforms.uBoot!.value = 1;
      uniforms.uRowsAlpha!.value = 0;
      uniforms.uChromeAlpha!.value = 0;
      this.draw(false);
      await this.animate(this.timing.titleSettleMs, (elapsed) => {
        uniforms.uBoot!.value = 1 - ease(0, this.timing.titleSettleMs, elapsed);
        uniforms.uRowsAlpha!.value = ease(100, 450, elapsed);
        uniforms.uChromeAlpha!.value = ease(350, 600, elapsed);
        uniforms.uWarp!.value = 0.025 * (1 - ease(300, this.timing.titleSettleMs, elapsed));
      });
      await this.hold(status, 1050);
      if (this.disposed) return;
      const result = await status;
      if (result.error) throw result.error;
      this.ripple(0.5, 0.5, 1.25);
      await this.animate(this.timing.titleExitMs, (elapsed) => {
        uniforms.uRowsAlpha!.value = 1 - ease(70, 350, elapsed);
        uniforms.uChromeAlpha!.value = 1 - ease(50, 300, elapsed);
        uniforms.uWarp!.value = 0.0013;
      });
    } finally {
      this.pendingArtwork = { rows: emptyCanvas(), chrome: emptyCanvas(), rowBounds: [] };
      this.end();
    }
  }

  async enter(artwork: MenuArtwork, reducedMotion = false): Promise<void> {
    if (this.busy || this.disposed) return;
    this.reduced = reducedMotion;
    this.begin(artwork);
    const uniforms = this.material.uniforms;
    try {
      await this.animate(
        reducedMotion ? 150 : this.timing.entrySelectedMs,
        (elapsed) => {
          if (reducedMotion) {
            uniforms.uRowsAlpha!.value = elapsed / 150;
            uniforms.uChromeAlpha!.value = elapsed / 150;
            return;
          }
          uniforms.uChromeAlpha!.value = ease(0, 200, elapsed);
          uniforms.uArrowsAlpha!.value = ease(
            this.timing.entryArrowsMs - 16.667,
            this.timing.entrySelectedMs,
            elapsed,
          );
          uniforms.uRowsAlpha!.value = ease(0, 100, elapsed);
          const grow =
            elapsed < this.timing.entryPeakMs
              ? this.timing.entryStartScale +
                (this.timing.entryPeakScale - this.timing.entryStartScale) *
                  ease(0, this.timing.entryPeakMs, elapsed)
              : this.timing.entryPeakScale -
                (this.timing.entryPeakScale - 1) *
                  ease(this.timing.entryPeakMs, this.timing.entryBaseMs, elapsed);
          const scales = uniforms.uScales!.value as number[];
          for (let index = 0; index < scales.length; index++) {
            const selected =
              index === this.selectionIndex
                ? 1 +
                  (this.timing.selectedScale - 1) *
                    ease(this.timing.entryBaseMs, this.timing.entrySelectedMs, elapsed)
                : 1;
            scales[index] = (grow * selected) / this.capturedScale(index);
          }
          uniforms.uWarp!.value = Math.sin((elapsed / this.timing.entrySelectedMs) * Math.PI) * 0.004;
        },
        reducedMotion,
      );
    } finally {
      this.end();
    }
  }

  async transition(
    artwork: MenuArtwork,
    change: () => NextArtwork | Promise<NextArtwork>,
    reducedMotion = false,
  ): Promise<void> {
    if (this.busy || this.disposed) return;
    this.reduced = reducedMotion;
    this.begin(artwork);
    const uniforms = this.material.uniforms;
    try {
      if (reducedMotion) {
        await this.animate(
          100,
          (elapsed) => {
            uniforms.uRowsAlpha!.value = 1 - elapsed / 100;
            uniforms.uChromeAlpha!.value = 1 - elapsed / 100;
          },
          true,
        );
        if (this.disposed) return;
        const next = await change();
        if (this.disposed) return;
        if (next) this.setArtwork(next);
        await this.previews?.ready;
        if (this.disposed) return;
        await this.animate(
          100,
          (elapsed) => {
            uniforms.uRowsAlpha!.value = elapsed / 100;
            uniforms.uChromeAlpha!.value = elapsed / 100;
            uniforms.uArrowsAlpha!.value = elapsed / 100;
          },
          true,
        );
        return;
      }
      this.ripple(0.5, 0.5, 1.25);
      await this.animate(this.timing.confirmMs, (elapsed) => {
        const scales = uniforms.uScales!.value as number[];
        const grow =
          1 +
          (this.timing.confirmPeakScale - 1) * ease(this.timing.growStartMs, this.timing.growPeakMs, elapsed);
        const collapse = 1 - ease(this.timing.growPeakMs, this.timing.rowsGoneMs, elapsed);
        for (let index = 0; index < 8; index++) {
          const selected =
            index === this.selectionIndex
              ? this.timing.selectedScale -
                (this.timing.selectedScale - 1) * ease(0, this.timing.selectionMs, elapsed)
              : 1;
          scales[index] = (selected * grow * collapse) / this.capturedScale(index);
        }
        uniforms.uRowsAlpha!.value = 1 - ease(this.timing.growPeakMs, this.timing.rowsGoneMs, elapsed);
        uniforms.uChromeAlpha!.value = 1 - ease(1160, 1400, elapsed);
        uniforms.uWarp!.value = 0.0013;
      });
      if (this.disposed) return;
      const next = await change();
      if (this.disposed) return;
      if (next) this.setArtwork(next);
      await this.previews?.ready;
      if (this.disposed) return;
      this.updateSelection(true);
      await this.animate(550, (elapsed) => {
        uniforms.uWarp!.value = 0.0013;
        uniforms.uRowsAlpha!.value = next ? ease(180, 530, elapsed) : 0;
        uniforms.uChromeAlpha!.value = next ? ease(0, 300, elapsed) : 0;
        uniforms.uArrowsAlpha!.value = next ? ease(380, 550, elapsed) : 0;
        if (!next) uniforms.uOpacity!.value = 1 - ease(0, 550, elapsed);
      });
    } finally {
      this.end();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keepVisible = false;
    cancelAnimationFrame(this.idleFrame);
    cancelAnimationFrame(this.frameId);
    this.finishFrame?.();
    this.finishFrame = undefined;
    window.removeEventListener('resize', this.resizeListener);
    this.canvas.removeEventListener('webglcontextlost', this.contextLostListener);
    this.end();
    this.blank.dispose();
    this.backdrop.dispose();
    this.previews?.dispose();
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.backend.dispose();
    this.canvas.remove();
  }
}
