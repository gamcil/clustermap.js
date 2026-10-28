import { measureCanvasText, measureTreeLayout } from "../scene/measure.mjs";
import { clusterLabelLayout } from "../scene/clusterLabels.mjs";
import { linkColours } from "../links/style.mjs";
import { hitTest } from "../scene/hitTest.mjs";
import { boundsInViewport, worldViewport, worldPoint } from "../scene/camera.mjs";
import { figureConfig } from "../ui/theme.mjs";
import { sceneRecordsInViewport } from "../scene/viewport.mjs";
import {
  interpolateScene,
  clusterPreviewInViewport,
  geneGeometryForPreview,
  linkGeometryForPreview,
  clusterLabelOffsetForPreview,
  clusterLabelTextForPreview,
  clusterOffsetForPreview,
  geneVisibleForPreview,
  locusGeometryForPreview,
  previewOffsetsForLocus,
} from "../scene/preview.mjs";
import { traceLinkPath, getLinkLabelPosition } from "../links/layout.mjs";
import { hitTestTreeNode, interpolateTreeLayout } from "../tree/layout.mjs";
import { drawCanvasTree } from "../tree/canvas.mjs";
import { resolveTrimIndicatorStyle } from "../loci/trimIndicators.mjs";
import { drawCanvasAnnotations } from "../annotations/render.mjs";

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

/**
 * Return the portion of chart-world space covered by a Canvas. A small
 * screen-space margin prevents records from popping at its edge while panning.
 */
export function canvasWorldViewport(canvas, camera, overscan = 20, dimensions = null) {
  return worldViewport(camera, dimensions || canvas.getBoundingClientRect(), overscan);
}

function clusterLabelHit(context, scene, point, config) {
  const label = clusterLabelLayout(config);
  for (const cluster of [...scene.clusters.values()].reverse()) {
    const anchorX = cluster.x + cluster.info.x;
    const nameFont = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
    const locusFont = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
    const nameWidth = measureCanvasText(context, scene, cluster.source.name || "", { font: nameFont, align: "left", baseline: "alphabetic" }).width;
    const locusWidth = measureCanvasText(context, scene, cluster.info.locusText, { font: locusFont, align: "left", baseline: "alphabetic" }).width;
    const width = Math.max(nameWidth, locusWidth);
    if (
      point.x >= anchorX - width &&
      point.x <= anchorX &&
      point.y >= cluster.y + label.top &&
      point.y <= cluster.y + label.bottom
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
      const labelWidth = measureCanvasText(context, scene, item.label).width;
      context.font = `${subtitleFontSize}px ${legend.fontFamily}`;
      const subtitleWidth = item.subtitle ? measureCanvasText(context, scene, item.subtitle).width : 0;
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
    const width = measureCanvasText(context, scene, scaleBar.label).width;
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
  const point = worldPoint(canvas, event, camera);
  const context = canvas.getContext("2d");
  return hitTest(scene, point) || treeNodeHit(context, scene, point, config, tree, treeDragging) || clusterLabelHit(context, scene, point, config) || chromeHit(context, scene, point);
}

function treeNodeHit(context, scene, point, config, tree, dragging = false) {
  return hitTestTreeNode(measureTreeLayout(context, tree, scene, config, { dragging }), point);
}

function drawTree(context, tree, scene, config, preview, motion) {
  const layout = measureTreeLayout(context, tree, scene, config, {
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

function drawLinkLabel(context, link, config, anchors) {
  if (!config.link.label.show || !link.labelPosition) return;
  const labelPosition = getLinkLabelPosition(anchors, config.link.label.position);
  context.fillStyle = "white";
  context.font = `${config.link.label.fontSize}px ${config.plot.fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(link.source.label ?? link.source.identity.toFixed(2), labelPosition.x, labelPosition.y);
}

function drawLink(context, link, config, scales, { visible, anchors }, showLabel) {
  if (!visible || !anchors) return;
  context.save();
  context.globalAlpha *= link.opacity ?? 1;
  const { fill, stroke } = linkColours(link.source, scales, config);
  context.beginPath();
  traceLinkPath(context, anchors, config.link);
  if (!config.link.asLine) {
    context.fillStyle = fill;
    context.fill();
  }
  context.strokeStyle = stroke;
  context.lineWidth = config.link.strokeWidth;
  context.stroke();

  if (showLabel) drawLinkLabel(context, link, config, anchors);
  context.restore();
}

function drawLinkHighlight(context, config, { visible, anchors }) {
  if (!visible || !anchors) return;
  context.beginPath();
  traceLinkPath(context, anchors, config.link);
  if (!config.link.asLine) {
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
  { x: offsetX = 0, y: offsetY = 0, locusText = cluster.info.locusText, selected = false } = {}
) {
  const { x, y } = cluster;
  const anchorX = x + cluster.info.x + offsetX;
  const label = clusterLabelLayout(config);
  context.fillStyle = selected ? "#1677ff" : config.figureStyle?.foreground || "black";
  context.textAlign = "end";
  context.font = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = label.nameBaseline;
  context.fillText(cluster.source.name, anchorX, y + offsetY + label.nameY);
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
          boundsInViewport(gene.bounds, viewport, previewOffsetsForLocus(preview, gene.locus))
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

const trimIndicatorPresence = new WeakMap();
function hasTrimIndicators(loci) {
  if (!trimIndicatorPresence.has(loci)) {
    trimIndicatorPresence.set(loci, [...loci.values()].some((locus) => locus.trimIndicators?.length));
  }
  return trimIndicatorPresence.get(loci);
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
  highlightClusterIds = null,
}) {
  config = figureConfig(config);
  const show = (layer) => layers.includes(layer);
  const showLinks = show("links") && config.link.show !== false, showGenes = show("genes");
  const displayScene = interpolateScene(previousScene, scene, progress);
  const showTrimIndicators = show("trimIndicators") && config.locus.trimIndicators?.show !== false &&
    (preview?.type === "locus-trim" || hasTrimIndicators(displayScene.loci));
  const showLoci = showTrimIndicators || show("tracks");
  const showGeneLabels = show("geneLabels") && config.gene.label.show;
  const showLinkLabels = show("linkLabels") && config.link.show !== false && config.link.label.show;
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

  // Animation and locus previews move geometry away from indexed bounds.
  // Use all candidates then; cluster drags have a preview-aware query below.
  const viewport = previousScene || fullScene
    ? null
    : canvasWorldViewport(canvas, camera, 20, dimensions);
  const clusterPreview = preview?.type === "cluster-drag";
  const visible = !preview && viewport && displayScene.index
    ? sceneRecordsInViewport(displayScene, viewport, {
        links: showLinks || showLinkLabels,
        loci: showLoci,
        genes: showGenes || showGeneLabels,
      })
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
    const anchors = geometry.anchors;
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
    if (showLinks) drawLink(context, link, config, scales, geometry, showLinkLabels);
    else drawLinkLabel(context, link, config, anchors);
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
      drawLinkHighlight(context, config, linkGeometryForPreview(displayScene, link, preview, config));
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
      selected: highlightClusterIds?.has(cluster.source.uid),
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
  if (showTrimIndicators) {
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
    const offsets = previewOffsetsForLocus(preview, gene.locus);
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
        previewOffsetsForLocus(preview, gene.locus)
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
