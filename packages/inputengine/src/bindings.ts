import type { BindingConflict, BindingMap, InputAction, InputBinding, KeyModifiers } from './types';

const keyPattern =
  /^(Key[A-Z]|Digit[0-9]|Numpad[A-Za-z0-9]+|F([1-9]|1[0-2])|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$/;

export function validBinding(value: unknown): value is InputBinding {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (item.kind === 'key')
    return (
      typeof item.code === 'string' &&
      keyPattern.test(item.code) &&
      ['ctrl', 'alt', 'shift', 'meta'].every(
        (key) => item[key] === undefined || typeof item[key] === 'boolean',
      )
    );
  if (item.kind === 'mouse')
    return Number.isInteger(item.button) && Number(item.button) >= 0 && Number(item.button) <= 4;
  if (item.kind === 'button')
    return Number.isInteger(item.button) && Number(item.button) >= 0 && Number(item.button) < 32;
  return (
    item.kind === 'axis' &&
    Number.isInteger(item.axis) &&
    Number(item.axis) >= 0 &&
    Number(item.axis) < 8 &&
    (item.sign === -1 || item.sign === 1)
  );
}

export function bindingKey(binding: InputBinding): string {
  if (binding.kind === 'key')
    return `key:${binding.code}:${Number(!!binding.ctrl)}${Number(!!binding.alt)}${Number(!!binding.shift)}${Number(!!binding.meta)}`;
  if (binding.kind === 'axis') return `axis:${binding.axis}:${binding.sign}`;
  return `${binding.kind}:${binding.button}`;
}

export function keyModifiersMatch(
  binding: Extract<InputBinding, { kind: 'key' }>,
  modifiers: KeyModifiers,
): boolean {
  const own = binding.code.replace(/(Left|Right)$/, '');
  return (
    (own === 'Control' || !!binding.ctrl === !!modifiers.ctrl) &&
    (own === 'Alt' || !!binding.alt === !!modifiers.alt) &&
    (own === 'Meta' || !!binding.meta === !!modifiers.meta) &&
    (own === 'Shift' || !binding.shift || !!modifiers.shift)
  );
}

export function bindingConflicts(
  actions: readonly InputAction[],
  bindings: BindingMap,
  actionId: string,
  binding: InputBinding,
): BindingConflict[] {
  const action = actions.find((entry) => entry.id === actionId);
  if (!action) return [];
  return actions
    .filter(
      (entry) => entry.id !== actionId && entry.contexts.some((context) => action.contexts.includes(context)),
    )
    .flatMap((entry) =>
      (bindings[entry.id] ?? [])
        .filter((other) => bindingsOverlap(other, binding))
        .map((other) => ({ action: entry.id, binding: other })),
    );
}

export function bindingsOverlap(first: InputBinding, second: InputBinding): boolean {
  if (first.kind !== 'key' || second.kind !== 'key') return bindingKey(first) === bindingKey(second);
  if (first.code !== second.code) return false;
  for (let mask = 0; mask < 16; mask++) {
    const modifiers = { ctrl: !!(mask & 1), alt: !!(mask & 2), shift: !!(mask & 4), meta: !!(mask & 8) };
    if (keyModifiersMatch(first, modifiers) && keyModifiersMatch(second, modifiers)) return true;
  }
  return false;
}

export function validateBindings(
  actions: readonly InputAction[],
  value: unknown,
  limit = 4,
): BindingMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const entries = Object.entries(value);
  if (entries.length > actions.length) return;
  const ids = new Set(actions.map((entry) => entry.id));
  const result: Record<string, InputBinding[]> = {};
  for (const [id, bindings] of entries) {
    if (!ids.has(id) || !Array.isArray(bindings) || bindings.length > limit || !bindings.every(validBinding))
      return;
    const seen = new Set<string>();
    result[id] = bindings
      .filter((binding) => {
        const key = bindingKey(binding);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((binding) => ({ ...binding }));
  }
  return result;
}
