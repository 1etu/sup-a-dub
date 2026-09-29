import { Color, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three';
import { cosmetic } from '@supadub/cosmetics';

const materials = new Map<string, MeshStandardMaterial>();
const patternKinds: Record<string, number> = {
  stars: 1,
  koi: 2,
  porcelain: 3,
  sailor: 4,
  copper: 5,
  lifeguard: 6,
  explorer: 7,
  mosaic: 8,
  'lemon-sorbet': 9,
  'speckled-egg': 10,
  'peach-jelly': 11,
  'tin-toy': 12,
  clockwork: 13,
  'deep-sea': 14,
  fiesta: 15,
  aurora: 16,
  patchwork: 17,
};

export function duckMaterial(skin: string, baby = false, texture?: Texture): MeshStandardMaterial {
  const palette = cosmetic(skin);
  const key = `${palette.id}-${baby ? 'duckling' : 'adult'}`;
  const cached = materials.get(key);
  if (cached) return cached;
  const metallic = palette.id === 'gold' || palette.id === 'chrome';
  const surface = {
    color: metallic ? palette.color : 0xffffff,
    map: metallic ? null : texture,
    metalness: baby ? 0 : palette.metalness,
    roughness: baby ? 0.37 : palette.roughness,
    envMapIntensity: metallic ? 1.05 : 0.72,
  };
  const result = baby
    ? new MeshStandardMaterial(surface)
    : new MeshPhysicalMaterial({
        ...surface,
        clearcoat:
          palette.pattern === 'porcelain' || palette.pattern === 'peach-jelly' ? 0.88 : metallic ? 0.2 : 0.38,
        clearcoatRoughness: palette.pattern === 'porcelain' ? 0.11 : 0.22,
        iridescence:
          palette.pattern === 'aurora'
            ? 0.42
            : palette.pattern === 'pearl' || palette.pattern === 'peach-jelly'
              ? 0.23
              : 0,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [180, 360],
      });
  result.name = `sony-sample-duck-${key}`;
  if (!metallic) {
    const tint = new Color(baby && palette.id === 'yellow' ? '#ffe475' : palette.color);
    const bill = new Color(baby ? '#f5a021' : palette.beakColor);
    const pattern = new Color(palette.accentColor);
    result.onBeforeCompile = (shader) => {
      shader.uniforms.duckTint = { value: tint };
      shader.uniforms.duckBill = { value: bill };
      shader.uniforms.duckPattern = { value: pattern };
      shader.uniforms.duckPatternKind = { value: patternKinds[palette.pattern] ?? 0 };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vDuckPosition;\nvarying vec3 vDuckNormal;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvDuckPosition = position;\nvDuckNormal = normal;',
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform vec3 duckTint;
uniform vec3 duckBill;
uniform vec3 duckPattern;
uniform float duckPatternKind;
varying vec3 vDuckPosition;
varying vec3 vDuckNormal;
float duckStar(vec2 p) {
  float angle = atan(p.x, p.y) + 3.14159265;
  float sector = floor(angle / 0.62831853);
  float localAngle = angle - sector * 0.62831853;
  float first = mix(0.25, 0.105, mod(sector, 2.0));
  float second = mix(0.105, 0.25, mod(sector, 2.0));
  float edge = first * second * 0.58778525 / (second * sin(0.62831853 - localAngle) + first * sin(localAngle));
  return 1.0 - smoothstep(edge - 0.012, edge + 0.012, length(p));
}
float duckMottle(vec3 p) {
  return sin(p.x * 7.1 + sin(p.y * 3.9)) + sin(p.z * 9.7 + p.y * 5.4) + cos(p.y * 8.1 - p.z * 5.7);
}
float duckHash(vec2 p) {
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
vec2 duckProjection(vec3 p, vec3 normal) {
  vec3 n = abs(normal);
  return n.x > n.y && n.x > n.z ? p.zy : n.y > n.z ? p.xz : p.xy;
}`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
#include <map_fragment>
float warmMask = smoothstep(0.16, 0.5, diffuseColor.r - diffuseColor.b);
float billRegion = step(0.81, vMapUv.x) * step(0.60, vMapUv.y) * (1.0 - step(0.83, vMapUv.y));
float yellowMask = (1.0 - billRegion) * warmMask;
float billMask = billRegion * warmMask;
vec2 patternUv = duckProjection(vDuckPosition, vDuckNormal);
float duckPatternMask = 0.0;
vec3 body = duckTint;
if (duckPatternKind > 0.5 && duckPatternKind < 1.5) {
  duckPatternMask = duckStar(fract(patternUv * 3.4) - 0.5);
  body = mix(body, duckPattern, duckPatternMask);
} else if (duckPatternKind < 2.5 && duckPatternKind > 1.5) {
  duckPatternMask = smoothstep(0.58, 0.88, duckMottle(vDuckPosition));
  float ink = smoothstep(1.82, 2.1, duckMottle(vDuckPosition.zxy + vec3(0.3, 0.8, 0.4)));
  body = mix(mix(body, duckPattern, duckPatternMask), vec3(0.014, 0.019, 0.022), ink * 0.85);
} else if (duckPatternKind < 3.5 && duckPatternKind > 2.5) {
  vec2 flower = fract(patternUv * 2.2) - 0.5;
  float angle = atan(flower.y, flower.x);
  float radius = length(flower);
  float stroke = abs(radius - (0.20 + 0.065 * cos(angle * 5.0)));
  float softness = max(fwidth(stroke) * 0.8, 0.008);
  float petal = 1.0 - smoothstep(0.032 - softness, 0.032 + softness, stroke);
  float center = 1.0 - smoothstep(0.055 - softness, 0.055 + softness, radius);
  duckPatternMask = max(petal, center) * (1.0 - smoothstep(0.88, 1.12, vDuckPosition.y));
  body = mix(body, duckPattern, duckPatternMask);
} else if (duckPatternKind < 4.5 && duckPatternKind > 3.5) {
  float stripes = smoothstep(0.1, 0.2, sin(vDuckPosition.y * 38.0));
  float shirt = (1.0 - smoothstep(0.70, 0.83, vDuckPosition.y)) * smoothstep(0.15, 0.22, vDuckPosition.y);
  duckPatternMask = stripes * shirt;
  body = mix(body, duckPattern, duckPatternMask);
} else if (duckPatternKind > 4.5 && duckPatternKind < 5.5) {
  float corrosion = duckMottle(vDuckPosition * 1.15) + duckMottle(vDuckPosition * 4.3) * 0.28;
  duckPatternMask = smoothstep(0.9, 1.45, corrosion);
  body = mix(body, duckPattern, duckPatternMask);
} else if (duckPatternKind > 5.5 && duckPatternKind < 6.5) {
  float vest=1.0-smoothstep(.69,.78,vDuckPosition.y);
  vec2 badge=abs(patternUv-vec2(0.0,.45));
  float crossMark=max((1.0-step(.04,badge.x))*(1.0-step(.13,badge.y)),(1.0-step(.13,badge.x))*(1.0-step(.04,badge.y)));
  body=mix(body,mix(duckPattern,vec3(1.0,.94,.79),crossMark),vest);
} else if (duckPatternKind > 6.5 && duckPatternKind < 7.5) {
  float vest=1.0-smoothstep(.62,.75,vDuckPosition.y);
  float seam=smoothstep(.018,.025,abs(fract(patternUv.x*3.3)-.5));
  body=mix(body,duckPattern*mix(.62,1.0,seam),vest);
} else if (duckPatternKind > 7.5 && duckPatternKind < 8.5) {
  vec2 cell=floor(patternUv*7.0);
  vec2 edge=abs(fract(patternUv*7.0)-.5);
  float grout=smoothstep(.41,.46,max(edge.x,edge.y));
  float tint=duckHash(cell);
  vec3 tile=tint<.33 ? duckPattern : tint<.66 ? body : mix(vec3(.91,.47,.57),body,.3);
  body=mix(tile,vec3(.9,.91,.79),grout);
} else if (duckPatternKind > 8.5 && duckPatternKind < 9.5) {
  float cream=smoothstep(.32,.39,vDuckPosition.y+.065*sin(patternUv.x*23.0));
  body=mix(duckPattern,body,cream);
  body=mix(body,vec3(1.0,.99,.79),pow(max(0.0,sin(patternUv.x*34.0+vDuckPosition.y*13.0)),24.0)*.22);
} else if (duckPatternKind > 9.5 && duckPatternKind < 10.5) {
  vec2 cell=floor(patternUv*8.5);
  vec2 spot=fract(patternUv*8.5)-.5;
  spot+=vec2(duckHash(cell),duckHash(cell.yx+4.2))*.35-.175;
  float dots=(1.0-smoothstep(.075,.115,length(spot)))*step(.3,duckHash(cell+8.0));
  body=mix(body,duckPattern,dots*.85);
} else if (duckPatternKind > 10.5 && duckPatternKind < 11.5) {
  float swirl=.5+.5*sin(patternUv.y*12.0+sin(patternUv.x*7.0)*1.8);
  body=mix(body,duckPattern,smoothstep(.68,.91,swirl)*.4);
} else if (duckPatternKind > 11.5 && duckPatternKind < 12.5) {
  vec2 panel=abs(fract(patternUv*3.4)-.5);
  float seam=smoothstep(.462,.48,max(panel.x,panel.y));
  body=mix(body,duckPattern,seam);
  float stripe=1.0-smoothstep(.055,.075,abs(vDuckPosition.y-.51));
  body=mix(body,vec3(.67,.18,.13),stripe);
} else if (duckPatternKind > 12.5 && duckPatternKind < 13.5) {
  vec2 gear=fract(patternUv*3.0)-.5;
  float angle=atan(gear.y,gear.x);
  float edge=.24+.025*step(0.0,sin(angle*10.0));
  float tooth=1.0-smoothstep(.022,.035,abs(length(gear)-edge));
  body=mix(body,duckPattern,tooth*.7);
} else if (duckPatternKind > 13.5 && duckPatternKind < 14.5) {
  vec2 cell=floor(patternUv*5.0);
  float light=(1.0-smoothstep(.055,.11,length(fract(patternUv*5.0)-.5)))*step(.58,duckHash(cell));
  body=mix(body,duckPattern,light);
  body*=.85+smoothstep(.25,1.1,vDuckPosition.y)*.15;
} else if (duckPatternKind > 14.5 && duckPatternKind < 15.5) {
  float stripe=fract(vDuckPosition.y*9.0+.08*sin(patternUv.x*15.0));
  vec3 cloth=stripe<.33 ? duckPattern : stripe<.66 ? vec3(.19,.61,.58) : vec3(.93,.67,.12);
  body=mix(body,cloth,1.0-smoothstep(.58,.74,vDuckPosition.y));
} else if (duckPatternKind > 15.5 && duckPatternKind < 16.5) {
  float band=.5+.5*sin(patternUv.x*4.0+vDuckPosition.y*7.0+sin(patternUv.y*5.0));
  body=mix(body,duckPattern,band*.82);
  body=mix(body,vec3(.62,.46,.84),pow(1.0-band,3.0)*.52);
} else if (duckPatternKind > 16.5) {
  vec2 cell=floor(patternUv*4.0);
  vec2 edge=abs(fract(patternUv*4.0)-.5);
  float tint=duckHash(cell);
  vec3 patchColor=tint<.3 ? duckPattern : tint<.65 ? body : vec3(.72,.4,.3);
  float seam=smoothstep(.438,.48,max(edge.x,edge.y));
  float stitch=step(.5,fract((patternUv.x+patternUv.y)*35.0));
  body=mix(patchColor,vec3(.98,.91,.69),seam*stitch*.9);
}
diffuseColor.rgb = mix(diffuseColor.rgb, body * mix(0.92, 1.0, diffuseColor.r), yellowMask);
diffuseColor.rgb = mix(diffuseColor.rgb, duckBill, billMask);
`,
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nif (duckPatternKind > 4.5 && duckPatternKind < 5.5) roughnessFactor = mix(roughnessFactor, 0.68, duckPatternMask * yellowMask);',
        )
        .replace(
          '#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\nif (duckPatternKind > 4.5 && duckPatternKind < 5.5) metalnessFactor = mix(metalnessFactor, 0.12, duckPatternMask * yellowMask);',
        );
    };
    result.customProgramCacheKey = () => 'supadub-duck-surface-v4';
  }
  materials.set(key, result);
  return result;
}

export function disposeDuckMaterials(): void {
  for (const material of materials.values()) material.dispose();
  materials.clear();
}

export function duckMaterialCount(): number {
  return materials.size;
}
