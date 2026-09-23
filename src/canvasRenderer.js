import { rgbaToRgb } from "./utils.js";
import { hitTest } from "./hitTest.mjs";
import { queryViewportOrdered } from "./spatialIndex.mjs";

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
export function canvasWorldViewport(canvas, camera, overscan = 20) {
  const bounds = canvas.getBoundingClientRect();
  const margin = overscan / camera.k;
  return {
    minX: -camera.x / camera.k - margin,
    maxX: (bounds.width - camera.x) / camera.k + margin,
    minY: -camera.y / camera.k - margin,
    maxY: (bounds.height - camera.y) / camera.k + margin,
  };
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
      const textWidth = context.measureText(item.label).width;
      if (
        point.x >= textX &&
        point.x <= textX + textWidth &&
        point.y >= y + item.textY - legend.fontSize / 2 &&
        point.y <= y + item.textY + legend.fontSize / 2
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

export function hitTestCanvas({ canvas, scene, camera, config, event }) {
  const point = canvasWorldPoint(canvas, event, camera);
  const context = canvas.getContext("2d");
  return hitTest(scene, point) || clusterLabelHit(context, scene, point, config) || chromeHit(context, scene, point);
}

function polygon(context, points) {
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
  }
  context.closePath();
}

function drawLink(context, layout, source, config, scales, geometry = {}) {
  const visible = geometry.visible ?? layout.visible;
  const anchors = geometry.anchors ?? layout.anchors;
  if (!visible || !anchors) return;
  let [ax1, ax2, ay, bx1, bx2, by] = anchors;
  ax1 += geometry.a || 0;
  ax2 += geometry.a || 0;
  bx1 += geometry.b || 0;
  bx2 += geometry.b || 0;
  const aMid = (ax1 + ax2) / 2;
  const bMid = (bx1 + bx2) / 2;
  const group = scales.group(source.query.uid);
  const colour = scales.colour(group);
  const score = scales.score(source.identity);

  context.beginPath();
  if (config.link.asLine) {
    context.moveTo(aMid, ay);
    if (config.link.straight) context.lineTo(bMid, by);
    else {
      const middle = (ay + by) / 2;
      context.bezierCurveTo(aMid, middle, bMid, middle, bMid, by);
    }
    context.strokeStyle = config.link.groupColour ? rgbaToRgb(colour) : score;
  } else {
    context.moveTo(ax2, ay);
    if (config.link.straight) {
      context.lineTo(bx2, by);
      context.lineTo(bx1, by);
      context.lineTo(ax1, ay);
    } else {
      const middle = ay + Math.abs(by - ay) / 2;
      context.bezierCurveTo(ax2, middle, bx2, middle, bx2, by);
      context.lineTo(bx1, by);
      context.bezierCurveTo(bx1, middle, ax1, middle, ax1, ay);
    }
    context.closePath();
    context.fillStyle = config.link.groupColour ? rgbaToRgb(colour) : score;
    context.fill();
    context.strokeStyle = config.link.groupColour ? colour : "black";
  }
  context.lineWidth = config.link.strokeWidth;
  context.stroke();

  if (config.link.label.show && (geometry.labelPosition || layout.labelPosition)) {
    const labelPosition = geometry.labelPosition || {
      x: aMid + (bMid - aMid) * config.link.label.position,
      y: ay + Math.abs(by - ay) * config.link.label.position,
    };
    context.fillStyle = "white";
    context.font = `${config.link.label.fontSize}px ${config.plot.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillText(source.identity.toFixed(2), labelPosition.x, labelPosition.y);
  }
}

function drawClusterInfo(context, cluster, config, { x: offsetX = 0, y: offsetY = 0 } = {}) {
  const { x, y } = cluster;
  const anchorX = x + cluster.info.x + offsetX;
  context.fillStyle = "black";
  context.textAlign = "end";
  context.font = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "alphabetic";
  context.fillText(cluster.source.name, anchorX, y + offsetY + 8);
  context.font = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
  context.textBaseline = "top";
  context.fillText(cluster.info.locusText, anchorX, y + offsetY + 12);
}

function drawGene(
  context,
  gene,
  config,
  scales,
  { x: offsetX = 0, y: offsetY = 0 } = {},
  visible = gene.visible
) {
  if (!visible) return;
  context.save();
  context.translate(offsetX, offsetY);
  polygon(context, gene.polygon);
  const group = scales.group(gene.source.uid);
  context.fillStyle = gene.source.colour || scales.colour(group);
  context.strokeStyle = config.gene.shape.stroke;
  context.lineWidth = config.gene.shape.strokeWidth;
  context.fill();
  context.stroke();

  if (!config.gene.label.show) {
    context.restore();
    return;
  }
  const { x, y, rotation } = gene.label;
  context.save();
  context.translate(gene.locus.x + x, gene.locus.y + y);
  context.rotate((rotation * Math.PI) / 180);
  context.fillStyle = "black";
  context.font = `${config.gene.label.fontSize}px ${config.plot.fontFamily}`;
  context.textAlign = config.gene.label.anchor === "middle" ? "center" : config.gene.label.anchor;
  context.textBaseline = "alphabetic";
  context.fillText(gene.source.label || gene.source.uid, 0, 0);
  context.restore();
  context.restore();
}

function drawLocusHover(context, scene, locusUid, geometry = {}) {
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
  context.fillStyle = "black";
  context.fillRect(locus.x + hover.leftHandleX + (offsets?.x || 0), y, 8, hover.height);
  context.fillRect(locus.x + hover.rightHandleX + (offsets?.x || 0), y, 8, hover.height);
}

function drawLocusTrack(context, locus, viewport, config, geometry = {}) {
  const { x: offsetX = 0, y: offsetY = 0 } = geometry.offsets || geometry;
  const track = geometry.track || locus.track;
  const worldStart = geometry.worldStart ?? locus.worldStart + offsetX;
  const worldEnd = geometry.worldEnd ?? locus.worldEnd + offsetX;
  const start = viewport ? Math.max(worldStart, viewport.minX) : worldStart;
  const end = viewport ? Math.min(worldEnd, viewport.maxX) : worldEnd;
  if (end < start) return;
  context.beginPath();
  context.moveTo(start, locus.y + track.y + offsetY);
  context.lineTo(end, locus.y + track.y + offsetY);
  context.strokeStyle = config.locus.trackBar.colour;
  context.lineWidth = config.locus.trackBar.stroke;
  context.stroke();
}

function locusOffsetForPreview(preview, locusUid) {
  if (preview?.locusOffsets?.has(locusUid)) return preview.locusOffsets.get(locusUid);
  return preview?.type === "locus-offset" && preview.locusUid === locusUid
    ? preview.offsetX
    : 0;
}

function clusterLabelOffsetForPreview(preview, clusterUid) {
  return preview?.clusterLabelOffsets?.get(clusterUid) || 0;
}

function clusterOffsetForPreview(preview, clusterUid) {
  return preview?.clusterOffsets?.get(clusterUid) || 0;
}

function offsetsForLocus(preview, locus) {
  if (!preview || !locus) return { x: 0, y: 0 };
  return {
    x: locusOffsetForPreview(preview, locus.source?.uid),
    y: clusterOffsetForPreview(preview, locus.cluster?.uid ?? locus.source?.clusterUid),
  };
}

function offsetsForGene(preview, gene) {
  return offsetsForLocus(preview, gene.locus);
}

function locusGeometryForPreview(preview, locus) {
  const trimmed = preview?.loci?.get(locus.source.uid);
  return {
    offsets: offsetsForLocus(preview, locus),
    ...(trimmed || {}),
  };
}

function geneVisibleForPreview(preview, gene) {
  return gene && (preview?.geneVisibility?.get(gene.source.uid) ?? gene.visible);
}

function linkOffsetsForPreview(scene, link, preview) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  const offsetForGene = (gene) =>
    locusOffsetForPreview(preview, gene?.locus?.source?.uid ?? gene?.source?.locusUid);
  const queryOffset = offsetForGene(query);
  const targetOffset = offsetForGene(target);
  // Link anchors are ordered from the upper locus to the lower one, not from
  // source.query to source.target.
  return query?.locus?.y <= target?.locus?.y
    ? { a: queryOffset, b: targetOffset }
    : { a: targetOffset, b: queryOffset };
}

function previewLinkAnchors(scene, link, preview) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return null;
  const anchorForGene = (gene) => {
    const offsets = offsetsForGene(preview, gene);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let index = 0; index < gene.polygon.length; index += 2) {
      minX = Math.min(minX, gene.polygon[index] + offsets.x);
      maxX = Math.max(maxX, gene.polygon[index] + offsets.x);
    }
    const forward = gene.display.strand === 1;
    return [
      forward ? minX : maxX,
      forward ? maxX : minX,
      gene.locus.y + gene.locus.track.y + offsets.y,
    ];
  };
  const queryAnchor = anchorForGene(query);
  const targetAnchor = anchorForGene(target);
  return queryAnchor[2] <= targetAnchor[2]
    ? [...queryAnchor, ...targetAnchor]
    : [...targetAnchor, ...queryAnchor];
}

function linkGeometryForPreview(scene, link, preview, config) {
  if (preview?.type !== "cluster-drag") {
    const query = scene.genes.get(link.source.query.uid);
    const target = scene.genes.get(link.source.target.uid);
    return {
      ...linkOffsetsForPreview(scene, link, preview),
      visible:
        link.visible &&
        geneVisibleForPreview(preview, query) &&
        geneVisibleForPreview(preview, target),
    };
  }
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  const queryOrder = preview.clusterOrder.get(query?.locus?.cluster?.uid);
  const targetOrder = preview.clusterOrder.get(target?.locus?.cluster?.uid);
  const visible =
    queryOrder !== undefined &&
    targetOrder !== undefined &&
    Math.abs(queryOrder - targetOrder) === 1 &&
    link.source.identity >= config.link.threshold &&
    query?.visible &&
    target?.visible;
  return { visible, anchors: visible ? previewLinkAnchors(scene, link, preview) : null };
}

function boundsInViewport(bounds, viewport, { x = 0, y = 0 } = {}) {
  return (
    !viewport ||
    !bounds ||
    (bounds.minX + x <= viewport.maxX &&
      bounds.maxX + x >= viewport.minX &&
      bounds.minY + y <= viewport.maxY &&
      bounds.maxY + y >= viewport.minY)
  );
}

function drawLegend(context, legend) {
  if (!legend.visible) return;
  context.save();
  context.translate(legend.position.x, legend.position.y);
  context.font = `${legend.fontSize}px ${legend.fontFamily}`;
  context.textAlign = "start";
  context.textBaseline = "middle";
  for (const item of legend.items) {
    context.beginPath();
    context.arc(item.x, item.y + item.circleY, item.radius, 0, 2 * Math.PI);
    context.fillStyle = item.colour;
    context.fill();
    context.fillStyle = "black";
    context.fillText(item.label, item.x + item.textX, item.y + item.textY);
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
  context.fillStyle = "black";
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
  context.strokeStyle = "black";
  context.lineWidth = 1;
  context.strokeRect(0, 0, colourBar.width, colourBar.height);
  context.fillStyle = "black";
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
  return {
    ...to,
    x: interpolateNumber(from.x, to.x, amount),
    y: interpolateNumber(from.y, to.y, amount),
    worldStart: interpolateNumber(from.worldStart, to.worldStart, amount),
    worldEnd: interpolateNumber(from.worldEnd, to.worldEnd, amount),
    transform: interpolatePosition(from.transform, to.transform, amount),
    track: {
      ...to.track,
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
    links.set(uid, {
      ...link,
      anchors: interpolateArray(prior?.anchors, link.anchors, amount),
      labelPosition: interpolatePosition(prior?.labelPosition, link.labelPosition, amount),
    });
  }

  return { ...scene, clusters, loci, genes, links };
}

/** Draw a renderer-neutral chart scene into a Canvas 2D context. */
export function renderCanvas({
  canvas,
  scene,
  previousScene = null,
  progress = 1,
  camera,
  config,
  scales,
  hoverLocusUid = null,
  preview = null,
}) {
  const displayScene = interpolateCanvasScene(previousScene, scene, progress);
  const context = canvas.getContext("2d");
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  const pixelRatio = globalThis.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(camera.x, camera.y);
  context.scale(camera.k, camera.k);

  // During an animation, geometry is between the previous and target scenes,
  // while the index describes only the target scene. Draw the full frame then
  // so an in-flight record cannot be incorrectly culled.
  const viewport = previousScene ? null : canvasWorldViewport(canvas, camera);
  const clusterPreview = preview?.type === "cluster-drag";
  const visible = !clusterPreview && viewport && displayScene.index
    ? {
        links: queryViewportOrdered(displayScene.index.links, viewport),
        loci: queryViewportOrdered(displayScene.index.loci, viewport),
        genes: queryViewportOrdered(displayScene.index.genes, viewport),
      }
    : null;

  const recordsFor = (records, ids) =>
    ids ? ids.map((uid) => records.get(uid)).filter(Boolean) : [...records.values()];

  for (const link of recordsFor(displayScene.links, visible?.links)) {
    const geometry = linkGeometryForPreview(displayScene, link, preview, config);
    if (
      clusterPreview &&
      (!geometry.visible || !boundsInViewport({
        minX: Math.min(geometry.anchors[0], geometry.anchors[1], geometry.anchors[3], geometry.anchors[4]),
        maxX: Math.max(geometry.anchors[0], geometry.anchors[1], geometry.anchors[3], geometry.anchors[4]),
        minY: Math.min(geometry.anchors[2], geometry.anchors[5]),
        maxY: Math.max(geometry.anchors[2], geometry.anchors[5]),
      }, viewport))
    ) {
      continue;
    }
    drawLink(
      context,
      link,
      link.source,
      config,
      scales,
      geometry
    );
  }
  const drawnClusterLabels = new Set();
  for (const locus of recordsFor(displayScene.loci, visible?.loci)) {
    const cluster = displayScene.clusters.get(locus.cluster?.uid ?? locus.source.clusterUid);
    if (!cluster) continue;
    if (!drawnClusterLabels.has(cluster.source.uid)) {
      drawnClusterLabels.add(cluster.source.uid);
      drawClusterInfo(context, cluster, config, {
        x: clusterLabelOffsetForPreview(preview, cluster.source.uid),
        y: clusterOffsetForPreview(preview, cluster.source.uid),
      });
    }
    drawLocusTrack(
      context,
      locus,
      viewport,
      config,
      locusGeometryForPreview(preview, locus)
    );
  }
  const hoveredLocus = hoverLocusUid ? displayScene.loci.get(hoverLocusUid) : null;
  drawLocusHover(
    context,
    displayScene,
    hoverLocusUid,
    hoveredLocus ? locusGeometryForPreview(preview, hoveredLocus) : null
  );
  for (const gene of recordsFor(displayScene.genes, visible?.genes)) {
    if (clusterPreview && !boundsInViewport(gene.bounds, viewport, offsetsForGene(preview, gene))) {
      continue;
    }
    drawGene(
      context,
      gene,
      config,
      scales,
      offsetsForGene(preview, gene),
      geneVisibleForPreview(preview, gene)
    );
  }
  if (displayScene.chrome) {
    const chrome = preview?.chrome || displayScene.chrome;
    drawLegend(context, chrome.legend);
    drawScaleBar(context, chrome.scaleBar);
    drawColourBar(context, chrome.colourBar);
  }
  context.restore();
  return { width, height, pixelRatio };
}
