import { queryPointOrdered } from "./spatialIndex.mjs";

function containsRect({ x, y, width, height }, point) {
  return (
    point.x >= x &&
    point.x <= x + width &&
    point.y >= y &&
    point.y <= y + height
  );
}

function pointOnSegment(point, start, end) {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > Number.EPSILON) return false;
  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
}

function nearSegment(point, start, end, margin) {
  const dx = end.x - start.x, dy = end.y - start.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length)) : 0;
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy) <= margin;
}

function containsPolygon({ points, strokeWidth = 0 }, point) {
  let inside = false;
  for (let index = 0, previous = points.length - 2; index < points.length; previous = index, index += 2) {
    const start = { x: points[previous], y: points[previous + 1] };
    const end = { x: points[index], y: points[index + 1] };
    if (pointOnSegment(point, start, end) || strokeWidth > 0 && nearSegment(point, start, end, strokeWidth / 2)) return true;
    const crosses = (start.y > point.y) !== (end.y > point.y);
    if (crosses && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function containsRegion(region, point) {
  if (region.type === "circle") return Math.hypot(point.x - region.x, point.y - region.y) <= region.radius + (region.strokeWidth ?? 0) / 2;
  if (region.type === "rect") return containsRect(region, point);
  if (region.type === "polygon") return containsPolygon(region, point);
  return false;
}

/**
 * Returns the topmost semantic interaction target at a chart-world point.
 * The spatial indexes limit precise region tests to records whose extents
 * contain the pointer. Reverse painter order gives genes and trim handles
 * precedence over a locus move region.
 */
export function hitTest(scene, point) {
  for (const uid of queryPointOrdered(scene.index.genes, point).reverse()) {
    const region = scene.hitRegions.genes.get(uid);
    if (region && containsRegion(region, point)) return region;
  }
  for (const uid of queryPointOrdered(scene.index.hitLoci, point).reverse()) {
    const regions = scene.hitRegions.loci.get(uid);
    for (const region of [regions?.trimRight, regions?.trimLeft, regions?.move]) {
      if (region && containsRegion(region, point)) return region;
    }
  }
  return null;
}
