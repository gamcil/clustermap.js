import { boundsInViewport } from "./camera.mjs";
import { clusterPairKey } from "../links/layout.mjs";
import { arrangeTrimIndicators, createTrimIndicators } from "../loci/trimIndicators.mjs";

function minStart(loci, startFor) {
  let start = Infinity;
  for (const locus of loci) start = Math.min(start, startFor(locus));
  return start;
}

function clusterUidForLocus(locus) {
  return locus.cluster?.uid ?? locus.cluster?.source?.uid ?? locus.source.clusterUid;
}

function clusterLabelOffsetsForStarts(
  scene,
  startFor,
  alignLabels,
  affectedClusters = scene.clusters.values()
) {
  const offsets = new Map();
  if (alignLabels) {
    const offset = minStart(scene.loci.values(), startFor) -
      minStart(scene.loci.values(), (locus) => locus.worldStart);
    for (const cluster of scene.clusters.values()) offsets.set(cluster.source.uid, offset);
    return offsets;
  }
  for (const cluster of affectedClusters) {
    offsets.set(
      cluster.source.uid,
      minStart(cluster.loci, startFor) - minStart(cluster.loci, (locus) => locus.worldStart)
    );
  }
  return offsets;
}

function chromeForPreview(scene, maxX) {
  if (!scene.chrome) return null;
  const dx = scene.annotationPanels?.length ? annotationOffsetForPreview(scene, { contentMaxX: maxX }) : maxX - scene.bounds.maxX;
  return {
    ...scene.chrome,
    legend: {
      ...scene.chrome.legend,
      position: {
        ...scene.chrome.legend.position,
        x:
          scene.chrome.legend.placement === "bottom"
            ? scene.chrome.legend.position.x
            : scene.chrome.legend.position.x + dx,
      },
    },
  };
}

/** Keep the annotation group beyond stationary scales while loci move. */
export function annotationOffsetForPreview(scene, preview) {
  if (!scene.annotationPanels?.length || preview?.contentMaxX === undefined) return 0;
  let right = -Infinity;
  for (const locus of scene.loci.values()) right = Math.max(right, locus.worldEnd);
  const movingRight = scene.bounds.maxX + preview.contentMaxX - right;
  return Math.max(movingRight, scene.annotationChromeRight ?? -Infinity) -
    (scene.annotationAnchorX ?? scene.bounds.maxX);
}

function locusPreview(scene, fields, startFor, endFor, alignLabels, affectedClusters) {
  let contentMaxX = -Infinity;
  for (const locus of scene.loci.values()) contentMaxX = Math.max(contentMaxX, endFor(locus));
  return {
    ...fields,
    contentMaxX,
    clusterLabelOffsets: clusterLabelOffsetsForStarts(scene, startFor, alignLabels, affectedClusters),
    chrome: chromeForPreview(scene, contentMaxX),
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
  const startFor = (candidate) =>
    candidate.source.uid === locusUid ? candidate.worldStart + offsetX : candidate.worldStart;
  const endFor = (candidate) =>
    candidate.source.uid === locusUid ? candidate.worldEnd + offsetX : candidate.worldEnd;
  return locusPreview(scene, {
    type: "locus-offset",
    locusUid,
    offsetX,
  }, startFor, endFor, alignLabels, [scene.clusters.get(locus.cluster.uid)]);
}

/** Describe several transient locus translations without rebuilding the scene. */
export function createLocusOffsetsPreview(scene, offsets, { alignLabels }) {
  const locusOffsets = new Map();
  const affectedClusters = new Set();
  for (const [locusUid, offset] of offsets) {
    const locus = scene.loci.get(locusUid);
    if (!locus) continue;
    locusOffsets.set(locusUid, offset - locus.localX);
    const cluster = scene.clusters.get(locus.cluster.uid);
    if (cluster) affectedClusters.add(cluster);
  }
  if (!locusOffsets.size) return null;
  const offsetFor = (candidate) => locusOffsets.get(candidate.source.uid) || 0;
  const startFor = (candidate) => candidate.worldStart + offsetFor(candidate);
  const endFor = (candidate) => candidate.worldEnd + offsetFor(candidate);
  return locusPreview(scene, {
    type: "locus-offsets",
    locusOffsets,
  }, startFor, endFor, alignLabels, affectedClusters);
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
  { localXFor, scaleX, alignLabels, shape, trimIndicatorStyle = {}, clusterLabelText = null }
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
    trimIndicators: createTrimIndicators({
      locus: locus.source,
      state,
      getGeneState: (gene) => scene.genes.get(gene.uid)?.display || gene,
      scaleX,
      shape,
    }),
  };
  const locusGeometry = new Map([[locusUid, trimmed]]);
  const arrangedTrimIndicators = arrangeTrimIndicators(
    scene.loci.values(),
    new Map([[locusUid, trimmed.trimIndicators]]),
    trimIndicatorStyle
  );
  trimmed.trimIndicators = arrangedTrimIndicators.get(locusUid) || [];
  const startFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldStart
      : candidate.worldStart + offsetFor(candidate);
  const endFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldEnd
      : candidate.worldEnd + offsetFor(candidate);
  const geneVisibility = new Map();
  for (const gene of locus.genes) {
    geneVisibility.set(
      gene.source.uid,
      gene.display.start >= state.start && gene.display.end <= state.end + 1
    );
  }

  return locusPreview(scene, {
    type: "locus-trim",
    locusUid,
    locusOffsets,
    loci: locusGeometry,
    geneVisibility,
    ...(clusterLabelText === null
      ? {}
      : {
          clusterLabelTexts: new Map([[
            clusterUidForLocus(locus),
            clusterLabelText,
          ]]),
        }),
  }, startFor, endFor, alignLabels);
}

// Preview patches carry layout deltas rather than cloned scenes. These
// accessors keep SVG, Canvas chrome, and dense WebGPU marks on the same
// locus, cluster, and link geometry.
export function locusOffsetForPreview(preview, locusUid) {
  if (preview?.locusOffsets?.has(locusUid)) return preview.locusOffsets.get(locusUid);
  return preview?.type === "locus-offset" && preview.locusUid === locusUid
    ? preview.offsetX
    : 0;
}

export function clusterLabelOffsetForPreview(preview, clusterUid) {
  return preview?.clusterLabelOffsets?.get(clusterUid) || 0;
}

export function clusterLabelTextForPreview(preview, clusterUid, fallback) {
  return preview?.clusterLabelTexts?.get(clusterUid) ?? fallback;
}

export function clusterOffsetForPreview(preview, clusterUid) {
  return preview?.clusterOffsets?.get(clusterUid) || 0;
}

export function previewOffsetsForLocus(preview, locus) {
  if (!preview || !locus) return { x: 0, y: 0 };
  return {
    x: locusOffsetForPreview(preview, locus.source?.uid),
    y: clusterOffsetForPreview(preview, locus.cluster?.uid ?? locus.source?.clusterUid),
  };
}

export function locusGeometryForPreview(preview, locus) {
  if (preview?.type === "locus-flip") {
    const axis = preview.axes?.get(locus.source.uid);
    if (axis !== undefined) {
      const flip = (x) => x + (axis * 2 - x - x) * preview.progress;
      const start = flip(locus.worldStart);
      const end = flip(locus.worldEnd);
      const hoverStart = flip(locus.x + locus.hover.x);
      const hoverEnd = flip(locus.x + locus.hover.x + locus.hover.width);
      const left = Math.min(start, end);
      const right = Math.max(start, end);
      return {
        offsets: previewOffsetsForLocus(preview, locus),
        worldStart: left,
        worldEnd: right,
        track: {
          ...locus.track,
          x1: flip(locus.x + locus.track.x1) - locus.x,
          x2: flip(locus.x + locus.track.x2) - locus.x,
        },
        hover: {
          ...locus.hover,
          x: Math.min(hoverStart, hoverEnd) - locus.x,
          width: Math.abs(hoverEnd - hoverStart),
          leftHandleX: left - locus.x - 8,
          rightHandleX: right - locus.x,
        },
      };
    }
  }
  const trimmed = preview?.loci?.get(locus.source.uid);
  return {
    offsets: previewOffsetsForLocus(preview, locus),
    ...(trimmed || {}),
  };
}

export function geneVisibleForPreview(preview, gene) {
  return gene && (preview?.geneVisibility?.get(gene.source.uid) ?? gene.visible);
}

/** Describe flip frames without re-projecting the chart. */
export function createLocusFlipPreview(
  scene,
  locusUid,
  { progress = 0, clusterLabelText = null } = {}
) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  return {
    type: "locus-flip",
    locusUid,
    progress,
    ...(clusterLabelText === null
      ? {}
      : {
          clusterLabelTexts: new Map([[
            clusterUidForLocus(locus),
            clusterLabelText,
          ]]),
        }),
    // The projected bounds reflect the currently displayed locus, including
    // any committed trim. Source coordinates describe the original record and
    // must not determine the transient flip axis.
    axes: new Map([[locusUid, (locus.worldStart + locus.worldEnd) / 2]]),
  };
}

/** Describe temporary cluster rows without rebuilding a scene. */
export function createClusterDragPreview(scene, { clusterUid, position, positions, order, rows }) {
  const clusterOffsets = new Map();
  const clusterOrder = new Map();
  for (const [index, uid] of order.entries()) {
    const cluster = scene.clusters.get(uid);
    if (!cluster) continue;
    const y = positions?.get(uid) ?? (uid === clusterUid ? position : rows[index]);
    clusterOffsets.set(uid, y - cluster.y);
    clusterOrder.set(uid, index);
  }
  return { type: "cluster-drag", clusterUid, clusterOffsets, clusterOrder };
}

export function offsetsForGene(preview, gene) {
  return previewOffsetsForLocus(preview, gene.locus);
}

function flipAxisForGene(preview, gene) {
  return preview?.type === "locus-flip"
    ? preview.axes?.get(gene?.locus?.source?.uid)
    : undefined;
}

export function geneGeometryForPreview(preview, gene) {
  const axis = flipAxisForGene(preview, gene);
  if (axis === undefined) return {};
  const progress = preview.progress;
  const flipScale = 1 - 2 * progress;
  const flip = (x) => axis + (x - axis) * flipScale;
  return {
    flipAxis: axis,
    flipScale,
    labelX: flip(gene.locus.x + gene.label.x),
  };
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

export function previewLinkAnchors(scene, link, preview) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return null;
  const anchorForGene = (gene) => {
    const offsets = offsetsForGene(preview, gene);
    // Bounds are calculated when the retained scene is built and equal the
    // polygon's horizontal extent. Reusing them avoids a vertex scan for each
    // animated link endpoint on every frame.
    let minX = gene.bounds?.minX;
    let maxX = gene.bounds?.maxX;
    // Retain support for compact third-party scenes that only expose a
    // polygon. Production scenes always take the cached-bounds path above.
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      minX = Infinity;
      maxX = -Infinity;
      for (let index = 0; index < gene.polygon.length; index += 2) {
        minX = Math.min(minX, gene.polygon[index]);
        maxX = Math.max(maxX, gene.polygon[index]);
      }
    }
    minX += offsets.x;
    maxX += offsets.x;
    const forward = gene.display.strand === 1;
    const axis = flipAxisForGene(preview, gene);
    if (axis === undefined) {
      return [
        forward ? minX : maxX,
        forward ? maxX : minX,
        gene.locus.y + gene.locus.track.y + offsets.y,
      ];
    }
    const progress = preview.progress;
    const targetMin = axis * 2 - maxX;
    const targetMax = axis * 2 - minX;
    const from = forward ? [minX, maxX] : [maxX, minX];
    const to = forward ? [targetMax, targetMin] : [targetMin, targetMax];
    return [
      from[0] + (to[0] - from[0]) * progress,
      from[1] + (to[1] - from[1]) * progress,
      gene.locus.y + gene.locus.track.y + offsets.y,
    ];
  };
  const queryAnchor = anchorForGene(query);
  const targetAnchor = anchorForGene(target);
  return queryAnchor[2] <= targetAnchor[2]
    ? [...queryAnchor, ...targetAnchor]
    : [...targetAnchor, ...queryAnchor];
}

export function linkGeometryForPreview(scene, link, preview, config) {
  const visible = linkVisibleForPreview(scene, link, preview, config);
  if (preview?.type === "cluster-drag" || preview?.type === "locus-flip") {
    const query = scene.genes.get(link.source.query.uid);
    const target = scene.genes.get(link.source.target.uid);
    const affected = preview.type === "cluster-drag" ||
      query?.locus?.source?.uid === preview.locusUid ||
      target?.locus?.source?.uid === preview.locusUid;
    return { visible, anchors: visible && affected ? previewLinkAnchors(scene, link, preview) : link.anchors };
  }
  const anchors = link.anchors;
  if (!preview || !anchors) return { visible, anchors };
  const { a, b } = linkOffsetsForPreview(scene, link, preview);
  return { visible, anchors: a || b
    ? [anchors[0] + a, anchors[1] + a, anchors[2], anchors[3] + b, anchors[4] + b, anchors[5]]
    : anchors };
}

export function linkVisibleForPreview(scene, link, preview, config) {
  if (!preview) return link.visible;
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return false;
  if (!geneVisibleForPreview(preview, query) || !geneVisibleForPreview(preview, target)) return false;
  if (preview?.type === "locus-trim") {
    return link.allowed && !link.source.hidden && link.source.identity >= config.link.threshold;
  }
  if (preview?.type !== "cluster-drag") return link.visible;
  const queryOrder = preview.clusterOrder.get(query.locus.cluster.uid);
  const targetOrder = preview.clusterOrder.get(target.locus.cluster.uid);
  return (
    queryOrder !== undefined &&
    targetOrder !== undefined &&
    Math.abs(queryOrder - targetOrder) === 1 &&
    link.allowed &&
    link.source.identity >= config.link.threshold
  );
}


export function recordsForPreview(scene, preview, { includeClusters = false } = {}) {
  if (!preview) return null;
  if (preview.type === "cluster-drag" && !includeClusters) {
    return {
      // Genes, tracks, and instanced link ribbons all resolve their row
      // offsets on the GPU, leaving only a compact visible-link index list to
      // upload while the pointer moves.
      loci: new Set(),
      genes: new Set(),
      links: new Set(),
      clusterOffsets: true,
    };
  }
  const loci = new Set();
  if (preview.type === "cluster-drag") {
    for (const locus of scene.loci.values()) {
      if (clusterOffsetForPreview(preview, locus.cluster.uid)) loci.add(locus.source.uid);
    }
  }
  if (preview.type === "locus-offset") loci.add(preview.locusUid);
  if (preview.type === "locus-offsets") {
    for (const locusUid of preview.locusOffsets.keys()) loci.add(locusUid);
  }
  if (preview.type === "locus-flip") loci.add(preview.locusUid);
  if (preview.type === "locus-trim") {
    const trimmed = scene.loci.get(preview.locusUid);
    const clusterUid = trimmed?.cluster.uid;
    // getLocusScaleValues packs loci independently within each cluster. A
    // trim can therefore shift every sibling locus even when its individual
    // offset happens to be zero in a particular preview frame.
    for (const locus of scene.loci.values()) {
      if (locus.cluster.uid === clusterUid) loci.add(locus.source.uid);
    }
  }
  const genes = new Set();
  for (const uid of loci) {
    for (const gene of scene.loci.get(uid)?.genes || []) genes.add(gene.source.uid);
  }
  const links = new Set();
  if (scene.linksByGene) {
    for (const uid of genes) {
      for (const link of scene.linksByGene.get(uid) || []) links.add(link.uid);
    }
  } else {
    for (const link of scene.links.values()) {
      if (genes.has(link.source.query.uid) || genes.has(link.source.target.uid)) links.add(link.source.uid);
    }
  }
  return { loci, genes, links };
}


export function genePolygonForPreview(preview, gene, { includeClusterOffset = true } = {}) {
  const { x, y } = previewOffsetsForLocus(preview, gene.locus);
  // Retained GPU vertices and SVG children apply cluster rows at their parent.
  const bakedY = includeClusterOffset ? y : 0;
  const axis = preview?.type === "locus-flip"
    ? preview.axes?.get(gene.locus.source.uid)
    : undefined;
  if (!x && !y && axis === undefined) return gene.polygon;
  const scale = axis === undefined ? 1 : 1 - 2 * preview.progress;
  return gene.polygon.map((coordinate, index) =>
    index % 2
      ? coordinate + bakedY
      : (axis === undefined ? coordinate : axis + (coordinate - axis) * scale) + x
  );
}

/** Visible preview rows and their adjacent cluster pairs, shared by raster backends. */
export function clusterPreviewInViewport(scene, preview, viewport, { includeLinks = true } = {}) {
  const clusters = [...scene.clusters.values()].filter((cluster) => boundsInViewport(
    cluster.bounds, viewport, { y: clusterOffsetForPreview(preview, cluster.source.uid) }
  ));
  const pairs = new Set();
  if (includeLinks) {
    const clusterUidByOrder = new Map([...preview.clusterOrder].map(([uid, order]) => [order, uid]));
    for (const cluster of clusters) {
      const order = preview.clusterOrder.get(cluster.source.uid);
      for (const neighbourOrder of [order - 1, order + 1]) {
        const neighbour = clusterUidByOrder.get(neighbourOrder);
        if (neighbour !== undefined) pairs.add(clusterPairKey(cluster.source.uid, neighbour));
      }
    }
  }
  return { clusters, pairs };
}
