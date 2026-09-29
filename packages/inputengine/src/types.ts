export type InputSource = 'keyboard' | 'mouse' | 'gamepad' | 'touch';
export type ControllerProfile = 'xbox' | 'playstation' | 'nintendo' | 'generic';
export type KeyboardPlatform = 'pc' | 'mac';
export type KeyModifiers = { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean };
export type InputBinding =
  | ({ kind: 'key'; code: string } & KeyModifiers)
  | { kind: 'mouse'; button: number }
  | { kind: 'button'; button: number }
  | { kind: 'axis'; axis: number; sign: -1 | 1 };
export type InputAction = Readonly<{
  id: string;
  label: string;
  contexts: readonly string[];
  threshold?: number;
  repeat?: Readonly<{ delayMs: number; intervalMs: number }>;
}>;
export type BindingMap = Readonly<Record<string, readonly InputBinding[]>>;
export type ActionEvent = {
  action: string;
  phase: 'press' | 'repeat' | 'release';
  value: number;
  source: InputSource;
};
export type InputEvents = { action: ActionEvent; source: InputSource; reset: undefined };
export type BindingConflict = { action: string; binding: InputBinding };
export type GamepadSample = Readonly<{
  id: string;
  connected: boolean;
  buttons: readonly { readonly pressed: boolean; readonly value: number }[];
  axes: readonly number[];
}>;
