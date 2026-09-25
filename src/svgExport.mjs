import { renderSvg } from "./svgRenderer.js";

const noop = () => {};

const exportInteractions = {
  isDragging: () => false,
  beginClusterDrag: noop,
  moveClusterDrag: noop,
  endClusterDrag: noop,
  beginLocusDrag: noop,
  moveLocusDrag: noop,
  endLocusDrag: noop,
  beginLocusTrim: noop,
  moveLocusTrim: noop,
  endLocusTrim: noop,
  flipLocus: noop,
  onGeneClick: null,
  showGeneMenu: noop,
  showGroupMenu: noop,
  setScaleBarLength: noop,
  chooseLegendColour: noop,
  legendColour: noop,
  legendText: noop,
  legendMenu: noop,
};

/**
 * Render the retained scene through the normal SVG renderer in a detached
 * document. The publication output therefore shares all drawing semantics
 * with the interactive SVG backend while excluding interaction affordances.
 */
export function exportChartSvg({
  data,
  scene,
  config,
  scales,
  ids,
  lookup,
  padding = 20,
  documentRef = document,
}) {
  if (!scene) throw new Error("Cannot export an SVG before the chart has rendered.");
  const namespace = "http://www.w3.org/2000/svg";
  const svgNode = documentRef.createElementNS(namespace, "svg");
  const defs = d3.select(svgNode).append("defs");
  const filter = defs
    .append("filter")
    .attr("id", "filter_solid")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 1)
    .attr("height", 1);
  filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
  filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "");
  const plot = d3.select(svgNode).append("g").attr("class", "clusterMapG");
  const exportIds = { ...ids, filter: "filter_solid", colourGradient: "colour-gradient" };
  renderSvg({
    plot,
    data,
    scene,
    transition: d3.transition().duration(0),
    animate: false,
    config,
    scales,
    ids: exportIds,
    lookup,
    interactions: exportInteractions,
  });
  // Event listeners do not serialize, but hover/trim affordances would still
  // be visible as nodes in an exported publication figure.
  plot.selectAll("g.hover").remove();

  d3.select(documentRef.body)
    .append(() => svgNode)
    .style("position", "fixed")
    .style("visibility", "hidden")
    .style("pointer-events", "none");
  const bounds = plot.node().getBBox();
  svgNode.remove();
  svgNode.removeAttribute("style");
  svgNode.setAttribute(
    "viewBox",
    `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`
  );
  svgNode.setAttribute("width", bounds.width + padding * 2);
  svgNode.setAttribute("height", bounds.height + padding * 2);
  svgNode.setAttribute("xmlns", namespace);
  return new XMLSerializer().serializeToString(svgNode);
}
