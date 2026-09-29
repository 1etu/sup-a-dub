import { EventBus } from '@supadub/core';
import { keyModifiersMatch, validateBindings } from './bindings';
import type {
  BindingMap,
  GamepadSample,
  InputAction,
  InputBinding,
  InputEvents,
  InputSource,
  KeyModifiers,
} from './types';

type ActionState = { value: number; nextRepeat: number };
const deadZone = 0.16;

export class InputController {
  readonly events = new EventBus<InputEvents>(96);
  private readonly keys = new Set<string>();
  private readonly mouse = new Set<number>();
  private readonly virtual = new Map<string, number>();
  private readonly states = new Map<string, ActionState>();
  private pad?: GamepadSample;
  private readonly heldButtons = new Set<number>();
  private readonly heldAxes = new Set<number>();
  private modifiers: KeyModifiers = {};
  private bindings: BindingMap;
  private context = 'menu';
  private blocked = false;
  private disposed = false;
  private source: InputSource = 'keyboard';
  private lastDeviceChange = -Infinity;

  constructor(
    readonly actions: readonly InputAction[],
    bindings: BindingMap,
    private readonly now: () => number = () => performance.now(),
  ) {
    if (actions.length > 64 || new Set(actions.map((entry) => entry.id)).size !== actions.length)
      throw new Error('Use unique input actions within the action limit.');
    const valid = validateBindings(actions, bindings);
    if (!valid) throw new Error('The input bindings are invalid.');
    this.bindings = valid;
    for (const action of actions) this.states.set(action.id, { value: 0, nextRepeat: 0 });
  }

  get activeSource(): InputSource {
    return this.source;
  }
  get activeContext(): string {
    return this.context;
  }
  get mapping(): BindingMap {
    return this.bindings;
  }

  setContext(context: string): void {
    if (this.context === context) return;
    this.reset();
    this.context = context;
  }

  setBlocked(blocked: boolean): void {
    if (this.blocked === blocked) return;
    this.reset();
    this.blocked = blocked;
  }

  setBindings(bindings: BindingMap): void {
    const valid = validateBindings(this.actions, bindings);
    if (!valid) throw new Error('The input bindings are invalid.');
    this.reset();
    this.bindings = valid;
  }

  useSource(source: InputSource): void {
    if (this.disposed || source === this.source || this.now() - this.lastDeviceChange < 300) return;
    this.source = source;
    this.lastDeviceChange = this.now();
    this.events.emit('source', source);
  }

  key(code: string, pressed: boolean, modifiers: KeyModifiers = {}): boolean {
    this.modifiers = modifiers;
    if (pressed) {
      if (this.keys.size >= 32 && !this.keys.has(code)) return false;
      this.keys.add(code);
      this.useSource('keyboard');
    } else this.keys.delete(code);
    const used = this.actions.some(
      (action) =>
        action.contexts.includes(this.context) &&
        (this.bindings[action.id] ?? []).some(
          (binding) =>
            binding.kind === 'key' && binding.code === code && keyModifiersMatch(binding, modifiers),
        ),
    );
    this.evaluate();
    return used && !this.blocked;
  }

  pointerButton(button: number, pressed: boolean): void {
    if (button < 0 || button > 4) return;
    if (pressed) this.mouse.add(button);
    else this.mouse.delete(button);
    if (pressed) this.useSource('mouse');
    this.evaluate();
  }

  gamepad(pad?: GamepadSample): void {
    const active =
      pad?.connected &&
      (pad.buttons.some((button) => button.pressed) ||
        pad.axes.some((axis) => Number.isFinite(axis) && Math.abs(axis) > deadZone));
    this.pad = pad?.connected ? pad : undefined;
    for (const button of this.heldButtons)
      if (!this.pad?.buttons[button]?.pressed) this.heldButtons.delete(button);
    for (const axis of this.heldAxes)
      if (Math.abs(this.pad?.axes[axis] ?? 0) <= deadZone) this.heldAxes.delete(axis);
    if (active) this.useSource('gamepad');
    this.evaluate();
  }

  trigger(action: string, pressed: boolean, source: InputSource = 'touch'): void {
    if (!this.states.has(action)) return;
    if (pressed) this.virtual.set(action, 1);
    else this.virtual.delete(action);
    if (pressed) this.useSource(source);
    this.evaluate();
  }

  value(action: string): number {
    return this.blocked ? 0 : (this.states.get(action)?.value ?? 0);
  }

  private read(binding: InputBinding): number {
    if (binding.kind === 'key')
      return Number(this.keys.has(binding.code) && keyModifiersMatch(binding, this.modifiers));
    if (binding.kind === 'mouse') return Number(this.mouse.has(binding.button));
    if (binding.kind === 'button')
      return !this.heldButtons.has(binding.button) && this.pad?.buttons[binding.button]?.pressed ? 1 : 0;
    if (this.heldAxes.has(binding.axis)) return 0;
    const axis = (this.pad?.axes[binding.axis] ?? 0) * binding.sign;
    return Number.isFinite(axis) ? Math.min(1, Math.max(0, (axis - deadZone) / (1 - deadZone))) : 0;
  }

  private evaluate(): void {
    if (this.disposed) return;
    const now = this.now();
    for (const action of this.actions) {
      const state = this.states.get(action.id)!;
      const previous = state.value;
      state.value =
        !this.blocked && action.contexts.includes(this.context)
          ? Math.max(
              this.virtual.get(action.id) ?? 0,
              ...(this.bindings[action.id] ?? []).map((binding) => this.read(binding)),
              0,
            )
          : 0;
      const threshold = action.threshold ?? 0.001;
      const active = state.value > threshold;
      const wasActive = previous > threshold;
      if (active && !wasActive) {
        state.nextRepeat = now + (action.repeat?.delayMs ?? Infinity);
        this.events.emit('action', {
          action: action.id,
          phase: 'press',
          value: state.value,
          source: this.source,
        });
      } else if (!active && wasActive)
        this.events.emit('action', { action: action.id, phase: 'release', value: 0, source: this.source });
      else if (active && action.repeat && now >= state.nextRepeat) {
        state.nextRepeat = now + action.repeat.intervalMs;
        this.events.emit('action', {
          action: action.id,
          phase: 'repeat',
          value: state.value,
          source: this.source,
        });
      }
    }
  }

  reset(): void {
    this.pad?.buttons.forEach((button, index) => {
      if (button.pressed) this.heldButtons.add(index);
    });
    this.pad?.axes.forEach((axis, index) => {
      if (Number.isFinite(axis) && Math.abs(axis) > deadZone) this.heldAxes.add(index);
    });
    this.keys.clear();
    this.mouse.clear();
    this.virtual.clear();
    this.pad = undefined;
    this.modifiers = {};
    for (const state of this.states.values()) {
      state.value = 0;
      state.nextRepeat = 0;
    }
    this.events.emit('reset', undefined);
  }

  dispose(): void {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.events.dispose();
  }
}
