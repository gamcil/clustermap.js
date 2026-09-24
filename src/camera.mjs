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
