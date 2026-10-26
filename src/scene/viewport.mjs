import { queryViewportOrdered } from "./spatialIndex.mjs";

/** Select scene records intersecting a world-space viewport, in painter order. */
export function sceneRecordsInViewport(scene, viewport, include = {}) {
  if (!viewport || !scene?.index) return null;
  // These indexes contain biological geometry. An offscreen tree, legend or
  // annotation panel does not require culling when all that geometry fits.
  const bounds = scene.bounds;
  if (bounds && viewport.minX <= bounds.minX && viewport.maxX >= bounds.maxX &&
      viewport.minY <= bounds.minY && viewport.maxY >= bounds.maxY) return null;

  return {
    links: include.links === false ? null : queryViewportOrdered(scene.index.links, viewport),
    loci: include.loci === false ? null : queryViewportOrdered(scene.index.loci, viewport),
    genes: include.genes === false ? null : queryViewportOrdered(scene.index.genes, viewport),
  };
}
