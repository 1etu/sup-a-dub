import * as THREE from 'three';

export function createSkyEnvironment(renderer: THREE.WebGLRenderer) {
  const width = 512;
  const height = 256;
  const pixels = new Float32Array(width * height * 4);
  const color = new THREE.Color();
  const blue = new THREE.Color(0x44658f);
  const lavender = new THREE.Color(0x8995b5);
  const peach = new THREE.Color(0xe6ccc4);
  for (let y = 0; y < height; y++) {
    const v = 1 - y / (height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / width;
      color
        .copy(v < 0.7 ? blue : lavender)
        .lerp(v < 0.7 ? lavender : peach, v < 0.7 ? v / 0.7 : (v - 0.7) / 0.3);
      const clouds = Math.max(0, Math.sin(u * Math.PI * 6 + Math.sin(v * 15) * 0.9 + 4.0)) ** 3;
      const cloudBand = Math.exp(-(((v - 0.36) / 0.085) ** 2));
      const softbox = Math.exp(-(((u - 0.18) / 0.07) ** 2) - ((v - 0.24) / 0.065) ** 2);
      const fill = Math.exp(-(((u - 0.67) / 0.035) ** 2) - ((v - 0.35) / 0.17) ** 2);
      const glow = clouds * cloudBand * 2.2 + softbox * 1.1 + fill * 1.6;
      const index = (y * width + x) * 4;
      pixels[index] = color.r + glow;
      pixels[index + 1] = color.g + glow;
      pixels[index + 2] = color.b + glow;
      pixels[index + 3] = 1;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  pmrem.dispose();
  return { environment: target, sky: texture };
}
