import * as THREE from 'three';

const fullscreenVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}`;

const noise = `
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
}
float fbm(vec2 p) {
  float n=0.0, a=0.5;
  for(int i=0;i<5;i++){n+=a*noise(p); p=mat2(1.6,-1.2,1.2,1.6)*p; a*=0.5;}
  return n;
}
float cloudLobe(vec2 p,vec2 center,vec2 radius) {
  vec2 d=(p-center)/radius;
  return exp(-dot(d,d)*2.4);
}`;

export class Backdrop {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.Camera();
  private material: THREE.ShaderMaterial;
  private geometry = new THREE.PlaneGeometry(2, 2);

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMenu: { value: 1 },
        uAspect: { value: 16 / 9 },
        uMotion: { value: 1 },
      },
      vertexShader: fullscreenVertex,
      fragmentShader: `${noise}
      varying vec2 vUv;
      uniform float uTime, uMenu, uAspect, uMotion;
      void main() {
        vec2 uv=vUv;
        float t=uTime*uMotion;
        vec2 q=uv*vec2(uAspect,1.0);
        vec2 p=q+vec2(t*0.003,0.0);
        vec3 sky=vec3(0.0);
        if(uMenu<.5){
        vec2 detail=vec2(noise(p*8.0+vec2(1.0,2.0)),noise(p*17.0+vec2(3.0,1.0)));
        float structure=detail.x*.55+detail.y*.30+noise(p*35.0+vec2(11.4,8.2))*.15;
        vec2 cloudUv=uv+(detail-.5)*.046;
        cloudUv+=vec2(sin(t*.055)*.023,cos(t*.045)*.008);
        float cloud=cloudLobe(cloudUv,vec2(-.055,.19),vec2(.28,.28));
        cloud+=cloudLobe(cloudUv,vec2(.01,.365),vec2(.135,.145));
        cloud+=cloudLobe(cloudUv,vec2(-.02,.49),vec2(.092,.105));
        cloud+=cloudLobe(cloudUv,vec2(.035,.565),vec2(.066,.078));
        cloud+=cloudLobe(cloudUv,vec2(.096,.474),vec2(.074,.091));
        cloud+=cloudLobe(cloudUv,vec2(.132,.295),vec2(.105,.115));
        cloud+=cloudLobe(cloudUv,vec2(1.055,.21),vec2(.28,.28));
        cloud+=cloudLobe(cloudUv,vec2(.995,.386),vec2(.137,.155));
        cloud+=cloudLobe(cloudUv,vec2(1.018,.526),vec2(.088,.10));
        cloud+=cloudLobe(cloudUv,vec2(.953,.591),vec2(.057,.073));
        cloud+=cloudLobe(cloudUv,vec2(.887,.47),vec2(.067,.086));
        cloud+=cloudLobe(cloudUv,vec2(.873,.29),vec2(.105,.12));
        float highCloud=cloudLobe(cloudUv,vec2(.774,.818),vec2(.09,.125))*.75;
        highCloud+=cloudLobe(cloudUv,vec2(.808,.759),vec2(.096,.13))*.8;
        highCloud+=cloudLobe(cloudUv,vec2(.747,.865),vec2(.078,.10))*.55;
        highCloud+=cloudLobe(cloudUv,vec2(.148,.73),vec2(.076,.125))*.65;
        highCloud+=cloudLobe(cloudUv,vec2(.171,.685),vec2(.068,.09))*.5;
        float density=max(0.0,cloud-.095+(structure-.5)*.36*clamp(cloud*1.4,0.0,1.0));
        float cloudOpacity=1.0-exp(-density*3.4);
        sky=mix(vec3(1.0,.81,.79),vec3(.285,.407,.682),smoothstep(.04,.86,uv.y));
        float centerHaze=exp(-pow((uv.x-.5)/.34,2.0))*clamp(.16+(.96-uv.y)*.5,.14,.25);
        float skyHaze=(.24*(1.0-smoothstep(.65,.96,uv.y))+centerHaze)*smoothstep(.45,.64,uv.y);
        sky=mix(sky,vec3(.59,.73,.94),skyHaze);
        float cloudLight=smoothstep(.21,.9,structure*.7+min(cloud,1.4)*.28);
        vec3 cloudColor=mix(vec3(.78,.84,.91),vec3(1.0,.995,.99),cloudLight);
        sky=mix(sky,cloudColor,cloudOpacity*.96);
        float highOpacity=(1.0-exp(-highCloud*(.85+structure*.3)*1.35))*.58;
        sky=mix(sky,vec3(.72,.81,.91),highOpacity);
        vec2 rp=(uv-vec2(0.52,0.05))*vec2(uAspect,1.0);
        float radius=length(rp);
        float rainbow=exp(-pow((radius-0.88)/0.085,2.0))*0.025;
        vec3 spectrum=0.5+0.5*cos(vec3(0.0,2.1,4.2)+(radius-0.84)*86.0);
        sky=mix(sky,spectrum,rainbow);
        }
        vec3 tile=vec3(0.0);
        if(uMenu>.5){
        vec2 gridUv=uv*vec2(74.0,74.0/uAspect);
        gridUv+=vec2(sin(uv.y*17.0+t*0.27)+sin(uv.y*35.0-t*0.12),cos(uv.x*23.0+t*0.21))*0.037;
        gridUv+=vec2(sin(uv.y*110.0+t*0.4),cos(uv.x*145.0-t*0.3))*0.018;
        vec2 cell=floor(gridUv);
        vec2 grid=abs(fract(gridUv)-0.5);
        vec2 fw=fwidth(gridUv)*1.0;
        float grout=max(smoothstep(0.454-fw.x,0.482+fw.x,grid.x),smoothstep(0.454-fw.y,0.482+fw.y,grid.y));
        tile=mix(vec3(0.17,0.455,0.72),vec3(0.255,0.565,0.84),hash(cell)*0.6+0.20);
        float shimmer=fbm(q*4.5+vec2(t*0.023,-t*0.015));
        float caustic=pow(1.0-abs(sin(q.x*9.0+shimmer*8.0+t*0.22)*cos(q.y*12.0-shimmer*6.0)),10.0);
        tile+=shimmer*0.075+caustic*0.016;
        tile=mix(tile,vec3(0.74,0.86,0.84),grout*0.82);
        }
        float vignette=1.0-0.12*pow(length((uv-0.5)*vec2(1.3,1.0)),1.8);
        gl_FragColor=vec4(pow(mix(sky,tile,uMenu)*vignette,vec3(2.2)),1.0);
      }`,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  update(time: number, menu: boolean, aspect: number, reducedMotion: boolean) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uMenu.value = menu ? 1 : 0;
    this.material.uniforms.uAspect.value = aspect;
    this.material.uniforms.uMotion.value = reducedMotion ? 0 : 1;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
