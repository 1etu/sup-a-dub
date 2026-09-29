import type { BufferGeometry } from 'three';
import type { DuckDetail } from '../duck';
import { ToyGeometry } from './geometry';

const designs = new Set([
  'lifeguard',
  'explorer',
  'mosaic',
  'lemon-sorbet',
  'speckled-egg',
  'peach-jelly',
  'tin-toy',
  'clockwork',
  'deep-sea',
  'fiesta',
  'aurora',
  'patchwork',
]);

export function createDuckDesign(skin: string, detail: DuckDetail): BufferGeometry | undefined {
  if (!designs.has(skin)) return;
  const b = new ToyGeometry(detail);
  if (skin === 'lifeguard') {
    b.ring([0, 0.39, -0.03], 0.48, 0.065, '#e95856', [Math.PI / 2, 0, 0], [1, 1, 1.08]);
    b.shape(
      [
        [-0.035, 0.12],
        [0.035, 0.12],
        [0.035, 0.035],
        [0.115, 0.035],
        [0.115, -0.035],
        [0.035, -0.035],
        [0.035, -0.12],
        [-0.035, -0.12],
        [-0.035, -0.035],
        [-0.115, -0.035],
        [-0.115, 0.035],
        [-0.035, 0.035],
      ],
      0.017,
      '#fff8d5',
      [0, 0.44, 0.48],
    );
    b.tube(
      [
        [-0.22, 0.75, 0.12],
        [0, 0.58, 0.39],
        [0.22, 0.75, 0.12],
      ],
      0.013,
      '#fcf1c7',
    );
    b.blob([0, 0.57, 0.415], [0.044, 0.037, 0.065], '#f1c455');
  } else if (skin === 'explorer') {
    b.shape(
      [
        [-0.13, -0.15],
        [0.13, -0.15],
        [0.15, 0.12],
        [-0.15, 0.12],
      ],
      0.08,
      '#a57846',
      [-0.49, 0.44, -0.14],
      [0, -Math.PI / 2, 0],
    );
    b.tube(
      [
        [-0.5, 0.5, -0.28],
        [-0.42, 0.78, 0.15],
        [0.3, 0.78, 0.07],
        [0.47, 0.35, -0.25],
      ],
      0.024,
      '#aa8151',
    );
    b.blob([-0.54, 0.48, -0.14], [0.022, 0.045, 0.045], '#e5c36f');
  } else if (skin === 'mosaic') {
    for (let index = 0; index < 8; index++) {
      const a = (index / 8) * Math.PI * 2;
      b.shape(
        [
          [0, 0.075],
          [0.06, 0],
          [0, -0.075],
          [-0.06, 0],
        ],
        0.012,
        ['#65c4cc', '#ef9bb2', '#f0cf6c', '#6487ca'][index % 4]!,
        [Math.sin(a) * 0.49, 0.37, Math.cos(a) * 0.55],
        [0, a, 0],
      );
    }
  } else if (skin === 'lemon-sorbet') {
    for (let index = 0; index < 9; index++) {
      const a = (index / 9) * Math.PI * 2;
      b.blob([Math.sin(a) * 0.42, 0.43, Math.cos(a) * 0.41], [0.095, 0.11, 0.095], '#fff2b4');
    }
    b.fin(
      [
        [0.36, 0.66, -0.23],
        [0.49, 0.75, -0.36],
        [0.56, 0.8, -0.45],
      ],
      0.085,
      0.018,
      '#a8c96d',
      [0, 0, 1],
    );
  } else if (skin === 'speckled-egg') {
    for (let index = 0; index < 12; index++) {
      const a = (index / 12) * Math.PI * 2;
      b.shape(
        [
          [-0.09, -0.075],
          [0.09, -0.075],
          [0.075, 0.055],
          [0, 0.14],
          [-0.055, 0.065],
        ],
        0.024,
        '#f5ead2',
        [Math.sin(a) * 0.48, 0.33, Math.cos(a) * 0.52],
        [0, a, 0],
      );
    }
  } else if (skin === 'peach-jelly') {
    b.fin(
      [
        [0.34, 0.54, -0.26],
        [0.46, 0.7, -0.43],
        [0.34, 0.77, -0.62],
      ],
      0.12,
      0.028,
      '#a4d89b',
      [1, 0, 0],
    );
    for (const side of [-1, 1]) b.blob([side * 0.45, 0.48, 0.16], [0.055, 0.09, 0.11], '#ffd6c4');
  } else if (skin === 'tin-toy' || skin === 'clockwork') {
    const metal = skin === 'clockwork' ? '#bf8e47' : '#b8dbe7';
    for (const side of [-1, 1]) {
      b.tube(
        [
          [side * 0.4, 0.59, -0.21],
          [side * 0.51, 0.39, -0.01],
          [side * 0.43, 0.18, 0.21],
        ],
        0.012,
        '#52687b',
      );
      for (let index = 0; index < 3; index++)
        b.blob([side * 0.505, 0.3 + index * 0.1, -0.07], [0.017, 0.021, 0.022], metal);
    }
    b.tube(
      [
        [0, 0.5, -0.49],
        [0, 0.5, -0.75],
      ],
      0.028,
      metal,
    );
    for (const side of [-1, 1]) b.ring([side * 0.095, 0.5, -0.76], 0.087, 0.022, metal);
    if (skin === 'clockwork') {
      b.blob([0.49, 0.45, -0.08], [0.025, 0.12, 0.12], '#eccb76');
      for (let index = 0; index < 8; index++)
        b.blob(
          [
            0.52,
            0.45 + Math.sin((index * Math.PI) / 4) * 0.11,
            -0.08 + Math.cos((index * Math.PI) / 4) * 0.11,
          ],
          [0.025, 0.027, 0.027],
          metal,
        );
    }
  } else if (skin === 'deep-sea') {
    for (const side of [-1, 1]) {
      b.blob([side * 0.18, 0.5, -0.48], [0.11, 0.3, 0.13], '#607b9a');
      b.tube(
        [
          [side * 0.18, 0.73, -0.46],
          [side * 0.33, 0.85, -0.2],
          [side * 0.32, 0.77, 0.19],
        ],
        0.018,
        '#b7e8d7',
      );
      b.ring([side * 0.18, 0.64, -0.48], 0.107, 0.021, '#c7ce8a', [Math.PI / 2, 0, 0]);
    }
  } else if (skin === 'fiesta') {
    for (let index = 0; index < 10; index++) {
      const a = (index / 10) * Math.PI * 2;
      b.shape(
        [
          [-0.075, 0.03],
          [0.075, 0.03],
          [0, -0.13],
        ],
        0.016,
        ['#f17e8b', '#e6c64e', '#76c6c2'][index % 3]!,
        [Math.sin(a) * 0.44, 0.48, Math.cos(a) * 0.46],
        [0, a, 0],
      );
    }
  } else if (skin === 'aurora') {
    for (const side of [-1, 1])
      for (let feather = 0; feather < 3; feather++)
        b.fin(
          [
            [side * 0.4, 0.46, -0.15],
            [side * (0.48 + feather * 0.035), 0.68, -0.35],
            [side * 0.43, 0.75 + feather * 0.045, -0.56 - feather * 0.07],
          ],
          0.07,
          0.018,
          ['#80dfdc', '#b5acfa', '#beeab9'][feather]!,
          [1, 0, 0],
        );
  } else {
    for (const side of [-1, 1]) {
      for (let stitch = 0; stitch < 4; stitch++) {
        const z = -0.27 + stitch * 0.12;
        b.tube(
          [
            [side * 0.495, 0.36, z],
            [side * 0.508, 0.42, z + 0.045],
          ],
          0.012,
          '#fff2c3',
        );
      }
      b.blob([side * 0.51, 0.49, -0.05], [0.018, 0.056, 0.056], side < 0 ? '#e6b24f' : '#88b4d9');
    }
  }
  return b.finish();
}
