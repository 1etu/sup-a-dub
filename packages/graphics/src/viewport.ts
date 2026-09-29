export type ViewRect = { left: number; top: number; width: number; height: number };

export function clippedViewport(
  bounds: ViewRect,
  clip: ViewRect | undefined,
  offset: { x: number; y: number },
): { viewport: ViewRect; clip: ViewRect } | null {
  const left = bounds.left - offset.x;
  const top = bounds.top - offset.y;
  const clippedLeft = Math.max(left, clip?.left ?? 0, 0);
  const clippedRight = Math.min(left + bounds.width, clip ? clip.left + clip.width : 1, 1);
  const clippedTop = Math.max(top, clip?.top ?? 0, 0);
  const clippedBottom = Math.min(top + bounds.height, clip ? clip.top + clip.height : 1, 1);
  if (bounds.width <= 0 || bounds.height <= 0 || clippedRight <= clippedLeft || clippedBottom <= clippedTop)
    return null;
  return {
    viewport: { left, top, width: bounds.width, height: bounds.height },
    clip: {
      left: clippedLeft,
      top: clippedTop,
      width: clippedRight - clippedLeft,
      height: clippedBottom - clippedTop,
    },
  };
}
