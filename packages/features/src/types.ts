export type FeatureFlags = Readonly<Record<string, boolean>>;
export interface FeatureInstance {
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
export interface FeatureDefinition<Context> {
  id: string;
  requires?: readonly string[];
  create(context: Context): FeatureInstance | Promise<FeatureInstance>;
}
export interface FeatureState {
  id: string;
  enabled: boolean;
  active: boolean;
}
