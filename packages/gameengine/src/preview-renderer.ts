import * as THREE from 'three';
import { SKINS } from '@supadub/protocol';
import type { GameVisuals } from './visuals';
import { avatarKey, previewLoadout } from './avatar-key';
import type { CanvasBounds } from './camera-rig';

type Slot = {
  skin: string;
  key: string;
  rect: CanvasBounds;
  clip: CanvasBounds | null;
  scroll: HTMLElement | null;
  scrollX: number;
  scrollY: number;
};
export type PreviewViewport = { viewport: CanvasBounds; clip: CanvasBounds };

export function previewViewport(
  rect: CanvasBounds,
  clip: CanvasBounds | null,
  canvas: CanvasBounds,
  dx = 0,
  dy = 0,
): PreviewViewport | null {
  const viewport = {
    left: rect.left - dx - canvas.left,
    top: rect.top - dy - canvas.top,
    width: rect.width,
    height: rect.height,
  };
  const left = Math.max(viewport.left, clip ? clip.left - canvas.left : 0, 0);
  const right = Math.min(
    viewport.left + viewport.width,
    clip ? clip.left + clip.width - canvas.left : canvas.width,
    canvas.width,
  );
  const top = Math.max(viewport.top, clip ? clip.top - canvas.top : 0, 0);
  const bottom = Math.min(
    viewport.top + viewport.height,
    clip ? clip.top + clip.height - canvas.top : canvas.height,
    canvas.height,
  );
  return right > left && bottom > top && viewport.width > 0 && viewport.height > 0
    ? { viewport, clip: { left, top, width: right - left, height: bottom - top } }
    : null;
}

export class PreviewRenderer {
  readonly group = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  private readonly ducks = new Map<string, THREE.Group>();
  private readonly observer: MutationObserver;
  private readonly controller = new AbortController();
  private readonly slots: Slot[] = [];
  private canvasBounds: CanvasBounds = { left: 0, top: 0, width: 1280, height: 720 };
  private queued = false;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: THREE.Scene,
    private readonly visuals: GameVisuals,
  ) {
    this.scene.add(this.group);
    this.camera.position.set(0, 2.2, 4.4);
    this.camera.lookAt(0, 0.75, 0);
    this.observer = new MutationObserver(() => this.invalidate());
    this.observer.observe(canvas.ownerDocument.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-skin',
        'data-head',
        'data-face',
        'data-neck',
        'data-duck-preview',
        'data-preview-clip',
      ],
    });
    canvas.ownerDocument.defaultView?.addEventListener('resize', () => this.invalidate(), {
      signal: this.controller.signal,
    });
  }

  setVisible(value: boolean): void {
    this.group.visible = value;
    if (value) this.invalidate();
  }
  resize(bounds: CanvasBounds): void {
    this.canvasBounds = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
    this.invalidate();
  }
  private invalidate(): void {
    if (this.queued || this.disposed) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (!this.disposed) this.measure();
    });
  }
  private measure(): void {
    this.slots.length = 0;
    if (!this.group.visible) return;
    const rectangles = new Map<HTMLElement, CanvasBounds>();
    for (const element of [
      ...this.canvas.ownerDocument.querySelectorAll<HTMLElement>('[data-duck-preview][data-skin]'),
    ].slice(0, 32)) {
      const rect = element.getBoundingClientRect();
      const scroll = element.closest<HTMLElement>('[data-preview-clip]');
      let clip = scroll ? rectangles.get(scroll) : undefined;
      if (scroll && !clip) {
        const bounds = scroll.getBoundingClientRect();
        clip = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
        rectangles.set(scroll, clip);
      }
      const skin = SKINS.find((skin) => skin === element.dataset.skin) ?? 'yellow';
      const loadout = previewLoadout(element);
      const key = avatarKey(skin, loadout);
      this.slots.push({
        skin,
        key,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        clip: clip ?? null,
        scroll,
        scrollX: scroll?.scrollLeft ?? 0,
        scrollY: scroll?.scrollTop ?? 0,
      });
      if (!this.ducks.has(key)) {
        if (this.ducks.size >= 32) {
          const oldest = [...this.ducks.keys()].find(
            (entry) => !this.slots.some((slot) => slot.key === entry),
          );
          if (oldest) {
            this.ducks.get(oldest)!.removeFromParent();
            this.ducks.delete(oldest);
          }
        }
        const duck = this.visuals.create('avatar', { skin, loadout });
        duck.visible = false;
        this.ducks.set(key, duck);
        this.group.add(duck);
      }
    }
  }
  render(renderer: THREE.WebGLRenderer, time: number, reducedMotion: boolean): void {
    if (!this.group.visible || this.disposed) return;
    const canvas = this.canvasBounds;
    renderer.setScissorTest(true);
    try {
      for (const slot of this.slots) {
        const draw = previewViewport(
          slot.rect,
          slot.clip,
          canvas,
          (slot.scroll?.scrollLeft ?? 0) - slot.scrollX,
          (slot.scroll?.scrollTop ?? 0) - slot.scrollY,
        );
        if (!draw) continue;
        const duck = this.ducks.get(slot.key)!;
        duck.visible = true;
        duck.position.set(0, reducedMotion ? 0 : Math.sin(time * 1.6) * 0.015, 0);
        duck.rotation.y = -0.5 + (reducedMotion ? 0 : Math.sin(time * 0.6) * 0.1);
        this.camera.aspect = draw.viewport.width / draw.viewport.height;
        this.camera.updateProjectionMatrix();
        renderer.setViewport(
          draw.viewport.left,
          canvas.height - draw.viewport.top - draw.viewport.height,
          draw.viewport.width,
          draw.viewport.height,
        );
        renderer.setScissor(
          draw.clip.left,
          canvas.height - draw.clip.top - draw.clip.height,
          draw.clip.width,
          draw.clip.height,
        );
        renderer.clearDepth();
        try {
          renderer.render(this.scene, this.camera);
        } finally {
          duck.visible = false;
        }
      }
    } finally {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, canvas.width, canvas.height);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.controller.abort();
    this.slots.length = 0;
    this.ducks.clear();
    this.group.clear();
    this.group.removeFromParent();
  }
}
