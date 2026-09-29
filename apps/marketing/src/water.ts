import { waterFragment, waterVertex } from '@supadub/assets/marketing';

export class WaterSurface {
  private readonly gl: WebGLRenderingContext | null;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly ripples = new Float32Array(24);
  private readonly events = new AbortController();
  private program?: WebGLProgram;
  private buffer?: WebGLBuffer;
  private frame = 0;
  private previous = 0;
  private nextRipple = 0;
  private width = 0;
  private height = 0;
  private readonly start = performance.now();
  private readonly uniforms = new Map<string, WebGLUniformLocation>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    });
    if (!this.gl) return;
    for (let i = 0; i < 6; i++) this.ripples[i * 4 + 2] = -100;
    if (!this.initialize()) return;
    const options = { signal: this.events.signal };
    window.addEventListener('resize', this.refresh, options);
    document.addEventListener('visibilitychange', this.refresh, options);
    this.motion.addEventListener('change', this.refresh, options);
    canvas.addEventListener('webglcontextlost', this.contextLost, options);
    canvas.addEventListener('webglcontextrestored', this.contextRestored, options);
    window.addEventListener('pointerdown', this.splash, { ...options, passive: true });
    this.refresh();
    canvas.classList.add('ready');
  }

  private initialize(): boolean {
    const gl = this.gl!;
    const shaders: WebGLShader[] = [];
    for (const [type, source] of [
      [gl.VERTEX_SHADER, waterVertex],
      [gl.FRAGMENT_SHADER, waterFragment],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) return false;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        shaders.forEach((item) => gl.deleteShader(item));
        return false;
      }
    }
    const program = gl.createProgram();
    if (!program) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      return false;
    }
    shaders.forEach((shader) => gl.attachShader(program, shader));
    gl.linkProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return false;
    }
    this.program = program;
    gl.useProgram(program);
    this.buffer = gl.createBuffer() ?? undefined;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer ?? null);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['resolution', 'viewport', 'time', 'scroll', 'ripples']) {
      const location = gl.getUniformLocation(program, name);
      if (location !== null) this.uniforms.set(name, location);
    }
    return true;
  }

  private readonly splash = (event: PointerEvent): void => {
    if (this.motion.matches || !this.program) return;
    const offset = this.nextRipple * 4;
    this.ripples.set([event.clientX, event.clientY + window.scrollY * 0.22, this.elapsed(), 0], offset);
    this.nextRipple = (this.nextRipple + 1) % 6;
  };

  private elapsed(): number {
    return (performance.now() - this.start) / 1000;
  }

  private readonly refresh = (): void => {
    cancelAnimationFrame(this.frame);
    if (!this.program || document.hidden) return;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const scale = Math.min(1, Math.sqrt(1_000_000 / (this.width * this.height)));
    this.canvas.width = Math.round(this.width * scale);
    this.canvas.height = Math.round(this.height * scale);
    this.gl!.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.draw();
    if (!this.motion.matches) this.frame = requestAnimationFrame(this.tick);
  };

  private readonly tick = (now: number): void => {
    if (now - this.previous >= 1000 / 30) {
      this.draw();
      this.previous = now;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private draw(): void {
    const gl = this.gl!;
    const uniform = (name: string) => this.uniforms.get(name) ?? null;
    gl.uniform2f(uniform('resolution'), this.canvas.width, this.canvas.height);
    gl.uniform2f(uniform('viewport'), this.width, this.height);
    gl.uniform1f(uniform('time'), this.motion.matches ? 0 : this.elapsed());
    gl.uniform1f(uniform('scroll'), window.scrollY);
    gl.uniform4fv(uniform('ripples'), this.ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    cancelAnimationFrame(this.frame);
    this.canvas.classList.remove('ready');
    this.program = undefined;
    this.buffer = undefined;
  };

  private readonly contextRestored = (): void => {
    if (!this.initialize()) return;
    this.refresh();
    this.canvas.classList.add('ready');
  };

  dispose(): void {
    this.events.abort();
    cancelAnimationFrame(this.frame);
    if (this.buffer) this.gl?.deleteBuffer(this.buffer);
    if (this.program) this.gl?.deleteProgram(this.program);
    this.uniforms.clear();
    this.canvas.classList.remove('ready');
  }
}
