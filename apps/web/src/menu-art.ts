import type { MenuArtwork, MenuPreview, MenuRowBounds, MenuScrollArtwork } from '@supadub/gameengine';

const embeddedResources = new Map<string, Promise<string>>();
const styleProperties =
  'display position inset top right bottom left width height min-width max-width min-height max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left box-sizing border border-top border-right border-bottom border-left border-radius outline outline-offset color background background-color background-image background-size background-position background-repeat background-clip -webkit-background-clip box-shadow text-shadow font-family font-size font-style font-weight font-variant font-feature-settings line-height letter-spacing text-align text-transform text-decoration text-indent white-space word-break word-spacing overflow overflow-x overflow-y text-overflow opacity visibility transform transform-origin transform-style perspective filter backdrop-filter clip-path isolation z-index vertical-align appearance -webkit-appearance accent-color fill fill-opacity fill-rule stroke stroke-width stroke-linejoin stroke-linecap stroke-opacity paint-order vector-effect justify-content justify-items align-content align-items align-self justify-self flex-direction flex-wrap flex-grow flex-shrink flex-basis gap row-gap column-gap grid-template-columns grid-template-rows grid-column grid-row order object-fit object-position list-style -webkit-text-stroke'.split(
    ' ',
  );

function resourceUrl(url: string): Promise<string> {
  let resource = embeddedResources.get(url);
  if (resource) return resource;
  if (embeddedResources.size >= 128) embeddedResources.delete(embeddedResources.keys().next().value!);
  resource = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error('A menu resource could not load.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    const type = url.endsWith('.ttf')
      ? 'font/ttf'
      : (response.headers.get('content-type')?.split(';')[0] ?? 'image/svg+xml');
    return `data:${type};base64,${btoa(binary)}`;
  });
  embeddedResources.set(url, resource);
  return resource;
}

function canvas(): HTMLCanvasElement {
  const result = document.createElement('canvas');
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const scale = Math.min(1, 1920 / width, 1080 / height);
  result.width = Math.max(1, Math.round(width * scale));
  result.height = Math.max(1, Math.round(height * scale));
  return result;
}

function copyStyle(source: CSSStyleDeclaration, destination: CSSStyleDeclaration): void {
  for (const property of styleProperties) {
    const value = source
      .getPropertyValue(property)
      .replace(/url\(["']?https?:[^)#]+#([^)'"\s]+)["']?\)/g, 'url(#$1)');
    if (value) destination.setProperty(property, value);
  }
  destination.setProperty('animation', 'none');
  destination.setProperty('transition', 'none');
  destination.setProperty('caret-color', 'transparent');
}

function blankCanvas(): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = 1;
  output.height = 1;
  return output;
}

function addPseudo(source: Element, destination: Element, kind: 'before' | 'after'): void {
  if (!(destination instanceof HTMLElement)) return;
  const computed = getComputedStyle(source, `::${kind}`);
  if (computed.content === 'none' || computed.content === 'normal' || computed.display === 'none') return;
  const pseudo = document.createElement('span');
  copyStyle(computed, pseudo.style);
  pseudo.textContent = computed.content.replace(/^["']|["']$/g, '');
  if (kind === 'before') destination.prepend(pseudo);
  else destination.append(pseudo);
}

async function cloneStyled(overlay: HTMLElement): Promise<HTMLElement> {
  const clone = overlay.cloneNode(true) as HTMLElement;
  const sources = [overlay, ...overlay.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  if (sources.length > 2400) throw new Error('The menu exceeds the render limit.');
  const pending: Promise<unknown>[] = [];
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]!;
    const copy = copies[index]!;
    if (copy instanceof HTMLElement || copy instanceof SVGElement)
      copyStyle(getComputedStyle(source), copy.style);
    if (source instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
      const value = source.type === 'password' ? '•'.repeat(source.value.length) : source.value;
      copy.type = source.type === 'password' ? 'text' : source.type;
      copy.value = value;
      copy.setAttribute('value', value);
      if (source.checked) copy.setAttribute('checked', 'checked');
      else copy.removeAttribute('checked');
    }
    if (source instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement)
      copy.textContent = source.value;
    if (source instanceof HTMLSelectElement && copy instanceof HTMLSelectElement)
      Array.from(copy.options).forEach((option, optionIndex) => {
        if (source.options[optionIndex]?.selected) option.setAttribute('selected', 'selected');
        else option.removeAttribute('selected');
      });
    if (source instanceof HTMLImageElement && copy instanceof HTMLImageElement) {
      const url = new URL(source.currentSrc || source.src, location.href);
      if (url.origin !== location.origin) throw new Error('A menu image must use a local asset.');
      pending.push(resourceUrl(url.pathname).then((data) => copy.setAttribute('src', data)));
      copy.loading = 'eager';
      copy.removeAttribute('srcset');
    }
    if (source instanceof HTMLElement && (source.scrollTop || source.scrollLeft)) {
      for (const child of Array.from(copy.children)) {
        if (!(child instanceof HTMLElement)) continue;
        child.style.translate = `${-source.scrollLeft}px ${-source.scrollTop}px`;
      }
    }
    addPseudo(source, copy, 'before');
    addPseudo(source, copy, 'after');
  }
  await Promise.all(pending);
  const bounds = overlay.getBoundingClientRect();
  Object.assign(clone.style, {
    position: 'absolute',
    inset: 'auto',
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${overlay.offsetWidth}px`,
    height: `${overlay.offsetHeight}px`,
    margin: '0',
    opacity: '1',
    visibility: 'visible',
    transform: `scale(${bounds.width / Math.max(1, overlay.offsetWidth)})`,
    transformOrigin: '0 0',
  });
  clone.querySelectorAll('script,link,style,canvas').forEach((element) => element.remove());
  return clone;
}

function filterLayer(clone: HTMLElement, kind: 'rows' | 'chrome' | 'arrows'): void {
  if (kind === 'chrome') {
    clone.querySelectorAll('.main-menu').forEach((element) => element.remove());
    return;
  }
  for (const child of Array.from(clone.children)) {
    if (!child.matches('.main-menu') && !child.querySelector('.main-menu')) child.remove();
  }
  for (const label of clone.querySelectorAll<HTMLElement>('.main-menu .menu-label'))
    label.style.transform = 'none';
  for (const row of clone.querySelectorAll<HTMLElement>('.main-menu .menu-item')) {
    row.style.filter = 'none';
    for (const arrow of row.querySelectorAll<HTMLElement>('.triangle'))
      arrow.style.opacity = row.classList.contains('selected') ? '1' : '0';
  }
  clone
    .querySelectorAll(kind === 'rows' ? '.main-menu .triangle' : '.main-menu .menu-label')
    .forEach((element) => {
      if (element instanceof HTMLElement) element.style.opacity = '0';
    });
}

async function layerImage(
  clone: HTMLElement,
  fontRules: string,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreign.setAttribute('width', '100%');
  foreign.setAttribute('height', '100%');
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden;color-scheme:dark`;
  const style = document.createElement('style');
  style.textContent = `${fontRules}*{scrollbar-width:none}*::-webkit-scrollbar{display:none}`;
  wrapper.append(style, clone);
  foreign.append(wrapper);
  svg.append(foreign);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  await image.decode();
  return image;
}

async function rasterLayer(clone: HTMLElement, fontRules: string): Promise<HTMLCanvasElement> {
  const output = canvas();
  const image = await layerImage(
    clone,
    fontRules,
    document.documentElement.clientWidth,
    document.documentElement.clientHeight,
  );
  const context = output.getContext('2d')!;
  context.drawImage(image, 0, 0, output.width, output.height);
  return output;
}

function captureGeometry(overlay: HTMLElement): {
  previews: MenuPreview[];
  scroll?: MenuScrollArtwork;
  element?: HTMLElement;
  scale: number;
} {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const scale = overlay.getBoundingClientRect().width / Math.max(1, overlay.offsetWidth);
  const element = overlay.querySelector<HTMLElement>('[data-preview-clip]') ?? undefined;
  let scroll: MenuScrollArtwork | undefined;
  if (element) {
    const bounds = element.getBoundingClientRect();
    scroll = {
      id: element.id || 'menu-scroll-0',
      viewport: {
        left: (bounds.left + element.clientLeft * scale) / width,
        top: (bounds.top + element.clientTop * scale) / height,
        width: (element.clientWidth * scale) / width,
        height: (element.clientHeight * scale) / height,
      },
      contentSize: {
        width: (element.scrollWidth * scale) / width,
        height: (element.scrollHeight * scale) / height,
      },
      scrollUnit: { x: scale / width, y: scale / height },
      initialOffset: { x: element.scrollLeft, y: element.scrollTop },
      maxOffset: {
        x: element.scrollWidth - element.clientWidth,
        y: element.scrollHeight - element.clientHeight,
      },
      tiles: [],
    };
  }
  const previews = Array.from(overlay.querySelectorAll<HTMLElement>('[data-duck-preview]'))
    .slice(0, 32)
    .map((slot) => {
      const bounds = slot.getBoundingClientRect();
      const scrolled = Boolean(element?.contains(slot));
      return {
        skin: slot.dataset.skin ?? 'yellow',
        loadout: {
          head: slot.dataset.head || null,
          face: slot.dataset.face || null,
          neck: slot.dataset.neck || null,
        },
        viewport: {
          left: bounds.left / width + (scrolled ? scroll!.initialOffset.x * scroll!.scrollUnit.x : 0),
          top: bounds.top / height + (scrolled ? scroll!.initialOffset.y * scroll!.scrollUnit.y : 0),
          width: bounds.width / width,
          height: bounds.height / height,
        },
        scrollId: scrolled ? scroll?.id : undefined,
      };
    });
  return { previews, scroll, element, scale };
}

async function captureScrollContent(
  template: HTMLElement,
  fontRules: string,
  geometry: ReturnType<typeof captureGeometry>,
): Promise<MenuScrollArtwork | undefined> {
  const scroll = geometry.scroll;
  const element = geometry.element;
  const source = template.querySelector<HTMLElement>('[data-preview-clip]');
  if (!scroll || !element || !source) return;
  const clone = source.cloneNode(true) as HTMLElement;
  const width = element.scrollWidth;
  const height = element.scrollHeight;
  Object.assign(clone.style, {
    position: 'absolute',
    inset: 'auto',
    left: '0',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    margin: '0',
    transform: 'none',
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
    outline: 'none',
    border: 'none',
  });
  for (const child of clone.children) if (child instanceof HTMLElement) child.style.translate = '0 0';
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const captureScale = Math.min(1, 1920 / viewportWidth, 1080 / viewportHeight);
  const resolution = Math.min(
    geometry.scale * captureScale,
    1920 / width,
    8192 / height,
    Math.sqrt(8_388_608 / (width * height)),
  );
  const pixelWidth = Math.max(1, Math.floor(width * resolution));
  const pixelHeight = Math.max(1, Math.floor(height * resolution));
  const image = await layerImage(clone, fontRules, width, height);
  const tiles: { canvas: HTMLCanvasElement; top: number; height: number }[] = [];
  for (let top = 0; top < pixelHeight; top += 2048) {
    const output = document.createElement('canvas');
    output.width = pixelWidth;
    output.height = Math.min(2048, pixelHeight - top);
    const context = output.getContext('2d')!;
    context.drawImage(
      image,
      0,
      (top / pixelHeight) * height,
      width,
      (output.height / pixelHeight) * height,
      0,
      0,
      pixelWidth,
      output.height,
    );
    for (const preview of geometry.previews) {
      if (preview.scrollId !== scroll.id) continue;
      const bounds = preview.viewport;
      context.clearRect(
        ((bounds.left - scroll.viewport.left) / scroll.contentSize.width) * pixelWidth,
        ((bounds.top - scroll.viewport.top) / scroll.contentSize.height) * pixelHeight - top,
        (bounds.width / scroll.contentSize.width) * pixelWidth,
        (bounds.height / scroll.contentSize.height) * pixelHeight,
      );
    }
    tiles.push({ canvas: output, top: top / pixelHeight, height: output.height / pixelHeight });
  }
  source.replaceChildren();
  return { ...scroll, tiles };
}

function caretBounds(overlay: HTMLElement): MenuRowBounds | undefined {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement) || !overlay.contains(input) || input.selectionStart === null)
    return;
  const bounds = input.getBoundingClientRect();
  const style = getComputedStyle(input);
  const scale = bounds.width / Math.max(1, input.offsetWidth);
  const fontSize = Number.parseFloat(style.fontSize) * scale;
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  const value =
    input.type === 'password' ? '•'.repeat(input.selectionStart) : input.value.slice(0, input.selectionStart);
  const padding = Number.parseFloat(style.paddingLeft) * scale;
  const x = Math.max(
    bounds.left + padding,
    Math.min(
      bounds.right - padding,
      bounds.left + padding + measure.measureText(value).width - input.scrollLeft * scale,
    ),
  );
  return {
    x: x / document.documentElement.clientWidth,
    y: (bounds.top + bounds.height * 0.5) / document.documentElement.clientHeight,
    width: 1.5 / document.documentElement.clientWidth,
    height: (fontSize * 1.05) / document.documentElement.clientHeight,
    selected: false,
  };
}

export async function captureMenuArt(overlay: HTMLElement): Promise<MenuArtwork> {
  await document.fonts.ready;
  const fonts = await Promise.all([
    resourceUrl('/fonts/supadub-display.ttf'),
    resourceUrl('/fonts/rajdhani-bold.ttf'),
    resourceUrl('/fonts/audiowide.ttf'),
  ]);
  const fontRules = `@font-face{font-family:'Supadub Display';src:url('${fonts[0]}')}@font-face{font-family:Rajdhani;font-weight:700;src:url('${fonts[1]}')}@font-face{font-family:Audiowide;src:url('${fonts[2]}')}`;
  const geometry = captureGeometry(overlay);
  const template = await cloneStyled(overlay);
  const scroll = await captureScrollContent(template, fontRules, geometry);
  const hasRows = Boolean(template.querySelector('.main-menu'));
  const layers = await Promise.all(
    (['rows', 'chrome', 'arrows'] as const).map(async (kind) => {
      if (!hasRows && kind !== 'chrome') return blankCanvas();
      const clone = template.cloneNode(true) as HTMLElement;
      filterLayer(clone, kind);
      return rasterLayer(clone, fontRules);
    }),
  );
  const [rows, chrome, arrows] = layers as [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const context = chrome.getContext('2d')!;
  const scaleX = chrome.width / width;
  const scaleY = chrome.height / height;
  for (const slot of geometry.previews) {
    if (slot.scrollId) continue;
    const bounds = slot.viewport;
    const left = Math.max(bounds.left * width, 0);
    const right = Math.min((bounds.left + bounds.width) * width, width);
    const top = Math.max(bounds.top * height, 0);
    const bottom = Math.min((bounds.top + bounds.height) * height, height);
    if (right > left && bottom > top)
      context.clearRect(left * scaleX, top * scaleY, (right - left) * scaleX, (bottom - top) * scaleY);
  }
  const rowBounds: MenuRowBounds[] = [];
  for (const row of overlay.querySelectorAll<HTMLElement>('.main-menu .menu-item')) {
    const label = row.querySelector<HTMLElement>('.menu-label');
    if (!label) continue;
    const bounds = label.getBoundingClientRect();
    rowBounds.push({
      x: (bounds.x + bounds.width / 2) / width,
      y: (bounds.y + bounds.height / 2) / height,
      width: Math.min(1, (label.offsetWidth * geometry.scale) / width + 0.03),
      height: Math.min(1, row.getBoundingClientRect().height / height),
      selected: row.classList.contains('selected'),
    });
  }
  const selectionKey = hasRows
    ? Array.from(overlay.querySelectorAll<HTMLElement>('.main-menu .menu-item'))
        .map((row) => row.dataset.action)
        .join('|')
    : undefined;
  return {
    rows,
    chrome,
    arrows,
    rowBounds: rowBounds.slice(0, 8),
    caret: caretBounds(overlay),
    normalizedRows: true,
    selectionKey,
    previews: geometry.previews,
    scroll,
  };
}
function logoText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  pink: boolean,
): void {
  context.save();
  context.translate(x, y);
  context.font = '116px "Supadub Display"';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const ratio = width / context.measureText(value).width;
  context.scale(ratio, 1);
  const gradient = context.createLinearGradient(0, -63, 0, 56);
  const colors = pink
    ? ['#ffd1e9', '#e984b7', '#db6098', '#ec81b5']
    : ['#d4ffff', '#8bdce9', '#078ad9', '#17266f'];
  colors.forEach((color, index) => gradient.addColorStop([0, 0.48, 0.52, 1][index]!, color));
  context.lineJoin = 'round';
  context.shadowColor = pink ? '#ffdfed' : '#adffff';
  context.shadowBlur = 12;
  context.strokeStyle = pink ? '#ef9dc5' : '#54d3e9';
  context.lineWidth = 13;
  context.strokeText(value, 0, 0);
  context.strokeStyle = '#f4ffff';
  context.lineWidth = 7;
  context.strokeText(value, 0, 0);
  context.fillStyle = gradient;
  context.fillText(value, 0, 0);
  context.restore();
}

export async function createBootArt(): Promise<MenuArtwork> {
  await document.fonts.load('116px "Supadub Display"');
  const rows = canvas();
  const chrome = canvas();
  const context = rows.getContext('2d')!;
  const center = chrome.getContext('2d')!;
  const scale = Math.min(rows.width / 1280, rows.height / 720);
  for (const target of [context, center]) {
    target.translate(rows.width / 2, rows.height / 2);
    target.scale(scale, scale);
    target.translate(-640, -360);
  }
  logoText(context, 'SUP', 378, 382, 345, true);
  logoText(context, 'DUB', 899, 382, 345, false);
  center.save();
  center.translate(640, 378);
  center.shadowColor = '#b3ffff';
  center.shadowBlur = 17;
  center.fillStyle = '#177cc8';
  center.strokeStyle = '#edffff';
  center.lineWidth = 7;
  center.beginPath();
  center.moveTo(55, 56);
  center.lineTo(0, 56);
  center.bezierCurveTo(-72, 56, -71, -58, 0, -58);
  center.bezierCurveTo(47, -58, 57, -16, 55, 56);
  center.fill();
  center.stroke();
  center.shadowBlur = 7;
  center.translate(-47, -56);
  center.scale(0.87, 0.87);
  center.fillStyle = '#ffffff';
  const duck = new Path2D(
    'M33 73C27 86 35 99 56 99H78C96 98 107 86 106 69L96 78C91 78 84 75 81 72C88 61 86 47 75 41C65 35 50 38 46 49C41 62 46 72 56 77C47 79 40 78 33 73ZM49 61L33 64L47 69Z',
  );
  center.fill(duck);
  center.restore();
  return { rows, chrome, rowBounds: [] };
}
