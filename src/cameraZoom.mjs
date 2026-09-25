// Surface modules supply renderer-specific effects, but every chart camera
// uses the same D3 gesture contract and intentionally reserves double-click
// for locus flipping.
export function bindCameraZoom({
  d3,
  surface,
  zoomExtent,
  onZoom,
  onStart,
  onEnd,
}) {
  const zoom = d3
    .zoom()
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
