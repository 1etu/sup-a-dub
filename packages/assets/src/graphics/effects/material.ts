import * as THREE from 'three';

export function createEffectMaterial(atlas: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { atlas: { value: atlas } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
attribute vec4 effectPosition;
attribute vec4 effectStyle;
attribute vec3 effectColor;
varying vec2 vAtlasUv;
varying float vOpacity;
varying vec3 vColor;
void main(){
  float angle=effectStyle.x;
  mat2 rotation=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
  vec2 offset=rotation*position.xy*effectPosition.w;
  vec4 center=modelViewMatrix*vec4(effectPosition.xyz,1.0);
  if(effectStyle.z>.5){
    center=modelViewMatrix*vec4(effectPosition.xyz+vec3(offset.x,0.,offset.y),1.0);
  }else{
    center.xy+=offset;
  }
  gl_Position=projectionMatrix*center;
  float tile=effectStyle.w;
  vAtlasUv=(uv*.98+.01+vec2(mod(tile,4.),floor(tile/4.)))*.25;
  vOpacity=effectStyle.y;
  vColor=effectColor;
}
`,
    fragmentShader: `
uniform sampler2D atlas;
varying vec2 vAtlasUv;
varying float vOpacity;
varying vec3 vColor;
void main(){
  vec4 sampleColor=texture2D(atlas,vAtlasUv);
  float alpha=sampleColor.a*vOpacity;
  if(alpha<.004)discard;
  gl_FragColor=vec4(sampleColor.rgb*vColor,alpha);
  #include <colorspace_fragment>
}
`,
  });
}
