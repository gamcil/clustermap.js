/** Test world bounds after applying a preview translation. */
export function boundsInViewport(bounds, viewport, { x = 0, y = 0 } = {}) {
  return !viewport || !bounds || bounds.minX + x <= viewport.maxX && bounds.maxX + x >= viewport.minX &&
    bounds.minY + y <= viewport.maxY && bounds.maxY + y >= viewport.minY;
}

function validBounds(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxY) &&
    bounds.maxX > bounds.minX &&
    bounds.maxY > bounds.minY
  );
}

/** Camera-visible world rectangle, with overscan measured in screen pixels. */
export function worldViewport(camera, { width, height }, overscan = 20) {
  const margin = overscan / camera.k;
  return {
    minX: -camera.x / camera.k - margin,
    maxX: (width - camera.x) / camera.k + margin,
    minY: -camera.y / camera.k - margin,
    maxY: (height - camera.y) / camera.k + margin,
  };
}

/**
 * Fit a world-space figure envelope into a viewport.
 *
 * Renderers may obtain the envelope differently (SVG can use getBBox while
 * raster renderers measure text), but camera policy stays shared: cap an
 * ordinary fit, optionally retain a readable scale for oversized figures,
 * and top-align whenever that scale crops the figure.
 */
export function fitCameraForBounds({
  bounds,
  viewport,
  padding = 20,
  maximumFitScale = 1.2,
  minimumReadableScale = 0,
  constrainScale = (scale) => scale,
} = {}) {
  if (!validBounds(bounds) || !viewport?.width || !viewport?.height) return null;

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const fitScale = Math.min(
    maximumFitScale,
    (viewport.width - padding * 2) / width,
    (viewport.height - padding * 2) / height
  );
  const k = constrainScale(Math.max(fitScale, minimumReadableScale));
  const cropped = k > fitScale;
  return {
    x: cropped
      ? padding - bounds.minX * k
      : (viewport.width - width * k) / 2 - bounds.minX * k,
    y: cropped
      ? padding - bounds.minY * k
      : (viewport.height - height * k) / 2 - bounds.minY * k,
    k,
    fitScale,
    cropped,
  };
}

/** Convert a pointer event on a surface into chart-world coordinates. */
export function worldPoint(surface, event, camera) {
  const bounds = surface.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left - camera.x) / camera.k,
    y: (event.clientY - bounds.top - camera.y) / camera.k,
  };
}
