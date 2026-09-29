import { controlGlyph } from '@supadub/assets/controls';

const fallback: Record<string, string> = {
  confirm: 'Enter',
  back: 'Escape',
  pause: 'Escape',
  account: 'F2',
  split: 'Space',
  eject: 'KeyW',
  boost: 'Space',
  quack: 'KeyQ',
  chat: 'Enter',
  emote: 'KeyR',
  'move-up': 'ArrowUp',
};
let provider = (action: string): string => controlGlyph({ kind: 'key', code: fallback[action] ?? 'Enter' });

export function setPromptProvider(next: (action: string) => string): void {
  provider = next;
}
export function promptGlyph(action: string): string {
  return `<span class="control-prompt" data-control-hint="${action}">${provider(action)}</span>`;
}
export function refreshControlPrompts(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-control-hint]')) {
    const next = provider(node.dataset.controlHint!);
    if (node.innerHTML !== next) node.innerHTML = next;
  }
}
