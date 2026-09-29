import type { BindingMap, ControllerProfile, InputAction, InputBinding } from '@supadub/inputengine';

const repeat = { delayMs: 320, intervalMs: 110 };
export const CONTROL_ACTIONS: readonly InputAction[] = Object.freeze([
  { id: 'menu-up', label: 'Menu up', contexts: ['menu', 'emote'], repeat, threshold: 0.5 },
  { id: 'menu-down', label: 'Menu down', contexts: ['menu', 'emote'], repeat, threshold: 0.5 },
  { id: 'menu-left', label: 'Previous choice', contexts: ['menu', 'emote'], repeat, threshold: 0.5 },
  { id: 'menu-right', label: 'Next choice', contexts: ['menu', 'emote'], repeat, threshold: 0.5 },
  { id: 'confirm', label: 'Confirm / skip', contexts: ['menu', 'results', 'emote'] },
  { id: 'account', label: 'Account', contexts: ['menu'] },
  { id: 'back', label: 'Back', contexts: ['menu', 'results', 'chat', 'emote'] },
  { id: 'pause', label: 'Pause menu', contexts: ['practice', 'endless'] },
  { id: 'move-up', label: 'Swim forward', contexts: ['practice', 'endless'] },
  { id: 'move-down', label: 'Swim back', contexts: ['practice', 'endless'] },
  { id: 'move-left', label: 'Swim left', contexts: ['practice', 'endless'] },
  { id: 'move-right', label: 'Swim right', contexts: ['practice', 'endless'] },
  { id: 'practice-up', label: 'Practice forward', contexts: ['practice'] },
  { id: 'practice-down', label: 'Practice back', contexts: ['practice'] },
  { id: 'split', label: 'Split your flock', contexts: ['endless'] },
  { id: 'eject', label: 'Eject mass', contexts: ['endless'], repeat: { delayMs: 210, intervalMs: 210 } },
  { id: 'boost', label: 'Practice boost', contexts: ['practice'] },
  { id: 'quack', label: 'Quack', contexts: ['practice', 'endless'] },
  { id: 'chat', label: 'Pool chat', contexts: ['practice', 'endless'] },
  { id: 'emote', label: 'Emote wheel', contexts: ['practice', 'endless', 'emote'] },
]);

const key = (code: string): InputBinding => ({ kind: 'key', code });
const button = (value: number): InputBinding => ({ kind: 'button', button: value });
const axis = (value: number, sign: -1 | 1): InputBinding => ({ kind: 'axis', axis: value, sign });

export function defaultBindings(profile: ControllerProfile = 'generic'): BindingMap {
  const confirm = profile === 'nintendo' ? 1 : 0;
  const back = profile === 'nintendo' ? 0 : 1;
  return {
    'menu-up': [key('ArrowUp'), button(12), axis(1, -1)],
    'menu-down': [key('ArrowDown'), button(13), axis(1, 1)],
    'menu-left': [key('ArrowLeft'), button(14), axis(0, -1)],
    'menu-right': [key('ArrowRight'), button(15), axis(0, 1)],
    confirm: [key('Enter'), button(confirm)],
    account: [key('F2'), button(3)],
    back: [key('Escape'), button(back), button(9)],
    pause: [key('Escape'), button(9)],
    'move-up': [key('ArrowUp'), axis(1, -1)],
    'move-down': [key('ArrowDown'), axis(1, 1)],
    'move-left': [key('ArrowLeft'), key('KeyA'), axis(0, -1)],
    'move-right': [key('ArrowRight'), key('KeyD'), axis(0, 1)],
    'practice-up': [key('KeyW')],
    'practice-down': [key('KeyS')],
    split: [key('Space'), button(0)],
    eject: [key('KeyW'), button(1)],
    boost: [key('Space'), key('ShiftLeft'), button(0)],
    quack: [key('KeyQ'), button(2)],
    chat: [key('Enter'), button(8)],
    emote: [key('KeyR'), button(3)],
  };
}
