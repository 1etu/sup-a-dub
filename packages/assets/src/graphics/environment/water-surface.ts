import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Refractor } from 'three/addons/objects/Refractor.js';

const vertex = `
varying vec3 vWorld;
varying vec4 vReflection;
varying vec4 vRefraction;
uniform mat4 reflectionMatrix;
uniform mat4 refractionMatrix;
void main(){
  vWorld=(modelMatrix*vec4(position,1.0)).xyz;
  vReflection=reflectionMatrix*vec4(position,1.0);
  vRefraction=refractionMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

const fragment = `
varying vec3 vWorld;
varying vec4 vReflection;
varying vec4 vRefraction;
uniform sampler2D reflectionMap;
uniform sampler2D refractionMap;
uniform float time;
uniform float motion;
uniform vec3 tint;
uniform vec4 ripples[32];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(cell),hash(cell+vec2(1,0)),f.x),mix(hash(cell+vec2(0,1)),hash(cell+vec2(1)),f.x),f.y);
}
float height(vec2 p){
  float t=time*motion;
  float broad=noise(p*.39+vec2(t*.045,-t*.031))*.28;
  float crossing=noise(p*.71+vec2(-t*.03,t*.026))*.11;
  return broad+crossing+sin(p.x*.83+p.y*.28+t*.62)*.055+sin(p.y*1.21-p.x*.19-t*.54)*.028;
}
void main(){
  vec2 p=vWorld.xz;
  float h=height(p);
  vec2 slope=vec2(height(p+vec2(.08,0.0))-h,height(p+vec2(0.0,.08))-h)/.08;
  float wake=0.0;
  for(int i=0;i<32;i++){
    float age=time-ripples[i].z;
    if(age>=0.0&&age<3.5){
      vec2 offset=p-ripples[i].xy;
      float d=length(offset);
      float ring=d-age*3.3;
      float wave=sin(ring*9.0)*exp(-ring*ring*1.8)*exp(-age*1.25)*ripples[i].w*motion;
      slope+=normalize(offset+vec2(.0001))*wave*.3;
      wake+=abs(wave)*.045;
    }
  }
  vec2 reflected=vReflection.xy/vReflection.w;
  vec2 refracted=vRefraction.xy/vRefraction.w;
  vec2 distortion=slope*.065;
  vec3 below=texture2D(refractionMap,clamp(refracted+distortion*.22,.002,.998)).rgb;
  vec3 above=texture2D(reflectionMap,clamp(reflected+distortion,.002,.998)).rgb;
  above=above/(vec3(1.0)+above*.24);
  vec3 normal=normalize(vec3(-slope.x,1.0,-slope.y));
  vec3 eye=normalize(cameraPosition-vWorld);
  float fresnel=.025+.72*pow(1.0-max(dot(normal,eye),0.0),3.0);
  float cloudBreak=noise(p*.67+vec2(time*.012,-time*.009)*motion);
  fresnel*=.28+smoothstep(.25,.70,cloudBreak)*1.45;
  vec3 color=mix(below*tint,above,clamp(fresnel,0.0,1.0));
  float spec=pow(max(dot(normal,normalize(eye+normalize(vec3(-.3,1.0,-.9)))),0.0),180.0);
  float broadSpec=pow(max(dot(normal,normalize(eye+normalize(vec3(.32,1.0,-.4)))),0.0),28.0);
  color+=vec3(.70,.86,1.0)*(spec*.09+broadSpec*.065*cloudBreak+wake);
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class WaterSurface {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private reflector: Reflector;
  private refractor: Refractor;
  private ripples = Array.from({ length: 32 }, () => new THREE.Vector4(0, 0, -100, 0));
  private nextRipple = 0;
  private time = 0;
  private sky = new THREE.Color(0xc7dced);
  private skyMap: THREE.Texture | null = null;
  private size = new THREE.Vector2();
  private renderGroup = new THREE.Group();

  constructor() {
    const geometry = new THREE.PlaneGeometry(28, 17);
    this.reflector = new Reflector(geometry, {
      textureWidth: 640,
      textureHeight: 360,
      multisample: 0,
      clipBias: 0.003,
    });
    this.refractor = new Refractor(geometry, {
      textureWidth: 640,
      textureHeight: 360,
      multisample: 0,
      clipBias: 0.003,
    });
    const material = new THREE.ShaderMaterial({
      uniforms: {
        reflectionMap: { value: this.reflector.getRenderTarget().texture },
        refractionMap: { value: this.refractor.getRenderTarget().texture },
        reflectionMatrix: (this.reflector.material as THREE.ShaderMaterial).uniforms.textureMatrix,
        refractionMatrix: (this.refractor.material as THREE.ShaderMaterial).uniforms.textureMatrix,
        time: { value: 0 },
        motion: { value: 1 },
        tint: { value: new THREE.Color(0.94, 0.98, 1) },
        ripples: { value: this.ripples },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = -0.08;
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
  }

  setSize(width: number, depth: number) {
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(width, depth);
    this.reflector.geometry = this.mesh.geometry;
    this.refractor.geometry = this.mesh.geometry;
  }

  setSky(texture: THREE.Texture) {
    this.skyMap = texture;
  }

  update(time: number, reducedMotion = false) {
    this.time = time;
    this.mesh.material.uniforms.time.value = time;
    this.mesh.material.uniforms.motion.value = reducedMotion ? 0 : 1;
  }

  ripple(x: number, z: number, strength: number) {
    this.ripples[this.nextRipple].set(x, z, this.time, strength);
    this.nextRipple = (this.nextRipple + 1) % this.ripples.length;
  }

  capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    renderer.getDrawingBufferSize(this.size);
    const width = Math.max(256, Math.min(960, Math.round(this.size.x / 2)));
    const height = Math.max(144, Math.min(540, Math.round(this.size.y / 2)));
    const reflection = this.reflector.getRenderTarget();
    if (reflection.width !== width || reflection.height !== height) reflection.setSize(width, height);
    const refraction = this.refractor.getRenderTarget();
    const refractionWidth = Math.max(256, Math.min(1920, Math.round(this.size.x)));
    const refractionHeight = Math.max(144, Math.min(1080, Math.round(this.size.y)));
    if (refraction.width !== refractionWidth || refraction.height !== refractionHeight)
      refraction.setSize(refractionWidth, refractionHeight);
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    this.reflector.matrixWorld.copy(this.mesh.matrixWorld);
    this.refractor.matrixWorld.copy(this.mesh.matrixWorld);
    const previousBackground = scene.background;
    const previousVisibility = this.mesh.visible;
    this.mesh.visible = false;
    scene.background = this.skyMap ?? this.sky;
    try {
      this.reflector.onBeforeRender(
        renderer,
        scene,
        camera,
        this.mesh.geometry,
        this.reflector.material as THREE.Material,
        this.renderGroup,
      );
      this.refractor.onBeforeRender(
        renderer,
        scene,
        camera,
        this.mesh.geometry,
        this.refractor.material,
        this.renderGroup,
      );
    } finally {
      this.mesh.visible = previousVisibility;
      scene.background = previousBackground;
    }
  }

  dispose() {
    this.reflector.dispose();
    this.refractor.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
