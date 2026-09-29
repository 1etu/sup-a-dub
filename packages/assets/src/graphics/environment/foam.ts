import * as THREE from 'three';

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
};

export class Foam {
  readonly points: THREE.Points;
  private capacity = 128;
  private particles: Particle[];
  private positions: Float32Array;
  private sizes: Float32Array;
  private geometry = new THREE.BufferGeometry();
  private material = new THREE.ShaderMaterial({
    uniforms: { uHeight: { value: 720 } },
    vertexShader: `
      attribute float aSize;
      uniform float uHeight;
      void main(){
        vec4 p=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*p;
        gl_PointSize=aSize*uHeight/max(1.0,-p.z);
      }`,
    fragmentShader: `
      void main(){
        vec2 p=gl_PointCoord-0.5;
        float r=length(p)*2.0;
        float rim=exp(-pow((r-0.75)*10.0,2.0))*0.42;
        float highlight=exp(-dot((p-vec2(-0.15,0.15))*9.0,(p-vec2(-0.15,0.15))*9.0))*0.65;
        gl_FragColor=vec4(0.86,0.97,1.0,(rim+highlight)*(1.0-smoothstep(0.9,1.0,r)));
      }`,
    transparent: true,
    depthWrite: false,
  });
  private cursor = 0;
  private seed = 0;

  constructor() {
    this.particles = Array.from({ length: this.capacity }, () => ({
      x: 0,
      y: -10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 5,
      life: 1,
      size: 0,
    }));
    this.positions = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity);
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      'aSize',
      new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  spawn(x: number, z: number, angle: number, strength: number) {
    const count = Math.ceil(3 + strength * 4);
    for (let index = 0; index < count; index++) {
      const random = Math.sin(++this.seed * 128.74) * 4361.24;
      const fraction = random - Math.floor(random);
      const direction = angle + (fraction - 0.5) * 2.0;
      const particle = this.particles[this.cursor++ % this.capacity];
      particle.x = x - Math.sin(direction) * (0.3 + fraction * 0.4);
      particle.z = z - Math.cos(direction) * (0.3 + fraction * 0.4);
      particle.y = 0.05;
      particle.vx = -Math.sin(direction) * 0.3;
      particle.vz = -Math.cos(direction) * 0.3;
      particle.vy = 0.4 + fraction * strength;
      particle.age = 0;
      particle.life = 0.7 + fraction * 0.7;
      particle.size = 0.17 + fraction * 0.25;
    }
  }

  update(dt: number, height: number) {
    this.material.uniforms.uHeight.value = height;
    for (let index = 0; index < this.capacity; index++) {
      const particle = this.particles[index];
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.z += particle.vz * dt;
      particle.y += particle.vy * dt;
      particle.vy -= dt * 0.65;
      this.positions[index * 3] = particle.x;
      this.positions[index * 3 + 1] = Math.max(0.03, particle.y);
      this.positions[index * 3 + 2] = particle.z;
      this.sizes[index] =
        particle.age < particle.life ? particle.size * (1 - particle.age / particle.life) : 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
