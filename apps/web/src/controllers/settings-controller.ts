import type { AudioEngine } from '@supadub/audioengine';
import type { GameScene } from '@supadub/gameengine';
import { saveSettings, type Settings } from '../settings';

export class SettingsController {
  constructor(
    private readonly settings: Settings,
    private readonly audio: AudioEngine,
    private readonly scene: () => GameScene,
    private readonly refresh: () => void,
    private readonly qualityChanged: (low: boolean) => void = () => {},
  ) {}

  change(input: HTMLInputElement): void {
    if (input.id === 'player-name') this.settings.name = input.value;
    else if (input.id === 'volume') {
      this.settings.volume = Math.max(0, Math.min(1, Number(input.value) / 100));
      this.audio.setVolume(this.settings.volume);
    } else if (
      input.id === 'music-volume' ||
      input.id === 'effects-volume' ||
      input.id === 'ambience-volume'
    ) {
      const gain = Math.max(0, Math.min(1, Number(input.value) / 100));
      if (input.id === 'music-volume') this.settings.musicVolume = gain;
      if (input.id === 'effects-volume') this.settings.effectsVolume = gain;
      if (input.id === 'ambience-volume') this.settings.ambienceVolume = gain;
      this.mix();
    } else return;
    saveSettings(this.settings);
  }

  toggle(setting: string): void {
    const settings = this.settings;
    switch (setting) {
      case 'muted':
      case 'music':
      case 'softness':
      case 'reducedMotion':
        settings[setting] = !settings[setting];
        break;
      case 'quality': {
        const values = ['auto', 'high', 'low'] as const;
        settings.quality = values[(values.indexOf(settings.quality) + 1) % values.length]!;
        break;
      }
      case 'theme': {
        const values = ['blue', 'hearts', 'stars', 'dots'] as const;
        settings.theme = values[(values.indexOf(settings.theme) + 1) % values.length]!;
        break;
      }
      default:
        return;
    }
    this.apply();
    this.audio.play('select');
    this.refresh();
  }

  apply(): void {
    const settings = this.settings;
    this.audio.setMuted(settings.muted);
    this.audio.setMusic(settings.music);
    this.audio.setVolume(settings.volume);
    this.mix();
    this.scene().setQuality(settings.quality, settings.reducedMotion);
    this.qualityChanged(settings.quality === 'low');
    this.scene().setTheme(settings.theme);
    this.scene().setSoftness(settings.softness);
    document.body.classList.toggle('soft-picture', settings.softness);
    document.body.classList.toggle('gentle-motion', settings.reducedMotion);
    saveSettings(settings);
  }

  private mix(): void {
    this.audio.setBusGain('music', (this.settings.musicVolume ?? 0.75) * 0.6);
    this.audio.setBusGain('effects', this.settings.effectsVolume ?? 1);
    this.audio.setBusGain('ambience', (this.settings.ambienceVolume ?? 0.65) * 0.5);
  }
}
