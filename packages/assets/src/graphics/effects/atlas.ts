import * as THREE from 'three';

export const EFFECT_TILES = Object.freeze({
  ring: 0,
  bubble: 1,
  star: 2,
  heart: 3,
  rainbow: 4,
  sparkle: 5,
  wave: 6,
  laugh: 7,
  wow: 8,
  cheer: 9,
  splash: 10,
  confetti: 11,
});

type Rgba = readonly [number, number, number, number];
type Shape = { distance: (x: number, y: number) => number; color: Rgba };
type Point = readonly [number, number];
const white: Rgba = [255, 255, 255, 1];
const ink: Rgba = [40, 58, 91, 1];
const gold: Rgba = [255, 215, 64, 1];
const pink: Rgba = [245, 111, 163, 1];
const blue: Rgba = [136, 228, 252, 1];

function circle(x: number, y: number, radius: number, color: Rgba): Shape {
  return { distance: (px, py) => Math.hypot(px - x, py - y) - radius, color };
}

function ellipse(x: number, y: number, rx: number, ry: number, color: Rgba): Shape {
  return {
    distance: (px, py) => (Math.hypot((px - x) / rx, (py - y) / ry) - 1) * Math.min(rx, ry),
    color,
  };
}

function stroke(a: Point, b: Point, radius: number, color: Rgba): Shape {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  return {
    distance: (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length));
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) - radius;
    },
    color,
  };
}

function polygon(points: readonly Point[], color: Rgba): Shape {
  return {
    distance: (x, y) => {
      let nearest = Infinity,
        inside = false;
      for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
        const a = points[index]!,
          b = points[previous]!;
        const dx = b[0] - a[0],
          dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
        nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
        if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
          inside = !inside;
      }
      return inside ? -nearest : nearest;
    },
    color,
  };
}

function star(radius: number, color: Rgba, points = 5): Shape {
  return polygon(
    Array.from({ length: points * 2 }, (_, index): Point => {
      const angle = (index * Math.PI) / points + Math.PI / 2;
      const r = radius * (index % 2 ? 0.42 : 1);
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    }),
    color,
  );
}

function face(shapes: Shape[]): void {
  shapes.push(circle(0, 0, 0.83, white), circle(0, 0, 0.75, [218, 150, 31, 1]));
  shapes.push(ellipse(0, 0.045, 0.705, 0.68, gold));
  shapes.push(ellipse(-0.25, 0.48, 0.26, 0.11, [255, 248, 196, 0.9]));
  shapes.push(ellipse(-0.47, -0.16, 0.13, 0.065, pink), ellipse(0.47, -0.16, 0.13, 0.065, pink));
}

function artwork(tile: number): Shape[] {
  const shapes: Shape[] = [];
  if (tile === EFFECT_TILES.ring) {
    shapes.push({
      distance: (x, y) => Math.abs(Math.hypot(x, y) - 0.7) - 0.028,
      color: [209, 248, 255, 0.8],
    });
    shapes.push({
      distance: (x, y) => Math.abs(Math.hypot(x, y) - 0.56) - 0.012,
      color: [119, 211, 249, 0.43],
    });
  } else if (tile === EFFECT_TILES.bubble) {
    shapes.push(circle(0, 0, 0.76, [167, 225, 246, 0.09]));
    shapes.push({
      distance: (x, y) => Math.abs(Math.hypot(x, y) - 0.74) - 0.025,
      color: [208, 248, 253, 0.85],
    });
    shapes.push({
      distance: (x, y) => Math.max(Math.abs(Math.hypot(x, y) - 0.685) - 0.033, -x, y + 0.04),
      color: [249, 166, 223, 0.6],
    });
    shapes.push(ellipse(-0.32, 0.45, 0.16, 0.08, white), circle(0.39, -0.43, 0.06, [236, 252, 255, 0.7]));
  } else if (tile === EFFECT_TILES.star || tile === EFFECT_TILES.sparkle) {
    shapes.push(star(0.86, white, tile === EFFECT_TILES.sparkle ? 4 : 5));
    shapes.push(
      star(0.72, tile === EFFECT_TILES.sparkle ? blue : gold, tile === EFFECT_TILES.sparkle ? 4 : 5),
    );
    shapes.push(ellipse(-0.13, 0.24, 0.13, 0.07, white));
  } else if (tile === EFFECT_TILES.heart) {
    const heart = Array.from({ length: 48 }, (_, index): Point => {
      const t = (index / 48) * Math.PI * 2;
      return [
        Math.sin(t) ** 3 * 0.77,
        (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 18,
      ];
    });
    shapes.push(
      polygon(
        heart.map(([x, y]) => [x * 1.08, y * 1.08] as Point),
        white,
      ),
    );
    shapes.push(polygon(heart, pink), ellipse(-0.31, 0.34, 0.13, 0.08, [255, 226, 239, 1]));
  } else if (tile === EFFECT_TILES.rainbow) {
    const colors: Rgba[] = [
      [255, 139, 181, 0.78],
      [255, 212, 108, 0.78],
      [194, 238, 148, 0.78],
      [117, 228, 245, 0.78],
      [183, 171, 249, 0.78],
    ];
    colors.forEach((color, index) =>
      shapes.push({
        distance: (x, y) =>
          Math.max(Math.abs(Math.hypot(x, y + 0.25) - (0.78 - index * 0.12)) - 0.062, -y - 0.25),
        color,
      }),
    );
    for (const side of [-1, 1]) shapes.push(ellipse(side * 0.56, -0.24, 0.25, 0.14, white));
  } else if (tile === EFFECT_TILES.wave) {
    for (const [x, height] of [
      [-0.3, 0.45],
      [-0.07, 0.62],
      [0.17, 0.54],
      [0.38, 0.34],
    ])
      shapes.push(stroke([x!, -0.13], [x!, height!], 0.115, ink));
    shapes.push(ellipse(0.04, -0.19, 0.45, 0.48, ink), stroke([-0.27, -0.2], [-0.64, 0.1], 0.135, ink));
    for (const [x, height] of [
      [-0.3, 0.45],
      [-0.07, 0.62],
      [0.17, 0.54],
      [0.38, 0.34],
    ])
      shapes.push(stroke([x!, -0.13], [x!, height!], 0.078, white));
    shapes.push(ellipse(0.04, -0.19, 0.405, 0.43, white), stroke([-0.27, -0.2], [-0.64, 0.1], 0.098, white));
    shapes.push(stroke([-0.25, -0.62], [0.29, -0.62], 0.095, blue));
    shapes.push(
      stroke([-0.84, 0.42], [-0.69, 0.56], 0.04, gold),
      stroke([0.64, 0.61], [0.79, 0.43], 0.04, gold),
    );
  } else if (tile >= EFFECT_TILES.laugh && tile <= EFFECT_TILES.cheer) {
    face(shapes);
    if (tile === EFFECT_TILES.laugh) {
      for (const side of [-1, 1]) {
        shapes.push(stroke([side * 0.19, 0.21], [side * 0.31, 0.31], 0.043, ink));
        shapes.push(stroke([side * 0.31, 0.31], [side * 0.43, 0.18], 0.043, ink));
      }
      shapes.push(ellipse(0, -0.27, 0.3, 0.23, ink), ellipse(0, -0.39, 0.18, 0.08, pink));
      shapes.push(stroke([-0.17, -0.1], [0.17, -0.1], 0.043, white));
    } else if (tile === EFFECT_TILES.wow) {
      for (const side of [-1, 1])
        shapes.push(
          ellipse(side * 0.25, 0.19, 0.065, 0.12, ink),
          circle(side * 0.25 - 0.018, 0.24, 0.019, white),
        );
      shapes.push(ellipse(0, -0.31, 0.13, 0.17, ink), ellipse(0, -0.33, 0.075, 0.11, [255, 168, 115, 1]));
    } else {
      for (const side of [-1, 1]) {
        const eye = star(0.14, ink);
        shapes.push({ distance: (x, y) => eye.distance(x - side * 0.27, y - 0.21), color: ink });
      }
      shapes.push(ellipse(0, -0.23, 0.28, 0.22, ink), ellipse(0, -0.32, 0.19, 0.08, pink));
      shapes.push(stroke([-0.19, -0.08], [0.19, -0.08], 0.05, white));
    }
  } else if (tile === EFFECT_TILES.splash) {
    const outline: Point[] = [
      [-0.78, -0.32],
      [-0.64, 0.13],
      [-0.37, -0.08],
      [-0.33, 0.6],
      [-0.02, 0.05],
      [0.28, 0.75],
      [0.36, 0.1],
      [0.7, 0.35],
      [0.68, -0.37],
      [0.35, -0.65],
      [-0.3, -0.65],
    ];
    shapes.push(
      polygon(
        outline.map(([x, y]) => [x * 1.08, y * 1.08] as Point),
        white,
      ),
      polygon(outline, blue),
    );
    shapes.push(
      ellipse(-0.21, -0.16, 0.24, 0.1, white),
      circle(-0.65, 0.6, 0.085, blue),
      circle(0.73, 0.68, 0.064, white),
    );
  } else if (tile === EFFECT_TILES.confetti) {
    shapes.push(
      polygon(
        [
          [-0.28, -0.68],
          [0.28, -0.61],
          [0.4, 0.64],
          [-0.24, 0.71],
        ],
        white,
      ),
    );
    shapes.push(
      polygon(
        [
          [-0.2, -0.57],
          [0.2, -0.52],
          [0.31, 0.55],
          [-0.17, 0.59],
        ],
        pink,
      ),
    );
    shapes.push(stroke([-0.13, 0.38], [0.24, 0.31], 0.03, [255, 213, 234, 1]));
  }
  return shapes;
}

export function createEffectAtlas(): THREE.DataTexture {
  const cell = 96,
    size = cell * 4;
  const pixels = new Uint8Array(size * size * 4);
  for (let tile = 0; tile < 12; tile++) {
    const shapes = artwork(tile);
    for (let row = 0; row < cell; row++)
      for (let column = 0; column < cell; column++) {
        const x = ((column + 0.5) / cell) * 2 - 1;
        const y = ((row + 0.5) / cell) * 2 - 1;
        let r = 0,
          g = 0,
          b = 0,
          alpha = 0;
        for (const shape of shapes) {
          const coverage = Math.max(0, Math.min(1, 0.5 - shape.distance(x, y) * cell * 0.5)) * shape.color[3];
          const next = coverage + alpha * (1 - coverage);
          if (next <= 0) continue;
          r = (shape.color[0] * coverage + r * alpha * (1 - coverage)) / next;
          g = (shape.color[1] * coverage + g * alpha * (1 - coverage)) / next;
          b = (shape.color[2] * coverage + b * alpha * (1 - coverage)) / next;
          alpha = next;
        }
        const offset = ((Math.floor(tile / 4) * cell + row) * size + (tile % 4) * cell + column) * 4;
        pixels[offset] = r;
        pixels[offset + 1] = g;
        pixels[offset + 2] = b;
        pixels[offset + 3] = alpha * 255;
      }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'supadub-cosmetic-effects-authored';
  return texture;
}

let sharedTexture: THREE.DataTexture | undefined;
let users = 0;

export function acquireEffectAtlas(): { texture: THREE.DataTexture; release(): void } {
  sharedTexture ??= createEffectAtlas();
  users++;
  const texture = sharedTexture;
  let released = false;
  return {
    texture,
    release() {
      if (released) return;
      released = true;
      users--;
      if (users === 0) {
        sharedTexture?.dispose();
        sharedTexture = undefined;
      }
    },
  };
}
