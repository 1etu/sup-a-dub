import * as THREE from 'three';

export function createFloorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { theme: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec2 world;void main(){world=(modelMatrix*vec4(position,1.0)).xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec2 world;
      uniform float theme,time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 uv=world*3.6;
        vec2 g=abs(fract(uv)-.5),aa=fwidth(uv);
        float line=max(smoothstep(.475-aa.x,.497+aa.x,g.x),smoothstep(.475-aa.y,.497+aa.y,g.y));
        vec3 color=mix(vec3(.038,.18,.527),vec3(.067,.28,.702),hash(floor(uv))*.55+.2);
        color=mix(color,vec3(.31,.52,.72),line*.66);
        vec2 cell=floor(world*.45);
        vec2 pat=fract(world*.45)-.5-(vec2(hash(cell+4.8),hash(cell+9.2))-.5)*.25;
        float rot=(hash(cell+12.4)-.5)*1.1;
        pat=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*pat;
        pat/=mix(.62,1.08,hash(cell));
        float pattern=0.0;
        if(theme>.5&&theme<1.5){
          vec2 h=pat*5.0;h.y=-h.y+.15;
          float a=dot(h,h)-1.0;
          pattern=1.0-smoothstep(-.08,.08,a*a*a-h.x*h.x*h.y*h.y*h.y);
          color=mix(vec3(.57,.19,.38),vec3(.78,.40,.61),pattern*.72);
        }
        if(theme>1.5&&theme<2.5){
          float angle=atan(pat.x,pat.y)+3.14159265;
          float sector=floor(angle/.62831853),local=angle-sector*.62831853;
          float r0=mix(.27,.116,mod(sector,2.0)),r1=mix(.116,.27,mod(sector,2.0));
          float edge=r0*r1*sin(.62831853)/(r1*sin(.62831853-local)+r0*sin(local));
          pattern=1.0-smoothstep(edge-.008,edge+.008,length(pat));
          color=mix(vec3(.045,.30,.33),vec3(.27,.57,.53),pattern*.65);
        }
        if(theme>2.5){pattern=1.0-smoothstep(.17,.19,length(pat));color=mix(vec3(.22,.39,.52),vec3(.51,.67,.74),pattern*.8);}
        float w=sin(world.x*.8+world.y*.6+time*.9)*.65+sin(world.y*1.2-time*.7)*.45;
        float caustic=pow(1.0-abs(sin(world.x*1.19+w*1.8)*cos(world.y*1.37-w*1.9)),7.0);
        color+=vec3(.014,.027,.039)*caustic;
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function createBarrierMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `varying vec3 point;varying vec3 norm;void main(){point=(modelMatrix*vec4(position,1.0)).xyz;norm=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      varying vec3 point,norm;
      void main(){
        vec2 uv=vec2(abs(norm.z)>.5?point.x:point.z,point.y)*4.0;
        vec2 g=abs(fract(uv)-.5),aa=fwidth(uv);
        float line=max(smoothstep(.455-aa.x,.49+aa.x,g.x),smoothstep(.455-aa.y,.49+aa.y,g.y));
        vec3 color=mix(vec3(.024,.15,.30),vec3(.28,.47,.56),line*.8);
        color*=.8+.2*abs(norm.z);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
