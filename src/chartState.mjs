export function createChartState(data, previous = null) {
  const loci = previous?.loci || new Map();
  const genes = previous?.genes || new Map();
  const clusterOffsets = previous?.clusterOffsets || new Map();
  const locusOffsets = previous?.locusOffsets || new Map();
  const camera = previous?.camera || { x: 0, y: 0, k: 1 };
  const dragging = previous?.dragging || false;
  const clusterIds = data.clusters.map((cluster) => cluster.uid);
  const clusterIdSet = new Set(clusterIds);
  const clusterOrder = [
    ...(previous?.clusterOrder || []).filter((uid) => clusterIdSet.has(uid)),
    ...clusterIds.filter((uid) => !previous?.clusterOrder?.includes(uid)),
  ];
  const present = new Set();
  for (const cluster of data.clusters) {
    if (!clusterOffsets.has(cluster.uid)) clusterOffsets.set(cluster.uid, 0);
    for (const locus of cluster.loci) {
      present.add(locus.uid);
      if (!loci.has(locus.uid)) {
        loci.set(locus.uid, {
          start: locus.start,
          end: locus.end,
          flipped: false,
          trimLeft: null,
          trimRight: null,
        });
      }
      for (const gene of locus.genes) {
        const geneBio = gene.bio || {
          start: gene.start,
          end: gene.end,
          strand: gene.strand,
        };
        const locusBio = locus.bio || { start: locus.start, end: locus.end };
        const key = `${locus.uid}:${gene.uid}`;
        present.add(key);
        if (!genes.has(key)) {
          genes.set(key, {
            start: geneBio.start - locusBio.start,
            end: geneBio.end - locusBio.start,
            strand: geneBio.strand,
          });
        }
      }
    }
  }
  for (const uid of loci.keys()) {
    if (!data.clusters.some((cluster) => cluster.loci.some((locus) => locus.uid === uid))) loci.delete(uid);
  }
  for (const uid of genes.keys()) if (!present.has(uid)) genes.delete(uid);
  for (const uid of clusterOffsets.keys()) {
    if (!clusterIdSet.has(uid)) clusterOffsets.delete(uid);
  }
  for (const uid of locusOffsets.keys()) {
    if (!loci.has(uid)) locusOffsets.delete(uid);
  }
  return { loci, genes, clusterOffsets, locusOffsets, clusterOrder, camera, dragging };
}

export function isDragging(chartState) {
  return chartState.dragging;
}

export function setDragging(chartState, dragging) {
  chartState.dragging = dragging;
}

export function getClusterOrder(chartState) {
  return chartState.clusterOrder;
}

export function setClusterOrder(chartState, order) {
  chartState.clusterOrder = [...order];
}

export function moveClusterToIndex(chartState, uid, index) {
  const order = [...chartState.clusterOrder];
  const current = order.indexOf(uid);
  if (current === -1) return order;
  order.splice(current, 1);
  order.splice(Math.max(0, Math.min(index, order.length)), 0, uid);
  chartState.clusterOrder = order;
  return order;
}

export function getClusterOffset(chartState, uid) {
  return chartState.clusterOffsets.get(uid) ?? 0;
}

export function setClusterOffset(chartState, uid, offset) {
  chartState.clusterOffsets.set(uid, offset);
}

export function getLocusOffset(chartState, uid) {
  return chartState.locusOffsets.get(uid) ?? 0;
}

export function setLocusOffset(chartState, uid, offset) {
  chartState.locusOffsets.set(uid, offset);
}

export function initializeLocusOffsets(chartState, defaults) {
  for (const [uid, offset] of defaults) {
    if (!chartState.locusOffsets.has(uid)) chartState.locusOffsets.set(uid, offset);
  }
}

export function getCamera(chartState) {
  return chartState.camera;
}

export function setCamera(chartState, { x, y, k }) {
  chartState.camera = { x, y, k };
}

export function getLocusState(chartState, locus) {
  return chartState.loci.get(locus.uid);
}

export function getGeneState(chartState, gene) {
  return chartState.genes.get(`${gene.locusUid}:${gene.uid}`);
}

export function formatLocusText(loci, chartState, hideCoordinates) {
  return loci
    .map((locus) => {
      let start;
      let end;

      const state = getLocusState(chartState, locus);
      if (locus.bio) {
        let startDiff = state.start - locus.start;
        let endDiff = locus.end - state.end;
        if (state.flipped) [startDiff, endDiff] = [endDiff, startDiff];
        start = locus.bio.start + startDiff + 1;
        end = locus.bio.end - endDiff;
      } else {
        start = state.start + 1;
        end = state.end;
      }

      if (state.flipped) [start, end] = [end, start];

      const reversed = state.flipped ? " (reversed)" : "";
      if (hideCoordinates || state.start == null || state.end == null)
        return `${locus.name}${reversed}`;
      return `${locus.name}${reversed}:${start.toFixed(0)}-${end.toFixed(0)}`;
    })
    .join(", ");
}

/**
 * Synchronize derived display coordinates after a trim, flip, or a change to
 * unscaled-gene mode. This is state work: it deliberately does not depend on
 * a renderer or a D3 scale.
 */
export function synchronizeLocusState(chartState, locus, scaleGenes) {
  locus.genes.forEach((gene, index, genes) => {
    const state = getGeneState(chartState, gene);
    const length = scaleGenes ? state.end - state.start : 1000;
    state.start = scaleGenes
      ? state.start
      : index > 0
      ? getGeneState(chartState, genes[index - 1]).end
      : 0;
    state.end = state.start + length;
  });

  const state = getLocusState(chartState, locus);
  const oldStart = state.start;
  const lastGene = locus.genes[locus.genes.length - 1];
  state.start = state.trimLeft
    ? getGeneState(chartState, state.trimLeft).start
    : 0;
  state.end = state.trimRight
    ? getGeneState(chartState, state.trimRight).end
    : scaleGenes
    ? locus.end
    : lastGene.end;

  return { oldStart };
}

function boundaryIndex(values, target, edge) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  if (edge === "left") return Math.min(low, values.length - 1);
  if (low === 0) return 0;
  if (low === values.length) return values.length - 1;
  return target - values[low - 1] <= values[low] - target ? low - 1 : low;
}

/**
 * Apply a trim at the display boundary under a resize handle. The left handle
 * rounds forward to a gene start; the right handle selects the nearest gene
 * end, matching the drawn gene geometry.
 * `coordinateFor` is supplied by the caller, keeping the state transition
 * independent of D3 scales and any particular renderer.
 */
export function trimLocus(chartState, locus, {
  edge,
  position,
  coordinateFor,
  scaleGenes,
}) {
  const state = getLocusState(chartState, locus);
  const genes = [...locus.genes].sort(
    (left, right) =>
      getGeneState(chartState, left).start - getGeneState(chartState, right).start
  );

  if (edge === "left") {
    const visible = genes.filter(
      (gene) => getGeneState(chartState, gene).end <= state.end
    );
    const boundaries = [
      locus.start,
      ...visible.map((gene) => getGeneState(chartState, gene).start),
    ];
    const index = boundaryIndex(boundaries.map(coordinateFor), position, edge);
    state.start = boundaries[index];
    state.trimLeft = index === 0 ? null : visible[index - 1];
    return { state, coordinate: coordinateFor(state.start) };
  }

  if (edge === "right") {
    const visible = genes.filter(
      (gene) => getGeneState(chartState, gene).start >= state.start
    );
    const boundaries = [
      ...visible.map((gene) => getGeneState(chartState, gene).end),
      scaleGenes ? locus.end : state.end,
    ];
    const index = boundaryIndex(boundaries.map(coordinateFor), position, edge);
    state.end = boundaries[index];
    state.trimRight = visible[index] || null;
    return { state, coordinate: coordinateFor(state.end) };
  }

  throw new Error(`Unknown locus trim edge: ${edge}`);
}

export function finalizeLocusTrim(chartState, locus) {
  const state = getLocusState(chartState, locus);
  if (state.end === locus.end) state.trimRight = null;
  if (state.start === locus.start) state.trimLeft = null;
}

/**
 * Align each represented cluster with an anchor gene. Coordinate projection is
 * injected by the controller, so this state transition remains independent of
 * D3 and of a particular renderer.
 */
export function anchorGeneGroup(chartState, {
  anchor,
  genes,
  locusForGene,
  coordinateForGene,
  flipMismatchedLoci = false,
  onLocusFlipped = () => {},
}) {
  const anchorsByCluster = new Map();
  const anchorState = getGeneState(chartState, anchor);

  for (const gene of genes) {
    if (
      flipMismatchedLoci &&
      getGeneState(chartState, gene).strand !== anchorState.strand
    ) {
      const locus = locusForGene(gene);
      flipLocus(chartState, locus);
      onLocusFlipped(locus);
    }
    const clusterGenes = anchorsByCluster.get(gene.clusterUid) || [];
    clusterGenes.push(gene);
    anchorsByCluster.set(gene.clusterUid, clusterGenes);
  }

  const midpoint = coordinateForGene(anchor);
  const changes = [];
  for (const [clusterUid, clusterGenes] of anchorsByCluster) {
    if (clusterGenes.some((gene) => gene.uid === anchor.uid)) continue;
    const closest = clusterGenes.reduce((best, gene) =>
      Math.abs(coordinateForGene(gene) - midpoint) <
      Math.abs(coordinateForGene(best) - midpoint)
        ? gene
        : best
    );
    const offset = midpoint - coordinateForGene(closest);
    setClusterOffset(
      chartState,
      clusterUid,
      getClusterOffset(chartState, clusterUid) + offset
    );
    changes.push({ clusterUid, offset, gene: closest });
  }
  return changes;
}

export function flipLocus(chartState, locus) {
  const state = getLocusState(chartState, locus);
  state.flipped = !state.flipped;
  const length = locus.end - locus.start;

  [state.trimLeft, state.trimRight] = [
    state.trimRight,
    state.trimLeft,
  ];

  locus.genes.forEach((gene) => {
    const geneState = getGeneState(chartState, gene);
    const start = geneState.start;
    geneState.start = length - geneState.end;
    geneState.end = length - start;
    geneState.strand = geneState.strand === 1 ? -1 : 1;
  });
  locus.genes.sort(
    (a, b) => getGeneState(chartState, a).start - getGeneState(chartState, b).start
  );
}
