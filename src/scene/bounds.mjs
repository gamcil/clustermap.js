/** Expand an owned accumulator, copying the first extent when it is empty. */
export function includeBounds(bounds, extent) {
  if (!extent) return bounds;
  if (!bounds) return { ...extent };
  bounds.minX = Math.min(bounds.minX, extent.minX);
  bounds.maxX = Math.max(bounds.maxX, extent.maxX);
  bounds.minY = Math.min(bounds.minY, extent.minY);
  bounds.maxY = Math.max(bounds.maxY, extent.maxY);
  return bounds;
}
