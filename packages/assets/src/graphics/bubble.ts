import {
  Camera,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';

let geometry: PlaneGeometry | undefined;
let material: ShaderMaterial | undefined;

function resources(): { geometry: PlaneGeometry; material: ShaderMaterial } {
  geometry ??= new PlaneGeometry(2, 2);
  material ??= new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vRayPoint;
      varying vec3 vCenter;
      varying float vRadius;
      varying float vPhase;
      void main() {
        mat4 transform = modelMatrix;
        #ifdef USE_INSTANCING
          transform = modelMatrix * instanceMatrix;
        #endif
        vec4 center = transform * vec4(0.0, 0.0, 0.0, 1.0);
        vRadius = length(transform[0].xyz);
        vCenter = (viewMatrix * center).xyz;
        vPhase = fract(sin(dot(center.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 point;
        if (projectionMatrix[2][3] < -0.5) {
          float depth = -vCenter.z;
          if (depth + vRadius <= 0.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }
          float denominator = depth * depth - vRadius * vRadius;
          if (denominator <= 0.0001) {
            point = vec3(position.x / projectionMatrix[0][0], position.y / projectionMatrix[1][1], -1.0);
          } else {
            vec2 centerSlope = vCenter.xy * depth / denominator;
            vec2 radiusSlope = vRadius * sqrt(vCenter.xy * vCenter.xy + vec2(denominator)) / denominator;
            point = vec3((centerSlope + position.xy * radiusSlope) * depth, -depth);
          }
        } else {
          point = vCenter + vec3(position.xy * vRadius, 0.0);
        }
        vRayPoint = point;
        gl_Position = projectionMatrix * vec4(point, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform mat4 projectionMatrix;
      varying vec3 vRayPoint;
      varying vec3 vCenter;
      varying float vRadius;
      varying float vPhase;
      void main() {
        bool perspective = projectionMatrix[2][3] < -0.5;
        vec3 origin = perspective ? vec3(0.0) : vec3(vRayPoint.xy, 0.0);
        vec3 direction = perspective ? normalize(vRayPoint) : vec3(0.0, 0.0, -1.0);
        vec3 delta = vCenter - origin;
        vec3 perpendicular = cross(delta, direction);
        float radiusSquared = dot(perpendicular, perpendicular) / (vRadius * vRadius);
        if (radiusSquared >= 1.0) discard;
        float halfChord = vRadius * sqrt(1.0 - radiusSquared);
        float middle = dot(delta, direction);
        float distance = middle - halfChord;
        if (distance < 0.0) distance = middle + halfChord;
        if (distance <= 0.0) discard;
        vec3 surface = origin + direction * distance;
        vec3 normal = normalize(surface - vCenter);
        float facing = abs(dot(normal, direction));
        vec2 p = normal.xy;
        float rim = pow(1.0 - facing, 1.15);
        float edge = pow(1.0 - facing, 7.5);
        float radius = sqrt(radiusSquared);
        float contourWidth = max(0.012, fwidth(radius) * 0.85);
        float contour = exp(-pow((radius - 0.974) / contourWidth, 2.0));
        float drift = sin(p.x * 4.4 + p.y * 3.1 + time * 0.19 + vPhase * 6.28) * 0.12;
        float film = p.y * 0.8 + p.x * 0.27 + rim * 0.32 + drift + vPhase * 0.08;
        vec3 rainbow = 0.58 + 0.42 * cos(film * 7.0 + vec3(0.2, 2.29, 4.38));
        rainbow = mix(rainbow, vec3(0.89, 0.96, 1.0), 0.12);
        float highlight = pow(max(dot(normal, normalize(vec3(-0.38, 0.45, 0.88))), 0.0), 20.0);
        float lower = pow(max(dot(normal, normalize(vec3(0.42, -0.61, 0.68))), 0.0), 40.0);
        float band = smoothstep(0.18, 0.8, rim) * (0.72 + sin(film * 12.0) * 0.13);
        float alpha = 0.006 + band * 0.34 + edge * 0.24 + contour * 0.23 + highlight + lower * 0.38;
        float outline = 1.0 - smoothstep(1.0 - fwidth(radiusSquared) * 1.5, 1.0, radiusSquared);
        vec3 color = mix(rainbow, vec3(1.0), min(0.98, highlight * 1.8 + lower * 1.3 + edge * 0.15 + contour * 0.1));
        vec4 projected = projectionMatrix * vec4(surface, 1.0);
        gl_FragDepth = projected.z / projected.w * 0.5 + 0.5;
        gl_FragColor = vec4(color, min(alpha, 0.98) * outline);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  return { geometry, material };
}

export function captiveDuckHeight(radius = 0.9, duckScale = 0.46): number {
  return radius - 0.1 - 1.45 * duckScale * 0.5;
}

export function createBubble(radius = 0.8): Object3D {
  const resource = resources();
  const bubble = new Mesh(resource.geometry, resource.material);
  bubble.name = 'soap-bubble';
  bubble.scale.setScalar(Math.max(0.01, radius));
  bubble.frustumCulled = false;
  bubble.renderOrder = 3;
  return bubble;
}

export function updateBubble(_bubble: Object3D, time: number): void {
  updateSpriteTime(time);
}

export function updateSpriteTime(time: number): void {
  if (material) material.uniforms.time!.value = time;
}

export interface BubbleInstances {
  group: Group;
  set(index: number, x: number, y: number, z: number, radius?: number): void;
  commit(count: number, camera?: Camera): void;
  dispose(): void;
}

export function createBubbleInstances(capacity: number): BubbleInstances {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
    throw new RangeError('The bubble capacity must be an integer from 1 to 10000.');
  }
  const resource = resources();
  const group = new Group();
  const mesh = new InstancedMesh(resource.geometry, resource.material, capacity);
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  group.add(mesh);
  const matrix = new Matrix4();
  const centers = new Float32Array(capacity * 4);
  const depths = new Float32Array(capacity);
  const order = Array.from({ length: capacity }, (_, index) => index);
  const point = new Vector3();
  let disposed = false;
  return {
    group,
    set(index, x, y, z, radius = 0.8) {
      if (disposed || index < 0 || index >= capacity || !Number.isInteger(index)) return;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(radius))
        return;
      centers[index * 4] = x;
      centers[index * 4 + 1] = y;
      centers[index * 4 + 2] = z;
      centers[index * 4 + 3] = Math.max(0.01, radius);
    },
    commit(count, camera) {
      if (disposed) return;
      const active = Number.isFinite(count) ? Math.max(0, Math.min(capacity, Math.floor(count))) : 0;
      order.length = active;
      for (let index = 0; index < active; index++) {
        order[index] = index;
        if (camera) {
          point
            .fromArray(centers, index * 4)
            .applyMatrix4(group.matrixWorld)
            .applyMatrix4(camera.matrixWorldInverse);
          depths[index] = point.z;
        }
      }
      if (camera) order.sort((a, b) => depths[a]! - depths[b]!);
      for (let index = 0; index < active; index++) {
        const offset = order[index]! * 4;
        const radius = centers[offset + 3]!;
        matrix.makeScale(radius, radius, radius);
        matrix.setPosition(centers[offset]!, centers[offset + 1]!, centers[offset + 2]!);
        mesh.setMatrixAt(index, matrix);
      }
      mesh.count = active;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}

export function disposeBubbleResources(): void {
  geometry?.dispose();
  material?.dispose();
  geometry = undefined;
  material = undefined;
}
