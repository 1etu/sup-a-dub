import * as THREE from 'three';
import { cosmetic, type AvatarFamily } from '@supadub/cosmetics';
import type { DuckDetail } from '../duck';
import type { AvatarAnchors } from './types';
import { ToyGeometry, type Point } from './geometry';

type AnimalShape = { geometry: THREE.BufferGeometry; anchors: AvatarAnchors };

function shark(builder: ToyGeometry, variant: boolean, body: string, accent: string): void {
  const cream = '#fff0d3';
  builder.hull(
    [
      [-1.06, 0.04, 0.06, 0.37],
      [-0.79, 0.31, 0.27, 0.42],
      [-0.28, 0.56, 0.47, 0.53],
      [0.3, variant ? 0.7 : 0.6, 0.49, 0.55],
      [0.69, variant ? 0.74 : 0.52, 0.33, 0.48],
      [0.94, 0.33, 0.13, 0.43],
      [1.03, 0.035, 0.04, 0.43],
    ],
    body,
    0.82,
  );
  builder.blob([0, 0.3, 0.35], [0.5, 0.18, 0.66], cream);
  for (const side of [-1, 1]) {
    builder.fin(
      [
        [side * 0.38, 0.36, 0.1],
        [side * 0.72, 0.27, -0.06],
        [side * (variant ? 1.04 : 0.94), 0.32, -0.45],
      ],
      0.22,
      0.065,
      accent,
    );
    builder.eye([side * (variant ? 0.49 : 0.37), 0.7, 0.69], variant ? 0.125 : 0.14, side);
    for (let gill = 0; gill < 3; gill++)
      builder.tube(
        [
          [side * 0.54, 0.64, -0.1 - gill * 0.105],
          [side * 0.565, 0.51, -0.08 - gill * 0.105],
          [side * 0.52, 0.41, -0.04 - gill * 0.105],
        ],
        0.015,
        '#3d6684',
      );
    builder.fin(
      [
        [0, 0.4, -0.85],
        [side * 0.36, 0.53, -1.16],
        [side * 0.52, 0.75, -1.37],
      ],
      0.23,
      0.06,
      accent,
    );
  }
  builder.fin(
    [
      [0, 0.78, -0.45],
      [0, 1.24, -0.36],
      [0, 0.84, 0.16],
    ],
    variant ? 0.27 : 0.2,
    0.075,
    accent,
    [1, 0, 0],
  );
  builder.smile(0.35, 0.4, 0.915, '#365069');
  for (let index = 0; index < 5; index++)
    builder.blob([-0.25 + index * 0.125, 0.357, 0.922], [0.045, 0.065, 0.025], cream, [
      0,
      0,
      index % 2 ? -0.08 : 0.08,
    ]);
  if (variant)
    for (const x of [-0.22, 0, 0.22]) builder.blob([x, 0.94, 0.21], [0.075, 0.025, 0.1], '#ffcfad');
}

function axolotl(builder: ToyGeometry, variant: boolean, body: string, accent: string): void {
  builder.hull(
    [
      [-1.04, 0.025, 0.04, 0.27],
      [-0.65, 0.31, 0.21, 0.28],
      [-0.2, 0.46, 0.34, 0.36],
      [0.33, 0.53, 0.32, 0.49],
      [0.65, 0.52, 0.29, 0.55],
      [0.89, 0.33, 0.16, 0.51],
      [0.95, 0.025, 0.04, 0.49],
    ],
    body,
    0.78,
  );
  builder.blob([0, 0.49, 0.61], [0.61, 0.31, 0.43], body);
  builder.fin(
    [
      [0, 0.3, -0.5],
      [0, 0.59, -0.95],
      [0, 0.68, -1.37],
      [0, 0.38, -1.53],
    ],
    0.23,
    0.045,
    accent,
    [1, 0, 0],
  );
  for (const side of [-1, 1]) {
    builder.eye([side * 0.255, 0.66, 0.93], 0.105, side);
    builder.blob([side * 0.39, 0.44, 0.92], [0.12, 0.055, 0.025], variant ? '#f4e579' : '#ef89af');
    for (let branch = 0; branch < 3; branch++) {
      const height = 0.57 + branch * 0.17;
      const endX = side * (0.85 + (branch === 1 ? 0.08 : 0));
      const endY = 0.49 + branch * 0.27;
      builder.tube(
        [
          [side * 0.44, height, 0.45],
          [side * 0.7, height + 0.07, 0.48],
          [endX, endY, 0.42],
        ],
        0.039,
        accent,
      );
      for (let tuft = 0; tuft < (variant ? 4 : 3); tuft++) {
        const t = (tuft + 1) / 5;
        const cx = side * (0.53 + 0.32 * t);
        const cy = height + (endY - height) * t;
        builder.fin(
          [
            [cx, cy, 0.46],
            [cx + side * 0.06, cy + 0.12, 0.45],
            [cx + side * 0.13, cy + 0.16, 0.41],
          ],
          variant ? 0.04 : 0.055,
          0.017,
          accent,
          [0, 0, 1],
        );
      }
    }
    for (const z of [-0.31, 0.3]) {
      builder.fin(
        [
          [side * 0.3, 0.24, z],
          [side * 0.58, 0.16, z + 0.07],
          [side * 0.65, 0.13, z + 0.26],
        ],
        0.125,
        0.06,
        body,
      );
      for (let toe = 0; toe < 3; toe++)
        builder.blob(
          [side * (0.56 + toe * 0.07), 0.13, z + 0.22 + Math.sin(toe) * 0.08],
          [0.055, 0.045, 0.09],
          accent,
        );
    }
  }
  builder.smile(0.21, 0.44, 0.972);
  if (variant)
    for (let index = 0; index < 7; index++)
      builder.blob(
        [((index % 3) - 1) * 0.15, 0.64 + (index % 2) * 0.05, -0.4 + Math.floor(index / 3) * 0.16],
        [0.035, 0.017, 0.055],
        '#6fa547',
      );
}

function turtle(builder: ToyGeometry, variant: boolean, body: string, accent: string): void {
  const belly = variant ? '#fff0c7' : '#d5ec94';
  builder.hull(
    [
      [-0.94, 0.06, 0.05, 0.24],
      [-0.68, 0.52, 0.14, 0.24],
      [-0.18, 0.69, 0.21, 0.27],
      [0.24, 0.64, 0.23, 0.28],
      [0.57, 0.43, 0.21, 0.29],
      [0.69, 0.08, 0.08, 0.32],
    ],
    body,
    0.85,
  );
  builder.blob([0, 0.16, -0.02], [0.69, 0.13, 0.79], belly);
  builder.blob([0, 0.47, 0.77], [0.39, 0.33, 0.41], body);
  builder.blob([0, 0.32, 0.93], [0.34, 0.14, 0.3], belly);
  builder.eye([-0.22, 0.65, 1.015], 0.13, -1);
  builder.eye([0.22, 0.65, 1.015], 0.13, 1);
  builder.smile(0.2, 0.37, 1.135, '#496b46');
  for (const side of [-1, 1]) {
    builder.fin(
      [
        [side * 0.43, 0.22, 0.31],
        [side * 0.77, 0.11, 0.49],
        [side * (variant ? 1.03 : 0.87), 0.12, variant ? 0.77 : 0.64],
      ],
      0.18,
      0.065,
      body,
    );
    builder.fin(
      [
        [side * 0.46, 0.2, -0.46],
        [side * 0.77, 0.12, -0.6],
        [side * 0.87, 0.16, -0.77],
      ],
      0.16,
      0.05,
      body,
    );
  }
  builder.fin(
    [
      [0, 0.23, -0.71],
      [0, 0.2, -0.98],
      [0, 0.24, -1.12],
    ],
    0.12,
    0.04,
    body,
  );
  builder.blob([0, 0.42, -0.05], [0.73, 0.48, 0.79], accent);
  const shellSurface = (x: number, z: number) =>
    0.425 + 0.49 * Math.sqrt(Math.max(0.04, 1 - (x / 0.75) ** 2 - ((z + 0.05) / 0.81) ** 2));
  const seam = variant ? '#755f3e' : '#285e49';
  for (const z of [-0.4, 0.02, 0.41]) {
    const points: Point[] = [];
    for (let step = 0; step <= 8; step++) {
      const x = -0.57 + (step / 8) * 1.14;
      const curvedZ = z + Math.abs(x) * (z < 0 ? 0.23 : -0.18);
      points.push([x, shellSurface(x, curvedZ), curvedZ]);
    }
    builder.tube(points, 0.016, seam);
  }
  for (const side of [-1, 1]) {
    const points: Point[] = [];
    for (let step = 0; step <= 10; step++) {
      const z = -0.65 + (step / 10) * 1.24;
      const x = side * (0.23 + Math.sin((step / 10) * Math.PI) * 0.06);
      points.push([x, shellSurface(x, z), z]);
    }
    builder.tube(points, 0.015, seam);
  }
  const rows = variant ? 3 : 2;
  for (let row = 0; row < rows; row++) {
    for (const side of [-1, 1]) {
      const cx = side * (row === 1 ? 0.27 : 0.23);
      const z = -0.48 + row * 0.37;
      const y = shellSurface(cx, z) - 0.018;
      builder.blob([cx, y, z], [0.12, 0.037, 0.14], variant ? '#d6b775' : '#79b575');
    }
  }
  if (variant)
    for (let index = 0; index < 5; index++)
      builder.blob([0, 0.87, -0.43 + index * 0.19], [0.065, 0.06, 0.075], '#f0d193');
}

function frog(builder: ToyGeometry, variant: boolean, body: string, accent: string): void {
  builder.hull(
    [
      [-0.71, 0.08, 0.05, 0.29],
      [-0.5, 0.5, 0.37, 0.43],
      [-0.02, 0.64, 0.43, 0.5],
      [0.44, 0.6, 0.28, 0.63],
      [0.77, 0.35, 0.15, 0.56],
      [0.87, 0.05, 0.035, 0.54],
    ],
    body,
    0.73,
  );
  builder.blob([0, 0.32, 0.31], [0.44, 0.23, 0.42], accent);
  builder.blob([0, 0.57, 0.63], [0.58, 0.19, 0.32], body);
  for (const side of [-1, 1]) {
    builder.blob([side * 0.34, 0.92, 0.39], [0.23, 0.25, 0.25], body);
    builder.eye([side * 0.34, 0.96, 0.585], 0.15, side);
    builder.blob([side * 0.085, 0.645, 0.917], [0.021, 0.022, 0.014], '#496646');
    builder.blob([side * 0.54, 0.33, -0.39], [0.31, 0.24, 0.35], body, [0, side * 0.25, 0]);
    builder.tube(
      [
        [side * 0.53, 0.31, 0.11],
        [side * 0.62, 0.16, 0.5],
        [side * 0.73, 0.12, 0.7],
      ],
      0.065,
      body,
    );
    for (let toe = 0; toe < 3; toe++) {
      const x = side * (0.57 + toe * 0.13);
      builder.tube(
        [
          [side * 0.65, 0.13, 0.58],
          [x, 0.1, 0.75],
          [x + side * 0.055, 0.12, 0.9],
        ],
        0.031,
        body,
      );
      builder.blob([x + side * 0.055, 0.12, 0.9], [variant ? 0.071 : 0.052, 0.025, 0.065], accent);
    }
    if (variant)
      builder.fin(
        [
          [side * 0.4, 0.94, 0.3],
          [side * 0.54, 1.15, 0.3],
          [side * 0.48, 1.0, 0.5],
        ],
        0.1,
        0.035,
        accent,
        [0, 0, 1],
      );
  }
  builder.smile(0.39, 0.49, 0.909, '#43624a');
  for (let index = 0; index < 6; index++)
    builder.blob(
      [((index % 3) - 1) * 0.24, 0.81 - (index % 3 === 1 ? 0 : 0.06), -0.32 + Math.floor(index / 3) * 0.27],
      [0.065, 0.027, 0.105],
      accent,
    );
}

function whale(builder: ToyGeometry, variant: boolean, body: string, accent: string): void {
  builder.hull(
    [
      [-1.19, 0.06, 0.055, 0.44],
      [-0.87, 0.25, 0.19, 0.43],
      [-0.4, 0.51, 0.37, 0.47],
      [0.15, 0.71, 0.52, 0.56],
      [0.66, variant ? 0.65 : 0.58, variant ? 0.65 : 0.47, variant ? 0.65 : 0.6],
      [0.98, variant ? 0.44 : 0.38, variant ? 0.36 : 0.28, variant ? 0.61 : 0.55],
      [1.09, 0.025, 0.06, 0.52],
    ],
    body,
    0.91,
  );
  builder.blob([0, 0.23, 0.38], [0.56, 0.17, 0.68], accent);
  for (const side of [-1, 1]) {
    builder.fin(
      [
        [side * 0.46, 0.35, 0.24],
        [side * 0.87, 0.19, 0.02],
        [side * 1.08, 0.29, -0.36],
      ],
      variant ? 0.23 : 0.18,
      0.06,
      body,
    );
    builder.fin(
      [
        [0, 0.46, -0.86],
        [side * 0.36, 0.76, -1.25],
        [side * 0.7, 0.85, -1.2],
      ],
      0.24,
      0.07,
      body,
    );
    builder.eye([side * 0.44, 0.67, 1.005], variant ? 0.11 : 0.13, side);
    if (variant) builder.blob([side * 0.49, 0.48, 0.96], [0.1, 0.045, 0.025], '#dcb5ed');
  }
  builder.smile(0.36, 0.45, 1.115, '#3b597d');
  for (const x of [-0.24, -0.12, 0, 0.12, 0.24])
    builder.tube(
      [
        [x, 0.4, 1.005],
        [x, 0.29, 0.96],
        [x, 0.17, 0.76],
      ],
      0.008,
      variant ? '#ab94c5' : '#7fb2cf',
    );
  builder.blob([0, 1.075, 0.29], [0.105, 0.02, 0.065], '#436384');
  for (const side of [-1, 1]) {
    builder.fin(
      [
        [0, 1.08, 0.3],
        [side * 0.08, 1.3, 0.29],
        [side * 0.25, 1.39, 0.3],
      ],
      0.053,
      0.045,
      variant ? '#ddf3fa' : '#9ce5f2',
      [0, 0, 1],
    );
    builder.blob([side * 0.27, 1.37, 0.3], [0.065, 0.08, 0.05], variant ? '#e9faff' : '#a9eff7');
  }
}

function octopus(builder: ToyGeometry, variant: boolean, body: string, accent: string): void {
  builder.hull(
    [
      [-0.53, 0.025, 0.03, 0.67],
      [-0.39, 0.39, 0.43, 0.63],
      [-0.04, 0.52, 0.66, 0.69],
      [0.36, 0.45, 0.48, 0.66],
      [0.57, 0.28, 0.25, 0.51],
      [0.65, 0.025, 0.05, 0.44],
    ],
    body,
    variant ? 0.75 : 1,
  );
  for (let arm = 0; arm < 8; arm++) {
    const a = (arm / 8) * Math.PI * 2;
    const side = Math.sin(a),
      front = Math.cos(a);
    const length = variant ? 1.0 : 0.9;
    const points: Point[] = [
      [side * 0.25, 0.3, front * 0.3],
      [side * 0.63, 0.12, front * 0.63],
      [side * length, 0.14, front * length],
      [side * (length + 0.08) + front * 0.12, 0.32, front * (length + 0.08) - side * 0.12],
      [side * (length - 0.05) + front * 0.2, 0.39, front * (length - 0.05) - side * 0.2],
    ];
    builder.fin(points, variant ? 0.135 : 0.15, 0.11, body);
    for (let sucker = 0; sucker < 3; sucker++) {
      const d = 0.56 + sucker * 0.13;
      builder.blob([side * d, 0.205, front * d], [0.055, 0.025, 0.055], accent);
    }
  }
  builder.eye([-0.19, 0.8, 0.53], 0.13, -1);
  builder.eye([0.19, 0.8, 0.53], 0.13, 1);
  builder.ring([0, 0.52, 0.662], 0.055, 0.021, '#65475f', [0, 0, 0], [1, 0.85, 1]);
  builder.blob([-0.32, 0.58, 0.54], [0.085, 0.05, 0.025], accent);
  builder.blob([0.32, 0.58, 0.54], [0.085, 0.05, 0.025], accent);
  if (variant)
    for (const side of [-1, 0, 1])
      builder.fin(
        [
          [side * 0.19, 1.08, -0.22],
          [side * 0.22, 1.35, -0.01],
          [side * 0.2, 1.08, 0.21],
        ],
        0.055,
        0.035,
        accent,
        [1, 0, 0],
      );
  else
    for (let index = 0; index < 5; index++)
      builder.blob(
        [
          Math.sin(index * 2.4) * 0.26,
          1.21 - Math.abs(Math.sin(index * 2.4)) * 0.08,
          Math.cos(index * 2.4) * 0.22,
        ],
        [0.045, 0.022, 0.06],
        accent,
      );
}

const constructors = { shark, axolotl, turtle, frog, whale, octopus };
const anchorPositions: Record<Exclude<AvatarFamily, 'duck'>, Record<'head' | 'face' | 'neck', Point>> = {
  shark: { head: [0, 0.99, 0.35], face: [0, 0.7, 0.84], neck: [0, 0.36, 0.38] },
  axolotl: { head: [0, 0.81, 0.55], face: [0, 0.66, 1.035], neck: [0, 0.27, 0.48] },
  turtle: { head: [0, 0.77, 0.77], face: [0, 0.65, 1.14], neck: [0, 0.3, 0.75] },
  frog: { head: [0, 1.02, 0.34], face: [0, 0.95, 0.73], neck: [0, 0.34, 0.54] },
  whale: { head: [0, 1.05, 0.61], face: [0, 0.67, 1.135], neck: [0, 0.36, 0.43] },
  octopus: { head: [0, 1.24, 0.05], face: [0, 0.8, 0.65], neck: [0, 0.36, 0.31] },
};

export function createAnimalGeometry(skin: string, detail: DuckDetail): AnimalShape {
  const palette = cosmetic(skin);
  const family = palette.modelFamily === 'duck' ? 'shark' : palette.modelFamily;
  const variant = [
    'shark-coral',
    'axolotl-lime',
    'turtle-sand',
    'frog-sunset',
    'whale-lilac',
    'octopus-coral',
  ].includes(skin);
  const builder = new ToyGeometry(detail);
  constructors[family](builder, variant, palette.color, palette.accentColor);
  const geometry = builder.finish();
  const bounds = geometry.boundingBox!;
  const floor = bounds.min.y;
  const scale = 1.45 / (bounds.max.y - floor);
  geometry.translate(0, -floor, 0);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const anchors = Object.fromEntries(
    Object.entries(anchorPositions[family]).map(([slot, position]) => [
      slot,
      {
        position: new THREE.Vector3(position[0], position[1] - floor, position[2]).multiplyScalar(scale),
        scale: new THREE.Vector3(scale, scale, scale),
      },
    ]),
  ) as AvatarAnchors;
  return { geometry, anchors };
}
