import * as THREE from 'three';

export class Picture {
  readonly target = new THREE.WebGLRenderTarget(1280, 720, { type: THREE.HalfFloatType, samples: 2 });
  private readonly history = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  private readonly copyScene = new THREE.Scene();
  private readonly copyMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: this.target.texture } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:
      'varying vec2 vUv;uniform sampler2D source;void main(){gl_FragColor=texture2D(source,vUv);}',
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private geometry = new THREE.PlaneGeometry(2, 2);
  private material = new THREE.ShaderMaterial({
    uniforms: {
      picture: { value: this.target.texture },
      previousPicture: { value: this.history.texture },
      transition: { value: 1 },
      pixel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
      softness: { value: 1 },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D picture,previousPicture;
      uniform vec2 pixel;
      uniform float softness;
      uniform float transition;
      vec3 sampleScene(vec2 uv){
        if(transition>=1.0)return texture2D(picture,uv).rgb;
        vec2 aspect=vec2(pixel.y/pixel.x,1.0);
        vec2 delta=(uv-vec2(.5))*aspect;
        float radius=length(delta);
        float front=radius-transition*.9;
        float envelope=exp(-front*front*12.0)*sin(transition*3.14159265);
        vec2 offset=normalize(delta+vec2(.0001))/aspect*sin(front*38.0)*envelope*.032;
        vec2 displaced=clamp(uv+offset,vec2(.001),vec2(.999));
        return mix(texture2D(previousPicture,displaced).rgb,texture2D(picture,displaced).rgb,smoothstep(.06,.92,transition));
      }
      void main(){
        vec3 original=sampleScene(vUv);
        vec3 diffuse=vec3(0.0);
        vec3 bloom=vec3(0.0);
        for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
          vec3 nearColor=sampleScene(vUv+vec2(float(x),float(y))*pixel*1.25);
          vec3 farColor=sampleScene(vUv+vec2(float(x),float(y))*pixel*5.0);
          diffuse+=nearColor/9.0;
          bloom+=max(farColor-vec3(.72),vec3(0.0))/9.0;
        }
        vec3 color=mix(original,diffuse,.16*softness)+bloom*.25*softness;
        color=mix(color,color*.95+vec3(.014,.012,.023),softness*.5);
        float vignette=1.0-.095*softness*pow(length((vUv-.5)*vec2(1.25,1.0)),1.8);
        gl_FragColor=vec4(color*vignette,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });

  constructor() {
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
    this.copyScene.add(new THREE.Mesh(this.geometry, this.copyMaterial));
  }

  beginTransition(renderer: THREE.WebGLRenderer): void {
    const previous = renderer.getRenderTarget();
    this.history.setSize(this.target.width, this.target.height);
    try {
      renderer.setRenderTarget(this.history);
      renderer.render(this.copyScene, this.camera);
      this.material.uniforms.transition.value = 0;
    } finally {
      renderer.setRenderTarget(previous);
    }
  }

  setTransition(progress: number): void {
    this.material.uniforms.transition.value = Number.isFinite(progress)
      ? Math.max(0, Math.min(1, progress))
      : 1;
  }

  endTransition(): void {
    this.material.uniforms.transition.value = 1;
  }

  resize(width: number, height: number) {
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    if (width !== this.target.width || height !== this.target.height) this.target.setSize(width, height);
    if (this.material.uniforms.transition.value < 1) this.endTransition();
    this.material.uniforms.pixel.value.set(1 / width, 1 / height);
  }

  render(renderer: THREE.WebGLRenderer, soft: boolean) {
    this.material.uniforms.softness.value = soft ? 1 : 0;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.target.dispose();
    this.history.dispose();
    this.copyMaterial.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
