export type SoundName = string;
export type AudioCurve = readonly AudioPoint[];
export type AudioPoint = Readonly<{
  time: number;
  value: number;
  curve?: 'set' | 'linear' | 'exponential';
}>;
export type NoiseColor = 'white' | 'pink' | 'brown';
export type VoiceSource =
  | Readonly<{ kind: 'oscillator'; wave: OscillatorType; frequency: AudioCurve }>
  | Readonly<{ kind: 'noise'; color: NoiseColor }>;
export type SoundVoice = Readonly<{
  source: VoiceSource;
  duration: number;
  delay?: number;
  envelope: AudioCurve;
  filter?: Readonly<{ type: BiquadFilterType; frequency: AudioCurve; q?: number }>;
  pan?: number;
}>;
export type SoundPlan = Readonly<{ voices: readonly SoundVoice[] }>;
export type SoundParameters = Readonly<Record<string, number>>;
export type RecipeContext = Readonly<{
  occurrence: number;
  elapsed: number;
  parameters: SoundParameters;
  random(): number;
}>;
export type SoundRecipe = Readonly<{
  id: string;
  bus?: string;
  cooldown?: number;
  priority?: number;
  create(context: RecipeContext): SoundPlan;
}>;
export type SoundRequest = Readonly<{
  id: string;
  parameters?: SoundParameters;
  gain?: number;
  pan?: number;
  delay?: number;
}>;
export type SequenceContext = Readonly<{
  step: number;
  time: number;
  random(): number;
}>;
export type AudioSequence = Readonly<{
  id: string;
  interval: number;
  create(context: SequenceContext): readonly SoundRequest[];
}>;
export type AudioBusDefinition = Readonly<{ id: string; gain: number }>;
export type AudioCatalog = Readonly<{
  sounds: readonly SoundRecipe[];
  sequences?: readonly AudioSequence[];
  ambience?: readonly string[];
  buses?: readonly AudioBusDefinition[];
}>;
export interface AudioAdapter {
  readonly context: BaseAudioContext | undefined;
  readonly running: boolean;
  prepare?(): BaseAudioContext | undefined;
  unlock(): Promise<BaseAudioContext | undefined>;
  suspend(): Promise<void>;
  dispose(): Promise<void>;
}
export interface SchedulerDriver {
  every(milliseconds: number, callback: () => void): unknown;
  cancel(handle: unknown): void;
}
export type AudioEngineOptions = Partial<AudioCatalog> & {
  adapter?: AudioAdapter;
  scheduler?: SchedulerDriver;
  maxVoices?: number;
  seed?: number;
  onError?: (error: unknown) => void;
};
export type PlayOptions = Omit<SoundRequest, 'id'>;
export interface VoiceHandle {
  onEnded(callback: () => void): void;
  stop(): void;
}
