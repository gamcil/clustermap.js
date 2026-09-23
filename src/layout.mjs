import {
  getGeneLabelDy,
  getGeneLabelTransform,
  getGenePolygonCoordinates,
} from "./genes/layout.mjs";
import {
  getLinkAnchors,
  getLinkLabelPosition,
  getLinkPath,
} from "./links/layout.mjs";

function worldPolygon(points, x, y) {
  return points.map((point, index) => point + (index % 2 === 0 ? x : y));
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
        genes.set(gene.uid, {
          source: gene,
          display,
          locus: locusLayout,
          visible,
          localPolygon,
          polygon: worldPolygon(localPolygon, worldX, y),
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
    chrome: buildChrome(bounds, genes, chrome),
  };
}

// Kept as a compatibility alias while callers adopt the scene terminology.
export const createLayoutProjection = buildScene;
