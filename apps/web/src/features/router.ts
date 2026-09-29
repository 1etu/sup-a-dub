import { FeatureHost, type FeatureFlags } from '@supadub/features';
import { Registry } from '@supadub/core';
import type { ClientFeature, ClientContext } from './contracts';

export class ClientFeatureRouter {
  private readonly controllers = new Registry<string, ClientFeature>(16);
  private readonly host: FeatureHost<ClientContext>;
  private started = false;
  private disposed = false;
  private starting: Promise<void> | undefined;

  constructor(context: ClientContext, flags: FeatureFlags) {
    this.host = new FeatureHost(context, flags);
  }

  register(id: string, create: (context: ClientContext) => ClientFeature): this {
    this.host.register({
      id,
      create: (context) => {
        if (this.disposed) throw new Error('The feature router is closed.');
        const controller = create(context);
        this.controllers.register(id, controller);
        return controller;
      },
    });
    return this;
  }

  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('The feature router is closed.'));
    if (this.starting) return this.starting;
    if (this.started) return Promise.resolve();
    this.starting = this.host
      .start()
      .then(() => {
        if (!this.disposed) this.started = true;
      })
      .catch((error: unknown) => {
        this.controllers.clear();
        throw error;
      })
      .finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }
  enabled(id: string): boolean {
    return this.host.enabled(id);
  }

  async action(name: string): Promise<boolean> {
    return this.dispatch((controller) => controller.action?.(name));
  }
  async click(target: HTMLElement): Promise<boolean> {
    return this.dispatch((controller) => controller.click?.(target));
  }
  async submit(form: HTMLFormElement): Promise<boolean> {
    return this.dispatch((controller) => controller.submit?.(form));
  }
  private async dispatch(
    handle: (controller: ClientFeature) => Promise<boolean> | boolean | undefined,
  ): Promise<boolean> {
    if (!this.started || this.disposed) return false;
    for (const controller of this.controllers.values()) {
      const handled = await handle(controller);
      if (!this.started || this.disposed) return false;
      if (handled) return true;
    }
    return false;
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    this.started = false;
    this.controllers.clear();
    try {
      await this.host.dispose();
    } finally {
      this.controllers.clear();
    }
  }
}
