import * as THREE from 'three';
import { clippedViewport } from '@supadub/graphics';
import type { GameVisuals, SkyVisual } from './visuals';
import { SKINS } from '@supadub/protocol';
import { avatarKey } from './avatar-key';
import type { MenuPreview, MenuRect, MenuScrollArtwork } from './menu-motion';

interface PreviewDraw {
  skin: string;
  viewport: MenuRect;
  clip: MenuRect;
}

export class MenuPreviews {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  private readonly ducks = new Map<string, THREE.Group>();
  private readonly environment: SkyVisual;
  private readonly drawRecords: PreviewDraw[] = [];
  private drawCount = 0;
  ready: Promise<void> = Promise.resolve();
  prepared = true;

  get modelCount(): number {
    return this.ducks.size;
  }

  get draws(): PreviewDraw[] {
    return this.drawRecords
      .slice(0, this.drawCount)
      .map((record) => ({ skin: record.skin, viewport: { ...record.viewport }, clip: { ...record.clip } }));
  }

  prepare(renderer: THREE.WebGLRenderer, slots: readonly MenuPreview[]): Promise<void> {
    let changed = false;
    const active = new Set(slots.slice(0, 32).map((slot) => avatarKey(slot.skin, slot.loadout)));
    for (const slot of slots.slice(0, 32)) {
      const skin = SKINS.find((skin) => skin === slot.skin) ?? 'yellow';
      const key = avatarKey(skin, slot.loadout);
      if (this.ducks.has(key)) continue;
      if (this.ducks.size >= 32) {
        const oldest = [...this.ducks.keys()].find((entry) => !active.has(entry));
        if (oldest) {
          this.ducks.get(oldest)!.removeFromParent();
          this.ducks.delete(oldest);
        }
      }
      const duck = this.visuals.create('avatar', { skin, loadout: slot.loadout });
      duck.visible = false;
      this.ducks.set(key, duck);
      this.scene.add(duck);
      changed = true;
    }
    if (!changed) return this.ready;
    this.prepared = false;
    this.ready = renderer.compileAsync(this.scene, this.camera).then(() => {
      this.prepared = true;
    });
    return this.ready;
  }

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly visuals: GameVisuals,
  ) {
    this.environment = visuals.create('sky', renderer);
    this.scene.environment = this.environment.environment.texture;
    this.scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight(0xfff9ec, 1.8);
    key.position.set(-12, 25, 9);
    const fill = new THREE.DirectionalLight(0xcedcff, 0.5);
    fill.position.set(10, 8, -15);
    this.scene.add(new THREE.HemisphereLight(0xe7f6ff, 0x9d92b9, 1), key, fill);
    this.camera.position.set(0, 2.2, 4.4);
    this.camera.lookAt(0, 0.75, 0);
  }

  render(
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    time: number,
    reduced: boolean,
    slots: readonly MenuPreview[],
    scroll: MenuScrollArtwork | undefined,
    scrollOffset: THREE.Vector2,
  ): void {
    const autoClear = renderer.autoClear;
    this.drawCount = 0;
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    for (let index = 0; index < Math.min(32, slots.length); index++) {
      const slot = slots[index]!;
      const bounds = slot.viewport;
      const scrolled = Boolean(scroll && slot.scrollId === scroll.id);
      const view = clippedViewport(
        bounds,
        scrolled ? scroll?.viewport : undefined,
        scrolled ? scrollOffset : { x: 0, y: 0 },
      );
      if (!view) continue;
      const originX = view.viewport.left;
      const originY = view.viewport.top;
      const { left, top, width: clippedWidth, height: clippedHeight } = view.clip;
      const right = left + clippedWidth;
      const bottom = top + clippedHeight;
      const requested = slot.skin;
      const skin = SKINS.find((skin) => skin === requested) ?? 'yellow';
      const duck = this.ducks.get(avatarKey(skin, slot.loadout));
      if (!duck) continue;
      const record = (this.drawRecords[this.drawCount] ??= {
        skin,
        viewport: { left: 0, top: 0, width: 0, height: 0 },
        clip: { left: 0, top: 0, width: 0, height: 0 },
      });
      record.skin = skin;
      Object.assign(record.viewport, {
        left: originX,
        top: originY,
        width: bounds.width,
        height: bounds.height,
      });
      Object.assign(record.clip, { left, top, width: right - left, height: bottom - top });
      this.drawCount++;
      duck.visible = true;
      duck.position.y = reduced ? 0 : Math.sin(time * 1.6) * 0.015;
      duck.rotation.y = -0.5 + (reduced ? 0 : Math.sin(time * 0.6) * 0.1);
      this.camera.aspect = (bounds.width * width) / (bounds.height * height);
      this.camera.updateProjectionMatrix();
      renderer.setViewport(
        originX * width,
        (1 - originY - bounds.height) * height,
        bounds.width * width,
        bounds.height * height,
      );
      renderer.setScissor(
        left * width,
        (1 - bottom) * height,
        (right - left) * width,
        (bottom - top) * height,
      );
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
      duck.visible = false;
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.autoClear = autoClear;
  }

  dispose(): void {
    this.scene.clear();
    this.ducks.clear();
    this.drawRecords.length = 0;
    this.environment.environment.dispose();
    this.environment.sky.dispose();
  }
}
