import { measureFigureBounds } from "../scene/measure.mjs";

/** One backdrop shared by all renderers; camera changes only update its transform. */
export function createFigureSurface() {
  let context = null, measuredScene = null, measuredConfig = null, measuredBounds = null, measuredPreview = null;
  let preserveNextSceneBounds = null;

  function bounds(container, scene, config, tree, preview = null) {
    if (!container || !scene?.bounds) return null;
    // Reordering moves rows within the figure without changing its extent.
    if (preview?.type === "cluster-drag") preview = null;
    if (scene !== measuredScene || config !== measuredConfig || preview !== measuredPreview) {
      context ||= container.ownerDocument.createElement("canvas").getContext("2d");
      measuredBounds = measureFigureBounds(context, scene, config, tree, { preview });
      if (preserveNextSceneBounds) {
        const previous = preserveNextSceneBounds;
        preserveNextSceneBounds = null;
        measuredBounds = {
          minX: Math.min(previous.minX, measuredBounds.minX),
          maxX: Math.max(previous.maxX, measuredBounds.maxX),
          minY: Math.min(previous.minY, measuredBounds.minY),
          maxY: Math.max(previous.maxY, measuredBounds.maxY),
        };
      }
      measuredScene = scene;
      measuredConfig = config;
      measuredPreview = preview;
    }
    return { ...measuredBounds };
  }

  function update(container, scene, config, tree, camera, preview = null) {
    const extent = bounds(container.node(), scene, config, tree, preview);
    if (!extent) return;
    const padding = 20;
    const { x, y, k } = camera;
    const width = extent.maxX - extent.minX + padding * 2;
    const height = extent.maxY - extent.minY + padding * 2;
    const left = x + (extent.minX - padding) * k;
    const top = y + (extent.minY - padding) * k;
    const showFrame = config.plot.showFigureFrame !== false;
    container.selectAll("div.clusterMapFigureSurface").data([extent]).join(
      (enter) => enter.insert("div", ":first-child")
        .attr("class", "clusterMapFigureSurface").attr("aria-hidden", "true")
    )
      .classed("clusterMapFigureSurface--frameless", !showFrame)
      .style("width", `${width}px`)
      .style("height", `${height}px`)
      .style("background", config.plot.background)
      .style("transform", `translate(${left}px, ${top}px) scale(${k})`);
    const label = container.selectAll("div.clusterMapFigureDimensions").data([extent]).join(
      (enter) => enter.append("div").attr("class", "clusterMapFigureDimensions")
        .attr("title", "Figure width × height at 100% zoom, including padding. SVG output is resolution independent.")
    ).style("transform", `translate(${left}px, ${top - 24}px)`)
      .style("display", showFrame ? null : "none");
    const text = `${Math.round(width).toLocaleString("en-US")} × ${Math.round(height).toLocaleString("en-US")} px`;
    if (label.text() !== text) label.text(text);
  }

  function clear() {
    context = measuredScene = measuredConfig = measuredBounds = measuredPreview = preserveNextSceneBounds = null;
  }

  function preserveBoundsOnNextScene() {
    if (measuredBounds) preserveNextSceneBounds = { ...measuredBounds };
  }

  return { bounds, update, clear, preserveBoundsOnNextScene };
}
