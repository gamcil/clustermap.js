import { layoutTree } from "../tree/layout.mjs";
import { includeBounds } from "./bounds.mjs";
import { figureBoundsForChrome } from "./layout.mjs";
import { annotationPanelsForFrame, annotationPanelBounds, annotationFigureBounds, legendContentBounds } from "../annotations/model.mjs";
import { getLinkLabelPosition } from "../links/layout.mjs";
import { resolveTrimIndicatorStyle } from "../loci/trimIndicators.mjs";
import { locusContentBounds } from "../loci/layout.mjs";
import { textBounds, textDimensions, textFont } from "./text.mjs";
import { clusterLabelLayout, clusterLabelWidth } from "./clusterLabels.mjs";
import { allIndexedIds } from "./spatialIndex.mjs";
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

export function canvasTextMeasurer(context, scene) {
  return (text, style) => measureCanvasText(context, scene, text, {
    font: textFont(style), align: "left", baseline: style.textBaseline || "alphabetic",
  });
}

/** Ink bounds of a displayed cluster name in committed world coordinates. */
export function measureClusterNameBounds(context, scene, config, uid) {
  const cluster = scene?.clusters.get(uid), text = cluster?.source.name;
  if (!cluster || !text) return null;
  const label = clusterLabelLayout(config);
  const box = textBounds(text, { fontSize: config.cluster.nameFontSize,
    fontFamily: config.plot.fontFamily, fontWeight: 700,
    anchor: cluster.info.anchor, baseline: label.nameBaseline }, canvasTextMeasurer(context, scene));
  const x = cluster.x + cluster.info.x, y = cluster.y + label.nameY;
  return { minX: x + box.minX, maxX: x + box.maxX, minY: y + box.minY, maxY: y + box.maxY };
}

/** Gene text uses an SVG baseline offset that rotates with the label. */
function geneLabelBounds(gene, config, measureText, preview = null) {
  const geometry = geneGeometryForPreview(preview, gene), offsets = previewOffsetsForLocus(preview, gene.locus);
  const { x, y, rotation } = gene.label;
  const dy = config.plot.renderer === "svg" ? ({ top: -.4, middle: .4, bottom: .8 }[config.gene.label.position] || 0) * config.gene.label.fontSize : 0;
  const radians = rotation * Math.PI / 180;
  const labelX = (geometry.labelX ?? gene.locus.x + x) + offsets.x - Math.sin(radians) * dy;
  const labelY = gene.locus.y + y + offsets.y + Math.cos(radians) * dy;
  const box = textBounds(gene.source.label || gene.source.name || gene.source.uid,
    { fontSize: config.gene.label.fontSize, fontFamily: config.plot.fontFamily,
      anchor: config.gene.label.anchor, rotation }, measureText);
  return { minX: labelX + box.minX, maxX: labelX + box.maxX,
    minY: labelY + box.minY, maxY: labelY + box.maxY };
}

/** Bounds of requested visible tree marks in committed world coordinates. */
export function measureTreeTargetBounds(context, tree, scene, config, targets = {}) {
  const layout = measureTreeLayout(context, tree, scene, config);
  if (!layout) return null;
  let bounds = null;
  const include = (box) => { bounds = includeBounds(bounds, box); };
  const line = (mark, width) => {
    const half = (width || 1) / 2;
    include({ minX: Math.min(mark.x1, mark.x2) - half, maxX: Math.max(mark.x1, mark.x2) + half,
      minY: Math.min(mark.y1, mark.y2) - half, maxY: Math.max(mark.y1, mark.y2) + half });
  };
  for (const branch of layout.branches) if (targets.tree || (targets.treeBranches || []).includes(branch.uid)) line(branch, branch.style.width);
  for (const stem of layout.stems) if (targets.tree || (targets.treeStems || []).includes(stem.uid)) line(stem, stem.style.width);
  for (const node of layout.nodes) if (targets.tree || (targets.treeNodes || []).includes(node.uid)) {
    const radius = Math.max(node.hitRadius, node.radius + layout.branch.width / 2);
    include({ minX: node.x - radius, maxX: node.x + radius, minY: node.y - radius, maxY: node.y + radius });
  }
  for (const triangle of layout.triangles) if (targets.tree || (targets.treeNodes || []).includes(triangle.uid)) {
    const half = (triangle.style?.width || 1) / 2;
    include({ minX: Math.min(triangle.x, triangle.x2) - half, maxX: Math.max(triangle.x, triangle.x2) + half,
      minY: Math.min(triangle.y, triangle.y1, triangle.y2) - half, maxY: Math.max(triangle.y, triangle.y1, triangle.y2) + half });
  }
  for (const guide of layout.guides) if ((targets.treeGuides || []).includes(guide.uid)) line(guide, layout.guide.width);
  for (const label of layout.annotations) if ((targets.treeAnnotations || []).includes(label.uid)) {
    include({ minX: label.x - (label.overhang || 0), maxX: label.x + label.width,
      minY: label.y, maxY: label.y + label.height });
  }
  for (const label of layout.supports) if ((targets.treeSupports || []).includes(label.uid)) {
    include({ minX: label.x - label.width, maxX: label.x + (label.overhang || 0),
      minY: label.y - label.height, maxY: label.y });
  }
  if (targets.treeScaleBar && layout.scaleBar) {
    for (const mark of layout.scaleBar.lines) line(mark, layout.scaleBar.strokeWidth);
    const label = layout.scaleBar.label;
    include({ minX: label.x - label.width / 2, maxX: label.x + label.width / 2,
      minY: label.y, maxY: label.y + label.height });
  }
  if (targets.treeCutLine && layout.cutLine) {
    line(layout.cutLine, layout.cutLine.width);
    const label = layout.cutLine.label;
    include({ minX: label.x - label.width / 2, maxX: label.x + label.width / 2,
      minY: label.y - label.height, maxY: label.y });
  }
  return bounds;
}

/** Visible plot decorations in committed world coordinates. */
export function measureDecorationBounds(context, scene, targets = {}, config = {}, preview = null) {
  if (!scene) return null;
  const measureText = canvasTextMeasurer(context, scene), chrome = preview?.chrome || scene.chrome;
  let bounds = null;
  const include = (box) => { bounds = includeBounds(bounds, box); };
  const includeText = (text, x, y, style) => {
    if (!text) return;
    const box = textBounds(text, style, measureText);
    include({ minX: x + box.minX, maxX: x + box.maxX, minY: y + box.minY, maxY: y + box.maxY });
  };
  const legend = chrome?.legend;
  if (legend?.visible && (targets.legend || targets.legendItems?.length || targets.legendSymbols?.length)) {
    const items = targets.legend ? legend.items : legend.items.filter((item) => (targets.legendItems || []).includes(item.uid));
    if (items.length) {
      const box = legendContentBounds({ ...legend, items }, measureText);
      include({ minX: legend.position.x + box.minX, maxX: legend.position.x + box.maxX,
        minY: legend.position.y + box.minY, maxY: legend.position.y + box.maxY });
    }
    for (const item of targets.legendSymbols?.length ? legend.items : []) if (targets.legendSymbols.includes(item.uid)) {
      const box = legend.symbol.bounds;
      include({ minX: legend.position.x + item.x + box.minX, maxX: legend.position.x + item.x + box.maxX,
        minY: legend.position.y + item.y + box.minY, maxY: legend.position.y + item.y + box.maxY });
    }
  }
  const scale = chrome?.scaleBar;
  if (targets.scaleBar && scale?.visible) {
    const half = scale.strokeWidth / 2;
    include({ minX: scale.position.x - half, maxX: scale.position.x + scale.length + half,
      minY: scale.position.y - half, maxY: scale.position.y + scale.height + half });
    includeText(scale.label, scale.position.x + scale.length / 2, scale.position.y + scale.height + 5,
      { fontSize: scale.fontSize, fontFamily: scale.fontFamily, anchor: "middle", baseline: "top" });
  }
  const colour = chrome?.colourBar;
  if (targets.colourBar && colour?.visible) {
    include({ minX: colour.position.x - .5, maxX: colour.position.x + colour.width + .5,
      minY: colour.position.y - .5, maxY: colour.position.y + colour.height + .5 });
    const font = { fontSize: colour.fontSize, fontFamily: colour.fontFamily, baseline: "top" };
    const y = colour.position.y + colour.height + 5;
    includeText(colour.label, colour.position.x + colour.width / 2, y, { ...font, anchor: "middle" });
    includeText(colour.startLabel, colour.position.x, y, font);
    includeText(colour.endLabel, colour.position.x + colour.width, y, { ...font, anchor: "end" });
  }
  const needsPanels = targets.annotations || targets.annotationPanels?.length || targets.annotationCells?.length || targets.annotationMarkers?.length;
  for (const panel of needsPanels ? annotationPanelsForFrame(scene, preview) : []) {
    if (targets.annotations || (targets.annotationPanels || []).includes(panel.uid)) {
      const box = annotationPanelBounds(panel);
      if (Object.values(box).every(Number.isFinite)) include(box);
    }
    for (const target of targets.annotationCells || []) {
      if (target.panelUid !== panel.uid) continue;
      const row = panel.rows.find((row) => row.uid === target.clusterUid);
      const cell = row?.cells.find((cell) => cell.columnIndex === target.columnIndex);
      if (cell) include({ minX: panel.x + cell.x, maxX: panel.x + cell.x + cell.width,
        minY: row.y + cell.y, maxY: row.y + cell.y + cell.height });
    }
    for (const target of targets.annotationMarkers || []) {
      if (target.panelUid !== panel.uid || !panel.markerGroups?.some((group) => group.uid === target.groupUid)) continue;
      const segments = new Set([...scene.clusters.keys()].map((uid) => `${target.groupUid}:${uid}`));
      for (const rect of panel.rects) if (segments.has(rect.uid)) {
        include({ minX: panel.x + rect.x, maxX: panel.x + rect.x + rect.width,
          minY: rect.y, maxY: rect.y + rect.height });
      }
      for (const text of panel.texts) if (segments.has(text.uid)) {
        includeText(text.text, panel.x + text.x, text.y,
          { fontSize: text.fontSize, fontFamily: panel.fontFamily, anchor: text.anchor });
      }
    }
  }
  for (const uid of targets.clusterLocusLabels || []) {
    const cluster = scene.clusters.get(uid), text = cluster?.info.locusText;
    if (!cluster || !text || config.cluster.hideLocusLabels) continue;
    includeText(text, cluster.x + cluster.info.x, cluster.y + 12,
      { fontSize: config.cluster.lociFontSize, fontFamily: config.plot.fontFamily,
        anchor: cluster.info.anchor, baseline: "top" });
  }
  for (const uid of targets.geneLabels || []) {
    const gene = scene.genes.get(uid);
    if (!gene?.visible || !config.gene.label.show) continue;
    include(geneLabelBounds(gene, config, measureText));
  }
  for (const uid of targets.linkLabels || []) {
    const link = scene.links.get(uid);
    if (!link?.visible || !link.labelPosition || !config.link.show || !config.link.label.show) continue;
    includeText(link.source.label ?? link.source.identity.toFixed(2), link.labelPosition.x, link.labelPosition.y,
      { fontSize: config.link.label.fontSize, fontFamily: config.plot.fontFamily, anchor: "middle" });
  }
  if (config.locus.trimIndicators?.show !== false) {
    const style = resolveTrimIndicatorStyle(config.locus.trimIndicators);
    for (const uid of targets.trimIndicators || []) {
      const locus = scene.loci.get(uid);
      for (const indicator of locus?.trimIndicators || []) {
        const box = textBounds(indicator.text, { fontSize: style.fontSize, fontWeight: style.fontWeight,
          fontFamily: config.plot.fontFamily, anchor: indicator.anchor, baseline: "top" }, measureText);
        const half = style.borderWidth / 2, x = locus.x + indicator.x, y = locus.y + indicator.y;
        include({ minX: x + box.minX - half, maxX: x + box.maxX + half,
          minY: y + box.minY - half, maxY: y + box.maxY + half });
      }
    }
  }
  return bounds;
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
  const measureText = canvasTextMeasurer(context, scene);
  const layout = layoutTree({
    ...options, tree, scene, config,
    measureText: (text, style) => textDimensions(text, style, measureText),
    measureLabel: (cluster, locusText) => clusterLabelWidth(cluster.source.name || "", locusText, config, measureText),
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
      includeBounds(structural, content);
    }
  }
  const measureChromeText = canvasTextMeasurer(context, scene);
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
    const anchor = ["right", "end"].includes(align) ? "end" : ["center", "middle"].includes(align) ? "middle" : "start";
    const box = textBounds(text, { fontSize, fontFamily, fontWeight, anchor, baseline, rotation }, measureChromeText);
    include(x + box.minX - border / 2, y + box.minY - border / 2);
    include(x + box.maxX + border / 2, y + box.maxY + border / 2);
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
      includeBounds(bounds, geneLabelBounds(gene, config, measureChromeText, preview));
    }
  }
  if (config.link.show && config.link.label.show) {
    const candidates = scene.index?.links?.boundsById
      ? (function* () { for (const uid of allIndexedIds(scene.index.links)) yield scene.links.get(uid); })()
      : scene.links.values();
    for (const link of candidates) {
      if (!link) continue;
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
  includeBounds(bounds, measureDecorationBounds(context, scene,
    { legend: true, scaleBar: true, colourBar: true }, config, preview));
  return bounds;
}

