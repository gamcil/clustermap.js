import { createChartState } from "./state.mjs";
import { setTreeClusterOrder } from "../tree/model.mjs";

const finiteNumber = (value) => Number.isFinite(value) ? value : null;
const stateEntries = (value) => Array.isArray(value)
  ? value.filter((entry) => Array.isArray(entry) && entry.length === 2 && entry[0] !== undefined)
  : [];
const recordStateEntries = (value) => stateEntries(value)
  .filter(([, entry]) => entry && typeof entry === "object" && !Array.isArray(entry));

function offsetEntries(entries) {
  return [...entries].filter(([, value]) => Number.isFinite(value) && value !== 0);
}

function locusSnapshot(state) {
  return {
    start: state.start,
    end: state.end,
    flipped: Boolean(state.flipped),
    trimLeft: state.trimLeft?.uid ?? null,
    trimRight: state.trimRight?.uid ?? null,
  };
}

function geneSnapshot(state) {
  return { start: state.start, end: state.end, strand: state.strand };
}

function createSnapshotBaseline(data) {
  const genes = new Map();
  const loci = new Map();
  const clusterOrder = [];
  for (const cluster of data.clusters) {
    clusterOrder.push(cluster.uid);
    for (const locus of cluster.loci) {
      loci.set(locus.uid, { start: locus.start, end: locus.end });
      const locusBio = locus.bio || locus;
      for (const gene of locus.genes) {
        const geneBio = gene.bio || gene;
        genes.set(`${locus.uid}:${gene.uid}`, {
          start: geneBio.start - locusBio.start,
          end: geneBio.end - locusBio.start,
          strand: geneBio.strand,
        });
      }
    }
  }
  return { genes, loci, clusterOrder };
}

function sameState(left, right) {
  return left && right && left.start === right.start && left.end === right.end && left.strand === right.strand;
}

function changedLocusEntries(state, loci) {
  return [...state.loci]
    .filter(([uid, value]) => {
      const locus = loci.get(uid);
      return locus && (
        value.start !== locus.start ||
        value.end !== locus.end ||
        value.flipped ||
        value.trimLeft ||
        value.trimRight
      );
    })
    .map(([uid, value]) => [uid, locusSnapshot(value)]);
}

function snapshotFromBaseline(state, data, baseline) {
  const defaultOrder = baseline.clusterOrder;
  const genes = [];
  for (const [uid, value] of state.genes) {
    if (!sameState(value, baseline.genes.get(uid))) genes.push([uid, geneSnapshot(value)]);
  }
  return {
    version: 1,
    ...(state.excludedClusters.size ? { excludedClusters: [...state.excludedClusters] } : {}),
    ...(state.excludedLoci.size ? { excludedLoci: [...state.excludedLoci] } : {}),
    // Tree child order changes with edits. Keep its leaf order explicit so an
    // undo snapshot can restore it even if it matched source cluster order.
    clusterOrder: !data.tree && state.clusterOrder.length === defaultOrder.length && state.clusterOrder.every((uid, index) => uid === defaultOrder[index])
      ? []
      : [...state.clusterOrder],
    clusterOffsets: offsetEntries(state.clusterOffsets),
    locusOffsets: offsetEntries(state.locusOffsets),
    loci: changedLocusEntries(state, baseline.loci),
    genes,
    camera: { ...state.camera },
  };
}

/** Return a JSON-safe snapshot without retaining a cache for standalone callers. */
export function serializeChartState(state, data) {
  return snapshotFromBaseline(state, data, createSnapshotBaseline(data));
}

/**
 * One baseline per chart, shared by history, state reads, and project exports.
 * reset(data) rebuilds eagerly, including for in-place source edits; reset()
 * releases the cache. Geometry/state-only edits do not invalidate the baseline.
 * Returned snapshots own their values and never retain the baseline Maps.
 */
export function createChartStateSerializer() {
  let source = null;
  let baseline = null;
  function reset(data = null) {
    source = data;
    baseline = data ? createSnapshotBaseline(data) : null;
  }
  return {
    reset,
    serialize(state, data) {
      if (source !== data || !baseline) reset(data);
      return snapshotFromBaseline(state, data, baseline);
    },
  };
}

function boundaryGene(value, genes) {
  // Early project exports stored the whole gene record. Accept those files as
  // well as the current compact UID form.
  const uid = value && typeof value === "object" ? value.uid : value;
  return genes.get(uid) || null;
}

/** Restore a durable chart snapshot, ignoring records absent from this data. */
export function chartStateFromSnapshot(data, snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Chart state must be an object.");
  }
  const loci = data.clusters.flatMap((cluster) => cluster.loci);
  const genesByLocus = new Map(loci.map((locus) => [
    locus.uid,
    new Map(locus.genes.map((gene) => [gene.uid, gene])),
  ]));
  const restored = createChartState(data, {
    excludedClusters: Array.isArray(snapshot.excludedClusters) ? snapshot.excludedClusters : [],
    excludedLoci: Array.isArray(snapshot.excludedLoci) ? snapshot.excludedLoci : [],
  });
  const applyOffsets = (entries, allowed, target) => stateEntries(entries).forEach(([uid, value]) => {
    if (allowed.has(uid) && finiteNumber(value) !== null) target.set(uid, value);
  });
  applyOffsets(snapshot.clusterOffsets, restored.clusterOffsets, restored.clusterOffsets);
  applyOffsets(snapshot.locusOffsets, restored.loci, restored.locusOffsets);
  recordStateEntries(snapshot.loci).forEach(([uid, value]) => {
    const target = restored.loci.get(uid);
    if (!target) return;
    ["start", "end"].forEach((key) => {
      if (finiteNumber(value[key]) !== null) target[key] = value[key];
    });
    target.trimLeft = boundaryGene(value.trimLeft, genesByLocus.get(uid));
    target.trimRight = boundaryGene(value.trimRight, genesByLocus.get(uid));
    if (value.flipped !== undefined) target.flipped = Boolean(value.flipped);
  });
  recordStateEntries(snapshot.genes).forEach(([key, value]) => {
    const target = restored.genes.get(key);
    if (!target) return;
    ["start", "end", "strand"].forEach((property) => {
      if (finiteNumber(value[property]) !== null) target[property] = value[property];
    });
  });
  const camera = snapshot.camera || {};
  if (Array.isArray(snapshot.clusterOrder)) {
    const order = snapshot.clusterOrder.filter((uid) => restored.clusterOffsets.has(uid));
    restored.clusterOrder = [...new Set([...order, ...restored.clusterOrder])];
    setTreeClusterOrder(data.tree, restored.clusterOrder);
  }
  if (finiteNumber(camera.x) !== null && finiteNumber(camera.y) !== null && finiteNumber(camera.k) !== null && camera.k > 0) {
    restored.camera = { x: camera.x, y: camera.y, k: camera.k };
  }
  return restored;
}
