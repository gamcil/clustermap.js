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
import { createSpatialIndex, patchSpatialIndex } from "./spatialIndex.mjs";

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

export function clusterPairKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
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

function createLocusLayout(locus, clusterLayout, {
  scaleX,
  getLocusState,
  locusOffset,
  shape,
  geneMidpoint,
}) {
  const state = getLocusState(locus);
  const localX = locusOffset(locus.uid);
  const start = scaleX(state.start);
  const end = scaleX(state.end);
  const worldX = clusterLayout.x + localX;
  return {
    source: locus,
    cluster: clusterLayout.source,
    state,
    localX,
    x: worldX,
    y: clusterLayout.y,
    start,
    end,
    worldStart: worldX + start,
    worldEnd: worldX + end,
    bounds: {
      minX: worldX + start,
      maxX: worldX + end,
      minY: clusterLayout.y - 10,
      maxY: clusterLayout.y + shape.tipHeight * 2 + shape.bodyHeight + 10,
    },
    transform: { x: localX, y: 0 },
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
      y: -10,
      width: end - start,
      height: shape.tipHeight * 2 + shape.bodyHeight + 20,
      leftHandleX: start - 8,
      rightHandleX: end,
    },
    genes: [],
  };
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
    labelTransform: getGeneLabelTransform(display, { scaleX, shape, label }),
    labelDy: getGeneLabelDy(label.position),
  };
}

function createLinkLayout(source, order, { genes, loci, clusters, areClustersAdjacent, scaleX, link, geneMidpoint }) {
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
  return {
    source,
    order,
    anchors,
    bounds: boundsFromLinkAnchors(anchors),
    path: getLinkPath(anchors, link),
    labelPosition: anchors ? getLinkLabelPosition(anchors, link.labelPosition) : null,
    visible:
      Boolean(anchors) &&
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
  const all = [];

  for (const locus of loci.values()) {
    const regions = createLocusHitRegions(locus);
    locusRegions.set(locus.source.uid, regions);
    all.push(regions.move, regions.trimLeft, regions.trimRight);
  }

  for (const gene of genes.values()) {
    const region = createGeneHitRegion(gene);
    if (!region) continue;
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
    clusterOrder = null,
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
  const linksByClusterPair = new Map();
  // Projection receives the current order from the stateful runtime. Index it
  // once so each link can test adjacency without searching that order array.
  // The callback remains the generic fallback for direct scene consumers.
  const clusterOrderIndex = clusterOrder
    ? new Map(clusterOrder.map((uid, index) => [uid, index]))
    : null;
  const indexedAreClustersAdjacent = (one, two) => {
    if (!clusterOrderIndex) return areClustersAdjacent(one, two);
    return Math.abs(clusterOrderIndex.get(one) - clusterOrderIndex.get(two)) === 1;
  };
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
      const locusLayout = createLocusLayout(locus, clusterLayout, {
        scaleX,
        getLocusState,
        locusOffset,
        shape,
        geneMidpoint,
      });
      loci.set(locus.uid, locusLayout);
      clusterLayout.loci.push(locusLayout);
      minX = Math.min(minX, locusLayout.worldStart);
      maxX = Math.max(maxX, locusLayout.worldEnd);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + shape.tipHeight * 2 + shape.bodyHeight);

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
    clusterLayout.bounds = clusterLayout.loci.length
      ? {
          minX: Math.min(...clusterLayout.loci.map((locus) => locus.bounds.minX)),
          maxX: Math.max(...clusterLayout.loci.map((locus) => locus.bounds.maxX)),
          minY: Math.min(...clusterLayout.loci.map((locus) => locus.bounds.minY)),
          maxY: Math.max(...clusterLayout.loci.map((locus) => locus.bounds.maxY)),
        }
      : null;
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

  for (const [order, source] of data.links.entries()) {
    const linkLayout = createLinkLayout(source, order, {
      genes,
      loci,
      clusters,
      areClustersAdjacent: indexedAreClustersAdjacent,
      scaleX,
      link,
      geneMidpoint,
    });
    links.set(source.uid, linkLayout);
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
  return {
    clusters,
    loci,
    genes,
    links,
    linksByClusterPair,
    bounds,
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
    chrome: buildChrome(bounds, genes, chrome),
  };
}

/**
 * Apply the geometry consequences of one committed locus flip to a retained
 * scene. Clusters outside the locus and links not incident to one of its
 * genes are structurally shared with the prior scene.
 */
export function patchFlippedLocusScene(
  scene,
  locus,
  {
    scaleX,
    locusOffset,
    getLocusState,
    getGeneState,
    areClustersAdjacent,
    shape,
    label,
    link,
    clusterLabel = () => "",
    alignLabels = true,
    linksForGene = () => [],
  }
) {
  const previousLocus = scene.loci.get(locus.uid);
  if (!previousLocus) return scene;
  const previousCluster = scene.clusters.get(previousLocus.cluster.uid);
  if (!previousCluster) return scene;

  const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;
  const clusters = new Map(scene.clusters);
  const cluster = { ...previousCluster, loci: [...previousCluster.loci] };
  clusters.set(cluster.source.uid, cluster);
  const replacement = createLocusLayout(locus, cluster, {
    scaleX,
    getLocusState,
    locusOffset,
    shape,
    geneMidpoint,
  });
  const locusIndex = cluster.loci.findIndex((candidate) => candidate.source.uid === locus.uid);
  cluster.loci[locusIndex] = replacement;
  cluster.bounds = {
    minX: Math.min(...cluster.loci.map((candidate) => candidate.bounds.minX)),
    maxX: Math.max(...cluster.loci.map((candidate) => candidate.bounds.maxX)),
    minY: Math.min(...cluster.loci.map((candidate) => candidate.bounds.minY)),
    maxY: Math.max(...cluster.loci.map((candidate) => candidate.bounds.maxY)),
  };
  const clusterStart = Math.min(...cluster.loci.map((candidate) => candidate.worldStart));
  cluster.info = {
    x: (alignLabels && scene.bounds ? scene.bounds.minX : clusterStart) - cluster.x - 10,
    y: 0,
    locusText: clusterLabel(cluster.source),
  };

  const loci = new Map(scene.loci);
  loci.set(locus.uid, replacement);
  const genes = new Map(scene.genes);
  const changedGenes = [];
  for (const gene of locus.genes) {
    const layout = createGeneLayout(gene, replacement, {
      scaleX,
      getGeneState,
      shape,
      label,
    });
    genes.set(gene.uid, layout);
    replacement.genes.push(layout);
    changedGenes.push([gene.uid, layout]);
  }

  const links = new Map(scene.links);
  const changedSources = new Map();
  for (const gene of locus.genes) {
    for (const source of linksForGene(gene.uid)) changedSources.set(source.uid, source);
  }
  const changedLinks = [];
  for (const source of changedSources.values()) {
    const previous = links.get(source.uid);
    if (!previous) continue;
    const layout = createLinkLayout(source, previous.order, {
      genes,
      loci,
      clusters,
      areClustersAdjacent,
      scaleX,
      link,
      geneMidpoint,
    });
    links.set(source.uid, layout);
    changedLinks.push([source.uid, layout]);
  }

  const locusRegions = new Map(scene.hitRegions.loci);
  const replacementLocusRegions = createLocusHitRegions(replacement);
  locusRegions.set(locus.uid, replacementLocusRegions);
  const geneRegions = new Map(scene.hitRegions.genes);
  for (const [uid, gene] of changedGenes) {
    const region = createGeneHitRegion(gene);
    if (region) geneRegions.set(uid, region);
    else geneRegions.delete(uid);
  }
  const changedGeneIds = new Set(changedGenes.map(([uid]) => uid));
  const all = scene.hitRegions.all.filter(
    (region) => region.locusUid !== locus.uid && !changedGeneIds.has(region.geneUid)
  );
  all.push(
    replacementLocusRegions.move,
    replacementLocusRegions.trimLeft,
    replacementLocusRegions.trimRight,
    ...changedGenes
      .map(([uid]) => geneRegions.get(uid))
      .filter(Boolean)
  );
  const hitRegions = { all, loci: locusRegions, genes: geneRegions };

  return {
    ...scene,
    clusters,
    loci,
    genes,
    links,
    index: {
      ...scene.index,
      genes: patchSpatialIndex(
        scene.index.genes,
        changedGenes.map(([uid, gene]) => [uid, gene.bounds])
      ),
      loci: patchSpatialIndex(scene.index.loci, [[locus.uid, replacement.bounds]]),
      links: patchSpatialIndex(
        scene.index.links,
        changedLinks.map(([uid, layout]) => [uid, layout.bounds])
      ),
      hitLoci: patchSpatialIndex(scene.index.hitLoci, [
        [
          locus.uid,
          boundsFromRegions([
            replacementLocusRegions.move,
            replacementLocusRegions.trimLeft,
            replacementLocusRegions.trimRight,
          ]),
        ],
      ]),
    },
    hitRegions,
  };
}

function translateBounds(bounds, x) {
  if (!bounds) return bounds;
  return {
    ...bounds,
    minX: bounds.minX + x,
    maxX: bounds.maxX + x,
  };
}

function translatePolygon(points, x) {
  return points.map((point, index) => (index % 2 === 0 ? point + x : point));
}

function sceneBounds(loci) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const locus of loci.values()) {
    minX = Math.min(minX, locus.bounds.minX);
    maxX = Math.max(maxX, locus.bounds.maxX);
    minY = Math.min(minY, locus.bounds.minY);
    maxY = Math.max(maxY, locus.bounds.maxY);
  }
  return minX === Infinity ? null : { minX, maxX, minY, maxY };
}

function updateSpatialIndex(index, changedEntries, allEntries) {
  // Copy-on-write cell patches are excellent for a locus edit, but anchoring
  // often shifts most clusters. At that point cloning each touched cell is
  // more expensive than building a compact index from the already-patched
  // records.
  if (changedEntries.length > (index?.boundsById.size || 0) / 4) {
    return createSpatialIndex(allEntries);
  }
  return patchSpatialIndex(index, changedEntries);
}

/**
 * Apply a committed gene-anchor action without re-projecting unrelated chart
 * records. Anchoring shifts whole clusters; only their loci, genes, hit
 * regions, and incident links need new world-space geometry. A mismatched
 * strand may additionally flip one or more loci, which reuses the focused
 * locus patch above before applying the cluster translations.
 */
export function patchAnchoredGeneScene(
  scene,
  { changes = [], flippedLoci = new Set() },
  options
) {
  let patched = scene;
  for (const locusUid of flippedLoci) {
    const locus = patched.loci.get(locusUid)?.source;
    if (locus) patched = patchFlippedLocusScene(patched, locus, options);
  }

  const offsets = new Map(
    changes
      .filter(({ offset }) => offset)
      .map(({ clusterUid, offset }) => [clusterUid, offset])
  );
  if (!offsets.size) return patched;

  const clusters = new Map(patched.clusters);
  const loci = new Map(patched.loci);
  const genes = new Map(patched.genes);
  const changedLocusIds = new Set(flippedLoci);
  const changedGeneIds = new Set();

  for (const locusUid of flippedLoci) {
    for (const gene of loci.get(locusUid)?.genes || []) changedGeneIds.add(gene.source.uid);
  }

  for (const [clusterUid, offset] of offsets) {
    const previousCluster = patched.clusters.get(clusterUid);
    if (!previousCluster) continue;
    const cluster = {
      ...previousCluster,
      x: previousCluster.x + offset,
      bounds: translateBounds(previousCluster.bounds, offset),
      loci: [],
    };
    clusters.set(clusterUid, cluster);

    for (const previousLocus of previousCluster.loci) {
      const locus = {
        ...previousLocus,
        x: previousLocus.x + offset,
        worldStart: previousLocus.worldStart + offset,
        worldEnd: previousLocus.worldEnd + offset,
        bounds: translateBounds(previousLocus.bounds, offset),
        genes: [],
      };
      loci.set(locus.source.uid, locus);
      cluster.loci.push(locus);
      changedLocusIds.add(locus.source.uid);

      for (const previousGene of previousLocus.genes) {
        const gene = {
          ...previousGene,
          locus,
          polygon: translatePolygon(previousGene.polygon, offset),
          bounds: translateBounds(previousGene.bounds, offset),
        };
        genes.set(gene.source.uid, gene);
        locus.genes.push(gene);
        changedGeneIds.add(gene.source.uid);
      }
    }
  }

  const bounds = sceneBounds(loci);
  for (const [uid, previousCluster] of clusters) {
    const clusterStart = Math.min(...previousCluster.loci.map((locus) => locus.worldStart));
    const labelX =
      (options.alignLabels && bounds ? bounds.minX : clusterStart) - previousCluster.x - 10;
    clusters.set(uid, {
      ...previousCluster,
      info: {
        ...previousCluster.info,
        x: labelX,
        locusText: options.clusterLabel(previousCluster.source),
      },
    });
  }

  const geneMidpoint = options.shape.tipHeight + options.shape.bodyHeight / 2;
  const links = new Map(patched.links);
  const changedLinks = [];
  for (const previousLink of patched.links.values()) {
    if (
      !changedGeneIds.has(previousLink.source.query.uid) &&
      !changedGeneIds.has(previousLink.source.target.uid)
    ) continue;
    const layout = createLinkLayout(previousLink.source, previousLink.order, {
      genes,
      loci,
      clusters,
      areClustersAdjacent: options.areClustersAdjacent,
      scaleX: options.scaleX,
      link: options.link,
      geneMidpoint,
    });
    links.set(layout.source.uid, layout);
    changedLinks.push([layout.source.uid, layout]);
  }

  const locusRegions = new Map(patched.hitRegions.loci);
  const geneRegions = new Map(patched.hitRegions.genes);
  for (const locusUid of changedLocusIds) {
    const locus = loci.get(locusUid);
    if (locus) locusRegions.set(locusUid, createLocusHitRegions(locus));
  }
  for (const geneUid of changedGeneIds) {
    const gene = genes.get(geneUid);
    const region = gene && createGeneHitRegion(gene);
    if (region) geneRegions.set(geneUid, region);
    else geneRegions.delete(geneUid);
  }
  const all = [];
  for (const region of patched.hitRegions.all) {
    if (changedLocusIds.has(region.locusUid)) {
      if (region.action === "move-locus") {
        const replacement = locusRegions.get(region.locusUid);
        all.push(replacement.move, replacement.trimLeft, replacement.trimRight);
      }
      continue;
    }
    if (changedGeneIds.has(region.geneUid)) {
      const replacement = geneRegions.get(region.geneUid);
      if (replacement) all.push(replacement);
      continue;
    }
    all.push(region);
  }
  const hitRegions = { all, loci: locusRegions, genes: geneRegions };

  const changedLoci = [...changedLocusIds]
    .map((uid) => [uid, loci.get(uid)?.bounds])
    .filter(([, locusBounds]) => locusBounds);
  const changedGenes = [...changedGeneIds]
    .map((uid) => [uid, genes.get(uid)?.bounds])
    .filter(([, geneBounds]) => geneBounds);
  const chrome = patched.chrome
    ? {
        ...patched.chrome,
        legend: {
          ...patched.chrome.legend,
          position: {
            ...patched.chrome.legend.position,
            x: patched.chrome.legend.position.x + bounds.maxX - patched.bounds.maxX,
          },
        },
      }
    : null;

  return {
    ...patched,
    clusters,
    loci,
    genes,
    links,
    bounds,
    index: {
      ...patched.index,
      genes: updateSpatialIndex(
        patched.index.genes,
        changedGenes,
        [...genes].map(([uid, gene]) => [uid, gene.bounds])
      ),
      loci: updateSpatialIndex(
        patched.index.loci,
        changedLoci,
        [...loci].map(([uid, locus]) => [uid, locus.bounds])
      ),
      links: updateSpatialIndex(
        patched.index.links,
        changedLinks.map(([uid, layout]) => [uid, layout.bounds]),
        [...links].map(([uid, layout]) => [uid, layout.bounds])
      ),
      hitLoci: updateSpatialIndex(
        patched.index.hitLoci,
        changedLoci.map(([uid]) => {
          const regions = locusRegions.get(uid);
          return [uid, boundsFromRegions([regions.move, regions.trimLeft, regions.trimRight])];
        }),
        [...locusRegions].map(([uid, regions]) => [
          uid,
          boundsFromRegions([regions.move, regions.trimLeft, regions.trimRight]),
        ])
      ),
    },
    hitRegions,
    chrome,
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

/**
 * Describe a transient trim using the current scene and updated locus-scale
 * offsets. The controller updates scales (but not the scene) before calling
 * this, so sibling loci retain their correct packed positions without a full
 * data-to-scene projection for every pointer event.
 */
export function createLocusTrimPreview(
  scene,
  locusUid,
  state,
  { localXFor, scaleX, alignLabels }
) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;

  const locusOffsets = new Map();
  for (const candidate of scene.loci.values()) {
    locusOffsets.set(candidate.source.uid, localXFor(candidate.source.uid) - candidate.localX);
  }
  const offsetFor = (candidate) => locusOffsets.get(candidate.source.uid) || 0;
  const trimmed = {
    worldStart: locus.x + offsetFor(locus) + scaleX(state.start),
    worldEnd: locus.x + offsetFor(locus) + scaleX(state.end),
    track: {
      ...locus.track,
      x1: scaleX(state.start),
      x2: scaleX(state.end),
    },
    hover: {
      ...locus.hover,
      x: scaleX(state.start),
      width: scaleX(state.end) - scaleX(state.start),
      leftHandleX: scaleX(state.start) - 8,
      rightHandleX: scaleX(state.end),
    },
  };
  const locusGeometry = new Map([[locusUid, trimmed]]);
  const startFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldStart
      : candidate.worldStart + offsetFor(candidate);
  const endFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldEnd
      : candidate.worldEnd + offsetFor(candidate);
  const geneVisibility = new Map();
  for (const gene of scene.genes.values()) {
    if (gene.locus.source.uid !== locusUid) continue;
    geneVisibility.set(
      gene.source.uid,
      gene.display.start >= state.start && gene.display.end <= state.end + 1
    );
  }

  const clusterLabelOffsets = new Map();
  const minStart = (loci, start = (candidate) => candidate.worldStart) =>
    Math.min(...loci.map(start));
  if (alignLabels) {
    const oldStart = minStart([...scene.loci.values()]);
    const newStart = minStart([...scene.loci.values()], startFor);
    for (const cluster of scene.clusters.values()) {
      clusterLabelOffsets.set(cluster.source.uid, newStart - oldStart);
    }
  } else {
    for (const cluster of scene.clusters.values()) {
      const oldStart = minStart(cluster.loci);
      const newStart = minStart(cluster.loci, startFor);
      clusterLabelOffsets.set(cluster.source.uid, newStart - oldStart);
    }
  }

  const maxX = Math.max(...[...scene.loci.values()].map(endFor));
  const chrome = scene.chrome
    ? {
        ...scene.chrome,
        legend: {
          ...scene.chrome.legend,
          position: {
            ...scene.chrome.legend.position,
            x: scene.chrome.legend.position.x + maxX - scene.bounds.maxX,
          },
        },
      }
    : null;
  return {
    type: "locus-trim",
    locusUid,
    locusOffsets,
    loci: locusGeometry,
    geneVisibility,
    clusterLabelOffsets,
    chrome,
  };
}

/**
 * Describe flip frames without re-projecting the chart.
 *
 * A flip is a reflection in the locus's untrimmed display extent.  Keeping
 * that fact in a small patch lets Canvas animate only the changed locus while
 * retained scene geometry and spatial culling handle everything else.
 */
export function createLocusFlipPreview(scene, locusUid, { scaleX, progress = 0 }) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;

  // Source loci normally retain their biological extent. The state fallback
  // also keeps this helper usable with compact renderer test scenes.
  const length =
    (locus.source.end ?? locus.state.end) - (locus.source.start ?? locus.state.start);
  const left = locus.x + scaleX(0);
  const right = locus.x + scaleX(length);
  return {
    type: "locus-flip",
    locusUid,
    progress,
    axes: new Map([[locusUid, (left + right) / 2]]),
  };
}

/**
 * Describe the temporary rows of a cluster drag relative to an existing
 * scene. The active cluster follows the pointer; every other cluster snaps to
 * its row in the preview order.
 */
export function createClusterDragPreview(scene, { clusterUid, position, order, rows }) {
  const clusterOffsets = new Map();
  const clusterOrder = new Map();
  for (const [index, uid] of order.entries()) {
    const cluster = scene.clusters.get(uid);
    if (!cluster) continue;
    const y = uid === clusterUid ? position : rows[index];
    clusterOffsets.set(uid, y - cluster.y);
    clusterOrder.set(uid, index);
  }
  return { type: "cluster-drag", clusterUid, clusterOffsets, clusterOrder };
}

// Kept as a compatibility alias while callers adopt the scene terminology.
export const createLayoutProjection = buildScene;
