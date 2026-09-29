import { Registry } from '@supadub/core';

type Factories<T> = { [K in keyof T]: (...args: never[]) => unknown };

export interface GraphicsCatalog<T extends Factories<T>> {
  create<K extends keyof T & string>(name: K, ...args: Parameters<T[K]>): ReturnType<T[K]>;
}

export class FactoryCatalog<T extends Factories<T>> implements GraphicsCatalog<T> {
  private readonly factories: Registry<keyof T & string, T[keyof T]>;
  constructor(capacity = 128) {
    this.factories = new Registry(capacity);
  }

  register<K extends keyof T & string>(name: K, factory: T[K]): this {
    this.factories.register(name, factory);
    return this;
  }

  create<K extends keyof T & string>(name: K, ...args: Parameters<T[K]>): ReturnType<T[K]> {
    const factory = this.factories.require(name) as (...values: Parameters<T[K]>) => ReturnType<T[K]>;
    return factory(...args);
  }

  get names(): readonly string[] {
    return this.factories.keys();
  }
}
