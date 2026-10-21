import { rgbaToRgb } from "./utils.js";
import { hitTest } from "./hitTest.mjs";
import { boundsInViewport, worldViewport } from "./camera.mjs";
import { figureConfig } from "./theme.mjs";
import { queryViewportOrdered } from "./spatialIndex.mjs";
import {
  clusterPreviewInViewport,
  offsetsForGene,
  geneGeometryForPreview,
  linkGeometryForPreview,
  clusterLabelOffsetForPreview,
  clusterLabelTextForPreview,
  clusterOffsetForPreview,
  geneVisibleForPreview,
  locusGeometryForPreview,
  previewOffsetsForLocus,
  previewLinkAnchors,
} from "./scenePreview.mjs";
import { figureBoundsForChrome } from "./layout.mjs";
import { interpolateLinkAnchors, interpolateLinkOpacity, traceLinkPath, getLinkLabelPosition } from "./links/layout.mjs";
import { hitTestTreeNode, interpolateTreeLayout } from "./treeLayout.mjs";
import { drawCanvasTree, layoutCanvasTree } from "./treeCanvasRenderer.mjs";
import { resolveTrimIndicatorStyle } from "./loci/trimIndicators.mjs";
import { annotationPanelsForFrame, annotationFigureBounds } from "./annotations.mjs";
import { drawCanvasAnnotations } from "./annotationRenderers.mjs";

/**
 * Choose Canvas backing-store resolution from the view scale.  This affects
 * only raster detail: the CSS canvas size and chart-world coordinates remain
 * unchanged.  Active gestures always favour throughput over sharpness.
 */
export function canvasPixelRatioForCamera({
  camera,
  moving = false,
  devicePixelRatio = globalThis.devicePixelRatio || 1,
}) {
  if (moving) return Math.min(devicePixelRatio, 1);

  const zoom = camera?.k ?? 1;
  if (zoom < 0.35) return Math.min(devicePixelRatio, 0.75);
  if (zoom < 0.6) return Math.min(devicePixelRatio, 1);
  if (zoom < 0.85) return Math.min(devicePixelRatio, 1.5);
  return devicePixelRatio;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Project the complete chart bounds into a fixed-size screen-space minimap. */
export function createMinimapProjection({ bounds, width, height, padding = 4 }) {
  if (!bounds || !width || !height) return null;
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
  const frame = {
    x: (width - worldWidth * scale) / 2,
    y: (height - worldHeight * scale) / 2,
    width: worldWidth * scale,
    height: worldHeight * scale,
  };
  return {
    bounds,
    width,
    height,
    scale,
    frame,
    x: frame.x - bounds.minX * scale,
    y: frame.y - bounds.minY * scale,
  };
}

/** Return the main viewport rectangle in minimap screen coordinates. */
export function canvasMinimapViewport(projection, camera, viewport) {
  if (!projection || !camera || !viewport) return null;
  const minX = -camera.x / camera.k;
  const maxX = (viewport.width - camera.x) / camera.k;
  const minY = -camera.y / camera.k;
  const maxY = (viewport.height - camera.y) / camera.k;
  const { bounds, scale, x, y, frame } = projection;
  const left = clamp(x + minX * scale, frame.x, frame.x + frame.width);
  const right = clamp(x + maxX * scale, frame.x, frame.x + frame.width);
  const top = clamp(y + minY * scale, frame.y, frame.y + frame.height);
  const bottom = clamp(y + maxY * scale, frame.y, frame.y + frame.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Centre the existing camera scale on a point selected in the minimap. */
export function cameraForMinimapPoint(projection, point, viewport, camera) {
  const worldX = clamp(
    (point.x - projection.x) / projection.scale,
    projection.bounds.minX,
    projection.bounds.maxX
  );
  const worldY = clamp(
    (point.y - projection.y) / projection.scale,
    projection.bounds.minY,
    projection.bounds.maxY
  );
  return {
    ...camera,
    x: viewport.width / 2 - worldX * camera.k,
    y: viewport.height / 2 - worldY * camera.k,
  };
}

/** Composite a cached overview raster with the live main-camera viewport. */
export function renderCanvasMinimap({
  canvas,
  baseCanvas = null,
  projection,
  camera,
  viewport,
  pixelRatio = globalThis.devicePixelRatio || 1,
}) {
  if (!projection) return null;
  const { width, height, frame } = projection;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (baseCanvas) context.drawImage(baseCanvas, 0, 0, width, height);
  else {
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
  }
  context.strokeStyle = "rgba(0, 0, 0, 0.55)";
  context.lineWidth = 1;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);
  const visible = canvasMinimapViewport(projection, camera, viewport);
  if (visible) {
    context.fillStyle = "rgba(30, 120, 255, 0.16)";
    context.fillRect(visible.x, visible.y, visible.width, visible.height);
    context.strokeStyle = "rgb(30, 120, 255)";
    context.strokeRect(visible.x, visible.y, visible.width, visible.height);
  }
  return { width, height, pixelRatio, viewport: visible };
}

export function canvasWorldPoint(canvas, event, camera) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left - camera.x) / camera.k,
    y: (event.clientY - bounds.top - camera.y) / camera.k,
  };
}

/**
 * Return the portion of chart-world space covered by a Canvas. A small
 * screen-space margin prevents records from popping at its edge while panning.
 */
export function canvasWorldViewport(canvas, camera, overscan = 20, dimensions = null) {
  return worldViewport(camera, dimensions || canvas.getBoundingClientRect(), overscan);
}

/**
 * Extend the scene's structural figure bounds with exact Canvas text metrics.
 * Scene layout deliberately records only renderer-neutral chrome extents; the
 * raster adapter owns glyph measurement for initial camera fitting.
 */
export function canvasFigureBounds(context, scene, config, tree = null, { preview = null, textMetrics = null } = {}) {
  if (!scene?.bounds) return null;
  let structural = scene.bounds;
  const chrome = preview?.chrome || scene.chrome;
  const panels = annotationPanelsForFrame(scene, preview);
  if (preview) {
    structural = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const locus of scene.loci.values()) {
      const geometry = locusGeometryForPreview(preview, locus);
      const { x = 0, y = 0 } = geometry.offsets;
      structural.minX = Math.min(structural.minX, geometry.worldStart ?? locus.worldStart + x);
      structural.maxX = Math.max(structural.maxX, geometry.worldEnd ?? locus.worldEnd + x);
      structural.minY = Math.min(structural.minY, locus.bounds.minY + y);
      structural.maxY = Math.max(structural.maxY, locus.bounds.maxY + y);
    }
  }
  const bounds = { ...(preview ? annotationFigureBounds(figureBoundsForChrome(structural, chrome),
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
    const key = JSON.stringify([font, align, baseline, String(text)]);
    let metrics = textMetrics?.get(key);
    if (!metrics) {
      context.save();
      context.font = font;
      context.textAlign = align;
      context.textBaseline = baseline;
      metrics = context.measureText(String(text));
      context.restore();
      textMetrics?.set(key, metrics);
    }
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
  for (const cluster of scene.clusters.values()) {
    const x = cluster.x + cluster.info.x + clusterLabelOffsetForPreview(preview, cluster.source.uid);
    const y = cluster.y + clusterOffsetForPreview(preview, cluster.source.uid);
    includeText(cluster.source.name, x, y + 8,
      { fontSize: config.cluster.nameFontSize, fontWeight: 700, align: "right" });
    includeText(clusterLabelTextForPreview(preview, cluster.source.uid, cluster.info.locusText), x, y + 12,
      { fontSize: config.cluster.lociFontSize, align: "right", baseline: "top" });
  }
  if (config.gene.label.show) {
    for (const gene of scene.genes.values()) {
      if (!geneVisibleForPreview(preview, gene)) continue;
      const offsets = offsetsForGene(preview, gene);
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
      const anchors = preview ? previewLinkAnchors(scene, link, preview) : link.anchors;
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
  const treeLayout = layoutCanvasTree(context, tree, scene, config, { preview, trackAnchor: Boolean(preview) });
  if (treeLayout) {
    include(treeLayout.bounds.minX, treeLayout.bounds.minY);
    include(treeLayout.bounds.maxX, treeLayout.bounds.maxY);
  }
  for (const panel of panels) {
    for (const item of panel.texts) includeText(item.text, panel.x + item.x, item.y,
      { fontSize: panel.fontSize, fontFamily: panel.fontFamily, fontWeight: item.weight || 400,
        align: item.anchor === "end" ? "right" : item.anchor === "middle" ? "center" : "left", rotation: item.rotation || 0 });
  }
  if (chrome?.legend.visible) {
    const legend = chrome.legend;
    const subtitleSize = legend.subtitleFontSize || Math.max(10, legend.fontSize * 0.72);
    for (const item of legend.items) {
      const x = legend.position.x + item.x, y = legend.position.y + item.y + item.circleY;
      include(x - item.radius, y - item.radius);
      include(x + item.radius, y + item.radius);
      includeText(item.label, legend.position.x + item.textX, legend.position.y + item.y + item.textY,
        { fontSize: legend.fontSize, fontFamily: legend.fontFamily, baseline: "middle" });
      includeText(item.subtitle, legend.position.x + item.textX, legend.position.y + item.y + item.subtitleY,
        { fontSize: subtitleSize, fontFamily: legend.fontFamily, baseline: "middle" });
    }
  }
  if (chrome?.scaleBar.visible) {
    const bar = chrome.scaleBar;
    const half = bar.strokeWidth / 2;
    include(bar.position.x - half, bar.position.y - half);
    include(bar.position.x + bar.length + half, bar.position.y + bar.height + half);
    includeText(bar.label, bar.position.x + bar.length / 2, bar.position.y + bar.height + 5,
      { fontSize: bar.fontSize * 4 / 3, fontFamily: bar.fontFamily, align: "center", baseline: "top" });
  }
  if (chrome?.colourBar.visible) {
    const bar = chrome.colourBar;
    include(bar.position.x - 0.5, bar.position.y - 0.5);
    include(bar.position.x + bar.width + 0.5, bar.position.y + bar.height + 0.5);
    const font = { fontSize: bar.fontSize * 4 / 3, fontFamily: bar.fontFamily, baseline: "top" };
    const y = bar.position.y + bar.height + 5;
    includeText(bar.label, bar.position.x + bar.width / 2, y, { ...font, align: "center" });
    includeText(bar.startLabel, bar.position.x, y, font);
    includeText(bar.endLabel, bar.position.x + bar.width, y, { ...font, align: "right" });
  }
  return bounds;
}

function clusterLabelHit(context, scene, point, config) {
  for (const cluster of [...scene.clusters.values()].reverse()) {
    const anchorX = cluster.x + cluster.info.x;
    const nameFont = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
    const locusFont = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
    context.save();
    context.font = nameFont;
    const nameWidth = context.measureText(cluster.source.name || "").width;
    context.font = locusFont;
    const locusWidth = context.measureText(cluster.info.locusText).width;
    context.restore();
    const width = Math.max(nameWidth, locusWidth);
    if (
      point.x >= anchorX - width &&
      point.x <= anchorX &&
      point.y >= cluster.y - config.cluster.nameFontSize &&
      point.y <= cluster.y + config.cluster.lociFontSize + 12
    ) {
      return { action: "move-cluster", clusterUid: cluster.source.uid };
    }
  }
  return null;
}

function chromeHit(context, scene, point) {
  const chrome = scene.chrome;
  if (!chrome) return null;

  const { legend, scaleBar } = chrome;
  if (legend.visible) {
    context.save();
    context.font = `${legend.fontSize}px ${legend.fontFamily}`;
    const subtitleFontSize = legend.subtitleFontSize || Math.max(10, Math.round(legend.fontSize * 0.72));
    for (const item of [...legend.items].reverse()) {
      const x = legend.position.x + item.x;
      const y = legend.position.y + item.y;
      const circleX = x;
      const circleY = y + item.circleY;
      if (Math.hypot(point.x - circleX, point.y - circleY) <= item.radius) {
        context.restore();
        return { action: "legend-colour", group: item.source };
      }
      const textX = x + item.textX;
      const labelWidth = context.measureText(item.label).width;
      context.font = `${subtitleFontSize}px ${legend.fontFamily}`;
      const subtitleWidth = item.subtitle ? context.measureText(item.subtitle).width : 0;
      context.font = `${legend.fontSize}px ${legend.fontFamily}`;
      const textWidth = Math.max(labelWidth, subtitleWidth);
      if (
        point.x >= textX &&
        point.x <= textX + textWidth &&
        point.y >= y + item.textY - legend.fontSize / 2 &&
        point.y <= y + (item.subtitleY ?? item.textY) + subtitleFontSize / 2
      ) {
        context.restore();
        return { action: "legend-text", group: item.source };
      }
    }
    context.restore();
  }

  if (scaleBar.visible) {
    const x = scaleBar.position.x + scaleBar.length / 2;
    const y = scaleBar.position.y + scaleBar.height + 5;
    context.save();
    context.font = `${scaleBar.fontSize}px ${scaleBar.fontFamily}`;
    const width = context.measureText(scaleBar.label).width;
    context.restore();
    if (
      point.x >= x - width / 2 &&
      point.x <= x + width / 2 &&
      point.y >= y &&
      point.y <= y + scaleBar.fontSize
    ) {
      return { action: "scale-bar" };
    }
  }

  return null;
}

export function hitTestCanvas({ canvas, scene, camera, config, event, tree = null, treeDragging = false }) {
  const point = canvasWorldPoint(canvas, event, camera);
  const context = canvas.getContext("2d");
  return hitTest(scene, point) || treeNodeHit(context, scene, point, config, tree, treeDragging) || clusterLabelHit(context, scene, point, config) || chromeHit(context, scene, point);
}

function treeNodeHit(context, scene, point, config, tree, dragging = false) {
  return hitTestTreeNode(layoutCanvasTree(context, tree, scene, config, { dragging }), point);
}

function drawTree(context, tree, scene, config, preview, motion) {
  const layout = layoutCanvasTree(context, tree, scene, config, {
    preview,
    previousTree: motion.previousTree,
    previousScene: motion.previousScene,
    targetScene: motion.targetScene || scene,
    trackAnchor: motion.trackAnchor,
  });
  drawCanvasTree(context, interpolateTreeLayout(layout, motion.progress));
}

function polygon(context, points) {
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
  }
  context.closePath();
}

function drawLinkLabel(context, layout, source, config, anchors, geometry = {}) {
  if (!config.link.label.show || !(geometry.labelPosition || layout.labelPosition)) return;
  let [ax1, ax2, ay, bx1, bx2, by] = anchors;
  ax1 += geometry.a || 0;
  ax2 += geometry.a || 0;
  bx1 += geometry.b || 0;
  bx2 += geometry.b || 0;
  const aMid = (ax1 + ax2) / 2;
  const bMid = (bx1 + bx2) / 2;
  const labelPosition = geometry.labelPosition || {
    x: aMid + (bMid - aMid) * config.link.label.position,
    y: ay + Math.abs(by - ay) * config.link.label.position,
  };
  context.fillStyle = "white";
  context.font = `${config.link.label.fontSize}px ${config.plot.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(source.label ?? source.identity.toFixed(2), labelPosition.x, labelPosition.y);
}

function drawLink(context, layout, source, config, scales, geometry, showLabel) {
  const visible = geometry.visible ?? layout.visible;
  const anchors = geometry.anchors ?? layout.anchors;
  if (!visible || !anchors) return;
  context.save();
  context.globalAlpha *= layout.opacity ?? 1;
  let [ax1, ax2, ay, bx1, bx2, by] = anchors;
  ax1 += geometry.a || 0;
  ax2 += geometry.a || 0;
  bx1 += geometry.b || 0;
  bx2 += geometry.b || 0;
  const group = scales.group(source.query.uid);
  const colour = source.colour || scales.colour(group);
  const score = scales.score(source.identity);

  context.beginPath();
  const adjustedAnchors = [ax1, ax2, ay, bx1, bx2, by];
  traceLinkPath(context, adjustedAnchors, config.link);
  if (config.link.asLine) {
    context.strokeStyle = source.colour || (config.link.groupColour ? rgbaToRgb(colour) : score);
  } else {
    context.fillStyle = source.colour || (config.link.groupColour ? rgbaToRgb(colour) : score);
    context.fill();
    context.strokeStyle = source.colour || (config.link.groupColour ? colour : config.figureStyle.outline);
  }
  context.lineWidth = config.link.strokeWidth;
  context.stroke();

  if (showLabel) drawLinkLabel(context, layout, source, config, anchors, geometry);
  context.restore();
}

function drawLinkHighlight(context, layout, source, config, geometry = {}) {
  const visible = geometry.visible ?? layout.visible;
  const anchors = geometry.anchors ?? layout.anchors;
  if (!visible || !anchors) return;
  let [ax1, ax2, ay, bx1, bx2, by] = anchors;
  ax1 += geometry.a || 0;
  ax2 += geometry.a || 0;
  bx1 += geometry.b || 0;
  bx2 += geometry.b || 0;
  context.beginPath();
  traceLinkPath(context, [ax1, ax2, ay, bx1, bx2, by], config.link);
  if (config.link.asLine) {
  } else {
    context.fillStyle = "rgba(22, 119, 255, 0.18)";
    context.fill();
  }
  context.strokeStyle = "#1677ff";
  context.lineWidth = Math.max(2, config.link.strokeWidth + 1);
  context.stroke();
}

function drawClusterInfo(
  context,
  cluster,
  config,
  { x: offsetX = 0, y: offsetY = 0, locusText = cluster.info.locusText } = {}
) {
  const { x, y } = cluster;
  const anchorX = x + cluster.info.x + offsetX;
  context.fillStyle = config.figureStyle?.foreground || "black";
  context.textAlign = "end";
  context.font = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "alphabetic";
  context.fillText(cluster.source.name, anchorX, y + offsetY + 8);
  context.font = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "top";
  context.fillText(locusText, anchorX, y + offsetY + 12);
}

function drawGene(
  context,
  gene,
  config,
  scales,
  { x: offsetX = 0, y: offsetY = 0 } = {},
  visible = gene.visible,
  geometry = {},
  showLabel = true
) {
  if (!visible) return;
  context.save();
  context.translate(offsetX, offsetY);
  if (geometry.flipAxis !== undefined) {
    // A flip preview is a uniform affine transform about the locus axis:
    // x' = axis + (x - axis) * (1 - 2p). Applying it to the context avoids
    // allocating a reflected polygon for every gene on every animation frame.
    context.save();
    context.translate(geometry.flipAxis, 0);
    context.scale(geometry.flipScale, 1);
    context.translate(-geometry.flipAxis, 0);
    polygon(context, gene.polygon);
  } else {
    polygon(context, gene.polygon);
  }
  const group = scales.group(gene.source.uid);
  context.fillStyle = gene.source.colour || scales.colour(group);
  context.strokeStyle = config.gene.shape.stroke;
  context.lineWidth = config.gene.shape.strokeWidth;
  context.fill();
  context.stroke();
  if (geometry.flipAxis !== undefined) context.restore();

  if (showLabel) drawGeneLabel(context, gene, config, geometry);
  context.restore();
}

function drawGeneLabel(context, gene, config, geometry = {}, { x: offsetX = 0, y: offsetY = 0 } = {}) {
  if (!config.gene.label.show) return;
  const { x, y, rotation } = gene.label;
  const labelX = (geometry.labelX ?? gene.locus.x + x) + offsetX;
  context.save();
  context.translate(labelX, gene.locus.y + y + offsetY);
  context.rotate((rotation * Math.PI) / 180);
  context.fillStyle = config.figureStyle?.foreground || "black";
  context.font = `${config.gene.label.fontSize}px ${config.plot.fontFamily}`;
  context.textAlign = config.gene.label.anchor === "middle" ? "center" : config.gene.label.anchor;
  context.textBaseline = "alphabetic";
  context.fillText(gene.source.label || gene.source.name || gene.source.uid, 0, 0);
  context.restore();
}

function drawGeneHighlight(context, gene, camera, geometry = {}, { x: offsetX = 0, y: offsetY = 0 } = {}) {
  context.save();
  context.translate(offsetX, offsetY);
  if (geometry.flipAxis !== undefined) {
    context.translate(geometry.flipAxis, 0);
    context.scale(geometry.flipScale, 1);
    context.translate(-geometry.flipAxis, 0);
  }
  polygon(context, gene.polygon);
  context.fillStyle = "rgba(22, 119, 255, 0.18)";
  context.fill();
  // Keep the editor-selection ring readable at every zoom level.
  context.strokeStyle = "#1677ff";
  context.lineWidth = 2.5 / camera.k;
  context.stroke();
  context.restore();
}

function drawLocusHighlight(context, locus, camera, geometry = {}) {
  const hover = geometry.hover || locus.hover;
  const offsets = geometry.offsets || {};
  const x = locus.x + hover.x + (offsets.x || 0);
  const y = locus.y + hover.y + (offsets.y || 0);
  context.save();
  context.fillStyle = "rgba(22, 119, 255, 0.12)";
  context.fillRect(x, y, hover.width, hover.height);
  context.strokeStyle = "#1677ff";
  context.lineWidth = 2 / camera.k;
  context.strokeRect(x, y, hover.width, hover.height);
  context.restore();
}

function drawLocusHover(context, scene, locusUid, geometry = {}, foreground = "black") {
  if (!locusUid) return;
  const locus = scene.loci.get(locusUid);
  if (!locus) return;

  geometry ||= {};
  const hover = geometry.hover || locus.hover;
  const offsets = geometry.offsets || {};
  const x = locus.x + hover.x + (offsets.x || 0);
  const y = locus.y + hover.y + (offsets.y || 0);
  context.fillStyle = "rgba(0, 0, 0, 0.4)";
  context.fillRect(x, y, hover.width, hover.height);
  context.fillStyle = foreground;
  context.fillRect(locus.x + hover.leftHandleX + (offsets?.x || 0), y, 8, hover.height);
  context.fillRect(locus.x + hover.rightHandleX + (offsets?.x || 0), y, 8, hover.height);
}

function drawLocusTrack(context, locus, viewport, config, geometry = {}) {
  const { x: offsetX = 0, y: offsetY = 0 } = geometry.offsets || geometry;
  const track = geometry.track || locus.track;
  // Compact test scenes and third-party scene consumers may only provide the
  // physical locus extent. Production scenes retain oriented track endpoints.
  const worldStart =
    track.x1 === undefined ? geometry.worldStart ?? locus.worldStart + offsetX : locus.x + track.x1 + offsetX;
  const worldEnd =
    track.x2 === undefined ? geometry.worldEnd ?? locus.worldEnd + offsetX : locus.x + track.x2 + offsetX;
  const start = viewport ? Math.max(Math.min(worldStart, worldEnd), viewport.minX) : worldStart;
  const end = viewport ? Math.min(Math.max(worldStart, worldEnd), viewport.maxX) : worldEnd;
  if (end < start) return;
  context.beginPath();
  context.moveTo(start, locus.y + track.y + offsetY);
  context.lineTo(end, locus.y + track.y + offsetY);
  context.strokeStyle = config.locus.trackBar.colour;
  context.lineWidth = config.locus.trackBar.stroke;
  context.stroke();
}

function drawLocusTrimIndicators(context, locus, config, geometry = {}) {
  if (config.locus.trimIndicators?.show === false) return;
  const { fontSize, fontWeight, borderWidth, borderOpacity } = resolveTrimIndicatorStyle(
    config.locus.trimIndicators
  );
  const indicators = geometry.trimIndicators || locus.trimIndicators || [];
  if (!indicators.length) return;
  const { x: offsetX = 0, y: offsetY = 0 } = geometry.offsets || geometry;
  context.save();
  context.fillStyle = "#536b88";
  context.strokeStyle = `rgba(255, 255, 255, ${borderOpacity})`;
  context.lineWidth = borderWidth;
  context.lineJoin = "round";
  context.font = `${fontWeight} ${fontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "top";
  for (const indicator of indicators) {
    context.textAlign = indicator.anchor;
    context.strokeText(indicator.text, locus.x + indicator.x + offsetX, locus.y + indicator.y + offsetY);
    context.fillText(indicator.text, locus.x + indicator.x + offsetX, locus.y + indicator.y + offsetY);
  }
  context.restore();
}

function recordsForClusterPreview(
  scene,
  preview,
  viewport,
  { includeLinks = true, includeGenes = true } = {}
) {
  const { clusters, pairs } = clusterPreviewInViewport(scene, preview, viewport, { includeLinks });

  const loci = [];
  const genes = [];
  for (const cluster of clusters) {
    for (const locus of cluster.loci) {
      const offsets = previewOffsetsForLocus(preview, locus);
      if (!boundsInViewport(locus.bounds, viewport, offsets)) continue;
      loci.push(locus);
      if (!includeGenes) continue;
      const locusGenes =
        locus.genes ||
        [...scene.genes.values()].filter((gene) => gene.locus.source?.uid === locus.source.uid);
      for (const gene of locusGenes) {
        if (
          geneVisibleForPreview(preview, gene) &&
          boundsInViewport(gene.bounds, viewport, offsetsForGene(preview, gene))
        ) {
          genes.push(gene);
        }
      }
    }
  }

  const linkUids = new Set();
  for (const pair of pairs) {
    for (const uid of scene.linksByClusterPair?.get(pair) || []) linkUids.add(uid);
  }
  const links = [...linkUids]
    .map((uid) => scene.links.get(uid))
    .filter(Boolean)
    .sort((left, right) => left.order - right.order);

  return { clusters, loci, genes, links };
}

function drawLegend(context, legend) {
  if (!legend.visible) return;
  context.save();
  context.translate(legend.position.x, legend.position.y);
  context.font = `${legend.fontSize}px ${legend.fontFamily}`;
  const subtitleFontSize = legend.subtitleFontSize || Math.max(10, Math.round(legend.fontSize * 0.72));
  context.textAlign = "start";
  context.textBaseline = "middle";
  for (const item of legend.items) {
    context.beginPath();
    context.arc(item.x, item.y + item.circleY, item.radius, 0, 2 * Math.PI);
    context.fillStyle = item.colour;
    context.fill();
    context.fillStyle = legend.textColour || "black";
    context.fillText(item.label, item.x + item.textX, item.y + item.textY);
    if (item.subtitle) {
      context.fillStyle = legend.subtitleColour || "#566273";
      context.font = `${subtitleFontSize}px ${legend.fontFamily}`;
      context.fillText(item.subtitle, item.x + item.textX, item.y + item.subtitleY);
      context.font = `${legend.fontSize}px ${legend.fontFamily}`;
    }
  }
  context.restore();
}

function drawScaleBar(context, scaleBar) {
  if (!scaleBar.visible) return;
  const { x, y } = scaleBar.position;
  context.save();
  context.translate(x, y);
  context.strokeStyle = scaleBar.colour;
  context.lineWidth = scaleBar.strokeWidth;
  context.beginPath();
  context.moveTo(0, scaleBar.middle);
  context.lineTo(scaleBar.length, scaleBar.middle);
  context.moveTo(0, 0);
  context.lineTo(0, scaleBar.height);
  context.moveTo(scaleBar.length, 0);
  context.lineTo(scaleBar.length, scaleBar.height);
  context.stroke();
  context.fillStyle = scaleBar.textColour || "black";
  context.font = `${scaleBar.fontSize}px ${scaleBar.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(scaleBar.label, scaleBar.length / 2, scaleBar.height + 5);
  context.restore();
}

function drawColourBar(context, colourBar) {
  if (!colourBar.visible) return;
  const { x, y } = colourBar.position;
  context.save();
  context.translate(x, y);
  const gradient = context.createLinearGradient(0, 0, colourBar.width, 0);
  gradient.addColorStop(0, colourBar.startColour);
  gradient.addColorStop(1, colourBar.endColour);
  context.fillStyle = gradient;
  context.fillRect(0, 0, colourBar.width, colourBar.height);
  context.strokeStyle = colourBar.textColour || "black";
  context.lineWidth = 1;
  context.strokeRect(0, 0, colourBar.width, colourBar.height);
  context.fillStyle = colourBar.textColour || "black";
  context.font = `${colourBar.fontSize}px ${colourBar.fontFamily}`;
  context.textBaseline = "top";
  context.textAlign = "center";
  context.fillText(colourBar.label, colourBar.width / 2, colourBar.height + 5);
  context.textAlign = "start";
  context.fillText(colourBar.startLabel, 0, colourBar.height + 5);
  context.textAlign = "end";
  context.fillText(colourBar.endLabel, colourBar.width, colourBar.height + 5);
  context.restore();
}

const interpolateNumber = (from, to, amount) => from + (to - from) * amount;

function interpolatePosition(from, to, amount) {
  if (!from || !to) return to;
  return {
    ...to,
    x: interpolateNumber(from.x, to.x, amount),
    y: interpolateNumber(from.y, to.y, amount),
  };
}

function interpolateArray(from, to, amount) {
  if (!from || !to || from.length !== to.length) return to;
  return to.map((value, index) => interpolateNumber(from[index], value, amount));
}

function interpolateLocus(from, to, amount) {
  if (!from) return to;
  const trackX = (locus, side) =>
    locus.track[side] ??
    locus[side === "x1" ? "worldStart" : "worldEnd"] - locus.x;
  return {
    ...to,
    x: interpolateNumber(from.x, to.x, amount),
    y: interpolateNumber(from.y, to.y, amount),
    worldStart: interpolateNumber(from.worldStart, to.worldStart, amount),
    worldEnd: interpolateNumber(from.worldEnd, to.worldEnd, amount),
    transform: interpolatePosition(from.transform, to.transform, amount),
    track: {
      ...to.track,
      x1: interpolateNumber(trackX(from, "x1"), trackX(to, "x1"), amount),
      x2: interpolateNumber(trackX(from, "x2"), trackX(to, "x2"), amount),
      y: interpolateNumber(from.track.y, to.track.y, amount),
    },
    hover: from.hover && to.hover
      ? {
          ...to.hover,
          x: interpolateNumber(from.hover.x, to.hover.x, amount),
          y: interpolateNumber(from.hover.y, to.hover.y, amount),
          width: interpolateNumber(from.hover.width, to.hover.width, amount),
          height: interpolateNumber(from.hover.height, to.hover.height, amount),
          leftHandleX: interpolateNumber(from.hover.leftHandleX, to.hover.leftHandleX, amount),
          rightHandleX: interpolateNumber(from.hover.rightHandleX, to.hover.rightHandleX, amount),
        }
      : to.hover,
  };
}

/**
 * Interpolate compatible scene geometry for Canvas animation. Sources,
 * hit-regions, and semantic state remain those of the target scene; only the
 * pixels in flight are interpolated.
 */
export function interpolateCanvasScene(previous, scene, amount) {
  if (!previous || amount >= 1) return scene;
  const loci = new Map();
  for (const [uid, locus] of scene.loci) {
    loci.set(uid, interpolateLocus(previous.loci.get(uid), locus, amount));
  }

  const clusters = new Map();
  for (const [uid, cluster] of scene.clusters) {
    const prior = previous.clusters.get(uid);
    clusters.set(uid, {
      ...cluster,
      x: prior ? interpolateNumber(prior.x, cluster.x, amount) : cluster.x,
      y: prior ? interpolateNumber(prior.y, cluster.y, amount) : cluster.y,
      info: interpolatePosition(prior?.info, cluster.info, amount),
      loci: cluster.loci.map((locus) => loci.get(locus.source.uid)),
    });
  }

  const genes = new Map();
  for (const [uid, gene] of scene.genes) {
    const prior = previous.genes.get(uid);
    genes.set(uid, {
      ...gene,
      polygon: interpolateArray(prior?.polygon, gene.polygon, amount),
      locus: interpolatePosition(prior?.locus, gene.locus, amount),
      label: {
        ...gene.label,
        x: interpolateNumber(prior?.label?.x ?? gene.label.x, gene.label.x, amount),
        y: interpolateNumber(prior?.label?.y ?? gene.label.y, gene.label.y, amount),
        rotation: interpolateNumber(
          prior?.label?.rotation ?? gene.label.rotation,
          gene.label.rotation,
          amount
        ),
      },
    });
  }

  const links = new Map();
  for (const [uid, link] of scene.links) {
    const prior = previous.links.get(uid);
    const opacity = interpolateLinkOpacity(prior, link, amount);
    const anchors = interpolateLinkAnchors(previous, prior, scene, link, amount);
    links.set(uid, {
      ...link,
      // Retained scene link anchors are normalized upper-to-lower. During a
      // row swap that reverses which endpoint is upper, so interpolate in
      // stable query/target order to keep each end attached to its gene.
      anchors,
      labelPosition: interpolatePosition(prior?.labelPosition, link.labelPosition, amount),
      opacity,
      visible: opacity > 0 && Boolean(prior?.visible || link.visible),
    });
  }

  const priorPanels = new Map((previous.annotationPanels || []).map((panel) => [panel.uid, panel]));
  const annotationPanels = (scene.annotationPanels || []).map((panel) => ({ ...panel,
    x: interpolateNumber(priorPanels.get(panel.uid)?.x ?? panel.x, panel.x, amount) }));
  return { ...scene, clusters, loci, genes, links, annotationPanels };
}

export const CANVAS_LAYERS = ["links", "linkLabels", "tracks", "trimIndicators", "genes", "geneLabels", "clusterLabels", "tree", "annotations", "annotationLabels", "chrome"];

/** Draw selected layers of a renderer-neutral scene into Canvas 2D. */
export function renderCanvas({
  canvas,
  scene,
  tree = null,
  previousScene = null,
  previousTree = null,
  previousTreeScene = null,
  treeTargetScene = null,
  treeProgress = 1,
  treeTrackAnchor = true,
  progress = 1,
  camera,
  config,
  scales,
  hoverLocusUid = null,
  suppressLocusHover = false,
  pixelRatio: requestedPixelRatio = globalThis.devicePixelRatio || 1,
  dimensions = null,
  fullScene = false,
  preview = null,
  clear = true,
  include = null,
  omit = null,
  layers = CANVAS_LAYERS,
  highlightGeneIds = null,
  highlightLinkIds = null,
  highlightLocusIds = null,
}) {
  config = figureConfig(config);
  const show = (layer) => layers.includes(layer);
  const showLinks = show("links"), showGenes = show("genes");
  const showLoci = show("trimIndicators") || show("tracks");
  const showGeneLabels = show("geneLabels") && config.gene.label.show;
  const showLinkLabels = show("linkLabels") && config.link.label.show;
  const displayScene = interpolateCanvasScene(previousScene, scene, progress);
  const context = canvas.getContext("2d");
  const bounds = dimensions || canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  const pixelRatio = requestedPixelRatio;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (clear) {
    context.clearRect(0, 0, width, height);
  }
  context.save();
  context.translate(camera.x, camera.y);
  context.scale(camera.k, camera.k);

  // During an animation, geometry is between the previous and target scenes,
  // while the index describes only the target scene. Draw the full frame then
  // so an in-flight record cannot be incorrectly culled.
  const viewport = previousScene || fullScene
    ? null
    : canvasWorldViewport(canvas, camera, 20, dimensions);
  const clusterPreview = preview?.type === "cluster-drag";
  const visible = !clusterPreview && viewport && displayScene.index
    ? {
        links: (showLinks || showLinkLabels) ? queryViewportOrdered(displayScene.index.links, viewport) : null,
        loci: showLoci ? queryViewportOrdered(displayScene.index.loci, viewport) : null,
        genes: (showGenes || showGeneLabels) ? queryViewportOrdered(displayScene.index.genes, viewport) : null,
      }
    : null;

  const recordsFor = (records, ids, type, { ignoreOmit = false } = {}) => {
    const included = include?.[type];
    const omitted = ignoreOmit ? null : omit?.[type];
    const recordIds = ids || [...records.keys()];
    return recordIds
      .filter((uid) => (!included || included.has(uid)) && !omitted?.has(uid))
      .map((uid) => records.get(uid))
      .filter(Boolean);
  };
  const previewRecords = clusterPreview
    ? recordsForClusterPreview(displayScene, preview, viewport, {
        includeLinks: showLinks || showLinkLabels,
        includeGenes: showGenes || showGeneLabels,
      })
    : null;

  for (const link of (showLinks || showLinkLabels)
    ? previewRecords?.links || recordsFor(displayScene.links, visible?.links, "links")
    : []) {
    const geometry = linkGeometryForPreview(displayScene, link, preview, config);
    // Ordinary frames retain anchors on the link layout; only dynamic previews
    // provide replacement anchors in their sparse geometry patch.
    const anchors = geometry.anchors ?? link.anchors;
    if (!geometry.visible || !anchors) continue;
    if (
      clusterPreview &&
      (!boundsInViewport({
        minX: Math.min(anchors[0], anchors[1], anchors[3], anchors[4]),
        maxX: Math.max(anchors[0], anchors[1], anchors[3], anchors[4]),
        minY: Math.min(anchors[2], anchors[5]),
        maxY: Math.max(anchors[2], anchors[5]),
      }, viewport))
    ) {
      continue;
    }
    if (showLinks) drawLink(context, link, link.source, config, scales, geometry, showLinkLabels);
    else drawLinkLabel(context, link, link.source, config, anchors, geometry);
  }
  if (show("tree")) drawTree(context, tree, displayScene, config, preview, {
    trackAnchor: treeTrackAnchor,
    previousTree,
    previousScene: previousTreeScene,
    targetScene: treeTargetScene || scene,
    progress: treeProgress,
  });
  if (highlightLinkIds?.size) {
    for (const uid of highlightLinkIds) {
      if (visible?.links && !visible.links.includes(uid)) continue;
      const link = displayScene.links.get(uid);
      if (!link) continue;
      drawLinkHighlight(context, link, link.source, config, linkGeometryForPreview(displayScene, link, preview));
    }
  }
  const loci = showLoci
    ? previewRecords?.loci || recordsFor(displayScene.loci, visible?.loci, "loci")
    : [];
  // Labels are the only immediate indication that a very large, initially
  // cropped figure rendered at all. Do not derive them from culled loci: a
  // cluster label can be on screen while every locus body is just outside the
  // viewport. Text is inexpensive and Canvas clips truly offscreen labels.
  const labelClusters = show("clusterLabels")
    ? recordsFor(displayScene.clusters, null, "clusters", { ignoreOmit: true })
    : [];
  for (const cluster of labelClusters) {
    drawClusterInfo(context, cluster, config, {
      x: clusterLabelOffsetForPreview(preview, cluster.source.uid),
      y: clusterOffsetForPreview(preview, cluster.source.uid),
      locusText: clusterLabelTextForPreview(
        preview,
        cluster.source.uid,
        cluster.info.locusText
      ),
    });
  }
  if (show("tracks")) {
    for (const locus of loci) {
      drawLocusTrack(
        context,
        locus,
        viewport,
        config,
        locusGeometryForPreview(preview, locus)
      );
    }
  }
  if (show("trimIndicators")) {
    for (const locus of loci) {
      drawLocusTrimIndicators(
        context,
        locus,
        config,
        locusGeometryForPreview(preview, locus)
      );
    }
  }
  if (highlightLocusIds?.size) {
    for (const uid of highlightLocusIds) {
      if (visible?.loci && !visible.loci.includes(uid)) continue;
      const locus = displayScene.loci.get(uid);
      if (locus) drawLocusHighlight(context, locus, camera, locusGeometryForPreview(preview, locus));
    }
  }
  if (!suppressLocusHover) {
    const hoveredLocus = hoverLocusUid ? displayScene.loci.get(hoverLocusUid) : null;
    drawLocusHover(
      context,
      displayScene,
      hoverLocusUid,
      hoveredLocus ? locusGeometryForPreview(preview, hoveredLocus) : null,
      config.figureStyle.foreground
    );
  }
  for (const gene of (showGenes || showGeneLabels)
    ? previewRecords?.genes || recordsFor(displayScene.genes, visible?.genes, "genes")
    : []) {
    const offsets = offsetsForGene(preview, gene);
    const visible = geneVisibleForPreview(preview, gene);
    const geometry = geneGeometryForPreview(preview, gene);
    if (showGenes) drawGene(context, gene, config, scales, offsets, visible, geometry, showGeneLabels);
    else if (visible) drawGeneLabel(context, gene, config, geometry, offsets);
  }
  if (highlightGeneIds?.size) {
    for (const uid of highlightGeneIds) {
      if (visible?.genes && !visible.genes.includes(uid)) continue;
      const gene = displayScene.genes.get(uid);
      if (!gene || !geneVisibleForPreview(preview, gene)) continue;
      drawGeneHighlight(
        context,
        gene,
        camera,
        geneGeometryForPreview(preview, gene),
        offsetsForGene(preview, gene)
      );
    }
  }
  if (show("annotations") || show("annotationLabels")) drawCanvasAnnotations(context, displayScene, preview, {
    showGeometry: show("annotations"), showLabels: show("annotationLabels"), viewport,
  });
  if (show("chrome") && displayScene.chrome) {
    const chrome = preview?.chrome || displayScene.chrome;
    drawLegend(context, chrome.legend);
    drawScaleBar(context, chrome.scaleBar);
    drawColourBar(context, chrome.colourBar);
  }
  context.restore();
  return { width, height, pixelRatio };
}
