import {
  getGeneLabelLayout,
  getGenePolygonCoordinates,
} from "../genes/layout.mjs";
import {
  clusterPairKey,
  orderLinkAnchors,
  getLinkLabelPosition,
} from "../links/layout.mjs";
import { createSpatialIndex, patchSpatialIndex } from "./spatialIndex.mjs";
import { locusContentBounds } from "../loci/layout.mjs";
import { arrangeTrimIndicators, createTrimIndicators, resolveTrimIndicatorStyle } from "../loci/trimIndicators.mjs";
import { layoutAnnotationPanels, annotationFigureBounds, annotationChromeRightEdge, legendTopExtent } from "../annotations/model.mjs";

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

function boundsFromRegions(regions) {
  if (!regions.length) return null;
  return {
    minX: Math.min(...regions.map((region) => region.x)),
    maxX: Math.max(...regions.map((region) => region.x + region.width)),
    minY: Math.min(...regions.map((region) => region.y)),
    maxY: Math.max(...regions.map((region) => region.y + region.height)),
  };
}

function formatKilobases(basePairs) {
  return `${+(basePairs / 1000).toFixed(1)}kb`;
}

function legendPositionForBounds(bounds, legend) {
  if (legend.placement === "bottom") {
    return {
      // Lower chrome shares the fixed chart baseline. Unlike a right-side
      // legend it must not slide horizontally when a locus is dragged.
      x: 0,
      y: bounds.maxY + legend.bottomOffset + legend.marginTop,
    };
  }
  return { x: bounds.maxX + legend.marginLeft, y: 0 };
}

function extendBounds(bounds, minX, maxX, minY, maxY) {
  return {
    minX: Math.min(bounds.minX, minX),
    maxX: Math.max(bounds.maxX, maxX),
    minY: Math.min(bounds.minY, minY),
    maxY: Math.max(bounds.maxY, maxY),
  };
}

// This deliberately excludes text-width measurement: Canvas supplies exact
// glyph metrics while fitting, and SVG uses its native bounding box. The scene
// still records the chrome's structural footprint for renderer-neutral camera
// and minimap work.
export function figureBoundsForChrome(bounds, chrome) {
  if (!bounds || !chrome) return bounds;
  let figureBounds = { ...bounds };
  const { legend, scaleBar, colourBar } = chrome;
  if (legend?.visible) {
    for (const item of legend.items) {
      const x = legend.position.x + item.x;
      const y = legend.position.y + item.y;
      figureBounds = extendBounds(
        figureBounds,
        x - item.radius,
        x + legend.columnWidth,
        y,
        y + (legend.hasSubtitles ? legend.entryHeight : legend.fontSize)
      );
    }
  }
  if (scaleBar?.visible) {
    figureBounds = extendBounds(
      figureBounds,
      scaleBar.position.x,
      scaleBar.position.x + scaleBar.length,
      scaleBar.position.y,
      scaleBar.position.y + scaleBar.height + scaleBar.fontSize + 5
    );
  }
  if (colourBar?.visible) {
    figureBounds = extendBounds(
      figureBounds,
      colourBar.position.x,
      colourBar.position.x + colourBar.width,
      colourBar.position.y,
      colourBar.position.y + colourBar.height + colourBar.fontSize + 5
    );
  }
  return figureBounds;
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
  const scaleBarLength = chrome.scaleBar.coordinateFor(chrome.scaleBar.basePair);
  const scaleBar = {
    textColour: chrome.scaleBar.textColour,
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

  const identityDomain = chrome.colourBar.domain || [0, 1];
  const colourBar = {
    textColour: chrome.colourBar.textColour,
    visible: chrome.colourBar.show && !chrome.link.groupColour && chrome.link.show,
    position: {
      x: chrome.colourBar.x,
      y: bounds.maxY + chrome.colourBar.marginTop,
    },
    width: chrome.colourBar.width,
    height: chrome.colourBar.height,
    fontSize: chrome.colourBar.fontSize,
    fontFamily: chrome.colourBar.fontFamily,
    startColour: chrome.colourBar.scoreColour(identityDomain[0]),
    endColour: chrome.colourBar.scoreColour(identityDomain[1]),
    label: "Identity (%)",
    startLabel: `${Math.round(identityDomain[0] * 100)}`,
    endLabel: `${Math.round(identityDomain[1] * 100)}`,
  };

  // Bottom legends share the lower chart edge with the scale and colour bars.
  // Stack them rather than letting the first legend entry cover those bars.
  const bottomOffset = Math.max(
    scaleBar.visible
      ? scaleBar.position.y - bounds.maxY + scaleBar.height + scaleBar.fontSize + 8
      : 0,
    colourBar.visible
      ? colourBar.position.y - bounds.maxY + colourBar.height + colourBar.fontSize + 8
      : 0
  );
  const columns = Math.min(
    groups.length || 1,
    Math.max(1, Math.floor(Number(chrome.legend.columns) || 1))
  );
  const columnWidth = Number(chrome.legend.columnWidth) || 160;
  const rows = Math.ceil(groups.length / columns);
  const fontSize = Number(chrome.legend.fontSize) || 14;
  const subtitleFontSize = Number(chrome.legend.subtitleFontSize) || Math.max(10, Math.round(fontSize * 0.72));
  const hasSubtitles = groups.some((group) => Boolean(group.subtitle));
  const entryHeight = hasSubtitles
    ? Math.max(Number(chrome.legend.entryHeight) || 18, fontSize + subtitleFontSize + 4)
    : Number(chrome.legend.entryHeight) || 18;
  const totalHeight = entryHeight * rows;
  const step = rows > 1 ? totalHeight / (rows - 0.5) : totalHeight;
  const radius = step / 4;
  const placement = chrome.legend.placement === "bottom" ? "bottom" : "right";
  const legend = {
    textColour: chrome.legend.textColour, subtitleColour: chrome.legend.subtitleColour,
    visible: chrome.legend.show,
    placement,
    columns,
    columnWidth,
    marginLeft: chrome.legend.marginLeft,
    marginTop: chrome.legend.marginTop,
    bottomOffset,
    position: legendPositionForBounds(bounds, {
      ...chrome.legend,
      placement,
      bottomOffset,
    }),
    entryHeight,
    fontSize,
    subtitleFontSize,
    hasSubtitles,
    fontFamily: chrome.legend.fontFamily,
    items: groups.map((group, index) => {
      const column = Math.floor(index / rows);
      const row = index % rows;
      return {
      uid: group.uid,
      source: group,
      label: group.label,
      colour: chrome.legend.colourForGroup(group.uid),
      x: column * columnWidth,
      y: row * step,
      radius,
      circleY: hasSubtitles ? entryHeight / 2 : radius,
      textX: radius + 6,
      textY: hasSubtitles ? entryHeight / 2 - subtitleFontSize * 0.42 : radius + 1,
      ...(group.subtitle ? { subtitle: group.subtitle, subtitleY: entryHeight / 2 + fontSize * 0.48 } : {}),
      };
    }),
  };

  return { legend, scaleBar, colourBar };
}

function createLocusLayout(locus, clusterLayout, {
  scaleX,
  getLocusState,
  getGeneState,
  locusOffset,
  shape,
  geneMidpoint,
  clusterSpacing = 40,
}) {
  const state = { ...getLocusState(locus) };
  const localX = locusOffset(locus.uid);
  const start = scaleX(state.start);
  const end = scaleX(state.end);
  const worldX = clusterLayout.x + localX;
  const paddingY = Math.max(0, Math.min(10, clusterSpacing / 4));
  const height = shape.tipHeight * 2 + shape.bodyHeight;
  return {
    source: locus,
    cluster: clusterLayout.source,
    state,
    localX,
    x: worldX,
    y: clusterLayout.y,
    worldStart: worldX + start,
    worldEnd: worldX + end,
    bounds: {
      minX: worldX + start,
      maxX: worldX + end,
      minY: clusterLayout.y - paddingY,
      maxY: clusterLayout.y + height + paddingY,
    },
    track: {
      // The physical extent is unchanged by a flip, but retaining the
      // endpoint orientation lets renderers animate the bar collapsing
      // through its midpoint and growing out in the reversed direction.
      x1: state.flipped ? end : start,
      x2: state.flipped ? start : end,
      y: geneMidpoint,
    },
    hover: {
      x: start,
      y: -paddingY,
      width: end - start,
      height: height + paddingY * 2,
      leftHandleX: start - 8,
      rightHandleX: end,
    },
    trimIndicators: createTrimIndicators({ locus, state, getGeneState, scaleX, shape }),
    genes: [],
  };
}

function extendLocusBoundsForTrimIndicators(locus, trimIndicatorStyle) {
  const { fontSize } = resolveTrimIndicatorStyle(trimIndicatorStyle);
  const maxY = Math.max(
    locus.y + locus.hover.y + locus.hover.height,
    ...locus.trimIndicators.map((indicator) => locus.y + indicator.y + fontSize + 1)
  );
  locus.bounds = { ...locus.bounds, maxY };
  return locus;
}

function createGeneLayout(gene, locusLayout, { scaleX, getGeneState, shape, label }) {
  const display = { ...gene, ...getGeneState(gene) };
  const visible =
    display.start >= locusLayout.state.start && display.end <= locusLayout.state.end + 1;
  const localPolygon = getGenePolygonCoordinates(display, { scaleX, shape });
  const polygon = worldPolygon(localPolygon, locusLayout.x, locusLayout.y);
  return {
    source: gene,
    display,
    locus: locusLayout,
    visible,
    localPolygon,
    polygon,
    bounds: boundsFromPoints(polygon),
    label: getGeneLabelLayout(display, { scaleX, shape, label }),
  };
}

function createLinkLayout(source, order, {
  genes, areClustersAdjacent, scaleX, link, linkVisible = () => true,
}) {
  const query = genes.get(source.query.uid);
  const target = genes.get(source.target.uid);
  const anchorForGene = ({ display, locus }) => {
    const start = scaleX(display.start) + locus.x;
    const end = scaleX(display.end) + locus.x;
    return display.strand === 1
      ? [start, end, locus.y + locus.track.y]
      : [end, start, locus.y + locus.track.y];
  };
  const anchors = query && target && areClustersAdjacent(query.display.clusterUid, target.display.clusterUid)
    ? orderLinkAnchors(anchorForGene(query), anchorForGene(target)) : null;
  const allowed = linkVisible(source);
  return {
    source,
    order,
    // Renderer policy (group membership, best-only reduction, hidden links)
    // is resolved once by the runtime. Keeping it on the retained record lets
    // all renderers, including dynamic cluster-drag previews, agree on it.
    allowed,
    anchors,
    bounds: boundsFromLinkAnchors(anchors),
    labelPosition: anchors ? getLinkLabelPosition(anchors, link.labelPosition) : null,
    visible:
      Boolean(anchors) &&
      allowed &&
      !source.hidden &&
      source.identity >= link.threshold &&
      query?.visible &&
      target?.visible,
  };
}

function createLocusHitRegions(locus) {
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
  return { move, trimLeft, trimRight };
}

function createGeneHitRegion(gene) {
  if (!gene.visible) return null;
  return {
    type: "polygon",
    action: "gene",
    geneUid: gene.source.uid,
    points: gene.polygon,
  };
}

function buildHitRegions(loci, genes) {
  const locusRegions = new Map();
  const geneRegions = new Map();

  for (const locus of loci.values()) {
    const regions = createLocusHitRegions(locus);
    locusRegions.set(locus.source.uid, regions);
  }

  for (const gene of genes.values()) {
    const region = createGeneHitRegion(gene);
    if (!region) continue;
    geneRegions.set(gene.source.uid, region);
  }

  return { loci: locusRegions, genes: geneRegions };
}

function adjacencyForOrder(order, fallback) {
  if (!order) return fallback;
  const positions = new Map(order.map((uid, index) => [uid, index]));
  return (one, two) => Math.abs(positions.get(one) - positions.get(two)) === 1;
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
    clusterOrder = null,
    clusterSpacing,
    shape,
    label,
    link,
    linkVisible = () => true,
    clusterLabel = () => "",
    alignLabels = true,
    labelAlignment = "right",
    clusterLabelWidth = () => 0,
    trimIndicatorStyle = {},
    chrome = null,
    fontFamily = "sans-serif",
    measureText = null,
    textMetricsRevision = 0,
    annotationsEnabled = false,
    tree = null,
    theme = null,
  }
) {
  const clusters = new Map();
  const loci = new Map();
  const genes = new Map();
  const links = new Map();
  const linksByClusterPair = new Map();
  const linksByGene = new Map();
  areClustersAdjacent = adjacencyForOrder(clusterOrder, areClustersAdjacent);
  const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;

  for (const cluster of data.clusters) {
    const x = clusterOffset(cluster.uid);
    const y = clusterPosition(cluster.uid);
    const clusterLayout = { source: cluster, x, y, loci: [] };
    clusters.set(cluster.uid, clusterLayout);

    for (const locus of cluster.loci) {
      const locusLayout = createLocusLayout(locus, clusterLayout, {
        scaleX,
        getLocusState,
        getGeneState,
        locusOffset,
        shape,
        geneMidpoint,
        clusterSpacing,
      });
      loci.set(locus.uid, locusLayout);
      clusterLayout.loci.push(locusLayout);

      for (const gene of locus.genes) {
        const geneLayout = createGeneLayout(gene, locusLayout, {
          scaleX,
          getGeneState,
          shape,
          label,
        });
        genes.set(gene.uid, geneLayout);
        locusLayout.genes.push(geneLayout);
      }
    }
  }

  const arrangedTrimIndicators = arrangeTrimIndicators(loci.values(), new Map(), trimIndicatorStyle);
  for (const locus of loci.values()) {
    locus.rawTrimIndicators = locus.trimIndicators;
    locus.trimIndicators = arrangedTrimIndicators.get(locus.source.uid) || [];
    extendLocusBoundsForTrimIndicators(locus, trimIndicatorStyle);
  }
  const bounds = sceneBounds(loci, { shape, trimIndicatorStyle });
  for (const cluster of clusters.values()) {
    cluster.bounds = boundsForLoci(cluster.loci);
  }
  for (const [uid, info] of clusterInfos(clusters, bounds, { alignLabels, clusterLabel, labelAlignment, clusterLabelWidth })) {
    clusters.get(uid).info = info;
  }

  for (const [order, source] of data.links.entries()) {
    const linkLayout = createLinkLayout(source, order, {
      genes, areClustersAdjacent, scaleX, link, linkVisible,
    });
    links.set(source.uid, linkLayout);
    for (const uid of new Set([source.query.uid, source.target.uid])) {
      if (!linksByGene.has(uid)) linksByGene.set(uid, []);
      linksByGene.get(uid).push(source);
    }
    const query = genes.get(source.query.uid);
    const target = genes.get(source.target.uid);
    if (query && target) {
      const key = clusterPairKey(query.locus.cluster.uid, target.locus.cluster.uid);
      const pairLinks = linksByClusterPair.get(key) || [];
      pairLinks.push(source.uid);
      linksByClusterPair.set(key, pairLinks);
    }
  }

  const hitRegions = buildHitRegions(loci, genes);
  const chromeLayout = buildChrome(bounds, genes, chrome);
  const annotations = projectSceneAnnotations(data.annotationPanels, clusters, bounds, chromeLayout,
    { annotationsEnabled, fontFamily, rowOffset: geneMidpoint, measureText, textMetricsRevision, theme, tree });
  return {
    clusters,
    loci,
    genes,
    links,
    linksByClusterPair,
    linksByGene,
    bounds,
    ...annotations,
    index: {
      genes: createSpatialIndex([...genes].map(([uid, gene]) => [uid, gene.bounds])),
      loci: createSpatialIndex([...loci].map(([uid, locus]) => [uid, locus.bounds])),
      links: createSpatialIndex([...links].map(([uid, link]) => [uid, link.bounds])),
      hitLoci: createSpatialIndex(
        [...hitRegions.loci].map(([uid, regions]) => [
          uid,
          boundsFromRegions([regions.move, regions.trimLeft, regions.trimRight]),
        ])
      ),
    },
    hitRegions,
    chrome: chromeLayout,
  };
}

function translateBounds(bounds, x, y = 0) {
  if (!bounds) return bounds;
  return {
    minX: bounds.minX + x, maxX: bounds.maxX + x,
    minY: bounds.minY + y, maxY: bounds.maxY + y,
  };
}

function boundsForLoci(loci) {
  const bounds = loci.map((locus) => locus.bounds).filter(Boolean);
  return bounds.length ? {
    minX: Math.min(...bounds.map((bounds) => bounds.minX)),
    maxX: Math.max(...bounds.map((bounds) => bounds.maxX)),
    minY: Math.min(...bounds.map((bounds) => bounds.minY)),
    maxY: Math.max(...bounds.map((bounds) => bounds.maxY)),
  } : null;
}

function sceneBounds(loci, options) {
  let bounds = null;
  for (const locus of loci.values()) {
    const next = locusContentBounds(locus, options);
    bounds = bounds ? extendBounds(bounds, next.minX, next.maxX, next.minY, next.maxY) : next;
  }
  return bounds;
}

function clusterInfos(clusters, bounds, { alignLabels = true, clusterLabel = () => "",
  labelAlignment = "right", clusterLabelWidth = () => 0 }) {
  const left = labelAlignment === "left";
  const infos = new Map([...clusters].map(([uid, cluster]) => {
    const locusText = clusterLabel(cluster.source);
    return [uid, { locusText, width: left ? clusterLabelWidth(cluster.source, locusText) : 0,
      anchor: left ? "start" : "end", y: 0 }];
  }));
  const width = Math.max(0, ...[...infos.values()].map((info) => info.width));
  for (const [uid, cluster] of clusters) {
    const info = infos.get(uid);
    const start = cluster.loci.length
      ? Math.min(...cluster.loci.map((locus) => locus.worldStart)) : cluster.x;
    info.x = (alignLabels && bounds ? bounds.minX : start) - cluster.x - 10 -
      (left ? alignLabels ? width : info.width : 0);
  }
  return infos;
}

function updateSpatialIndex(index, changedEntries, entriesForRebuild) {
  // Dense changes (e.g. a large reorder) are cheaper to rebuild than to patch
  // cell by cell. Construct the complete entry list only on that path.
  return changedEntries.length > (index?.boundsById.size || 0) / 4
    ? createSpatialIndex(entriesForRebuild())
    : patchSpatialIndex(index, changedEntries);
}

function repositionChrome(chrome, bounds, previousBounds) {
  if (!chrome || !bounds) return null;
  const dy = bounds.maxY - previousBounds.maxY;
  return {
    ...chrome,
    legend: { ...chrome.legend, position: legendPositionForBounds(bounds, chrome.legend) },
    scaleBar: { ...chrome.scaleBar, position: {
      ...chrome.scaleBar.position, y: chrome.scaleBar.position.y + dy,
    } },
    colourBar: { ...chrome.colourBar, position: {
      ...chrome.colourBar.position, y: chrome.colourBar.position.y + dy,
    } },
  };
}

const emptyAnnotationPanels = Object.freeze([]);

// Data/configuration builds project cells; geometry-only commits retain them.
// This is the single placement path for both kinds of scene update.
function projectSceneAnnotations(definitions, clusters, bounds, chrome, options, previous = null) {
  const annotationPanelData = options.annotationsEnabled ? definitions : undefined;
  const visible = annotationPanelData?.some((panel) => panel.show !== false);
  const annotationChromeRight = visible ? annotationChromeRightEdge(chrome, options.measureText) : -Infinity;
  const annotationAnchorX = Math.max(bounds?.maxX ?? 0, annotationChromeRight);
  let annotationPanels = emptyAnnotationPanels;
  if (visible) {
    // One reuse policy handles geometry commits, presentation and font changes.
    annotationPanels = layoutAnnotationPanels(annotationPanelData, clusters, bounds,
      { ...options, anchorX: annotationAnchorX, previousPanels: previous?.annotationPanels });
  }
  const annotationBounds = annotationFigureBounds(bounds, annotationPanels, clusters);
  placeLegendAfterAnnotations(chrome, annotationPanels, annotationBounds, options.measureText);
  return { annotationPanelData, annotationPanels, annotationAnchorX, annotationChromeRight,
    figureBounds: figureBoundsForChrome(annotationBounds, chrome) };
}

/** Presentation/data edits to annotations leave synteny and its indexes intact. */
export function patchAnnotationScene(scene, definitions, options) {
  const chrome = repositionChrome(scene.chrome, scene.bounds, scene.bounds);
  return { ...scene, chrome,
    ...projectSceneAnnotations(definitions, scene.clusters, scene.bounds, chrome,
      { ...options, rowOffset: options.shape.tipHeight + options.shape.bodyHeight / 2 }, scene),
    changes: { annotationsOnly: true } };
}

function placeLegendAfterAnnotations(chrome, panels, annotationBounds, measureText) {
  const legend = chrome?.legend;
  if (!legend || !annotationBounds) return;
  if (legend.placement === "right" && panels.length) {
    const right = Math.max(...panels.map((panel) => panel.x + panel.horizontalBounds.maxX));
    legend.position = { ...legend.position, x: right + legend.marginLeft };
  } else if (legend.placement === "bottom") {
    // Stack below keys and axes as well as scale bars, independently of width.
    legend.position = { ...legend.position,
      y: Math.max(legend.position.y, annotationBounds.maxY + legend.marginTop) - legendTopExtent(legend, measureText) };
  }
}

/**
 * Commit geometry edits to an existing renderer-neutral scene. IDs and data
 * membership must be unchanged; use buildScene for data/configuration changes.
 * Explicit loci cover flips/trims, clusters cover translations/reorders, and
 * the caller supplies current authoritative state/scales rather than deltas.
 * Unchanged records are shared. All changed links, bounds, labels, chrome and
 * hit indexes are finalized once, including for batch edits.
 */
export function patchScene(scene, { loci: locusIds = [], clusters: clusterIds = [] } = {}, options) {
  if (!scene) return scene;
  options = { ...options, areClustersAdjacent: adjacencyForOrder(options.clusterOrder, options.areClustersAdjacent) };
  const {
    scaleX, shape, label, getGeneState, getLocusState, locusOffset,
    clusterOffset = (uid) => scene.clusters.get(uid).x,
    clusterPosition = (uid) => scene.clusters.get(uid).y,
    trimIndicatorStyle = {},
  } = options;
  const requestedLoci = new Set(locusIds);
  const requestedClusters = new Set(clusterIds);
  for (const uid of requestedClusters) {
    for (const locus of scene.clusters.get(uid)?.loci || []) requestedLoci.add(locus.source.uid);
  }
  for (const uid of requestedLoci) {
    const locus = scene.loci.get(uid);
    if (locus) requestedClusters.add(locus.cluster.uid);
  }
  if (!requestedLoci.size) return scene;

  const clusters = new Map(scene.clusters);
  const loci = new Map(scene.loci);
  const genes = new Map(scene.genes);
  const changedLoci = new Set();
  const changedGenes = new Set();
  let visibilityChanged = false;
  const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;
  for (const uid of requestedClusters) {
    const previous = clusters.get(uid);
    if (previous) clusters.set(uid, {
      ...previous, x: clusterOffset(uid), y: clusterPosition(uid), loci: [...previous.loci],
    });
  }
  for (const uid of requestedLoci) {
    const previous = scene.loci.get(uid);
    if (!previous) continue;
    const cluster = clusters.get(previous.cluster.uid);
    const state = getLocusState(previous.source);
    const localX = locusOffset(uid);
    const dx = cluster.x + localX - previous.x, dy = cluster.y - previous.y;
    const translated = state.start === previous.state.start && state.end === previous.state.end &&
      state.flipped === previous.state.flipped;
    const locus = translated ? {
      ...previous, state: { ...state }, localX, x: previous.x + dx, y: previous.y + dy,
      worldStart: previous.worldStart + dx, worldEnd: previous.worldEnd + dx,
      bounds: translateBounds(previous.bounds, dx, dy),
      genes: [],
      trimIndicators: previous.rawTrimIndicators || previous.trimIndicators,
    } : createLocusLayout(previous.source, cluster, { ...options, geneMidpoint });
    locus.rawTrimIndicators = locus.trimIndicators;
    for (const source of locus.source.genes) {
      const previousGene = scene.genes.get(source.uid);
      const gene = translated && previousGene ? {
        ...previousGene, locus,
        polygon: worldPolygon(previousGene.polygon, dx, dy),
        bounds: translateBounds(previousGene.bounds, dx, dy),
      } : createGeneLayout(source, locus, { scaleX, getGeneState, shape, label });
      if (gene.visible !== previousGene?.visible) visibilityChanged = true;
      genes.set(source.uid, gene);
      locus.genes.push(gene);
      changedGenes.add(source.uid);
    }
    loci.set(uid, locus);
    changedLoci.add(uid);
  }

  // Moving a trimmed locus can also change a neighbour's indicator placement.
  // Reflow the small indicator set from its original local rows, retaining all
  // other locus/gene geometry when only an indicator row changes.
  const rawIndicators = new Map([...loci].map(([uid, locus]) =>
    [uid, locus.rawTrimIndicators || locus.trimIndicators]
  ));
  const arranged = arrangeTrimIndicators(loci.values(), rawIndicators, trimIndicatorStyle);
  for (const [uid, previous] of loci) {
    const indicators = arranged.get(uid) || [];
    if (!changedLoci.has(uid) && JSON.stringify(indicators) === JSON.stringify(previous.trimIndicators)) continue;
    const locus = changedLoci.has(uid) ? previous : { ...previous, genes: [] };
    locus.rawTrimIndicators = rawIndicators.get(uid);
    locus.trimIndicators = indicators;
    extendLocusBoundsForTrimIndicators(locus, trimIndicatorStyle);
    if (!changedLoci.has(uid)) {
      for (const previousGene of previous.genes) {
        const gene = { ...previousGene, locus };
        genes.set(gene.source.uid, gene);
        locus.genes.push(gene);
      }
      loci.set(uid, locus);
      requestedClusters.add(locus.cluster.uid);
      const cluster = clusters.get(locus.cluster.uid);
      if (cluster === scene.clusters.get(locus.cluster.uid)) clusters.set(locus.cluster.uid, { ...cluster });
    }
    changedLoci.add(uid);
  }
  for (const uid of requestedClusters) {
    const cluster = clusters.get(uid);
    if (!cluster) continue;
    cluster.loci = cluster.loci.map((locus) => loci.get(locus.source.uid));
    cluster.bounds = boundsForLoci(cluster.loci);
  }
  const bounds = sceneBounds(loci, options);
  for (const [uid, info] of clusterInfos(clusters, bounds, options)) {
    const cluster = clusters.get(uid);
    if (info.x !== cluster.info.x || info.locusText !== cluster.info.locusText ||
        info.width !== cluster.info.width || info.anchor !== cluster.info.anchor) {
      clusters.set(uid, { ...cluster, info });
    }
  }

  const sources = new Map();
  for (const uid of changedGenes) {
    for (const source of scene.linksByGene.get(uid) || []) sources.set(source.uid, source);
  }
  const links = new Map(scene.links);
  for (const source of sources.values()) {
    const previous = links.get(source.uid);
    if (previous) links.set(source.uid, createLinkLayout(source, previous.order, {
      ...options, genes,
    }));
  }

  const locusRegions = new Map(scene.hitRegions.loci);
  const geneRegions = new Map(scene.hitRegions.genes);
  for (const uid of changedLoci) locusRegions.set(uid, createLocusHitRegions(loci.get(uid)));
  for (const uid of changedGenes) {
    const region = createGeneHitRegion(genes.get(uid));
    if (region) geneRegions.set(uid, region);
    else geneRegions.delete(uid);
  }
  const hitRegions = {
    loci: locusRegions, genes: geneRegions,
  };
  const entries = (records, ids, boundsFor = (record) => record.bounds) =>
    [...ids].map((uid) => [uid, boundsFor(records.get(uid))]);
  const hitBounds = (regions) => boundsFromRegions([regions.move, regions.trimLeft, regions.trimRight]);
  const chrome = visibilityChanged && options.chrome
    ? buildChrome(bounds, genes, options.chrome)
    : repositionChrome(scene.chrome, bounds, scene.bounds);
  const annotations = projectSceneAnnotations(scene.annotationPanelData, clusters, bounds, chrome,
    { ...options, rowOffset: geneMidpoint }, scene);
  return {
    ...scene, clusters, loci, genes, links, bounds, chrome, hitRegions, ...annotations,
    changes: { loci: changedLoci, genes: changedGenes, links: new Set(sources.keys()), clusters: requestedClusters },
    index: {
      genes: updateSpatialIndex(scene.index.genes, entries(genes, changedGenes), () => entries(genes, genes.keys())),
      loci: updateSpatialIndex(scene.index.loci, entries(loci, changedLoci), () => entries(loci, loci.keys())),
      links: updateSpatialIndex(scene.index.links, entries(links, sources.keys()), () => entries(links, links.keys())),
      hitLoci: updateSpatialIndex(scene.index.hitLoci, entries(locusRegions, changedLoci, hitBounds),
        () => entries(locusRegions, locusRegions.keys(), hitBounds)),
    },
  };
}
