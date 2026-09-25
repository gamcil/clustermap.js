function minStart(loci, startFor) {
  return Math.min(...loci.map(startFor));
}

function clusterLabelOffsetsForStarts(
  scene,
  startFor,
  alignLabels,
  affectedClusters = scene.clusters.values()
) {
  const offsets = new Map();
  if (alignLabels) {
    const loci = [...scene.loci.values()];
    const offset = minStart(loci, startFor) - minStart(loci, (locus) => locus.worldStart);
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
  return {
    ...scene.chrome,
    legend: {
      ...scene.chrome.legend,
      position: {
        ...scene.chrome.legend.position,
        x:
          scene.chrome.legend.placement === "bottom"
            ? scene.chrome.legend.position.x
            : scene.chrome.legend.position.x + maxX - scene.bounds.maxX,
      },
    },
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
  const maxX = Math.max(...[...scene.loci.values()].map(endFor));

  return {
    type: "locus-offset",
    locusUid,
    offsetX,
    clusterLabelOffsets: clusterLabelOffsetsForStarts(scene, startFor, alignLabels, [
      scene.clusters.get(locus.cluster.uid),
    ]),
    chrome: chromeForPreview(scene, maxX),
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

  const maxX = Math.max(...[...scene.loci.values()].map(endFor));
  return {
    type: "locus-trim",
    locusUid,
    locusOffsets,
    loci: locusGeometry,
    geneVisibility,
    clusterLabelOffsets: clusterLabelOffsetsForStarts(scene, startFor, alignLabels),
    chrome: chromeForPreview(scene, maxX),
  };
}

// Preview patches carry layout deltas rather than cloned scenes. These
// accessors are deliberately renderer-neutral so SVG-adjacent Canvas chrome
// and dense WebGPU marks apply exactly the same locus and cluster movement.
export function locusOffsetForPreview(preview, locusUid) {
  if (preview?.locusOffsets?.has(locusUid)) return preview.locusOffsets.get(locusUid);
  return preview?.type === "locus-offset" && preview.locusUid === locusUid
    ? preview.offsetX
    : 0;
}

export function clusterLabelOffsetForPreview(preview, clusterUid) {
  return preview?.clusterLabelOffsets?.get(clusterUid) || 0;
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
export function createLocusFlipPreview(scene, locusUid, { progress = 0 } = {}) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  return {
    type: "locus-flip",
    locusUid,
    progress,
    // The projected bounds reflect the currently displayed locus, including
    // any committed trim. Source coordinates describe the original record and
    // must not determine the transient flip axis.
    axes: new Map([[locusUid, (locus.worldStart + locus.worldEnd) / 2]]),
  };
}

/** Describe temporary cluster rows without rebuilding a scene. */
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
