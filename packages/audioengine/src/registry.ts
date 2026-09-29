import type { AudioSequence, SoundPlan, SoundRecipe } from './types';

const identifier = /^[a-z][a-z0-9.-]{0,63}$/;
const waves = new Set(['sine', 'square', 'sawtooth', 'triangle']);
const filters = new Set([
  'lowpass',
  'highpass',
  'bandpass',
  'lowshelf',
  'highshelf',
  'peaking',
  'notch',
  'allpass',
]);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function range(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export class SoundRegistry {
  private readonly sounds = new Map<string, SoundRecipe>();
  private readonly sequences = new Map<string, AudioSequence>();

  registerSounds(recipes: readonly SoundRecipe[]): void {
    if (this.sounds.size + recipes.length > 128) throw new RangeError('Sound registry capacity exceeded.');
    const ids = new Set(this.sounds.keys());
    for (const recipe of recipes) {
      if (!identifier.test(recipe.id) || ids.has(recipe.id))
        throw new TypeError('Sound ID is invalid or duplicated.');
      if (typeof recipe.create !== 'function')
        throw new TypeError('Sound recipe requires a create function.');
      if (recipe.bus && !identifier.test(recipe.bus)) throw new TypeError('Sound bus ID is invalid.');
      if (
        !Number.isFinite(recipe.cooldown ?? 0) ||
        (recipe.cooldown ?? 0) < 0 ||
        (recipe.cooldown ?? 0) > 60
      ) {
        throw new RangeError('Sound cooldown is outside its limits.');
      }
      if (
        !Number.isFinite(recipe.priority ?? 1) ||
        (recipe.priority ?? 1) < 0 ||
        (recipe.priority ?? 1) > 10
      ) {
        throw new RangeError('Sound priority is outside its limits.');
      }
      ids.add(recipe.id);
    }
    for (const recipe of recipes) this.sounds.set(recipe.id, recipe);
  }

  registerSequences(sequences: readonly AudioSequence[]): void {
    if (this.sequences.size + sequences.length > 32)
      throw new RangeError('Sequence registry capacity exceeded.');
    const ids = new Set(this.sequences.keys());
    for (const sequence of sequences) {
      if (!identifier.test(sequence.id) || ids.has(sequence.id))
        throw new TypeError('Sequence ID is invalid or duplicated.');
      if (typeof sequence.create !== 'function') throw new TypeError('Sequence requires a create function.');
      if (!Number.isFinite(sequence.interval) || sequence.interval < 0.025 || sequence.interval > 60) {
        throw new RangeError('Sequence interval is outside its limits.');
      }
      ids.add(sequence.id);
    }
    for (const sequence of sequences) this.sequences.set(sequence.id, sequence);
  }

  sound(id: string): SoundRecipe | undefined {
    return this.sounds.get(id);
  }
  sequence(id: string): AudioSequence | undefined {
    return this.sequences.get(id);
  }
  get size(): number {
    return this.sounds.size;
  }
  get sequenceCount(): number {
    return this.sequences.size;
  }

  clear(): void {
    this.sounds.clear();
    this.sequences.clear();
  }
}

function validCurve(curve: unknown, duration: number, minimum: number, maximum: number): boolean {
  if (!Array.isArray(curve) || curve.length < 1 || curve.length > 24) return false;
  let previous = -1;
  return curve.every((point) => {
    if (
      !object(point) ||
      !range(point.time, Math.max(0, previous), duration) ||
      !range(point.value, minimum, maximum)
    )
      return false;
    const valid =
      (point.curve === undefined ||
        point.curve === 'set' ||
        point.curve === 'linear' ||
        point.curve === 'exponential') &&
      (point.curve !== 'exponential' || point.value > 0);
    previous = point.time;
    return valid;
  });
}

export function validSoundPlan(plan: unknown): plan is SoundPlan {
  if (!object(plan) || !Array.isArray(plan.voices) || plan.voices.length < 1 || plan.voices.length > 16)
    return false;
  return plan.voices.every((voice) => {
    if (!object(voice) || !range(voice.duration, 0.000001, 12) || !object(voice.source)) return false;
    if (!range(voice.delay ?? 0, 0, 4) || !range(voice.pan ?? 0, -1, 1)) return false;
    if (!validCurve(voice.envelope, voice.duration, 0, 1)) return false;
    if (voice.source.kind === 'oscillator') {
      if (
        typeof voice.source.wave !== 'string' ||
        !waves.has(voice.source.wave) ||
        !validCurve(voice.source.frequency, voice.duration, 1, 24000)
      )
        return false;
    } else if (
      voice.source.kind !== 'noise' ||
      typeof voice.source.color !== 'string' ||
      !['white', 'pink', 'brown'].includes(voice.source.color)
    )
      return false;
    return (
      voice.filter === undefined ||
      (object(voice.filter) &&
        typeof voice.filter.type === 'string' &&
        filters.has(voice.filter.type) &&
        validCurve(voice.filter.frequency, voice.duration, 1, 24000) &&
        range(voice.filter.q ?? 1, 0, 30))
    );
  });
}
