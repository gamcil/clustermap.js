import { createChartState } from "./chartState.mjs";

const finiteNumber = (value) => Number.isFinite(value) ? value : null;
const stateEntries = (value) => Array.isArray(value)
  ? value.filter((entry) => Array.isArray(entry) && entry.length === 2 && entry[0] !== undefined)
  : [];
const recordStateEntries = (value) => stateEntries(value)
  .filter(([, entry]) => entry && typeof entry === "object" && !Array.isArray(entry));

function numericEntries(entries) {
  return [...entries].filter(([, value]) => finiteNumber(value) !== null);
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

/** Return the durable, JSON-safe portion of a chart's visual state. */
export function serializeChartState(state) {
  return {
    version: 1,
    clusterOrder: [...state.clusterOrder],
    clusterOffsets: numericEntries(state.clusterOffsets),
    locusOffsets: numericEntries(state.locusOffsets),
    loci: [...state.loci].map(([uid, value]) => [uid, locusSnapshot(value)]),
    genes: [...state.genes].map(([uid, value]) => [uid, geneSnapshot(value)]),
    camera: { ...state.camera },
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
  const clusterIds = new Set(data.clusters.map((cluster) => cluster.uid));
  const loci = data.clusters.flatMap((cluster) => cluster.loci);
  const locusIds = new Set(loci.map((locus) => locus.uid));
  const genesByLocus = new Map(loci.map((locus) => [
    locus.uid,
    new Map(locus.genes.map((gene) => [gene.uid, gene])),
  ]));
  const geneKeys = new Set(loci.flatMap((locus) => locus.genes.map((gene) => `${locus.uid}:${gene.uid}`)));
  const restored = createChartState(data);
  const applyOffsets = (entries, allowed, target) => stateEntries(entries).forEach(([uid, value]) => {
    if (allowed.has(uid) && finiteNumber(value) !== null) target.set(uid, value);
  });
  applyOffsets(snapshot.clusterOffsets, clusterIds, restored.clusterOffsets);
  applyOffsets(snapshot.locusOffsets, locusIds, restored.locusOffsets);
  recordStateEntries(snapshot.loci).forEach(([uid, value]) => {
    if (!locusIds.has(uid)) return;
    const target = restored.loci.get(uid);
    ["start", "end"].forEach((key) => {
      if (finiteNumber(value[key]) !== null) target[key] = value[key];
    });
    target.trimLeft = boundaryGene(value.trimLeft, genesByLocus.get(uid));
    target.trimRight = boundaryGene(value.trimRight, genesByLocus.get(uid));
    if (value.flipped !== undefined) target.flipped = Boolean(value.flipped);
  });
  recordStateEntries(snapshot.genes).forEach(([key, value]) => {
    if (!geneKeys.has(key)) return;
    const target = restored.genes.get(key);
    ["start", "end", "strand"].forEach((property) => {
      if (finiteNumber(value[property]) !== null) target[property] = value[property];
    });
  });
  const camera = snapshot.camera || {};
  if (Array.isArray(snapshot.clusterOrder)) {
    const order = snapshot.clusterOrder.filter((uid) => clusterIds.has(uid));
    restored.clusterOrder = [...new Set([...order, ...restored.clusterOrder])];
  }
  if (finiteNumber(camera.x) !== null && finiteNumber(camera.y) !== null && finiteNumber(camera.k) !== null && camera.k > 0) {
    restored.camera = { x: camera.x, y: camera.y, k: camera.k };
  }
  return restored;
}
