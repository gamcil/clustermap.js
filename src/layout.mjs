import {
  getGeneLabelDy,
  getGeneLabelLayout,
  getGeneLabelTransform,
  getGenePolygonCoordinates,
} from "./genes/layout.mjs";
import {
  getLinkAnchors,
  getLinkLabelPosition,
  getLinkPath,
} from "./links/layout.mjs";
import { createSpatialIndex } from "./spatialIndex.mjs";

function worldPolygon(points, x, y) {
  return points.map((point, index) => point + (index % 2 === 0 ? x : y));
}

function boundsFromPoints(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < points.length; index += 2) {
    minX = Math.min(minX, points[index]);
    maxX = Math.max(maxX, points[index]);
    minY = Math.min(minY, points[index + 1]);
    maxY = Math.max(maxY, points[index + 1]);
  }
  return { minX, maxX, minY, maxY };
}

function boundsFromLinkAnchors(anchors) {
  if (!anchors) return null;
  const [ax1, ax2, ay, bx1, bx2, by] = anchors;
  return {
    minX: Math.min(ax1, ax2, bx1, bx2),
    maxX: Math.max(ax1, ax2, bx1, bx2),
    minY: Math.min(ay, by),
    maxY: Math.max(ay, by),
  };
}

function formatKilobases(basePairs) {
  return `${+(basePairs / 1000).toFixed(1)}kb`;
}

function buildChrome(bounds, genes, chrome) {
  if (!bounds || !chrome) return null;

  const visibleGroupIds = new Set();
  for (const gene of genes.values()) {
    if (!gene.visible) continue;
    const groupUid = chrome.legend.groupForGene(gene.source.uid);
    if (groupUid !== null) visibleGroupIds.add(groupUid);
  }

  const groups = chrome.legend.groups.filter(
    (group) => !group.hidden && visibleGroupIds.has(group.uid)
  );
  const totalHeight = chrome.legend.entryHeight * groups.length;
  const step = groups.length > 1 ? totalHeight / (groups.length - 0.5) : totalHeight;
  const radius = step / 4;
  const legend = {
    visible: chrome.legend.show,
    position: { x: bounds.maxX + chrome.legend.marginLeft, y: 0 },
    fontSize: chrome.legend.fontSize,
    fontFamily: chrome.legend.fontFamily,
    items: groups.map((group, index) => ({
      uid: group.uid,
      source: group,
      label: group.label,
      colour: chrome.legend.colourForGroup(group.uid),
      x: 0,
      y: index * step,
      radius,
      circleY: radius,
      textX: radius + 6,
      textY: radius + 1,
    })),
  };

  const scaleBarLength = chrome.scaleBar.coordinateFor(chrome.scaleBar.basePair);
  const scaleBar = {
    visible: chrome.scaleBar.show,
    position: {
      x: chrome.scaleBar.x,
      y: bounds.maxY + chrome.scaleBar.marginTop,
    },
    length: scaleBarLength,
    basePair: chrome.scaleBar.basePair,
    height: chrome.scaleBar.height,
    middle: chrome.scaleBar.height / 2,
    label: formatKilobases(chrome.scaleBar.basePair),
    colour: chrome.scaleBar.colour,
    strokeWidth: chrome.scaleBar.strokeWidth,
    fontSize: chrome.scaleBar.fontSize,
    fontFamily: chrome.scaleBar.fontFamily,
  };

  const colourBar = {
    visible: chrome.colourBar.show && !chrome.link.groupColour && chrome.link.show,
    position: {
      x: chrome.colourBar.x,
      y: bounds.maxY + chrome.colourBar.marginTop,
    },
    width: chrome.colourBar.width,
    height: chrome.colourBar.height,
    fontSize: chrome.colourBar.fontSize,
    fontFamily: chrome.colourBar.fontFamily,
    startColour: chrome.colourBar.scoreColour(0),
    endColour: chrome.colourBar.scoreColour(1),
    label: "Identity (%)",
    startLabel: "0",
    endLabel: "100",
  };

  return { legend, scaleBar, colourBar };
}

function buildHitRegions(loci, genes) {
  const locusRegions = new Map();
  const geneRegions = new Map();
  const all = [];

  for (const locus of loci.values()) {
    const { source, worldStart, worldEnd, y, hover } = locus;
    const move = {
      type: "rect",
      action: "move-locus",
      locusUid: source.uid,
      x: worldStart,
      y: y + hover.y,
      width: worldEnd - worldStart,
      height: hover.height,
    };
    const trimLeft = {
      type: "rect",
      action: "trim-locus-left",
      locusUid: source.uid,
      x: worldStart + hover.leftHandleX - hover.x,
      y: y + hover.y,
      width: hover.x - hover.leftHandleX,
      height: hover.height,
    };
    const trimRight = {
      type: "rect",
      action: "trim-locus-right",
      locusUid: source.uid,
      x: worldEnd,
      y: y + hover.y,
      width: 8,
      height: hover.height,
    };
    const regions = { move, trimLeft, trimRight };
    locusRegions.set(source.uid, regions);
    all.push(move, trimLeft, trimRight);
  }

  for (const gene of genes.values()) {
    if (!gene.visible) continue;
    const region = {
      type: "polygon",
      action: "gene",
      geneUid: gene.source.uid,
      points: gene.polygon,
    };
    geneRegions.set(gene.source.uid, region);
    all.push(region);
  }

  return { all, loci: locusRegions, genes: geneRegions };
}

/**
 * Derive renderer-neutral, world-space geometry from chart data and state.
 * The returned records contain no DOM selections and can be consumed by SVG,
 * Canvas, or an SVG export renderer.
 */
export function buildScene(
  data,
  {
    scaleX,
    scaleY,
    clusterPosition = scaleY,
    clusterOffset,
    locusOffset,
    getLocusState,
    getGeneState,
    areClustersAdjacent,
    shape,
    label,
    link,
    clusterLabel = () => "",
    alignLabels = true,
    chrome = null,
  }
) {
  const clusters = new Map();
  const loci = new Map();
  const genes = new Map();
  const links = new Map();
  const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const cluster of data.clusters) {
    const x = clusterOffset(cluster.uid);
    const y = clusterPosition(cluster.uid);
    const clusterLayout = { source: cluster, x, y, loci: [] };
    clusters.set(cluster.uid, clusterLayout);

    for (const locus of cluster.loci) {
      const state = getLocusState(locus);
      const localX = locusOffset(locus.uid);
      const start = scaleX(state.start);
      const end = scaleX(state.end);
      const worldX = x + localX;
      const locusLayout = {
        source: locus,
        cluster,
        state,
        localX,
        x: worldX,
        y,
        start,
        end,
        worldStart: worldX + start,
        worldEnd: worldX + end,
        bounds: {
          minX: worldX + start,
          maxX: worldX + end,
          minY: y - 10,
          maxY: y + shape.tipHeight * 2 + shape.bodyHeight + 10,
        },
        transform: { x: localX, y: 0 },
        track: {
          x1: start,
          x2: end,
          y: geneMidpoint,
        },
        hover: {
          x: start,
          y: -10,
          width: end - start,
          height: shape.tipHeight * 2 + shape.bodyHeight + 20,
          leftHandleX: start - 8,
          rightHandleX: end,
        },
      };
      loci.set(locus.uid, locusLayout);
      clusterLayout.loci.push(locusLayout);
      minX = Math.min(minX, locusLayout.worldStart);
      maxX = Math.max(maxX, locusLayout.worldEnd);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + shape.tipHeight * 2 + shape.bodyHeight);

      for (const gene of locus.genes) {
        const display = { ...gene, ...getGeneState(gene) };
        const visible =
          display.start >= state.start && display.end <= state.end + 1;
        const localPolygon = getGenePolygonCoordinates(display, { scaleX, shape });
        const polygon = worldPolygon(localPolygon, worldX, y);
        genes.set(gene.uid, {
          source: gene,
          display,
          locus: locusLayout,
          visible,
          localPolygon,
          polygon,
          bounds: boundsFromPoints(polygon),
          label: getGeneLabelLayout(display, { scaleX, shape, label }),
          labelTransform: getGeneLabelTransform(display, { scaleX, shape, label }),
          labelDy: getGeneLabelDy(label.position),
        });
      }
    }
  }

  const bounds =
    minX === Infinity ? null : { minX, maxX, minY, maxY };
  for (const cluster of clusters.values()) {
    const clusterMinX = cluster.loci.length
      ? Math.min(...cluster.loci.map((locus) => locus.worldStart))
      : cluster.x;
    const labelX = (alignLabels && bounds ? bounds.minX : clusterMinX) - cluster.x - 10;
    cluster.info = {
      x: labelX,
      y: 0,
      locusText: clusterLabel(cluster.source),
    };
  }

  for (const source of data.links) {
    const query = genes.get(source.query.uid);
    const target = genes.get(source.target.uid);
    let anchors = null;
    if (query && target) {
      anchors = getLinkAnchors(source, {
        geneForUid: (uid) => genes.get(uid)?.display,
        areClustersAdjacent,
        scaleX,
        horizontalOffset: (gene) => {
          const locus = loci.get(gene.locusUid);
          return locus ? locus.x : 0;
        },
        verticalPosition: (gene) => clusters.get(gene.clusterUid)?.y ?? 0,
        geneMidpoint,
      });
    }
    links.set(source.uid, {
      source,
      anchors,
      bounds: boundsFromLinkAnchors(anchors),
      path: getLinkPath(anchors, link),
      labelPosition: anchors
        ? getLinkLabelPosition(anchors, link.labelPosition)
        : null,
      visible:
        Boolean(anchors) &&
        source.identity >= link.threshold &&
        query?.visible &&
        target?.visible,
    });
  }

  return {
    clusters,
    loci,
    genes,
    links,
    bounds,
    index: {
      genes: createSpatialIndex([...genes].map(([uid, gene]) => [uid, gene.bounds])),
      loci: createSpatialIndex([...loci].map(([uid, locus]) => [uid, locus.bounds])),
      links: createSpatialIndex([...links].map(([uid, link]) => [uid, link.bounds])),
    },
    hitRegions: buildHitRegions(loci, genes),
    chrome: buildChrome(bounds, genes, chrome),
  };
}

/**
 * Describe a transient locus translation relative to an already projected
 * scene. This is deliberately a sparse, renderer-neutral patch: it avoids
 * rebuilding the scene while a drag is in progress.
 */
export function createLocusOffsetPreview(scene, locusUid, offset, { alignLabels }) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  const offsetX = offset - locus.localX;
  const clusters = [...scene.clusters.values()];
  const minStart = (loci) => Math.min(...loci.map((candidate) => candidate.worldStart));
  const clusterLabelOffsets = new Map();

  if (alignLabels) {
    const oldStart = minStart([...scene.loci.values()]);
    const newStart = Math.min(
      ...[...scene.loci.values()].map((candidate) =>
        candidate.source.uid === locusUid ? candidate.worldStart + offsetX : candidate.worldStart
      )
    );
    const labelOffset = newStart - oldStart;
    for (const cluster of clusters) clusterLabelOffsets.set(cluster.source.uid, labelOffset);
  } else {
    const cluster = scene.clusters.get(locus.cluster.uid);
    const oldStart = minStart(cluster.loci);
    const newStart = Math.min(
      ...cluster.loci.map((candidate) =>
        candidate.source.uid === locusUid ? candidate.worldStart + offsetX : candidate.worldStart
      )
    );
    clusterLabelOffsets.set(cluster.source.uid, newStart - oldStart);
  }

  return {
    type: "locus-offset",
    locusUid,
    offsetX,
    clusterLabelOffsets,
  };
}

// Kept as a compatibility alias while callers adopt the scene terminology.
export const createLayoutProjection = buildScene;
