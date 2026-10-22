// Owns the persistent DOM surrounding an SVG chart. Scene joins and all chart
// interactions remain in the SVG renderer/controller; this module only
// establishes the SVG viewport, overlay nodes, and camera gesture binding.
import { bindCameraZoom, updateCameraZoom } from "../interaction/zoom.mjs";

export function appendLabelFilter(svg, id) {
  const filter = svg.append("defs").append("filter")
    .attr("id", id).attr("x", 0).attr("y", 0).attr("width", 1).attr("height", 1);
  filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
  filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "");
}

export function ensureSvgSurface({
  container,
  data,
  ids,
  fontFamily,
  zoom,
  zoomExtent,
  onZoom,
  onZoomStart,
  onZoomEnd,
}) {
  let currentZoom = zoom;
  const svg = container
    .selectAll("svg.clusterMap")
    .data([data])
    .join((enter) => {
      enter
        .append("input")
        .attr("id", ids.picker)
        .attr("class", "colourPicker")
        .attr("type", "color");

      enter
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("font-family", fontFamily);

      const surface = enter
        .append("svg")
        .attr("class", "clusterMap")
        .attr("id", ids.root)
        .attr("cursor", "grab")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

      appendLabelFilter(surface, ids.filter);

      // Layout measures chart content in world coordinates. The viewport is
      // the only group transformed by the persisted camera.
      const viewport = surface.append("g").attr("class", "clusterMapViewport");
      viewport.append("g").attr("class", "clusterMapG");

      currentZoom = bindCameraZoom({
        surface,
        zoomExtent,
        onZoom: (event) => onZoom(event, viewport),
        onStart: () => onZoomStart(surface),
        onEnd: () => onZoomEnd(surface),
      });
      return surface;
    });

  updateCameraZoom(currentZoom, zoomExtent);
  return {
    svg,
    plot: svg.select("g.clusterMapG"),
    tooltip: container.select("div.tooltip"),
    zoom: currentZoom,
  };
}
