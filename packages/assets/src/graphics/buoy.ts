import {
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';

let resources: ReturnType<typeof createResources> | undefined;

function createResources() {
  const pink = new MeshPhysicalMaterial({ color: 0xf044a1, roughness: 0.2, clearcoat: 1 });
  const white = new MeshPhysicalMaterial({
    color: 0xd7edf2,
    roughness: 0.2,
    clearcoat: 0.8,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const drain = new ShaderMaterial({
    uniforms: { center: { value: new Color(0xe995c6) }, edge: { value: new Color(0xdf5dad) } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 center;
      uniform vec3 edge;
      varying vec2 vUv;
      void main() {
        float radius = length(vUv - 0.5) * 2.0;
        float edgeShade = smoothstep(0.58, 1.0, radius);
        float light = 1.0 - edgeShade * smoothstep(0.4, 0.88, vUv.y) * 0.18;
        vec3 color = mix(center, edge, smoothstep(0.2, 0.94, radius)) * light;
        float reflection = exp(-pow((vUv.y - 0.27) / 0.2, 2.0)) * max(0.0, 1.0 - radius * radius);
        color = mix(color, vec3(0.78, 0.88, 0.97), reflection * 0.54);
        gl_FragColor = vec4(color, 0.72 + edgeShade * 0.1);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
  });
  const ring = new TorusGeometry(0.43, 0.042, 10, 36);
  ring.rotateX(-Math.PI / 2);
  const inset = new CircleGeometry(0.395, 32);
  inset.rotateX(-Math.PI / 2);
  const ball = new SphereGeometry(0.35, 28, 20);
  let label: SpriteMaterial | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#ffffff';
      context.font = '900 210px Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('EXIT', 256, 145);
      const map = new CanvasTexture(canvas);
      map.colorSpace = SRGBColorSpace;
      label = new SpriteMaterial({
        map,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      });
    }
  }
  return { pink, white, drain, ring, inset, ball, label };
}

export function createExitBuoy(): Group {
  resources ??= createResources();
  const group = new Group();
  group.name = 'exit-buoy';
  const rim = new Mesh(resources.ring, resources.white);
  rim.position.y = 0.065;
  const inset = new Mesh(resources.inset, resources.drain);
  inset.position.y = 0.04;
  const ball = new Mesh(resources.ball, resources.pink);
  ball.position.y = 0.86;
  ball.castShadow = true;
  group.add(rim, inset, ball);
  if (resources.label) {
    const label = new Sprite(resources.label);
    label.position.set(0, 0.86, 0);
    label.scale.set(0.72, 0.36, 1);
    label.renderOrder = 5;
    group.add(label);
  }
  return group;
}

export function disposeBuoyResources(): void {
  if (!resources) return;
  resources.pink.dispose();
  resources.white.dispose();
  resources.drain.dispose();
  resources.ring.dispose();
  resources.inset.dispose();
  resources.ball.dispose();
  resources.label?.map?.dispose();
  resources.label?.dispose();
  resources = undefined;
}
