import { Registry } from '@supadub/core';

export type RenderPass<Context> = {
  render(context: Context): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
};

export class RenderPipeline<Context> {
  private readonly passes = new Registry<string, RenderPass<Context>>(32);
  private ended = false;
  add(name: string, pass: RenderPass<Context>): this {
    if (this.ended) throw new Error('The render pipeline is closed.');
    this.passes.register(name, pass);
    return this;
  }
  render(context: Context): void {
    if (!this.ended) for (const pass of this.passes.values()) pass.render(context);
  }
  resize(width: number, height: number): void {
    if (!this.ended) for (const pass of this.passes.values()) pass.resize?.(width, height);
  }
  dispose(): void {
    if (this.ended) return;
    this.ended = true;
    const failures: unknown[] = [];
    for (const pass of [...this.passes.values()].reverse()) {
      try {
        pass.dispose?.();
      } catch (error) {
        failures.push(error);
      }
    }
    this.passes.clear();
    if (failures.length) throw new AggregateError(failures, 'Render pass cleanup failed.');
  }
}
