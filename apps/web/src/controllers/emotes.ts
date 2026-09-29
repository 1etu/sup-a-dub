import { getItem, type EmoteId } from '@supadub/cosmetics';
import { cosmeticIcon } from '@supadub/assets';
import { escapeHtml } from '../ui/graphics';
import { promptGlyph } from '../ui/control-prompts';

export class EmoteWheel {
  private readonly host = document.createElement('section');
  private ids: readonly EmoteId[] = [];
  private selected = 0;
  onSend: (id: EmoteId) => void = () => {};
  onClose: () => void = () => {};
  constructor(parent: HTMLElement) {
    this.host.className = 'emote-wheel';
    this.host.hidden = true;
    this.host.setAttribute('aria-label', 'Choose an emote');
    this.host.setAttribute('role', 'dialog');
    this.host.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-wheel-index]');
      if (button) {
        this.selected = Number(button.dataset.wheelIndex);
        this.confirm();
      }
    });
    parent.append(this.host);
  }
  get visible(): boolean {
    return !this.host.hidden;
  }
  open(ids: readonly EmoteId[]): void {
    this.ids = ids.slice(0, 4);
    this.selected = 0;
    this.host.innerHTML = `<h2>MAKE A FACE!</h2><div class="emote-choices">${this.ids.map((id, index) => `<button data-wheel-index="${index}" class="${index === 0 ? 'selected' : ''}"><img src="${cosmeticIcon(id)}" alt=""/><span>${escapeHtml(getItem(id)?.name ?? id)}</span></button>`).join('')}</div><p>${promptGlyph('confirm')} SEND ${promptGlyph('back')} CLOSE</p>`;
    this.host.hidden = false;
  }
  move(direction: number): void {
    if (!this.ids.length) return;
    this.selected = (this.selected + direction + this.ids.length) % this.ids.length;
    this.host
      .querySelectorAll('button')
      .forEach((button, index) => button.classList.toggle('selected', index === this.selected));
  }
  confirm(): void {
    const id = this.ids[this.selected];
    if (id) this.onSend(id);
    this.close();
  }
  close(): void {
    if (!this.visible) return;
    this.host.hidden = true;
    this.onClose();
  }
  dispose(): void {
    this.host.remove();
  }
}
