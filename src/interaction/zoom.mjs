import { zoom as createZoom, zoomIdentity, zoomTransform } from "d3-zoom";

// Surface modules supply renderer-specific effects, but every chart camera
// uses the same D3 gesture contract and intentionally reserves double-click
// for locus flipping.
export function bindCameraZoom({
  surface,
  zoomExtent,
  onZoom,
  onStart,
  onEnd,
}) {
  const zoom = createZoom()
    .scaleExtent(zoomExtent())
    .on("zoom", onZoom)
    .on("start", onStart)
    .on("end", onEnd);
  surface.call(zoom).on("dblclick.zoom", null);
  return zoom;
}

export function updateCameraZoom(zoom, zoomExtent) {
  if (zoom) zoom.scaleExtent(zoomExtent());
}

// D3 keeps a transform on each gesture surface. The chart camera is shared by
// all renderers, so a surface created while switching renderer must adopt that
// camera before its first wheel or drag event. Otherwise its default identity
// transform would overwrite the already-visible camera on that first gesture.
export function syncCameraZoom({ surface, zoom, camera }) {
  const node = surface?.node?.();
  if (!node || !zoom || !camera) return;
  const current = zoomTransform(node);
  if (current.x === camera.x && current.y === camera.y && current.k === camera.k) return;
  surface.call(
    zoom.transform,
    zoomIdentity.translate(camera.x, camera.y).scale(camera.k)
  );
}
