import { isRecordId } from "../utils/values.mjs";
import { createChartState } from "./state.mjs";
import { setTreeClusterOrder } from "../tree/model.mjs";

const finiteNumber = (value) => Number.isFinite(value) ? value : null;
const stateEntries = (value) => value ?? [];
const snapshotVersion = 2;

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
        genes.set(gene.uid, {
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
    version: snapshotVersion,
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

function validateSnapshot(snapshot) {
  const fail = (message) => { throw new TypeError(`Invalid chart state: ${message}`); };
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) fail("expected an object.");
  if (snapshot.version !== snapshotVersion) fail(`unsupported version; expected version ${snapshotVersion}.`);
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  for (const field of ["excludedClusters", "excludedLoci", "clusterOrder"]) {
    const values = snapshot[field];
    if (values !== undefined && (!Array.isArray(values) || values.some((uid) => !isRecordId(uid)) || new Set(values).size !== values.length)) {
      fail(`${field} must contain unique record IDs.`);
    }
  }
  for (const field of ["clusterOffsets", "locusOffsets", "loci", "genes"]) {
    const values = snapshot[field];
    if (values === undefined) continue;
    if (!Array.isArray(values)) fail(`${field} must be an array.`);
    const ids = new Set();
    for (const entry of values) {
      if (!Array.isArray(entry) || entry.length !== 2 || !isRecordId(entry[0]) || ids.has(entry[0])) fail(`${field} requires unique [ID, value] entries.`);
      ids.add(entry[0]);
      const value = entry[1];
      if (field.endsWith("Offsets")) {
        if (!Number.isFinite(value)) fail(`${field} values must be finite numbers.`);
        continue;
      }
      if (!record(value)) fail(`${field} values must be objects.`);
      for (const key of ["start", "end"]) if (value[key] !== undefined && !Number.isFinite(value[key])) fail(`${field}.${key} must be finite.`);
      if (value.start !== undefined && value.end !== undefined && value.start > value.end) fail(`${field} start must not exceed end.`);
      if (field === "loci") {
        if (value.flipped !== undefined && typeof value.flipped !== "boolean") fail("flipped must be a boolean.");
        for (const key of ["trimLeft", "trimRight"]) if (value[key] != null && !isRecordId(value[key])) fail(`${key} must be a gene ID or null.`);
      } else if (value.strand !== undefined && ![-1, 0, 1].includes(value.strand)) fail("strand must be -1, 0 or 1.");
    }
  }
  if (snapshot.camera !== undefined && (!record(snapshot.camera) ||
      ![snapshot.camera.x, snapshot.camera.y, snapshot.camera.k].every(Number.isFinite) || snapshot.camera.k <= 0)) fail("camera requires finite x/y and a positive scale.");
}

/** Restore a durable chart snapshot, ignoring records absent from this data. */
export function chartStateFromSnapshot(data, snapshot) {
  validateSnapshot(snapshot);
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
  stateEntries(snapshot.loci).forEach(([uid, value]) => {
    const target = restored.loci.get(uid);
    if (!target) return;
    ["start", "end"].forEach((key) => {
      if (finiteNumber(value[key]) !== null) target[key] = value[key];
    });
    if (target.start > target.end) throw new TypeError("Invalid chart state: locus start must not exceed end.");
    target.trimLeft = genesByLocus.get(uid).get(value.trimLeft) || null;
    target.trimRight = genesByLocus.get(uid).get(value.trimRight) || null;
    if (value.flipped !== undefined) target.flipped = value.flipped;
  });
  stateEntries(snapshot.genes).forEach(([key, value]) => {
    const target = restored.genes.get(key);
    if (!target) return;
    ["start", "end", "strand"].forEach((property) => {
      if (finiteNumber(value[property]) !== null) target[property] = value[property];
    });
  });
  for (const gene of restored.genes.values()) {
    if (gene.start > gene.end) throw new TypeError("Invalid chart state: gene start must not exceed end.");
  }
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
