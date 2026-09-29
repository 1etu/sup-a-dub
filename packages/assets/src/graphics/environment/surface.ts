import * as THREE from 'three';

export class SurfaceMarks {
  readonly mesh: THREE.InstancedMesh;
  private geometry = new THREE.PlaneGeometry(1, 1);
  private material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying float vPhase;
      void main(){
        vUv=uv;
        vec4 p=instanceMatrix*vec4(position,1.0);
        vPhase=p.x*0.7+p.z*0.9;
        gl_Position=projectionMatrix*modelViewMatrix*p;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying float vPhase;
      uniform float uTime;
      void main(){
        vec2 q=(vUv-0.5)*2.0;
        float r=length(q);
        float contact=exp(-dot(q*vec2(1.1,1.7),q*vec2(1.1,1.7))*4.5)*0.20;
        float rippleRadius=0.70+sin(uTime*1.7+vPhase)*0.08;
        float ring=exp(-pow((r-rippleRadius)*24.0,2.0))*0.15;
        float alpha=contact+ring;
        gl_FragColor=vec4(mix(vec3(0.09,0.22,0.36),vec3(0.9,0.98,1.0),ring/max(alpha,0.001)),alpha);
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  private matrix = new THREE.Matrix4();

  constructor(private capacity: number) {
    this.geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
  }

  set(index: number, x: number, z: number, radius: number) {
    if (index >= this.capacity) return;
    this.matrix.makeScale(radius * 2, 1, radius * 2);
    this.matrix.setPosition(x, -0.012, z);
    this.mesh.setMatrixAt(index, this.matrix);
  }

  commit(count: number, time: number) {
    this.mesh.count = Math.min(count, this.capacity);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.material.uniforms.uTime.value = time;
  }

  dispose() {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
