import * as THREE from 'three';

export function createBubblePopMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
attribute vec4 popStyle;
varying vec3 vRayPoint;
varying vec3 vCenter;
varying vec3 vAxes;
varying vec4 vStyle;
varying float vFilmPhase;
void main(){
  mat4 transform=modelMatrix*instanceMatrix;
  vec4 center=transform*vec4(0.,0.,0.,1.);
  vCenter=(viewMatrix*center).xyz;
  vFilmPhase=fract(sin(dot(center.xz,vec2(12.9898,78.233)))*43758.5453);
  float radius=length(transform[0].xyz);
  float age=popStyle.x;
  float shock=sin(min(age/.15,1.)*3.14159265)*popStyle.w;
  vAxes=radius*vec3(1.+shock*.14,1.-shock*.095,1.+shock*.07);
  if(popStyle.z>.5)vAxes=vec3(radius);
  float bound=max(vAxes.x,max(vAxes.y,vAxes.z));
  float depth=-vCenter.z;
  vec3 point;
  if(projectionMatrix[2][3]<-.5){
    if(depth+bound<=0.){gl_Position=vec4(2.,2.,2.,1.);return;}
    float denominator=depth*depth-bound*bound;
    if(denominator<=.0001){
      point=vec3(position.x/projectionMatrix[0][0],position.y/projectionMatrix[1][1],-1.);
    }else{
      vec2 centerSlope=vCenter.xy*depth/denominator;
      vec2 radiusSlope=bound*sqrt(vCenter.xy*vCenter.xy+vec2(denominator))/denominator;
      point=vec3((centerSlope+position.xy*radiusSlope)*depth,-depth);
    }
  }else{point=vCenter+vec3(position.xy*bound,0.);}
  vRayPoint=point;
  vStyle=popStyle;
  gl_Position=projectionMatrix*vec4(point,1.);
}
`,
    fragmentShader: `
uniform mat4 projectionMatrix;
uniform float time;
varying vec3 vRayPoint;
varying vec3 vCenter;
varying vec3 vAxes;
varying vec4 vStyle;
varying float vFilmPhase;
void main(){
  bool perspective=projectionMatrix[2][3]<-.5;
  vec3 origin=perspective?vec3(0.):vec3(vRayPoint.xy,0.);
  vec3 direction=perspective?normalize(vRayPoint):vec3(0.,0.,-1.);
  vec3 localOrigin=(origin-vCenter)/vAxes;
  vec3 localDirection=direction/vAxes;
  float a=dot(localDirection,localDirection);
  float b=dot(localOrigin,localDirection);
  float c=dot(localOrigin,localOrigin)-1.;
  float discriminant=b*b-a*c;
  if(discriminant<=0.)discard;
  float distance=(-b-sqrt(discriminant))/a;
  if(distance<=0.)distance=(-b+sqrt(discriminant))/a;
  if(distance<=0.)discard;
  vec3 surface=origin+direction*distance;
  vec3 normal=normalize((surface-vCenter)/(vAxes*vAxes));
  vec3 spherePoint=(surface-vCenter)/vAxes;
  float facing=abs(dot(normal,direction));
  float radiusSquared=1.-discriminant/a;
  float radial=sqrt(max(0.,radiusSquared));
  float rim=pow(1.-facing,1.15);
  float edge=pow(1.-facing,7.5);
  float contourWidth=max(.012,fwidth(radial)*.85);
  float contour=exp(-pow((radial-.974)/contourWidth,2.));
  float age=vStyle.x;
  float phase=vStyle.y;
  bool droplet=vStyle.z>.5;
  float drift=sin(normal.x*4.4+normal.y*3.1+time*.19+vFilmPhase*6.28)*.12;
  float film=normal.y*.8+normal.x*.27+rim*.32+drift+vFilmPhase*.08;
  vec3 rainbow=.58+.42*cos(film*7.+vec3(.2,2.29,4.38));
  rainbow=mix(rainbow,vec3(.89,.96,1.),droplet?.64:.12);
  float highlight=pow(max(dot(normal,normalize(vec3(-.38,.45,.88))),0.),20.);
  float lower=pow(max(dot(normal,normalize(vec3(.42,-.61,.68))),0.),40.);
  float band=smoothstep(.18,.8,rim)*(.72+sin(film*12.)*.13);
  float alpha=.006+band*.34+edge*.24+contour*.23+highlight+lower*.38;
  vec3 color=mix(rainbow,vec3(1.),min(.98,highlight*1.8+lower*1.3+edge*.15+contour*.1));
  if(!droplet){
    float angle=phase*6.2831853;
    vec3 first=normalize(vec3(cos(angle)*.65,sin(angle)*.6,.75));
    vec3 second=normalize(vec3(cos(angle+2.2)*.9,sin(angle+2.2)*.9,.25));
    vec3 third=normalize(vec3(cos(angle-2.0)*.8,sin(angle-2.0)*.8,.38));
    float opening=min(length(spherePoint-first),min(length(spherePoint-second)+.14,length(spherePoint-third)+.23));
    float growth=smoothstep(.027,.16,age)*2.75;
    float boundary=opening-growth;
    float remaining=smoothstep(-.026,.028,boundary);
    float curl=exp(-pow(boundary/.043,2.))*smoothstep(.028,.055,age);
    color=mix(color,mix(rainbow,vec3(1.),.57),curl);
    alpha=(alpha*remaining+curl*.57)*(1.-smoothstep(.11,.18,age));
  }else{
    float life=.36+fract(phase*7.13)*.22;
    alpha*=smoothstep(.012,.046,age)*(1.-smoothstep(life*.5,life,age));
    alpha*=.82;
  }
  float outline=1.-smoothstep(1.-fwidth(radiusSquared)*1.5,1.,radiusSquared);
  if(alpha*outline<.003)discard;
  vec4 projected=projectionMatrix*vec4(surface,1.);
  gl_FragDepth=projected.z/projected.w*.5+.5;
  gl_FragColor=vec4(color,min(alpha,.98)*outline);
  #include <colorspace_fragment>
}
`,
  });
}
