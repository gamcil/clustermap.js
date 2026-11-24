import { includeBounds } from "../scene/bounds.mjs";
import { measureFigureBounds, measureClusterNameBounds, measureTreeTargetBounds, measureDecorationBounds } from "../scene/measure.mjs";

const recordTargets = new Set(["genes", "links", "loci", "clusters", "figure"]);

/** One backdrop shared by all renderers; camera changes only update its transform. */
export function createFigureSurface() {
  let context = null, measuredScene = null, measuredConfig = null, measuredBounds = null, measuredPreview = null;
  const measurementContext = (container) => {
    if (!container) return null;
    return context ||= container.ownerDocument.createElement("canvas").getContext("2d");
  };

  function bounds(container, scene, config, tree, preview = null) {
    if (!container || !scene?.bounds) return null;
    // Reordering moves rows within the figure without changing its extent.
    if (preview?.type === "cluster-drag") preview = null;
    if (scene !== measuredScene || config !== measuredConfig || preview !== measuredPreview) {
      context = measurementContext(container);
      measuredBounds = measureFigureBounds(context, scene, config, tree, { preview });
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
    context = measuredScene = measuredConfig = measuredBounds = measuredPreview = null;
  }

  return { bounds, update, clear,
    targetBounds(container, scene, config, tree, targets) {
      if (!scene || !Object.entries(targets).some(([key, value]) =>
        !recordTargets.has(key) && (value === true || Array.isArray(value) && value.length))) return null;
      const ctx = measurementContext(container);
      if (!ctx) return null;
      let result = null;
      for (const uid of targets.clusterLabels || []) {
        result = includeBounds(result, measureClusterNameBounds(ctx, scene, config, uid));
      }
      if (Object.keys(targets).some((key) => key.startsWith("tree") && (targets[key] === true || targets[key]?.length))) {
        result = includeBounds(result, measureTreeTargetBounds(ctx, tree, scene, config, targets));
      }
      return includeBounds(result, measureDecorationBounds(ctx, scene, targets, config));
    } };
}
