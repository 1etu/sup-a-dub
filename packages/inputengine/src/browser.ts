import type { InputController } from './controller';
import type { ControllerProfile, InputBinding, KeyboardPlatform } from './types';

export function keyboardPlatform(platform = navigator.platform): KeyboardPlatform {
  return /Mac|iPhone|iPad/i.test(platform) ? 'mac' : 'pc';
}

export function controllerProfile(id: string): ControllerProfile {
  if (/dualsense|dualshock|playstation|054c/i.test(id)) return 'playstation';
  if (/nintendo|switch|joy-con|057e/i.test(id)) return 'nintendo';
  if (/xbox|xinput|045e/i.test(id)) return 'xbox';
  return 'generic';
}

export function isEditing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable)
  );
}

export function eventBinding(event: KeyboardEvent): InputBinding {
  return {
    kind: 'key',
    code: event.code,
    ctrl: event.ctrlKey && !event.code.startsWith('Control'),
    alt: event.altKey && !event.code.startsWith('Alt'),
    shift: event.shiftKey && !event.code.startsWith('Shift'),
    meta: event.metaKey && !event.code.startsWith('Meta'),
  };
}

export class BrowserInputAdapter {
  private readonly abort = new AbortController();
  private capture?: (binding: InputBinding | null) => void;
  private lastPad = '';
  private lastCaptureButtons = new Set<number>();
  private captureReady = false;
  private labels = new Map<string, string>();
  onController: (profile: ControllerProfile) => void = () => {};
  onLabel: () => void = () => {};

  constructor(
    readonly input: InputController,
    private readonly target: Window = window,
  ) {
    const signal = this.abort.signal;
    target.addEventListener(
      'keydown',
      (event) => {
        if (event.repeat) {
          if (
            !isEditing(event.target) &&
            this.input.actions.some(
              (action) =>
                action.contexts.includes(this.input.activeContext) &&
                this.input.mapping[action.id]?.some(
                  (binding) => binding.kind === 'key' && binding.code === event.code,
                ),
            )
          )
            event.preventDefault();
          return;
        }
        if (this.capture) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const callback = this.capture;
          this.capture = undefined;
          callback(event.code === 'Escape' ? null : eventBinding(event));
          this.input.setBlocked(false);
          return;
        }
        if (isEditing(event.target)) {
          if (
            !this.input.mapping.back?.some((binding) => binding.kind === 'key' && binding.code === event.code)
          )
            return;
          this.input.setBlocked(false);
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
          this.labels.set(event.code, event.key.toUpperCase());
        if (
          this.input.key(event.code, true, {
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey,
          })
        )
          event.preventDefault();
      },
      { signal },
    );
    target.addEventListener(
      'keyup',
      (event) =>
        this.input.key(event.code, false, {
          ctrl: event.ctrlKey,
          alt: event.altKey,
          shift: event.shiftKey,
          meta: event.metaKey,
        }),
      { signal },
    );
    target.addEventListener('blur', () => this.input.reset(), { signal });
    target.addEventListener(
      'gamepaddisconnected',
      () => {
        this.lastPad = '';
        this.input.reset();
      },
      { signal },
    );
    target.document.addEventListener(
      'visibilitychange',
      () => {
        if (target.document.hidden) this.input.reset();
      },
      { signal },
    );
    target.document.addEventListener(
      'focusin',
      (event) => {
        if (isEditing(event.target)) this.input.reset();
      },
      { signal },
    );
    target.addEventListener(
      'pointerdown',
      (event) => {
        this.input.useSource(event.pointerType === 'touch' ? 'touch' : 'mouse');
        if (this.capture && event.button > 0) {
          event.preventDefault();
          const callback = this.capture;
          this.capture = undefined;
          callback({ kind: 'mouse', button: event.button });
          this.input.setBlocked(false);
        } else if (!isEditing(event.target) && (event.target as Element)?.closest?.('#pool-canvas'))
          this.input.pointerButton(event.button, true);
      },
      { signal },
    );
    target.addEventListener('pointerup', (event) => this.input.pointerButton(event.button, false), {
      signal,
    });
    void this.layout();
  }

  private async layout(): Promise<void> {
    try {
      const keyboard = (
        navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }
      ).keyboard;
      const map = await keyboard?.getLayoutMap();
      if (!this.abort.signal.aborted && map) {
        this.labels = new Map(map);
        this.onLabel();
      }
    } catch {}
  }

  label(code: string): string | undefined {
    return this.labels.get(code)?.toUpperCase();
  }

  beginCapture(callback: (binding: InputBinding | null) => void): void {
    this.cancelCapture();
    this.capture = callback;
    this.input.setBlocked(true);
    this.lastCaptureButtons = new Set();
    this.captureReady = false;
  }

  cancelCapture(): void {
    const callback = this.capture;
    this.capture = undefined;
    this.input.setBlocked(false);
    callback?.(null);
  }

  poll(): void {
    if (this.abort.signal.aborted) return;
    const pad = navigator.getGamepads?.().find((entry) => entry?.connected);
    if (pad?.id !== this.lastPad && pad) {
      this.lastPad = pad.id;
      this.onController(controllerProfile(pad.id));
    }
    if (this.capture) {
      if (!pad) return;
      const pressed = new Set(pad.buttons.flatMap((button, index) => (button.pressed ? [index] : [])));
      if (!this.captureReady) {
        this.lastCaptureButtons = pressed;
        if (!pressed.size && pad.axes.every((axis) => Math.abs(axis) < 0.3)) this.captureReady = true;
        return;
      }
      const button = [...pressed].find((index) => !this.lastCaptureButtons.has(index));
      const axis = pad.axes.findIndex((value) => Math.abs(value) > 0.7);
      this.lastCaptureButtons = pressed;
      if (button !== undefined || axis >= 0) {
        const callback = this.capture;
        this.capture = undefined;
        this.input.gamepad(pad);
        callback(
          button !== undefined
            ? { kind: 'button', button }
            : { kind: 'axis', axis, sign: pad.axes[axis]! > 0 ? 1 : -1 },
        );
        this.input.setBlocked(false);
      }
      return;
    }
    this.input.setBlocked(
      isEditing(this.target.document.activeElement) && this.input.activeContext !== 'chat',
    );
    this.input.gamepad(pad ?? undefined);
  }

  dispose(): void {
    this.cancelCapture();
    this.abort.abort();
    this.input.reset();
  }
}
