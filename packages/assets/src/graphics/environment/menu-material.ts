import * as THREE from 'three';

export function createMenuMaterial(
  background: THREE.Texture,
  blank: THREE.Texture,
  scrollOffset: THREE.Vector2,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBackground: { value: background },
      uRows: { value: blank },
      uChrome: { value: blank },
      uArrows: { value: blank },
      uArrowsAlpha: { value: 1 },
      uArrowShift: { value: 0 },
      uScroll0: { value: blank },
      uScroll1: { value: blank },
      uScroll2: { value: blank },
      uScroll3: { value: blank },
      uScrollBounds: { value: new THREE.Vector4() },
      uScrollSize: { value: new THREE.Vector2(1, 1) },
      uScrollOffset: { value: scrollOffset },
      uScrollTiles: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
      uScrollCount: { value: 0 },
      uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -1000, 0)) },
      uCaret: { value: new THREE.Vector4() },
      uBounds: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
      uScales: { value: Array.from({ length: 8 }, () => 1) },
      uCount: { value: 0 },
      uSelection: { value: -1 },
      uTime: { value: 0 },
      uWarp: { value: 0 },
      uRowsAlpha: { value: 1 },
      uChromeAlpha: { value: 1 },
      uOpacity: { value: 1 },
      uBoot: { value: 0 },
      uAspect: { value: 16 / 9 },
      uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uBackground,uRows,uChrome,uArrows;
        uniform sampler2D uScroll0,uScroll1,uScroll2,uScroll3;
        uniform vec4 uScrollBounds;
        uniform vec2 uScrollSize,uScrollOffset,uScrollTiles[4];
        uniform int uScrollCount;
        uniform vec4 uBounds[8];
        uniform vec4 uRipples[8];
        uniform vec4 uCaret;
        uniform float uScales[8];
        uniform int uCount,uSelection;
        uniform float uTime,uWarp,uRowsAlpha,uChromeAlpha,uArrowsAlpha,uArrowShift,uOpacity,uBoot,uAspect;
        uniform vec2 uTexel;
        vec4 letters(vec2 uv){
          if(uCount==0)return texture2D(uRows,uv);
          vec4 result=vec4(0.0);
          for(int i=0;i<8;i++){
            if(i>=uCount)break;
            vec4 box=uBounds[i];
            float scale=max(uScales[i],0.002);
            vec2 sampleUv=(uv-box.xy)/scale+box.xy;
            vec2 delta=abs(sampleUv-box.xy);
            float inside=step(delta.x,box.z*0.5)*step(delta.y,box.w*0.5);
            if(inside<.5)continue;
            vec4 next=texture2D(uRows,sampleUv)*inside;
            next.rgb*=i==uSelection?1.025:1.0;
            result=next+result*(1.0-next.a);
          }
          return result;
        }
        vec4 scrolling(vec2 uv){
          if(uScrollCount==0)return vec4(0.0);
          vec2 point=vec2(uv.x,1.0-uv.y)-uScrollBounds.xy;
          if(point.x<0.0||point.y<0.0||point.x>uScrollBounds.z||point.y>uScrollBounds.w)return vec4(0.0);
          vec2 content=(point+uScrollOffset)/uScrollSize;
          if(content.x<0.0||content.x>1.0||content.y<0.0||content.y>1.0)return vec4(0.0);
          for(int i=0;i<4;i++){
            if(i>=uScrollCount)break;
            vec2 tile=uScrollTiles[i];
            float y=(content.y-tile.x)/tile.y;
            if(y<0.0||y>1.0)continue;
            vec2 tileUv=vec2(content.x,1.0-y);
            if(i==0)return texture2D(uScroll0,tileUv);
            if(i==1)return texture2D(uScroll1,tileUv);
            if(i==2)return texture2D(uScroll2,tileUv);
            return texture2D(uScroll3,tileUv);
          }
          return vec4(0.0);
        }
        vec2 titleProjection(vec2 point,float amount){
          point.x=0.5+(point.x-0.5)/(1.0+amount*(1.0-point.y)*2.0);
          point.y=0.5+(point.y-0.5)/(1.0+amount*16.0);
          return point;
        }
        void main(){
          vec2 uv=titleProjection(vUv,uBoot);
          vec2 center=(uv-vec2(0.53,0.49))*vec2(uAspect,1.0);
          float radius=length(center);
          vec2 wave=vec2(sin(uv.y*21.0-uTime*1.7)+sin(uv.x*8.0+uv.y*14.0+uTime),cos(uv.x*17.0+uTime*1.3))*0.42;
          wave+=normalize(center+vec2(0.0001))*sin(radius*29.0-uTime*4.1)*exp(-radius*1.7)*smoothstep(0.0,0.18,radius)*0.42;
          vec2 displacement=wave*uWarp;
          for(int i=0;i<8;i++){
            vec4 ripple=uRipples[i];
            float age=uTime-ripple.z;
            if(age<0.0||age>3.0||ripple.w<=0.0)continue;
            vec2 delta=(uv-ripple.xy)*vec2(uAspect,1.0);
            float distance=length(delta);
            float front=distance-age*0.44;
            float envelope=exp(-pow(front/(0.08+age*0.035),2.0))*exp(-age*2.0)*(1.0-smoothstep(.85,1.5,age));
            float height=sin(front*53.0+1.96)*envelope*smoothstep(0.0,0.045,distance);
            displacement+=normalize(delta+vec2(0.00001))*vec2(1.0/uAspect,1.0)*height*0.04*ripple.w;
          }
          vec2 sampleUv=clamp(uv+displacement,vec2(0.001),vec2(0.999));
          vec3 color=texture2D(uBackground,sampleUv).rgb;
          if(uBoot>0.001){
            vec3 streaks=vec3(0.0);
            for(int i=0;i<8;i++){
              float phase=(float(i)+.5)/8.0;
              vec2 trail=titleProjection(vUv,uBoot*mix(.35,1.0,phase));
              trail+=displacement*.25;
              streaks+=texture2D(uBackground,clamp(trail,vec2(.001),vec2(.999))).rgb;
            }
            color=mix(color,streaks*.125,min(1.0,uBoot*8.0));
            color*=1.0-uBoot*.44;
          }
          #ifdef TONE_MAPPING
            color=toneMapping(color);
          #endif
          vec4 row=letters(sampleUv);
          vec4 chrome=texture2D(uChrome,sampleUv);
          if(uBoot>0.001){
            row*=0.2;
            chrome*=0.2;
            for(int i=1;i<=4;i++){
              vec2 smear=vec2(0.0,(float(i)-2.5)*uBoot*0.018);
              row+=letters(clamp(sampleUv+smear,0.001,0.999))*0.2;
              chrome+=texture2D(uChrome,clamp(sampleUv+smear,0.001,0.999))*0.2;
            }
            row.rgb*=1.0-uBoot*.28;
            chrome.rgb*=1.0-uBoot*.28;
          }
          vec4 arrows=texture2D(uArrows,sampleUv+vec2(0.0,uArrowShift));
          vec4 scroll=scrolling(sampleUv);
          row.a*=uRowsAlpha;
          chrome.a*=uChromeAlpha;
          color=mix(color,row.rgb,row.a);
          color=mix(color,scroll.rgb,scroll.a*uChromeAlpha);
          color=mix(color,chrome.rgb,chrome.a);
          color=mix(color,arrows.rgb,arrows.a*uArrowsAlpha);
          vec2 caretDistance=abs(sampleUv-uCaret.xy);
          float caret=step(caretDistance.x,uCaret.z*0.5)*step(caretDistance.y,uCaret.w*0.5)*step(0.001,uCaret.w)*step(0.5,fract(uTime));
          color=mix(color,vec3(0.95,0.98,1.0),caret);
          gl_FragColor=vec4(color,uOpacity);
          #include <colorspace_fragment>
        }
      `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}
