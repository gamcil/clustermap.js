import test from "node:test";
import assert from "node:assert/strict";

function dataFor(...clusterIds) {
  return {
    clusters: clusterIds.map((uid) => ({ uid, loci: [] })),
  };
}

test("chart state persists cluster order across data refreshes", async () => {
  const { commitPreviewClusterOrder, createChartState, getClusterOrder, setPreviewClusterOrder } = await import(
    "../src/chartState.mjs"
  );
  let state = createChartState(dataFor("a", "b"));

  assert.deepEqual(getClusterOrder(state), ["a", "b"]);

  setPreviewClusterOrder(state, ["b", "a"]);
  commitPreviewClusterOrder(state);
  state = createChartState(dataFor("a", "b", "c"), state);
  assert.deepEqual(getClusterOrder(state), ["b", "a", "c"]);

  state = createChartState(dataFor("b", "c"), state);
  assert.deepEqual(getClusterOrder(state), ["b", "c"]);
});

test("chart state previews a cluster order before committing it", async () => {
  const {
    commitPreviewClusterOrder,
    createChartState,
    getClusterOrder,
    getClusterPosition,
    setPreviewClusterPosition,
    setPreviewClusterOrder,
  } = await import("../src/chartState.mjs");
  const state = createChartState(dataFor("a", "b", "c"));

  setPreviewClusterOrder(state, ["b", "c", "a"]);
  setPreviewClusterPosition(state, "a", 21);
  assert.deepEqual(getClusterOrder(state), ["b", "c", "a"]);
  assert.deepEqual(state.clusterOrder, ["a", "b", "c"]);
  assert.equal(getClusterPosition(state, "a", 0), 21);

  commitPreviewClusterOrder(state);
  assert.deepEqual(getClusterOrder(state), ["b", "c", "a"]);
  assert.deepEqual(state.clusterOrder, ["b", "c", "a"]);
  assert.equal(getClusterPosition(state, "a", 0), 0);
});

test("chart state previews a locus offset before committing it", async () => {
  const {
    commitPreviewLocusOffset,
    createChartState,
    getCommittedLocusOffset,
    getLocusOffset,
    setPreviewLocusOffset,
  } = await import("../src/chartState.mjs");
  const state = createChartState({
    clusters: [{ uid: "a", loci: [{ uid: "a-locus", start: 0, end: 10, genes: [] }] }],
  });

  setPreviewLocusOffset(state, "a-locus", 42);
  assert.equal(getLocusOffset(state, "a-locus"), 42);
  assert.equal(getCommittedLocusOffset(state, "a-locus"), 0);

  commitPreviewLocusOffset(state, "a-locus");
  assert.equal(getLocusOffset(state, "a-locus"), 42);
  assert.equal(state.locusOffsets.get("a-locus"), 42);
});

test("chart state persists horizontal offsets across data refreshes", async () => {
  const {
    createChartState,
    getClusterOffset,
    getLocusOffset,
    setClusterOffset,
    setLocusOffset,
  } = await import("../src/chartState.mjs");
  const data = {
    clusters: [
      {
        uid: "cluster-a",
        loci: [{ uid: "locus-a", start: 0, end: 10, genes: [] }],
      },
    ],
  };
  let state = createChartState(data);

  assert.equal(getClusterOffset(state, "cluster-a"), 0);
  assert.equal(getLocusOffset(state, "locus-a"), 0);

  setClusterOffset(state, "cluster-a", 42);
  setLocusOffset(state, "locus-a", 17);
  state = createChartState(structuredClone(data), state);

  assert.equal(getClusterOffset(state, "cluster-a"), 42);
  assert.equal(getLocusOffset(state, "locus-a"), 17);
});

test("chart state persists the camera transform across data refreshes", async () => {
  const { createChartState, getCamera, setCamera } = await import(
    "../src/chartState.mjs"
  );
  let state = createChartState(dataFor("a"));

  assert.deepEqual(getCamera(state), { x: 0, y: 0, k: 1 });

  setCamera(state, { x: 20, y: -10, k: 1.5 });
  state = createChartState(dataFor("a"), state);
  assert.deepEqual(getCamera(state), { x: 20, y: -10, k: 1.5 });
});

test("chart state snapshots preserve flipped trimmed loci as JSON-safe gene IDs", async () => {
  const {
    createChartState,
    flipLocus,
    getLocusState,
    trimLocus,
  } = await import("../src/chartState.mjs");
  const {
    chartStateFromSnapshot,
    serializeChartState,
  } = await import("../src/chartStateSnapshot.mjs");
  const makeData = () => ({
    clusters: [{
      uid: "cluster-a",
      loci: [{
        uid: "locus-a",
        start: 0,
        end: 100,
        genes: [
          { uid: "gene-a", locusUid: "locus-a", start: 0, end: 10, strand: 1 },
          { uid: "gene-b", locusUid: "locus-a", start: 20, end: 30, strand: 1 },
          { uid: "gene-c", locusUid: "locus-a", start: 40, end: 50, strand: 1 },
        ],
      }],
    }],
  });
  const data = makeData();
  const locus = data.clusters[0].loci[0];
  const state = createChartState(data);
  const coordinateFor = (value) => value;
  trimLocus(state, locus, { edge: "left", position: 20, coordinateFor, scaleGenes: true });
  trimLocus(state, locus, { edge: "right", position: 50, coordinateFor, scaleGenes: true });
  flipLocus(state, locus);

  const snapshot = JSON.parse(JSON.stringify(serializeChartState(state, data)));
  const savedLocus = new Map(snapshot.loci).get("locus-a");
  assert.equal(savedLocus.flipped, true);
  assert.equal(savedLocus.trimLeft, "gene-c");
  assert.equal(savedLocus.trimRight, "gene-b");

  const restoredData = makeData();
  const restored = chartStateFromSnapshot(restoredData, snapshot);
  assert.deepEqual(serializeChartState(restored, restoredData), snapshot);
  const restoredLocus = getLocusState(restored, restoredData.clusters[0].loci[0]);
  assert.equal(restoredLocus.trimLeft.uid, "gene-c");
  assert.equal(restoredLocus.trimRight.uid, "gene-b");
});

test("chart state snapshots omit default layout records", async () => {
  const { createChartState } = await import("../src/chartState.mjs");
  const { serializeChartState } = await import("../src/chartStateSnapshot.mjs");
  const data = {
    clusters: [{
      uid: "cluster-a",
      loci: [{
        uid: "locus-a",
        start: 0,
        end: 100,
        genes: [{ uid: "gene-a", locusUid: "locus-a", start: 0, end: 20, strand: 1 }],
      }],
    }],
  };
  const snapshot = serializeChartState(createChartState(data), data);

  assert.deepEqual(snapshot.clusterOrder, []);
  assert.deepEqual(snapshot.clusterOffsets, []);
  assert.deepEqual(snapshot.locusOffsets, []);
  assert.deepEqual(snapshot.loci, []);
  assert.deepEqual(snapshot.genes, []);
});

test("chart state tracks transient drag interactions", async () => {
  const { createChartState, isDragging, setDragging } = await import(
    "../src/chartState.mjs"
  );
  const state = createChartState(dataFor("a"));

  assert.equal(isDragging(state), false);
  setDragging(state, true);
  assert.equal(isDragging(state), true);
});

test("chart state anchors matching genes by moving their clusters", async () => {
  const {
    anchorGeneGroup,
    createChartState,
    getClusterOffset,
    getGeneState,
  } = await import("../src/chartState.mjs");
  const anchor = {
    uid: "gene-a",
    clusterUid: "cluster-a",
    locusUid: "locus-a",
    start: 0,
    end: 10,
    strand: 1,
  };
  const match = {
    uid: "gene-b",
    clusterUid: "cluster-b",
    locusUid: "locus-b",
    start: 20,
    end: 30,
    strand: 1,
  };
  const loci = new Map([
    ["locus-a", { uid: "locus-a", start: 0, end: 100, genes: [anchor] }],
    ["locus-b", { uid: "locus-b", start: 0, end: 100, genes: [match] }],
  ]);
  const state = createChartState({
    clusters: [
      { uid: "cluster-a", loci: [loci.get("locus-a")] },
      { uid: "cluster-b", loci: [loci.get("locus-b")] },
    ],
  });
  const coordinateForGene = (gene) => {
    const display = getGeneState(state, gene);
    return getClusterOffset(state, gene.clusterUid) + (display.start + display.end) / 2;
  };

  const changes = anchorGeneGroup(state, {
    anchor,
    genes: [anchor, match],
    locusForGene: (gene) => loci.get(gene.locusUid),
    coordinateForGene,
  });

  assert.equal(getClusterOffset(state, "cluster-a"), 0);
  assert.equal(getClusterOffset(state, "cluster-b"), -20);
  assert.deepEqual(changes.map(({ clusterUid, offset }) => ({ clusterUid, offset })), [
    { clusterUid: "cluster-b", offset: -20 },
  ]);
});

test("chart state anchoring flips mismatched loci before finding offsets", async () => {
  const {
    anchorGeneGroup,
    createChartState,
    getClusterOffset,
    getGeneState,
  } = await import("../src/chartState.mjs");
  const anchor = {
    uid: "gene-a",
    clusterUid: "cluster-a",
    locusUid: "locus-a",
    start: 0,
    end: 10,
    strand: 1,
  };
  const match = {
    uid: "gene-b",
    clusterUid: "cluster-b",
    locusUid: "locus-b",
    start: 20,
    end: 30,
    strand: -1,
  };
  const loci = new Map([
    ["locus-a", { uid: "locus-a", start: 0, end: 100, genes: [anchor] }],
    ["locus-b", { uid: "locus-b", start: 0, end: 100, genes: [match] }],
  ]);
  const state = createChartState({
    clusters: [
      { uid: "cluster-a", loci: [loci.get("locus-a")] },
      { uid: "cluster-b", loci: [loci.get("locus-b")] },
    ],
  });
  const flipped = [];

  anchorGeneGroup(state, {
    anchor,
    genes: [anchor, match],
    locusForGene: (gene) => loci.get(gene.locusUid),
    coordinateForGene: (gene) => {
      const display = getGeneState(state, gene);
      return getClusterOffset(state, gene.clusterUid) + (display.start + display.end) / 2;
    },
    flipMismatchedLoci: true,
    onLocusFlipped: (locus) => flipped.push(locus.uid),
  });

  assert.deepEqual(flipped, ["locus-b"]);
  assert.deepEqual(getGeneState(state, match), { start: 70, end: 80, strand: 1 });
  assert.equal(getClusterOffset(state, "cluster-b"), -70);
});
