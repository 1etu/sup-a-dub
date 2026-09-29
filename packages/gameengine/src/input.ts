import type { GameMode, Vec2 } from '@supadub/protocol';
import { isEditing, type InputController } from '@supadub/inputengine';

export type ControlState = { x: number; z: number; boost: boolean; target?: Vec2 };

export class GameInput {
  private pointer: { x: number; y: number } | null = null;
  private touchOrigin: { x: number; y: number } | null = null;
  private touching = false;
  private boosting = false;
  private active = false;
  private mode: GameMode = 'endless';
  private controller = new AbortController();
  private readonly unlisten: (() => void)[] = [];
  onQuack: () => void = () => {};
  onAction: (action: 'split' | 'eject') => void = () => {};
  toWorld: (x: number, y: number) => Vec2 | undefined = () => undefined;

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly controls: InputController,
  ) {
    const signal = this.controller.signal;
    this.unlisten.push(
      controls.events.on('action', (event) => {
        if (!this.active || isEditing(document.activeElement) || event.phase === 'release') return;
        if (event.action === 'quack' && event.phase === 'press') this.onQuack();
        if (this.mode === 'endless' && (event.action === 'split' || event.action === 'eject'))
          this.onAction(event.action);
      }),
    );
    this.unlisten.push(
      controls.events.on('reset', () => {
        this.pointer = null;
        this.touchOrigin = null;
        this.touching = false;
        this.boosting = false;
      }),
    );
    canvas.addEventListener(
      'pointermove',
      (event) => {
        if (!this.active || (event.pointerType === 'touch' && !this.touching)) return;
        this.pointer = { x: event.clientX, y: event.clientY };
      },
      { signal },
    );
    canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.active) return;
        if (event.pointerType === 'touch') {
          this.touchOrigin = { x: event.clientX, y: event.clientY };
          this.touching = true;
          canvas.setPointerCapture(event.pointerId);
        }
        this.pointer = { x: event.clientX, y: event.clientY };
      },
      { signal },
    );
    const release = (event: PointerEvent) => {
      this.boosting = false;
      if (event.pointerType === 'touch') {
        this.touching = false;
        this.pointer = null;
        this.touchOrigin = null;
      }
    };
    window.addEventListener('pointerup', release, { signal });
    window.addEventListener('pointercancel', release, { signal });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
  }

  setActive(active: boolean): void {
    this.active = active;
    this.reset();
  }
  setMode(mode: GameMode): void {
    this.mode = mode;
  }
  setBoost(boost: boolean): void {
    this.boosting = boost;
  }
  reset(): void {
    this.controls.reset();
    this.pointer = null;
    this.boosting = false;
    this.touching = false;
    this.touchOrigin = null;
  }

  read(playerOrigin?: { x: number; y: number }): ControlState {
    if (!this.active || this.controls.activeContext !== this.mode || isEditing(document.activeElement))
      return { x: 0, z: 0, boost: false };
    const value = (action: string) => this.controls.value(action);
    let x = value('move-right') - value('move-left');
    let z =
      Math.max(value('move-down'), this.mode === 'practice' ? value('practice-down') : 0) -
      Math.max(value('move-up'), this.mode === 'practice' ? value('practice-up') : 0);
    let target: Vec2 | undefined;
    if (!x && !z && this.pointer && this.controls.activeSource !== 'gamepad') {
      const bounds = this.canvas.getBoundingClientRect();
      const origin = this.touchOrigin ??
        playerOrigin ?? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height * 0.51 };
      const dx = this.pointer.x - origin.x;
      const dy = this.pointer.y - origin.y;
      if (Math.hypot(dx, dy) > (this.touchOrigin ? 9 : 32)) {
        x = dx;
        z = dy * 1.5;
      }
      if (this.mode === 'endless' && !this.touchOrigin) target = this.toWorld(this.pointer.x, this.pointer.y);
    }
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    return { x, z, target, boost: this.mode === 'practice' && (this.boosting || value('boost') > 0) };
  }

  dispose(): void {
    for (const unsubscribe of this.unlisten) unsubscribe();
    this.controller.abort();
    this.reset();
  }
}
