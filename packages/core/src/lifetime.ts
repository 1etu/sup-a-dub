export interface Disposable {
  dispose(): void;
}
export type Cleanup = Disposable | (() => void);
export class Lifetime implements Disposable {
  private cleanups: (() => void)[] = [];
  private ended = false;
  add<T extends Cleanup>(cleanup: T): T {
    const run = () => {
      if (typeof cleanup === 'function') cleanup();
      else cleanup.dispose();
    };
    if (this.ended) run();
    else this.cleanups.push(run);
    return cleanup;
  }
  dispose(): void {
    if (this.ended) return;
    this.ended = true;
    const errors: unknown[] = [];
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Resource cleanup failed.');
  }
}
