import * as THREE from 'three';
import { WaterSurface } from './water-surface';
import { createFloorMaterial, createBarrierMaterial } from './pool-floor';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ObstacleState, Vec2 } from '@supadub/protocol';

export type PoolTheme = 'blue' | 'hearts' | 'stars' | 'dots';

function roundedPath(
  path: THREE.Shape | THREE.Path,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  path.moveTo(x + radius, y);
  path.lineTo(x + width - radius, y);
  path.quadraticCurveTo(x + width, y, x + width, y + radius);
  path.lineTo(x + width, y + height - radius);
  path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  path.lineTo(x + radius, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
}

export function createTubFrame(width: number, depth: number, clock: THREE.IUniform<number> = { value: 0 }) {
  const shape = new THREE.Shape();
  roundedPath(shape, -width / 2 - 0.46, -depth / 2 - 0.46, width + 0.92, depth + 0.92, 0.76);
  const inner = new THREE.Path();
  roundedPath(inner, -width / 2 - 0.34, -depth / 2 - 0.34, width + 0.68, depth + 0.68, 0.84);
  shape.holes.push(inner);
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: 1.3,
    bevelEnabled: true,
    bevelSegments: 8,
    steps: 6,
    bevelSize: 0.64,
    bevelThickness: 0.48,
    curveSegments: 24,
  });
  extruded.deleteAttribute('normal');
  extruded.deleteAttribute('uv');
  const geometry = mergeVertices(extruded);
  extruded.dispose();
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0.2, 0);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const ceramic = new Float32Array(positions.count * 2);
  for (let index = 0; index < positions.count; index++) {
    const length = Math.hypot(positions.getX(index), positions.getZ(index));
    const inward =
      -(normals.getX(index) * positions.getX(index) + normals.getZ(index) * positions.getZ(index)) / length;
    ceramic.set([positions.getY(index) - 0.88, Math.max(0, Math.min(1, inward * 2))], index * 2);
  }
  geometry.setAttribute('ceramic', new THREE.BufferAttribute(ceramic, 2));
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xfffdfb,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ceramicTime = clock;
    shader.vertexShader = `attribute vec2 ceramic; varying vec2 vCeramic; varying vec2 vCeramicPosition;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvCeramic=ceramic;vCeramicPosition=position.xz;',
    );
    shader.fragmentShader = `
      varying vec2 vCeramic;
      varying vec2 vCeramicPosition;
      uniform float ceramicTime;
      float ceramicHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float ceramicNoise(vec2 p){
        vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(ceramicHash(cell),ceramicHash(cell+vec2(1,0)),f.x),mix(ceramicHash(cell+vec2(0,1)),ceramicHash(cell+vec2(1)),f.x),f.y);
      }
      ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float innerFace=smoothstep(.18,.82,vCeramic.y);
      float ceramicShadow=exp(-pow((vCeramic.x-.58)/.35,2.0));
      float ceramicPattern=ceramicNoise(vCeramicPosition*.82+vec2(ceramicTime*.035,-ceramicTime*.029));
      float reflectedWater=exp(-pow((vCeramic.x-.015+(ceramicPattern-.5)*.075)/.20,2.0));
      reflectedWater*=.55+smoothstep(.2,.74,ceramicPattern)*.45;
      diffuseColor.rgb*=mix(vec3(1.0),vec3(.97,1.0,.995)*(1.0-ceramicShadow*.20),innerFace);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      totalEmissiveRadiance+=vec3(.09,.16,.17)*innerFace*reflectedWater;
    `,
    );
  };
  material.customProgramCacheKey = () => 'supadub-ceramic-inner-wall-3';
  const rim = new THREE.Mesh(geometry, material);
  rim.position.y = -0.88;
  rim.receiveShadow = true;
  return rim;
}

export class Pool {
  readonly group = new THREE.Group();
  private water = new WaterSurface();
  private floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 17), createFloorMaterial());
  private frame: THREE.Mesh | null = null;
  private barrierGroup = new THREE.Group();
  private obstacles = new Map<string, THREE.Group>();
  private barrierGeometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.08);
  private faceGeometry = new THREE.BoxGeometry(1, 1, 1);
  private barrierMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe1e2ed,
    roughness: 0.26,
    clearcoat: 0.8,
  });
  private barrierFace = createBarrierMaterial();
  private finite = true;
  private ceramicTime = { value: 0 };

  constructor() {
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.85;
    this.group.add(this.floor, this.water.mesh, this.barrierGroup);
    this.setFinite(true);
  }

  setFinite(finite: boolean) {
    this.finite = finite;
    if (this.frame) {
      this.group.remove(this.frame);
      this.frame.geometry.dispose();
      (this.frame.material as THREE.Material).dispose();
      this.frame = null;
    }
    if (finite) {
      this.frame = createTubFrame(28, 17, this.ceramicTime);
      this.group.add(this.frame);
    }
    const width = finite ? 28 : 1024;
    const depth = finite ? 17 : 1024;
    this.floor.geometry.dispose();
    this.floor.geometry = new THREE.PlaneGeometry(width, depth);
    this.water.setSize(width, depth);
    this.floor.position.set(0, -0.85, 0);
    this.water.mesh.position.set(0, -0.08, 0);
  }

  setTheme(theme: PoolTheme) {
    this.floor.material.uniforms.theme.value = ['blue', 'hearts', 'stars', 'dots'].indexOf(theme);
  }

  setSky(texture: THREE.Texture) {
    this.water.setSky(texture);
  }

  prepare(
    renderer: THREE.WebGLRenderer,
    targetScene: THREE.Scene,
    camera: THREE.Camera,
    target: THREE.WebGLRenderTarget,
  ): void {
    const samples = new THREE.Group();
    samples.add(
      new THREE.Mesh(this.barrierGeometry, this.barrierMaterial),
      new THREE.Mesh(this.faceGeometry, this.barrierFace),
    );
    const previousTarget = renderer.getRenderTarget();
    const previousCubeFace = renderer.getActiveCubeFace();
    const previousMipmapLevel = renderer.getActiveMipmapLevel();
    try {
      renderer.setRenderTarget(target);
      renderer.compile(samples, camera, targetScene);
    } finally {
      samples.clear();
      renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel);
    }
  }

  update(time: number, center: Vec2, reducedMotion = false) {
    this.floor.material.uniforms.time.value = reducedMotion ? 0 : time;
    this.ceramicTime.value = reducedMotion ? 0 : time;
    this.water.update(time, reducedMotion);
    if (!this.finite) {
      const x = Math.floor(center.x / 64) * 64;
      const z = Math.floor(center.z / 64) * 64;
      this.water.mesh.position.set(x, -0.08, z);
      this.floor.position.set(x, -0.85, z);
    }
  }

  capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.water.capture(renderer, scene, camera);
  }

  ripple(x: number, z: number, strength = 1) {
    this.water.ripple(x, z, strength);
  }

  setObstacles(states: ObstacleState[]) {
    const current = new Set<string>();
    for (const state of states) {
      current.add(state.id);
      if (this.obstacles.has(state.id)) continue;
      const group = new THREE.Group();
      const wall = new THREE.Mesh(this.barrierGeometry, this.barrierMaterial);
      wall.scale.set(state.width, 0.9, state.depth);
      wall.position.y = 0.27;
      const foot = new THREE.Mesh(this.barrierGeometry, this.barrierMaterial);
      foot.scale.set(state.width + 0.22, 0.13, state.depth + 0.22);
      foot.position.y = -0.18;
      const face = new THREE.Mesh(this.faceGeometry, this.barrierFace);
      face.scale.set(state.width + 0.007, 0.48, state.depth + 0.007);
      face.position.y = 0.24;
      group.add(wall, foot, face);
      group.position.set(state.x, 0, state.z);
      this.barrierGroup.add(group);
      this.obstacles.set(state.id, group);
    }
    for (const [id, group] of this.obstacles) {
      if (!current.has(id)) {
        this.barrierGroup.remove(group);
        this.obstacles.delete(id);
      }
    }
  }

  dispose() {
    this.water.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.frame?.geometry.dispose();
    if (this.frame) (this.frame.material as THREE.Material).dispose();
    this.barrierGeometry.dispose();
    this.faceGeometry.dispose();
    this.barrierMaterial.dispose();
    this.barrierFace.dispose();
    this.obstacles.clear();
    this.group.clear();
  }
}
