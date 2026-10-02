// Owns the persistent DOM surrounding retained raster renderers. Painting,
// hit testing, minimap behaviour, and renderer-specific resources stay with
// the chart controller/backends.
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import { bindCameraZoom, updateCameraZoom } from "./cameraZoom.mjs";

const d3 = { zoom, zoomIdentity, zoomTransform };

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
        .attr("cursor", "grab")
        .attr("tabindex", 0)
        .attr("aria-label", "Cluster map")
        .style("display", "block")
        .style("width", "100%")
        .style("height", "100%")
        .style("outline", "none");
      currentZoom = bindCameraZoom({
        d3,
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

  if ((showWebGpu || showMinimap) && globalThis.getComputedStyle(container.node()).position === "static") {
    container.style("position", "relative");
  }
  const webgpuOverlay = container
    .selectAll("canvas.clusterMapWebGpuOverlay")
    .data(showWebGpu ? [data] : [])
    .join((enter) =>
      enter
        .append("canvas")
        .attr("class", "clusterMapWebGpuOverlay")
        .style("position", "absolute")
        .style("inset", "0")
        .style("display", "block")
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none")
    );
  const overview = container
    .selectAll("canvas.clusterMapMinimap")
    .data(showMinimap ? [data] : [])
    .join((enter) =>
      enter
        .append("canvas")
        .attr("class", "clusterMapMinimap")
        .attr("aria-label", "Cluster map overview")
        .style("position", "absolute")
        .style("z-index", 2)
        .style("display", "block")
        .style("box-sizing", "border-box")
        .style("background", "white")
        .style("box-shadow", "0 1px 4px rgba(0, 0, 0, 0.25)")
        .style("cursor", "grab")
        .style("touch-action", "none")
    );
  overview
    .style("width", showMinimap ? `${minimap.width}px` : null)
    .style("height", showMinimap ? `${minimap.height}px` : null)
    .style("right", showMinimap ? `${minimap.margin}px` : null)
    // The editor is a bottom overlay. Keep navigation independently reachable
    // by anchoring the overview at the chart's top-right corner instead.
    .style("top", showMinimap ? `${minimap.margin}px` : null)
    .style("bottom", null);

  return { canvas, webgpuOverlay, minimap: overview, zoom: currentZoom };
}
