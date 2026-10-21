import { select } from "d3-selection";
import { transition } from "d3-transition";
import { renderSvg } from "./svgRenderer.js";
import { figureConfig } from "./theme.mjs";
import { appendLabelFilter } from "./svgSurface.mjs";

/** Publication output uses the live SVG renderer with interaction affordances removed. */
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
  config = figureConfig(config);
  const namespace = "http://www.w3.org/2000/svg";
  const svgNode = documentRef.createElementNS(namespace, "svg");
  // SVG text getBBox() is unreliable while the tree is detached. Attach it
  // invisibly before rendering so tree/label spacing uses real text metrics.
  select(documentRef.body)
    .append(() => svgNode)
    .style("position", "fixed")
    .style("visibility", "hidden")
    .style("pointer-events", "none");
  try {
    appendLabelFilter(select(svgNode), "filter_solid");
    const plot = select(svgNode).append("g").attr("class", "clusterMapG");
    const exportIds = { ...ids, filter: "filter_solid", colourGradient: "colour-gradient" };
    renderSvg({
      plot,
      data,
      scene,
      transition: transition().duration(0),
      animate: false,
      config,
      scales,
      ids: exportIds,
      lookup,
    });
    // Event listeners do not serialize, but hover/trim affordances would still
    // be visible as nodes in an exported publication figure.
    plot.selectAll("g.hover").remove();
    // This is a static figure, so strip interaction affordances even when an
    // element's cursor or pointer policy was set by the live renderer.
    plot.selectAll("*").each(function () {
      this.removeAttribute("cursor");
      this.removeAttribute("tabindex");
      this.removeAttribute("role");
      this.removeAttribute("aria-label");
      this.removeAttribute("pointer-events");
      this.style.removeProperty("cursor");
      this.style.removeProperty("pointer-events");
      this.classList.remove("active");
    });
    const bounds = plot.node().getBBox();
    svgNode.removeAttribute("style");
    svgNode.setAttribute(
      "viewBox",
      `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`
    );
    svgNode.setAttribute("width", bounds.width + padding * 2);
    svgNode.setAttribute("height", bounds.height + padding * 2);
    svgNode.setAttribute("xmlns", namespace);
    select(svgNode).insert("rect", ":first-child")
      .attr("x", bounds.x - padding).attr("y", bounds.y - padding)
      .attr("width", bounds.width + padding * 2).attr("height", bounds.height + padding * 2)
      .attr("fill", config.figureStyle.background);
    return new XMLSerializer().serializeToString(svgNode);
  } finally {
    svgNode.remove();
  }
}
