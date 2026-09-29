import { FeatureHost, type FeatureFlags } from '@supadub/features';

export const SERVER_FEATURE_IDS = ['chat', 'moderation', 'profiles', 'rankings', 'collection'] as const;
export type ServerFeatureId = (typeof SERVER_FEATURE_IDS)[number];
export type ServerFeatureFlags = Partial<Record<ServerFeatureId, boolean>>;

export class ServerFeatures {
  private readonly active = new Set<ServerFeatureId>();
  readonly host: FeatureHost<ServerFeatures>;

  constructor(overrides: ServerFeatureFlags = {}) {
    if (Object.keys(overrides).some((id) => !(SERVER_FEATURE_IDS as readonly string[]).includes(id)))
      throw new Error('This server feature is not registered.');
    const flags: FeatureFlags = Object.fromEntries(
      SERVER_FEATURE_IDS.map((id) => [id, overrides[id] ?? true]),
    );
    this.host = new FeatureHost(this, flags);
    for (const id of SERVER_FEATURE_IDS)
      this.host.register({
        id,
        create: (context) => ({
          start: () => {
            context.active.add(id);
          },
          stop: () => {
            context.active.delete(id);
          },
        }),
      });
  }

  enabled(id: ServerFeatureId): boolean {
    return this.active.has(id);
  }
  start(): Promise<void> {
    return this.host.start();
  }
  stop(): Promise<void> {
    return this.host.dispose();
  }
  manifest() {
    return this.host.manifest();
  }
}
