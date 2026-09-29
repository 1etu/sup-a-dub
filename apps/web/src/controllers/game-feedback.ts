import type { AudioEngine } from '@supadub/audioengine';
import type { GameEvent } from '@supadub/protocol';
import type { GameSoundName } from '@supadub/assets/sfx';

const sounds: Record<GameEvent['event'], GameSoundName> = {
  collect: 'collect',
  steal: 'steal',
  lost: 'lost',
  saved: 'rescue',
  split: 'split',
  eject: 'eject',
  merge: 'bubble',
  shark: 'shark-bite',
  'shark-feed': 'shark-feed',
  'shark-launch': 'shark-launch',
};

export class GameFeedback {
  constructor(
    private readonly audio: AudioEngine,
    private readonly effect: (strength: number) => void,
    private readonly toast: (message: string) => void,
  ) {}
  receive(event: GameEvent): void {
    const sound = sounds[event.event];
    if (sound) this.audio.play(sound);
    this.effect(event.event === 'collect' ? 0.6 : 1.2);
    if (event.event === 'saved') this.toast(`${event.amount} DUCKS SAVED!`);
    else if (event.event === 'steal') this.toast(`+${event.amount} · WHAT A FLOCK!`);
    else if (event.event === 'lost') this.toast(`${event.amount} DUCKS LOST!`);
  }
}
