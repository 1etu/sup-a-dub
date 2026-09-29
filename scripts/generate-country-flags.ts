import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const folder = resolve(import.meta.dir, '../packages/assets/flags');
await mkdir(folder, { recursive: true });
const rect = (x: number, y: number, width: number, height: number, color: string) =>
  `<path fill="${color}" d="M${x} ${y}h${width}v${height}H${x}z"/>`;
const bands = (colors: string[], vertical = false) =>
  colors
    .map((color, i) =>
      vertical
        ? rect((i * 120) / colors.length, 0, 120 / colors.length, 80, color)
        : rect(0, (i * 80) / colors.length, 120, 80 / colors.length, color),
    )
    .join('');
const star = (cx: number, cy: number, radius: number, color: string, turn = -Math.PI / 2) =>
  `<path fill="${color}" d="${Array.from({ length: 10 }, (_, i) => {
    const angle = turn + (i * Math.PI) / 5;
    const size = i % 2 ? radius * 0.382 : radius;
    return `${i ? 'L' : 'M'}${(cx + Math.cos(angle) * size).toFixed(3)} ${(cy + Math.sin(angle) * size).toFixed(3)}`;
  }).join('')}Z"/>`;
const cross = (background: string, outer: string, inner?: string) =>
  rect(0, 0, 120, 80, background) +
  rect(32, 0, 18, 80, outer) +
  rect(0, 31, 120, 18, outer) +
  (inner ? rect(37, 0, 8, 80, inner) + rect(0, 36, 120, 8, inner) : '');
const flags: Record<string, { name: string; art: string }> = {
  TR: {
    name: 'Turkey',
    art:
      rect(0, 0, 120, 80, '#e30a17') +
      '<circle cx="48" cy="40" r="23" fill="white"/><circle cx="54" cy="40" r="18.4" fill="#e30a17"/>' +
      star(76, 40, 12, 'white', -Math.PI / 2),
  },
  US: {
    name: 'United States',
    art:
      bands(Array.from({ length: 13 }, (_, i) => (i % 2 ? '#fff' : '#b22234'))) +
      rect(0, 0, 50, 43.08, '#3c3b6e') +
      Array.from({ length: 9 }, (_, y) =>
        Array.from({ length: y % 2 ? 5 : 6 }, (_, x) =>
          star(4.17 + x * 8.33 + (y % 2 ? 4.17 : 0), 4.2 + y * 4.33, 2.1, '#fff'),
        ).join(''),
      ).join(''),
  },
  GB: {
    name: 'United Kingdom',
    art:
      rect(0, 0, 120, 80, '#012169') +
      '<path stroke="white" stroke-width="16" d="M0 0l120 80M120 0L0 80"/><path stroke="#c8102e" stroke-width="5" d="M0 0l120 80M120 0L0 80"/>' +
      rect(0, 27, 120, 26, 'white') +
      rect(47, 0, 26, 80, 'white') +
      rect(0, 33, 120, 14, '#c8102e') +
      rect(53, 0, 14, 80, '#c8102e'),
  },
  DE: { name: 'Germany', art: bands(['#000', '#d00', '#ffce00']) },
  FR: { name: 'France', art: bands(['#002395', '#fff', '#ed2939'], true) },
  IT: { name: 'Italy', art: bands(['#009246', '#fff', '#ce2b37'], true) },
  JP: {
    name: 'Japan',
    art: rect(0, 0, 120, 80, 'white') + '<circle cx="60" cy="40" r="24" fill="#bc002d"/>',
  },
  NL: { name: 'Netherlands', art: bands(['#ae1c28', '#fff', '#21468b']) },
  BE: { name: 'Belgium', art: bands(['#000', '#fdda24', '#ef3340'], true) },
  IE: { name: 'Ireland', art: bands(['#169b62', '#fff', '#ff883e'], true) },
  PL: { name: 'Poland', art: bands(['#fff', '#dc143c']) },
  UA: { name: 'Ukraine', art: bands(['#0057b7', '#ffd700']) },
  RO: { name: 'Romania', art: bands(['#002b7f', '#fcd116', '#ce1126'], true) },
  RU: { name: 'Russia', art: bands(['#fff', '#0039a6', '#d52b1e']) },
  AT: { name: 'Austria', art: bands(['#ed2939', '#fff', '#ed2939']) },
  HU: { name: 'Hungary', art: bands(['#ce2939', '#fff', '#477050']) },
  ID: { name: 'Indonesia', art: bands(['#ce1126', '#fff']) },
  MC: { name: 'Monaco', art: bands(['#ce1126', '#fff']) },
  CH: {
    name: 'Switzerland',
    art: rect(0, 0, 120, 80, '#ff0000') + rect(50, 13, 20, 54, '#fff') + rect(33, 30, 54, 20, '#fff'),
  },
  SE: { name: 'Sweden', art: cross('#006aa7', '#fecc00') },
  NO: { name: 'Norway', art: cross('#ba0c2f', '#fff', '#00205b') },
  DK: { name: 'Denmark', art: cross('#c60c30', '#fff') },
  FI: { name: 'Finland', art: cross('#fff', '#003580') },
  IS: { name: 'Iceland', art: cross('#02529c', '#fff', '#dc1e35') },
  CN: {
    name: 'China',
    art:
      rect(0, 0, 120, 80, '#de2910') +
      star(21, 21, 12, '#ffde00') +
      [
        [39, 8],
        [46, 17],
        [46, 29],
        [38, 37],
      ]
        .map(([x, y]) => star(x!, y!, 4, '#ffde00', Math.atan2(21 - y!, 21 - x!)))
        .join(''),
  },
  IN: {
    name: 'India',
    art:
      bands(['#ff9933', '#fff', '#138808']) +
      '<circle cx="60" cy="40" r="11" fill="none" stroke="#000080" stroke-width="1.4"/>' +
      Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return `<path stroke="#000080" stroke-width=".65" d="M60 40L${60 + Math.cos(a) * 10.8} ${40 + Math.sin(a) * 10.8}"/>`;
      }).join(''),
  },
  GR: {
    name: 'Greece',
    art:
      bands(Array.from({ length: 9 }, (_, i) => (i % 2 ? '#fff' : '#0d5eaf'))) +
      rect(0, 0, 44.45, 44.45, '#0d5eaf') +
      rect(17.78, 0, 8.89, 44.45, '#fff') +
      rect(0, 17.78, 44.45, 8.89, '#fff'),
  },
  CZ: { name: 'Czechia', art: bands(['#fff', '#d7141a']) + '<path d="M0 0L60 40L0 80Z" fill="#11457e"/>' },
  EE: { name: 'Estonia', art: bands(['#4891d9', '#000', '#fff']) },
  LT: { name: 'Lithuania', art: bands(['#fdb913', '#006a44', '#c1272d']) },
  LV: { name: 'Latvia', art: rect(0, 0, 120, 80, '#9e1b34') + rect(0, 32, 120, 16, '#fff') },
  LU: { name: 'Luxembourg', art: bands(['#ed2939', '#fff', '#00a1de']) },
};
for (const [code, flag] of Object.entries(flags)) {
  await Bun.write(
    resolve(folder, `${code.toLowerCase()}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" role="img" aria-label="${flag.name}"><clipPath id="bounds"><path d="M0 0h120v80H0z"/></clipPath><g clip-path="url(#bounds)">${flag.art}</g></svg>`,
  );
}
const catalog = Object.entries(flags).map(([code, { name }]) => ({
  code,
  name,
  path: `/assets/flags/${code.toLowerCase()}.svg`,
}));
await Bun.write(
  resolve(folder, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      author: 'Sup-a-Dub project',
      origin: 'Authored geometric flag illustrations',
      coverage: catalog.length,
      format: '2:3 display rectangles',
      flags: catalog,
    },
    null,
    2,
  ),
);
await Bun.write(
  resolve(folder, 'LICENSE.txt'),
  'These geometric flag illustrations were authored for Sup-a-Dub. The project dedicates its original drawing contributions to CC0 1.0 Universal.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n',
);
console.log(JSON.stringify({ generated: catalog.length, path: folder }));
