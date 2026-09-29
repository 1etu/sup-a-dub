import { chromium, type Browser } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AWARD_GRADES, type AwardGrade } from '../packages/assets/src/graphics/award-medal';

type Capture = {
  png: string;
  grade: AwardGrade;
  width: number;
  height: number;
  transparent: number;
  opaque: number;
  bounds: { left: number; top: number; right: number; bottom: number };
  luminance10: number;
  luminance90: number;
  resources: { geometries: number; materials: number; textures: number; triangles: number };
  gpu: { geometries: number; textures: number };
};
type AwardViewer = { ready: boolean; setGrade(grade: AwardGrade): void; capture(): Capture; dispose(): void };

const workspace = resolve(import.meta.dir, '..');
const directory = resolve(workspace, 'packages/assets/ui/awards');
const channel = process.env.PLAYWRIGHT_CHANNEL ?? 'chromium';
const host = await createServer({
  configFile: false,
  root: workspace,
  publicDir: false,
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const errors: string[] = [];
let browser: Browser | undefined;
try {
  await host.listen();
  const address = host.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('The award review server could not start.');
  browser = await chromium.launch({ headless: true, channel });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/packages/assets/review/award-viewer.html`);
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __AWARD_VIEWER__?: AwardViewer }).__AWARD_VIEWER__?.ready),
  );
  await mkdir(directory, { recursive: true });
  const captures: (Omit<Capture, 'png'> & { filename: string; bytes: number; sha256: string })[] = [];
  for (const grade of AWARD_GRADES) {
    const { png, ...capture } = await page.evaluate((next) => {
      const viewer = (window as unknown as { __AWARD_VIEWER__: AwardViewer }).__AWARD_VIEWER__;
      viewer.setGrade(next);
      return viewer.capture();
    }, grade);
    if (
      capture.width !== 512 ||
      capture.height !== 512 ||
      capture.transparent < 30000 ||
      capture.opaque < 100000
    )
      throw new Error(`The ${grade} award does not have the required size and transparency.`);
    if (
      capture.bounds.left < 4 ||
      capture.bounds.top < 4 ||
      capture.bounds.right > 507 ||
      capture.bounds.bottom > 507
    )
      throw new Error(`The ${grade} award touches the image edge.`);
    const previous = captures.at(-1);
    if (
      previous &&
      (capture.gpu.geometries !== previous.gpu.geometries || capture.gpu.textures !== previous.gpu.textures)
    )
      throw new Error('Award resources grew after changing the medal.');
    const bytes = Buffer.from(png.slice(png.indexOf(',') + 1), 'base64');
    const filename = `award-${grade}.png`;
    await Bun.write(resolve(directory, filename), bytes);
    captures.push({
      ...capture,
      filename,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  await page.evaluate(() =>
    (window as unknown as { __AWARD_VIEWER__: AwardViewer }).__AWARD_VIEWER__.dispose(),
  );
  if (errors.length) throw new Error(errors.join('\n'));
  const report = {
    authored: true,
    originalGameAsset: false,
    references: [
      'reference/source-bible/replay-source/frame-145.png',
      'reference/source-bible/replay-source/frame-150.png',
      'reference/original/menu.png',
    ],
    generatedAt: new Date().toISOString(),
    bun: Bun.version,
    browser: browser.version(),
    channel,
    errors,
    captures,
  };
  await Bun.write(resolve(directory, 'manifest.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  try {
    await browser?.close();
  } finally {
    await host.close();
  }
}
