import {
  BrowserInputAdapter,
  InputController,
  bindingConflicts,
  bindingsOverlap,
  bindingKey,
  keyboardPlatform,
  validateBindings,
  validBinding,
} from '@supadub/inputengine';
import type { BindingMap, ControllerProfile, InputBinding } from '@supadub/inputengine';
import { CONTROL_ACTIONS, controlGlyph, defaultBindings, glyphSvg } from '@supadub/assets/controls';
import { escapeHtml, triangle } from '../ui/graphics';
import { parseControlPreferences, type ControlPreferences } from '@supadub/protocol';

const profiles: readonly ControllerProfile[] = ['xbox', 'playstation', 'nintendo', 'generic'];
const storageKey = 'supadub-controls-v1';

export function readControlPreferences(key = storageKey): ControlPreferences {
  const fallback: ControlPreferences = {
    version: 1,
    controller: 'auto',
    handedness: 'right',
    keyboard: {},
    pads: {},
  };
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!data || typeof data !== 'object') return fallback;
    const record = data as Record<string, unknown>;
    if (record.version !== 1) return fallback;
    const keyboard = validateBindings(CONTROL_ACTIONS, record.keyboard, 2);
    if (keyboard)
      fallback.keyboard = Object.fromEntries(
        Object.entries(keyboard).map(([id, bindings]) => [
          id,
          bindings.filter((binding) => binding.kind === 'key' || binding.kind === 'mouse'),
        ]),
      );
    if (record.controller === 'auto' || profiles.includes(record.controller as ControllerProfile))
      fallback.controller = record.controller as ControlPreferences['controller'];
    if (record.handedness === 'left') fallback.handedness = 'left';
    if (record.pads && typeof record.pads === 'object')
      for (const profile of profiles) {
        const parsed = validateBindings(
          CONTROL_ACTIONS,
          (record.pads as Record<string, unknown>)[profile],
          2,
        );
        if (parsed)
          fallback.pads[profile] = Object.fromEntries(
            Object.entries(parsed).map(([id, bindings]) => [
              id,
              bindings.filter((binding) => binding.kind === 'button' || binding.kind === 'axis'),
            ]),
          );
      }
  } catch {}
  return fallback;
}

export class ControlsController {
  private preferences = readControlPreferences();
  private detected: ControllerProfile = 'generic';
  readonly engine = new InputController(CONTROL_ACTIONS, this.mapping());
  readonly adapter = new BrowserInputAdapter(this.engine);
  private device: 'keyboard' | 'gamepad' = 'keyboard';
  private capture?: { action: string; slot: number };
  private pending?: { action: string; slot: number; binding: InputBinding };
  private notice = '';
  private syncNotice = '';
  private retrySave = false;
  onChange: () => void = () => {};
  onPrompts: () => void = () => {};
  onSave: (preferences: ControlPreferences) => void = (preferences) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {}
  };

  constructor() {
    this.adapter.onController = (profile) => {
      this.detected = profile;
      this.engine.setBindings(this.mapping());
      this.onPrompts();
    };
    this.adapter.onLabel = () => this.onPrompts();
    this.engine.events.on('source', () => this.onPrompts());
    document.body.classList.toggle('touch-left', this.preferences.handedness === 'left');
  }

  get profile(): ControllerProfile {
    return this.preferences.controller === 'auto' ? this.detected : this.preferences.controller;
  }

  private mapping(): BindingMap {
    const defaults = defaultBindings(this.profile);
    const result: Record<string, readonly InputBinding[]> = {};
    for (const action of CONTROL_ACTIONS) {
      const original = defaults[action.id] ?? [];
      result[action.id] = [
        ...(this.preferences.keyboard[action.id] ??
          original.filter((binding) => binding.kind === 'key' || binding.kind === 'mouse')),
        ...(this.preferences.pads[this.profile]?.[action.id] ??
          original.filter((binding) => binding.kind === 'button' || binding.kind === 'axis')),
      ];
    }
    return result;
  }

  glyph(action: string): string {
    if (this.engine.activeSource === 'touch') return glyphSvg({ label: 'TAP', shape: 'touch' });
    const pad = this.engine.activeSource === 'gamepad';
    const binding = this.engine.mapping[action]?.find((entry) =>
      pad ? entry.kind === 'button' || entry.kind === 'axis' : entry.kind === 'key' || entry.kind === 'mouse',
    );
    return binding
      ? controlGlyph(
          binding,
          this.profile,
          keyboardPlatform(),
          'normal',
          binding.kind === 'key' ? this.adapter.label(binding.code) : undefined,
        )
      : glyphSvg({ label: '—', shape: 'key' }, 'disabled');
  }

  private save(): void {
    this.onSave(structuredClone(this.preferences));
    this.publish();
  }

  private publish(): void {
    this.engine.setBindings(this.mapping());
    document.body.classList.toggle('touch-left', this.preferences.handedness === 'left');
    this.onPrompts();
    this.onChange();
  }

  restore(value: ControlPreferences): void {
    const preferences = parseControlPreferences(value);
    if (!preferences) return;
    this.cancelCapture();
    this.preferences = preferences;
    this.notice = '';
    this.publish();
  }

  syncStatus(message: string, retry = false): void {
    this.syncNotice = message;
    this.retrySave = retry;
    this.onChange();
  }

  private bindings(action: string): InputBinding[] {
    return [...(this.engine.mapping[action] ?? [])].filter((binding) =>
      this.device === 'keyboard'
        ? binding.kind === 'key' || binding.kind === 'mouse'
        : binding.kind === 'button' || binding.kind === 'axis',
    );
  }

  private assign(action: string, slot: number, binding: InputBinding, replace: boolean): void {
    const conflicts = bindingConflicts(CONTROL_ACTIONS, this.engine.mapping, action, binding);
    if (conflicts.length && !replace) {
      this.pending = { action, slot, binding };
      this.notice = `Also assigned to ${conflicts.map((entry) => CONTROL_ACTIONS.find((item) => item.id === entry.action)!.label).join(', ')}.`;
      this.onChange();
      return;
    }
    const overrides: Record<string, readonly InputBinding[]> = {
      ...(this.device === 'keyboard'
        ? this.preferences.keyboard
        : (this.preferences.pads[this.profile] ?? {})),
    };
    if (replace)
      for (const conflict of conflicts)
        overrides[conflict.action] = this.bindings(conflict.action).filter(
          (other) => !bindingsOverlap(other, binding),
        );
    const bindings = this.bindings(action).slice(0, 2);
    bindings[slot] = binding;
    overrides[action] = bindings
      .filter(Boolean)
      .filter(
        (entry, index, items) =>
          items.findIndex((other) => bindingKey(other) === bindingKey(entry)) === index,
      );
    if (this.device === 'keyboard') this.preferences.keyboard = overrides;
    else this.preferences.pads[this.profile] = overrides;
    this.pending = undefined;
    this.notice = 'Control saved.';
    this.save();
  }

  click(target: HTMLElement): boolean {
    if (target.dataset.bindAction) {
      this.pending = undefined;
      const action = target.dataset.bindAction;
      const slot = Number(target.dataset.bindSlot);
      this.capture = { action, slot };
      this.notice = 'Press a key or controller button. Escape cancels.';
      this.adapter.beginCapture((binding) => {
        this.capture = undefined;
        if (!binding) {
          this.notice = 'Binding canceled.';
          this.onChange();
          return;
        }
        const appropriate =
          this.device === 'keyboard'
            ? binding.kind === 'key' || binding.kind === 'mouse'
            : binding.kind === 'button' || binding.kind === 'axis';
        if (
          !validBinding(binding) ||
          !appropriate ||
          (binding.kind === 'key' && (binding.meta || binding.alt || binding.ctrl))
        ) {
          this.notice = 'Use a key for this device without a browser shortcut.';
          this.onChange();
          return;
        }
        this.assign(action, slot, binding, false);
      });
      this.onChange();
      return true;
    }
    switch (target.dataset.controlAction) {
      case 'wasd':
        this.preferences.keyboard = {
          'move-up': [
            { kind: 'key', code: 'KeyW' },
            { kind: 'key', code: 'ArrowUp' },
          ],
          'move-down': [
            { kind: 'key', code: 'KeyS' },
            { kind: 'key', code: 'ArrowDown' },
          ],
          'move-left': [
            { kind: 'key', code: 'KeyA' },
            { kind: 'key', code: 'ArrowLeft' },
          ],
          'move-right': [
            { kind: 'key', code: 'KeyD' },
            { kind: 'key', code: 'ArrowRight' },
          ],
          'practice-up': [],
          'practice-down': [],
          eject: [{ kind: 'key', code: 'KeyE' }],
        };
        this.pending = undefined;
        this.notice = 'WASD moves. E ejects. Space splits.';
        this.save();
        return true;
      case 'classic':
        this.preferences.keyboard = {};
        this.pending = undefined;
        this.notice = 'Arrow keys move. W ejects. Space splits.';
        this.save();
        return true;
      case 'device':
        this.device = this.device === 'keyboard' ? 'gamepad' : 'keyboard';
        this.notice = '';
        this.onChange();
        return true;
      case 'profile': {
        const values = ['auto', ...profiles] as const;
        this.preferences.controller =
          values[(values.indexOf(this.preferences.controller) + 1) % values.length]!;
        this.save();
        return true;
      }
      case 'hand':
        this.preferences.handedness = this.preferences.handedness === 'right' ? 'left' : 'right';
        this.save();
        return true;
      case 'reset':
        this.preferences.keyboard = {};
        this.preferences.pads = {};
        this.pending = undefined;
        this.notice = 'Default controls restored.';
        this.save();
        return true;
      case 'replace':
        if (this.pending) this.assign(this.pending.action, this.pending.slot, this.pending.binding, true);
        return true;
      case 'cancel':
        this.pending = undefined;
        this.notice = '';
        this.onChange();
        return true;
      default:
        return false;
    }
  }

  render(): string {
    return `<section class="controls-panel"><div class="controls-toolbar"><button data-control-action="device">${this.device.toUpperCase()} ${triangle('right')}</button><button data-control-action="profile">PAD: ${this.preferences.controller.toUpperCase()} ${triangle('right')}</button><button data-control-action="hand">TOUCH: ${this.preferences.handedness.toUpperCase()}</button><button data-control-action="reset">RESET</button></div><div class="controls-presets"><span>QUICK SETUP</span><button data-control-action="wasd">WASD + E EJECT</button><button data-control-action="classic">ARROWS + W EJECT</button></div><div id="controls-scroll" class="controls-scroll" data-preview-clip>${CONTROL_ACTIONS.map(
      (action) => {
        const bindings = this.bindings(action.id);
        return `<div class="binding-row"><span><b>${escapeHtml(action.label)}</b><small>${escapeHtml(action.contexts.join(' · '))}</small></span>${[0, 1].map((slot) => `<button data-bind-action="${action.id}" data-bind-slot="${slot}" aria-label="Change ${escapeHtml(action.label)}, binding ${slot + 1}" ${this.capture ? 'disabled' : ''}>${bindings[slot] ? controlGlyph(bindings[slot]!, this.profile, keyboardPlatform(), 'normal', bindings[slot]!.kind === 'key' ? this.adapter.label((bindings[slot] as { code: string }).code) : undefined) : '<span class="empty-binding">+</span>'}</button>`).join('')}</div>`;
      },
    ).join(
      '',
    )}</div><div class="control-notice" role="status">${escapeHtml(this.notice)}${this.pending ? '<button data-control-action="replace">REASSIGN</button><button data-control-action="cancel">CANCEL</button>' : ''}</div><div class="controls-sync" role="status"><span>${escapeHtml(this.syncNotice)}</span>${this.retrySave ? '<button data-control-sync="retry">SAVE MY KEYS</button><button data-control-sync="reload">LOAD SAVED KEYS</button>' : ''}</div></section>`;
  }

  cancelCapture(): void {
    this.adapter.cancelCapture();
    this.capture = undefined;
    this.pending = undefined;
  }
  dispose(): void {
    this.adapter.dispose();
    this.engine.dispose();
  }
}
