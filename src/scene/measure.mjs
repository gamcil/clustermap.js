import { layoutTree } from "../tree/layout.mjs";
import { figureBoundsForChrome } from "./layout.mjs";
import { annotationPanelsForFrame, annotationFigureBounds, legendContentBounds } from "../annotations/model.mjs";
import { getLinkLabelPosition } from "../links/layout.mjs";
import { resolveTrimIndicatorStyle } from "../loci/trimIndicators.mjs";
import { locusContentBounds } from "../loci/layout.mjs";
import { clusterLabelLayout } from "./clusterLabels.mjs";
import {
  locusGeometryForPreview, clusterLabelOffsetForPreview, clusterLabelTextForPreview,
  clusterOffsetForPreview, geneVisibleForPreview, previewOffsetsForLocus,
  geneGeometryForPreview, linkGeometryForPreview,
} from "./preview.mjs";

const sceneMetrics = new WeakMap();
const treeLayouts = new WeakMap();
const textProperties = ["direction", "fontKerning", "fontStretch", "fontVariantCaps", "letterSpacing", "wordSpacing"];

/** Share native text metrics across Canvas consumers without changing their context. */
export function measureCanvasText(context, scene, text, {
  font = context.font, align = context.textAlign, baseline = context.textBaseline,
} = {}) {
  let cache = sceneMetrics.get(scene);
  if (!cache) { cache = new Map(); sceneMetrics.set(scene, cache); }
  text = String(text);
  const key = JSON.stringify([font, align, baseline, ...textProperties.map((name) => context[name]), text]);
  if (cache.has(key)) return cache.get(key);
  context.save();
  let metrics;
  try {
    context.font = font;
    context.textAlign = align;
    context.textBaseline = baseline;
    metrics = context.measureText(text);
  } finally { context.restore(); }
  // Preview coordinate labels can change on every drag frame.
  if (cache.size >= 4096) cache.delete(cache.keys().next().value);
  cache.set(key, metrics);
  return metrics;
}

/** Supply native text metrics to the shared tree layout. */
export function measureTreeLayout(context, tree, scene, config, options = {}) {
  if (!tree || !config.tree?.show || !scene?.clusters.size) return null;
  // Camera motion does not change world-space tree layout. Share the settled
  // layout between drawing and hit testing, but recompute live previews and
  // animations (whose objects may be updated in place).
  const settled = !options.preview && !options.previousTree && !options.previousScene &&
    (!options.targetScene || options.targetScene === scene) &&
    !options.dragging && options.trackAnchor !== false;
  const cached = treeLayouts.get(context);
  if (settled && cached?.scene === scene && cached.tree === tree && cached.config === config &&
      cached.textProperties.every((value, index) => value === context[textProperties[index]])) {
    return cached.layout;
  }
  treeLayouts.delete(context);
  const measure = (text, font) => measureCanvasText(context, scene, text,
    { font, align: "left", baseline: "alphabetic" });
  const layout = layoutTree({
    ...options,
    tree, scene, config,
    measureText: (text, style) => {
      const metrics = measure(text, `${style.fontStyle || "normal"} ${style.fontWeight || 400} ${style.fontSize}px ${style.fontFamily}`);
      const overhang = Math.max(0, metrics.actualBoundingBoxLeft || 0, (metrics.actualBoundingBoxRight || 0) - metrics.width);
      return { width: metrics.width + overhang * 2, overhang, height: Math.max(style.fontSize, (metrics.actualBoundingBoxAscent || 0) + (metrics.actualBoundingBoxDescent || 0)) };
    },
    measureLabel: (cluster, locusText) => Math.max(
      measure(cluster.source.name || "", `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`).width,
      measure(locusText, `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`).width
    ),
  });
  if (settled) treeLayouts.set(context, { scene, tree, config, layout,
    textProperties: textProperties.map((name) => context[name]) });
  return layout;
}


/**
 * Extend structural scene bounds with measured text and tree extents for
 * figure sizing, camera fitting, and minimaps across renderers.
 */
export function measureFigureBounds(context, scene, config, tree = null, { preview = null } = {}) {
  if (!scene?.bounds) return null;
  let structural = scene.bounds;
  const chrome = preview?.chrome || scene.chrome;
  const panels = annotationPanelsForFrame(scene, preview);
  if (preview) {
    structural = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const locus of scene.loci.values()) {
      const geometry = locusGeometryForPreview(preview, locus);
      const content = locusContentBounds(locus, {
        shape: config.gene.shape, trimIndicatorStyle: config.locus.trimIndicators,
      }, geometry);
      structural.minX = Math.min(structural.minX, content.minX);
      structural.maxX = Math.max(structural.maxX, content.maxX);
      structural.minY = Math.min(structural.minY, content.minY);
      structural.maxY = Math.max(structural.maxY, content.maxY);
    }
  }
  const measureChromeText = (text, style) => measureCanvasText(context, scene, text, {
    font: `${style.fontWeight || 400} ${style.fontSize}px ${style.fontFamily}`,
    align: "left", baseline: style.textBaseline || "alphabetic",
  });
  const bounds = { ...(preview ? annotationFigureBounds(figureBoundsForChrome(structural, chrome, measureChromeText),
    scene.annotationPanels || [], scene.clusters, panels) : scene.figureBounds || structural) };
  const include = (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  const includeText = (text, x, y, { fontSize, fontFamily = config.plot.fontFamily,
    fontWeight = 400, align = "left", baseline = "alphabetic", rotation = 0, border = 0 }) => {
    if (!text) return;
    const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = measureCanvasText(context, scene, text, { font, align, baseline });
    const left = align === "center" ? -metrics.width / 2 : ["right", "end"].includes(align) ? -metrics.width : 0;
    const top = baseline === "top" ? 0 : baseline === "middle" ? -fontSize / 2 : -fontSize;
    const x1 = Number.isFinite(metrics.actualBoundingBoxLeft) ? -metrics.actualBoundingBoxLeft : left;
    const x2 = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : left + metrics.width;
    const y1 = Number.isFinite(metrics.actualBoundingBoxAscent) ? -metrics.actualBoundingBoxAscent : top;
    const y2 = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : top + fontSize * 1.25;
    const radians = rotation * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    for (const [tx, ty] of [[x1, y1], [x1, y2], [x2, y1], [x2, y2]]) {
      const px = x + tx * cos - ty * sin, py = y + tx * sin + ty * cos;
      include(px - border / 2, py - border / 2);
      include(px + border / 2, py + border / 2);
    }
  };

  // Structural scene bounds already enclose loci, gene polygons and ribbons.
  // Add stroke extent without walking every homology link when labels are off.
  const halfStroke = Math.max(config.gene.shape.strokeWidth || 0, config.locus.trackBar.stroke || 0,
    config.link.show ? config.link.strokeWidth || 0 : 0) / 2;
  include(structural.minX - halfStroke, structural.minY - halfStroke);
  include(structural.maxX + halfStroke, structural.maxY + halfStroke);
  const label = clusterLabelLayout(config);
  for (const cluster of scene.clusters.values()) {
    const x = cluster.x + cluster.info.x + clusterLabelOffsetForPreview(preview, cluster.source.uid);
    const y = cluster.y + clusterOffsetForPreview(preview, cluster.source.uid);
    const align = cluster.info.anchor === "start" ? "left" : "right";
    includeText(cluster.source.name, x, y + label.nameY,
      { fontSize: config.cluster.nameFontSize, fontWeight: 700, align, baseline: label.nameBaseline });
    includeText(clusterLabelTextForPreview(preview, cluster.source.uid, cluster.info.locusText), x, y + 12,
      { fontSize: config.cluster.lociFontSize, align, baseline: "top" });
  }
  if (config.gene.label.show) {
    for (const gene of scene.genes.values()) {
      if (!geneVisibleForPreview(preview, gene)) continue;
      const offsets = previewOffsetsForLocus(preview, gene.locus);
      const geometry = geneGeometryForPreview(preview, gene);
      includeText(gene.source.label || gene.source.name || gene.source.uid,
        (geometry.labelX ?? gene.locus.x + gene.label.x) + offsets.x, gene.locus.y + gene.label.y + offsets.y,
        { fontSize: config.gene.label.fontSize, align: config.gene.label.anchor === "middle" ? "center" : config.gene.label.anchor, rotation: gene.label.rotation });
    }
  }
  if (config.link.show && config.link.label.show) {
    for (const link of scene.links.values()) {
      const geometry = linkGeometryForPreview(scene, link, preview, config);
      if (!geometry.visible || !link.labelPosition) continue;
      const anchors = geometry.anchors;
      const position = preview && anchors ? getLinkLabelPosition(anchors, config.link.label.position) : link.labelPosition;
      includeText(link.source.label ?? link.source.identity.toFixed(2), position.x, position.y,
        { fontSize: config.link.label.fontSize, align: "center" });
    }
  }
  if (config.locus.trimIndicators?.show !== false) {
    const style = resolveTrimIndicatorStyle(config.locus.trimIndicators);
    for (const locus of scene.loci.values()) {
      const geometry = locusGeometryForPreview(preview, locus);
      const { x = 0, y = 0 } = geometry.offsets;
      for (const indicator of geometry.trimIndicators || locus.trimIndicators || []) {
        includeText(indicator.text, locus.x + indicator.x + x, locus.y + indicator.y + y,
          { fontSize: style.fontSize, fontWeight: style.fontWeight, align: indicator.anchor, baseline: "top", border: style.borderWidth });
      }
    }
  }
  const treeLayout = measureTreeLayout(context, tree, scene, config, { preview, trackAnchor: Boolean(preview) });
  if (treeLayout) {
    include(treeLayout.bounds.minX, treeLayout.bounds.minY);
    include(treeLayout.bounds.maxX, treeLayout.bounds.maxY);
  }
  for (const panel of panels) {
    for (const item of panel.texts) includeText(item.text, panel.x + item.x, item.y,
      { fontSize: item.fontSize, fontFamily: panel.fontFamily, fontWeight: item.weight || 400,
        align: item.anchor === "end" ? "right" : item.anchor === "middle" ? "center" : "left", rotation: item.rotation || 0 });
  }
  if (chrome?.legend.visible && chrome.legend.items.length) {
    const legend = chrome.legend;
    const content = legendContentBounds(legend, measureChromeText);
    include(legend.position.x + content.minX, legend.position.y + content.minY);
    include(legend.position.x + content.maxX, legend.position.y + content.maxY);
  }
  if (chrome?.scaleBar.visible) {
    const bar = chrome.scaleBar;
    const half = bar.strokeWidth / 2;
    include(bar.position.x - half, bar.position.y - half);
    include(bar.position.x + bar.length + half, bar.position.y + bar.height + half);
    includeText(bar.label, bar.position.x + bar.length / 2, bar.position.y + bar.height + 5,
      { fontSize: bar.fontSize, fontFamily: bar.fontFamily, align: "center", baseline: "top" });
  }
  if (chrome?.colourBar.visible) {
    const bar = chrome.colourBar;
    include(bar.position.x - 0.5, bar.position.y - 0.5);
    include(bar.position.x + bar.width + 0.5, bar.position.y + bar.height + 0.5);
    const font = { fontSize: bar.fontSize, fontFamily: bar.fontFamily, baseline: "top" };
    const y = bar.position.y + bar.height + 5;
    includeText(bar.label, bar.position.x + bar.width / 2, y, { ...font, align: "center" });
    includeText(bar.startLabel, bar.position.x, y, font);
    includeText(bar.endLabel, bar.position.x + bar.width, y, { ...font, align: "right" });
  }
  return bounds;
}

