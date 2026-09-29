import * as THREE from 'three';
import { createAwardMedal, type AwardGrade } from './award-medal';

export type AwardPresentation = {
  object: THREE.Group;
  update(timeSeconds: number, reducedMotion: boolean): void;
  dispose(): void;
};

export function createAwardPresentation(grade: AwardGrade): AwardPresentation {
  const medal = createAwardMedal(grade);
  const object = new THREE.Group();
  object.name = `award-presentation-${grade}`;
  const key = new THREE.DirectionalLight(0xfff4d6, 3.6);
  key.position.set(-3, 5, 7);
  const fill = new THREE.DirectionalLight(0xd4e9ff, 1.35);
  fill.position.set(4, -1, 5);
  const glint = new THREE.DirectionalLight(0xfff8e7, 0.95);
  const hemisphere = new THREE.HemisphereLight(0xf7f7ff, 0x745437, 0.9);
  object.add(medal.object, key, key.target, fill, fill.target, glint, glint.target, hemisphere);
  let disposed = false;

  function update(timeSeconds: number, reducedMotion: boolean): void {
    if (disposed) return;
    const time = reducedMotion || !Number.isFinite(timeSeconds) ? 0 : Math.max(0, timeSeconds) % 86400;
    medal.object.rotation.set(
      -0.05 + Math.sin(time * 0.61) * 0.025,
      -0.06 + Math.sin(time * 0.43) * 0.085,
      -0.065,
    );
    glint.position.set(-0.4 + Math.sin(time * 0.53) * 0.9, 2.6, 4.8);
    glint.intensity = 0.95 + Math.sin(time * 0.53) * 0.2;
  }

  update(0, false);
  return {
    object,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      object.removeFromParent();
      medal.dispose();
      key.dispose();
      fill.dispose();
      glint.dispose();
      hemisphere.dispose();
      object.clear();
    },
  };
}
