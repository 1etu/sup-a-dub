import { AudioEngine } from '@supadub/audioengine';
import { GAME_AUDIO, type GameSoundName } from '@supadub/assets/sfx';
import { element } from './dom';

export class PageSound {
  private readonly engine = new AudioEngine({ ...GAME_AUDIO, maxVoices: 12 });
  private readonly button = element<HTMLButtonElement>('.sound-switch');
  private readonly label = element('[data-sound-label]');
  private enabled = false;
  private filmPlaying = false;

  constructor() {
    this.engine.setVolume(0.32);
    this.engine.setMuted(true);
    this.button.addEventListener('click', () => {
      this.enabled = !this.enabled;
      this.button.setAttribute('aria-pressed', String(this.enabled));
      this.button.setAttribute('aria-label', `Turn sound ${this.enabled ? 'off' : 'on'}`);
      this.label.textContent = `SOUND ${this.enabled ? 'ON' : 'OFF'}`;
      void this.update();
    });
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = (): void => {
    void this.update();
  };

  private async update(): Promise<void> {
    const playing = () => this.enabled && !this.filmPlaying && !document.hidden;
    if (!playing()) {
      this.engine.setMuted(true);
      this.engine.stopAmbience();
      await this.engine.suspend();
      return;
    }
    await this.engine.unlock();
    if (!playing()) return;
    this.engine.setMuted(false);
    this.engine.startAmbience();
  }

  film(playing: boolean): void {
    this.filmPlaying = playing;
    void this.update();
  }

  play(name: GameSoundName): void {
    if (this.enabled && !this.filmPlaying && !document.hidden) this.engine.play(name);
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.engine.dispose();
  }
}
