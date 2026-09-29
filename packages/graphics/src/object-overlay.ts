import * as THREE from 'three';

export type ObjectOverlayOptions = {
  environment?: THREE.Texture | null;
  environmentIntensity?: number;
};

export type ObjectOverlayPlacement = { x: number; y: number; diameter: number };

export class ObjectOverlay {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  private readonly bufferSize = new THREE.Vector2();
  private readonly previousViewport = new THREE.Vector4();
  private readonly previousScissor = new THREE.Vector4();
  private readonly viewport = new THREE.Vector4();
  private readonly scissor = new THREE.Vector4();
  private object: THREE.Object3D | null = null;
  private disposed = false;

  constructor(options: ObjectOverlayOptions = {}) {
    this.scene.environment = options.environment ?? null;
    this.scene.environmentIntensity = options.environmentIntensity ?? 1;
    this.camera.position.z = 5;
  }

  setObject(object: THREE.Object3D | null): void {
    if (this.disposed || object === this.object) return;
    if (this.object) this.scene.remove(this.object);
    this.object = object;
    if (object) this.scene.add(object);
  }

  prepare(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null): void {
    if (this.disposed || !this.object) return;
    const previous = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace();
    const mipmap = renderer.getActiveMipmapLevel();
    try {
      renderer.setRenderTarget(target);
      renderer.compile(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(previous, face, mipmap);
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    placement: ObjectOverlayPlacement,
  ): void {
    if (
      this.disposed ||
      !this.object?.visible ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(placement.x) ||
      !Number.isFinite(placement.y) ||
      !Number.isFinite(placement.diameter) ||
      width <= 0 ||
      height <= 0 ||
      placement.diameter <= 0
    )
      return;
    const target = renderer.getRenderTarget();
    if (target) {
      const divisor = 2 ** renderer.getActiveMipmapLevel();
      this.bufferSize.set(
        Math.max(1, Math.floor(target.width / divisor)),
        Math.max(1, Math.floor(target.height / divisor)),
      );
    } else renderer.getDrawingBufferSize(this.bufferSize);
    const scaleX = this.bufferSize.x / width;
    const scaleY = this.bufferSize.y / height;
    const radius = placement.diameter / 2;
    const left = (placement.x - radius) * scaleX;
    const bottom = (height - placement.y - radius) * scaleY;
    const diameterX = placement.diameter * scaleX;
    const diameterY = placement.diameter * scaleY;
    let clipLeft = Math.max(0, left);
    let clipBottom = Math.max(0, bottom);
    let clipRight = Math.min(this.bufferSize.x, left + diameterX);
    let clipTop = Math.min(this.bufferSize.y, bottom + diameterY);
    if (clipRight <= clipLeft || clipTop <= clipBottom) return;
    renderer.getCurrentViewport(this.previousViewport);
    const gl = renderer.getContext();
    this.previousScissor.fromArray(gl.getParameter(gl.SCISSOR_BOX) as Int32Array);
    const scissorTest = gl.isEnabled(gl.SCISSOR_TEST);
    if (scissorTest) {
      clipLeft = Math.max(clipLeft, this.previousScissor.x);
      clipBottom = Math.max(clipBottom, this.previousScissor.y);
      clipRight = Math.min(clipRight, this.previousScissor.x + this.previousScissor.z);
      clipTop = Math.min(clipTop, this.previousScissor.y + this.previousScissor.w);
      if (clipRight <= clipLeft || clipTop <= clipBottom) return;
    }
    this.viewport.set(left, bottom, diameterX, diameterY).round();
    this.scissor.set(clipLeft, clipBottom, clipRight - clipLeft, clipTop - clipBottom).round();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      renderer.state.viewport(this.viewport);
      renderer.state.scissor(this.scissor);
      renderer.state.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.state.viewport(this.previousViewport);
      renderer.state.scissor(this.previousScissor);
      renderer.state.setScissorTest(scissorTest);
      renderer.autoClear = autoClear;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.clear();
    this.scene.environment = null;
    this.object = null;
  }
}
