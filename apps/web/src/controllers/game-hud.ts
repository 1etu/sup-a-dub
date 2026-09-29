import type { WorldSnapshot } from '@supadub/protocol';
import type { ViewState } from '../ui/screens';
import { timecode } from '../ui/graphics';
import { gameplayPrompts } from '../ui/game-hud';

export class GameHud {
  private timer = 0;
  constructor(
    private readonly root: HTMLElement,
    private readonly state: ViewState,
  ) {}
  update(
    snapshot: WorldSnapshot | null,
    playerId: string,
    status: string,
    latency: number,
    fps: number,
  ): void {
    if (!snapshot || this.root.hidden) return;
    const self = snapshot.players.find((player) => player.id === playerId);
    if (self) {
      if (snapshot.mode === 'endless') this.state.bestScore = Math.max(this.state.bestScore, self.score);
      this.text(
        '#main-score',
        snapshot.practice ? timecode(snapshot.practice.elapsedMs) : self.score.toLocaleString(),
      );
      this.text('#flock-count', String(snapshot.practice?.savedDucks ?? self.chain));
      this.text('#piece-count', String(self.bodyCount ?? 1));
      if (snapshot.practice)
        this.text(
          '#game-hint',
          self.chain
            ? `${self.chain} IN YOUR CHAIN · LEAD THEM TO THE PINK EXIT`
            : 'POP THE BUBBLES · FIND THE PINK EXIT',
        );
      else {
        const element = this.root.querySelector<HTMLElement>('#game-hint');
        const protectedFlock = self.protectedUntil > snapshot.time;
        this.text('#flock-notice', protectedFlock ? 'SAFE SPLASH' : '');
        const mode = `controls-${this.state.featureFlags.chat}`;
        if (element && element.dataset.hintMode !== mode) {
          element.dataset.hintMode = mode;
          element.innerHTML = gameplayPrompts(this.state.featureFlags.chat);
        }
      }
    }
    this.text(
      '#connection-info',
      status === 'connected' ? `${latency} MS · ${fps} FPS` : status.toUpperCase(),
    );
  }

  toast(message: string): void {
    const element = this.root.querySelector('#event-toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => element.classList.remove('visible'), 2400);
  }
  private text(selector: string, value: string): void {
    const element = this.root.querySelector(selector);
    if (element && element.textContent !== value) element.textContent = value;
  }
  dispose(): void {
    clearTimeout(this.timer);
  }
}
