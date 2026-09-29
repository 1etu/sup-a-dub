import * as THREE from 'three';

export const AWARD_STUDIO_SIZE = Object.freeze({ width: 512, height: 256 });

export function createAwardStudioTexture(): THREE.DataTexture {
  const { width, height } = AWARD_STUDIO_SIZE;
  const pixels = new Float32Array(width * height * 4);
  const lights = [
    {
      direction: new THREE.Vector3(-0.45, 0.5, 1).normalize(),
      width: 0.8,
      height: 0.24,
      strength: 6.8,
      color: [1, 0.965, 0.89],
    },
    {
      direction: new THREE.Vector3(0.8, 0.13, 0.8).normalize(),
      width: 0.15,
      height: 0.7,
      strength: 4.4,
      color: [0.86, 0.93, 1],
    },
    {
      direction: new THREE.Vector3(-0.1, -0.7, 0.7).normalize(),
      width: 0.7,
      height: 0.06,
      strength: 4,
      color: [1, 0.85, 0.66],
    },
    {
      direction: new THREE.Vector3(-0.8, -0.2, -0.4).normalize(),
      width: 0.35,
      height: 0.6,
      strength: 1.9,
      color: [1, 1, 1],
    },
  ].map((light) => ({
    ...light,
    right: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), light.direction).normalize(),
    up: new THREE.Vector3(),
  }));
  for (const light of lights) light.up.crossVectors(light.direction, light.right).normalize();
  const direction = new THREE.Vector3();
  for (let y = 0; y < height; y++) {
    const elevation = Math.PI * (1 - (y + 0.5) / height);
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + 0.5) / width - 0.5) * Math.PI * 2;
      direction.set(
        Math.cos(azimuth) * Math.sin(elevation),
        Math.cos(elevation),
        Math.sin(azimuth) * Math.sin(elevation),
      );
      const ambient = 0.24 + Math.max(0, direction.y) * 0.32;
      const offset = (y * width + x) * 4;
      pixels[offset] = ambient;
      pixels[offset + 1] = ambient;
      pixels[offset + 2] = ambient * 1.025;
      pixels[offset + 3] = 1;
      for (const light of lights) {
        const forward = direction.dot(light.direction);
        if (forward <= 0) continue;
        const horizontal = Math.atan2(direction.dot(light.right), forward);
        const vertical = Math.atan2(direction.dot(light.up), forward);
        const distance =
          Math.pow(Math.abs(horizontal) / light.width, 12) + Math.pow(Math.abs(vertical) / light.height, 12);
        const intensity = Math.exp(-distance) * light.strength;
        for (let channel = 0; channel < 3; channel++)
          pixels[offset + channel] += intensity * light.color[channel]!;
      }
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.name = 'award-studio-source';
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
