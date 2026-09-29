import { Registry } from '@supadub/core';
import type { FeatureDefinition, FeatureFlags, FeatureInstance, FeatureState } from './types';
export class FeatureHost<Context> {
  private readonly definitions = new Registry<string, FeatureDefinition<Context>>(64);
  private readonly active = new Map<string, FeatureInstance>();
  private readonly flags: FeatureFlags;
  private starting: Promise<void> | undefined;
  private stopping: Promise<void> | undefined;
  private disposed = false;
  constructor(
    private readonly context: Context,
    flags: FeatureFlags,
  ) {
    this.flags = Object.freeze({ ...flags });
  }
  register(definition: FeatureDefinition<Context>): void {
    if (this.disposed || this.starting || this.active.size)
      throw new Error('Register features before startup.');
    if (!/^[a-z][a-z0-9-]{0,47}$/.test(definition.id)) throw new Error('Use a valid feature ID.');
    this.definitions.register(
      definition.id,
      Object.freeze({ ...definition, requires: [...(definition.requires ?? [])] }),
    );
  }
  enabled(id: string): boolean {
    return this.flags[id] === true;
  }
  manifest(): readonly FeatureState[] {
    return this.definitions
      .keys()
      .map((id) => ({ id, enabled: this.enabled(id), active: this.active.has(id) }));
  }
  private order(): FeatureDefinition<Context>[] {
    const order: FeatureDefinition<Context>[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error('Feature dependencies contain a cycle.');
      const feature = this.definitions.require(id);
      if (!this.enabled(id)) throw new Error(`The required feature ${id} is disabled.`);
      visiting.add(id);
      for (const dependency of feature.requires ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
      order.push(feature);
    };
    for (const id of this.definitions.keys()) if (this.enabled(id)) visit(id);
    return order;
  }
  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('The feature host is closed.'));
    if (this.starting) return this.starting;
    if (this.stopping) return this.stopping.then(() => this.start());
    if (this.active.size) return Promise.resolve();
    this.starting = this.startFeatures().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }
  private async startFeatures(): Promise<void> {
    try {
      for (const definition of this.order()) {
        const instance = await definition.create(this.context);
        this.active.set(definition.id, instance);
        await instance.start?.();
      }
    } catch (error) {
      try {
        await this.release();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Feature startup failed.');
      }
      throw error;
    }
  }
  private async release(): Promise<void> {
    const instances = [...this.active.values()].reverse();
    this.active.clear();
    const errors: unknown[] = [];
    for (const instance of instances) {
      try {
        await instance.stop?.();
      } catch (error) {
        errors.push(error);
      }
      try {
        await instance.dispose?.();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Feature shutdown failed.');
  }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    const startup = this.starting;
    this.stopping = (async () => {
      if (startup) {
        try {
          await startup;
        } catch {}
      }
      await this.release();
    })().finally(() => {
      this.stopping = undefined;
    });
    return this.stopping;
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stop();
    this.definitions.clear();
  }
}
