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

function containsPolygon({ points }, point) {
  let inside = false;
  for (let index = 0, previous = points.length - 2; index < points.length; previous = index, index += 2) {
    const start = { x: points[previous], y: points[previous + 1] };
    const end = { x: points[index], y: points[index + 1] };
    if (pointOnSegment(point, start, end)) return true;
    const crosses = (start.y > point.y) !== (end.y > point.y);
    if (crosses && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x) {
      inside = !inside;
    }
  }
  return inside;
}

function contains(region, point) {
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
  if (scene.index?.genes && scene.index?.hitLoci && scene.hitRegions.genes && scene.hitRegions.loci) {
    for (const uid of queryPointOrdered(scene.index.genes, point).reverse()) {
      const region = scene.hitRegions.genes.get(uid);
      if (region && contains(region, point)) return region;
    }
    for (const uid of queryPointOrdered(scene.index.hitLoci, point).reverse()) {
      const regions = scene.hitRegions.loci.get(uid);
      for (const region of [regions?.trimRight, regions?.trimLeft, regions?.move]) {
        if (region && contains(region, point)) return region;
      }
    }
    return null;
  }
  for (let index = scene.hitRegions.all.length - 1; index >= 0; index -= 1) {
    const region = scene.hitRegions.all[index];
    if (contains(region, point)) return region;
  }
  return null;
}
import { queryPointOrdered } from "./spatialIndex.mjs";
