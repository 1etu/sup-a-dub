import * as THREE from 'three';

export type RendererSettings = {
  alpha?: boolean;
  antialias?: boolean;
  pixelRatio?: number;
  maxPixelRatio?: number;
  exposure?: number;
  lowLatency?: boolean;
};

export interface GraphicsBackend<Renderer> {
  readonly renderer: Renderer;
  resize(width: number, height: number, pixelRatio?: number): void;
  dispose(): void;
}

export class WebGLBackend implements GraphicsBackend<THREE.WebGLRenderer> {
  readonly renderer: THREE.WebGLRenderer;
  private readonly maxPixelRatio: number;
  private ended = false;

  constructor(canvas: HTMLCanvasElement, settings: RendererSettings = {}) {
    this.maxPixelRatio = Math.max(1, settings.maxPixelRatio ?? 2);
    const attributes: WebGLContextAttributes & { desynchronized?: boolean } = {
      antialias: settings.antialias ?? true,
      alpha: settings.alpha ?? false,
      powerPreference: 'high-performance',
      desynchronized: settings.lowLatency ?? false,
      preserveDrawingBuffer: settings.lowLatency ?? false,
    };
    const context = settings.lowLatency ? canvas.getContext('webgl2', attributes) : undefined;
    this.renderer = new THREE.WebGLRenderer({ canvas, ...attributes, context: context ?? undefined });
    this.renderer.setPixelRatio(Math.min(this.maxPixelRatio, settings.pixelRatio ?? 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = settings.exposure ?? 0.95;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
  }

  resize(width: number, height: number, pixelRatio?: number): void {
    if (this.ended) return;
    if (pixelRatio !== undefined)
      this.renderer.setPixelRatio(Math.min(this.maxPixelRatio, Math.max(0.5, pixelRatio)));
    this.renderer.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), false);
  }

  dispose(): void {
    if (this.ended) return;
    this.ended = true;
    this.renderer.dispose();
  }
}
