import { MenuMotion } from '@supadub/gameengine';
import type { MenuArtwork } from '@supadub/gameengine';
import { captureMenuArt } from './menu-art';

export class MenuSurface {
  private enabled = false;
  private suspended = false;
  private disposed = false;
  private revision = 0;
  private frame = 0;
  private pending = false;
  private dirty = false;
  private lastCapture = 0;
  private animatedUntil = 0;
  private currentArtwork: MenuArtwork | undefined;
  private readonly observer: MutationObserver;
  private readonly invalidate = (event: Event) => {
    if (event.type === 'selectionchange' && !(document.activeElement instanceof HTMLInputElement)) return;
    if (event.target instanceof Element && event.target.closest('.main-menu')) return;
    this.refresh();
  };
  private readonly scroll = (event: Event) => {
    const content = event.target;
    if (this.enabled && content instanceof HTMLElement && content.id)
      this.motion.setScroll(content.id, content.scrollLeft, content.scrollTop);
  };
  private readonly animate = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('.main-menu')) return;
    this.animatedUntil = performance.now() + 240;
    this.refresh();
  };

  constructor(
    private readonly shell: HTMLElement,
    private readonly overlay: HTMLElement,
    private readonly motion: MenuMotion,
    private readonly reducedMotion: () => boolean,
  ) {
    this.observer = new MutationObserver((records) => {
      const contentChanged = records.some(
        (record) =>
          record.type !== 'attributes' ||
          record.attributeName !== 'class' ||
          !(record.target instanceof Element) ||
          !record.target.matches('.main-menu [data-nav]'),
      );
      if (contentChanged) this.refresh();
    });
    this.observer.observe(overlay, { subtree: true, childList: true, attributes: true, characterData: true });
    for (const event of ['input', 'focusin', 'focusout'])
      overlay.addEventListener(event, this.invalidate, true);
    overlay.addEventListener('scroll', this.scroll, true);
    overlay.addEventListener('transitionrun', this.animate);
    overlay.addEventListener('transitionend', this.invalidate);
    document.addEventListener('selectionchange', this.invalidate);
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    this.revision++;
    if (enabled) this.refresh();
    else {
      this.currentArtwork = undefined;
      this.dirty = false;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.motion.hide();
      this.restoreDom();
    }
  }

  suspend(suspended: boolean): void {
    this.suspended = suspended;
    this.revision++;
    if (!suspended) this.refresh();
  }

  present(artwork: MenuArtwork): void {
    if (this.disposed || !this.enabled) return;
    this.currentArtwork = artwork;
    this.motion.present(artwork, this.reducedMotion());
    if (artwork.scroll) {
      const content = document.getElementById(artwork.scroll.id);
      if (content && this.overlay.contains(content))
        this.motion.setScroll(artwork.scroll.id, content.scrollLeft, content.scrollTop);
    }
    this.shell.style.opacity = '0';
    this.shell.dataset.composited = 'true';
  }

  get artwork(): MenuArtwork | undefined {
    return this.currentArtwork;
  }

  refresh(): void {
    if (this.disposed || !this.enabled) return;
    this.dirty = true;
    if (!this.suspended && !this.frame && !this.pending)
      this.frame = requestAnimationFrame((time) => void this.capture(time));
  }

  private restoreDom(): void {
    this.shell.style.opacity = '';
    delete this.shell.dataset.composited;
  }

  recover(): void {
    this.currentArtwork = undefined;
    this.enabled = false;
    this.revision++;
    this.dirty = false;
    this.motion.hide();
    this.restoreDom();
  }

  private async capture(time: number): Promise<void> {
    this.frame = 0;
    if (this.disposed || !this.enabled || this.suspended || this.pending || !this.dirty) return;
    if (time - this.lastCapture < 50) {
      this.refresh();
      return;
    }
    this.pending = true;
    this.dirty = false;
    this.lastCapture = time;
    const revision = this.revision;
    try {
      const artwork = await captureMenuArt(this.overlay);
      if (revision === this.revision && this.enabled && !this.suspended) this.present(artwork);
    } catch (error) {
      this.recover();
      console.error('Menu artwork could not render.', error);
    } finally {
      this.pending = false;
      if (this.dirty || performance.now() < this.animatedUntil) this.refresh();
    }
  }

  dispose(): void {
    this.currentArtwork = undefined;
    this.disposed = true;
    this.observer.disconnect();
    cancelAnimationFrame(this.frame);
    for (const event of ['input', 'focusin', 'focusout'])
      this.overlay.removeEventListener(event, this.invalidate, true);
    this.overlay.removeEventListener('scroll', this.scroll, true);
    this.overlay.removeEventListener('transitionrun', this.animate);
    this.overlay.removeEventListener('transitionend', this.invalidate);
    document.removeEventListener('selectionchange', this.invalidate);
    this.motion.hide();
    this.restoreDom();
  }
}
