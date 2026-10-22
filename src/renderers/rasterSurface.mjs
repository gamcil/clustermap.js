// Owns the persistent DOM surrounding retained raster renderers. Painting,
// hit testing, minimap behaviour, and renderer-specific resources stay with
// the chart controller/backends.
import { bindCameraZoom, updateCameraZoom } from "../interaction/zoom.mjs";

export function ensureRasterSurface({
  container,
  data,
  renderer,
  showRaster,
  showWebGpu,
  showMinimap,
  minimap,
  zoom,
  zoomExtent,
  onZoom,
  onZoomStart,
  onZoomEnd,
}) {
  let currentZoom = zoom;
  // A canvas cannot switch between 2D and WebGPU contexts in place.
  container
    .selectAll("canvas.clusterMapCanvas")
    .filter(function () {
      return this.dataset.renderer && this.dataset.renderer !== renderer;
    })
    .remove();

  const canvas = container
    .selectAll("canvas.clusterMapCanvas")
    .data(showRaster ? [data] : [])
    .join((enter) => {
      const surface = enter
        .append("canvas")
        .attr("class", "clusterMapCanvas")
        .attr("tabindex", 0)
        .attr("aria-label", "Cluster map");
      currentZoom = bindCameraZoom({
        surface,
        zoomExtent,
        onZoom,
        onStart: function () { onZoomStart(this); },
        onEnd: function () { onZoomEnd(this); },
      });
      return surface;
    })
    .attr("data-renderer", renderer);

  if (showWebGpu) {
    canvas.attr("data-webgpu", function () { return this.dataset.webgpu || "initializing"; });
  } else {
    canvas.attr("data-webgpu", null);
  }
  updateCameraZoom(currentZoom, zoomExtent);

  const webgpuOverlay = container
    .selectAll("canvas.clusterMapWebGpuOverlay")
    .data(showWebGpu ? [data] : [])
    .join((enter) =>
      enter
        .append("canvas")
        .attr("class", "clusterMapWebGpuOverlay")
    );
  const overview = container
    .selectAll("canvas.clusterMapMinimap")
    .data(showMinimap ? [data] : [])
    .join((enter) =>
      enter
        .append("canvas")
        .attr("class", "clusterMapMinimap")
        .attr("aria-label", "Cluster map overview")
    );
  overview
    .style("width", showMinimap ? `${minimap.width}px` : null)
    .style("height", showMinimap ? `${minimap.height}px` : null)
    .style("right", showMinimap ? `${minimap.margin}px` : null)
    // The editor is a bottom overlay. Keep navigation independently reachable
    // by anchoring the overview at the chart's top-right corner instead.
    .style("top", showMinimap ? `${minimap.margin}px` : null);

  return { canvas, webgpuOverlay, minimap: overview, zoom: currentZoom };
}
