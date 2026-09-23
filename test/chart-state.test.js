const test = require("node:test");
const assert = require("node:assert/strict");

function dataFor(...clusterIds) {
  return {
    clusters: clusterIds.map((uid) => ({ uid, loci: [] })),
  };
}

test("chart state persists cluster order across data refreshes", async () => {
  const { createChartState, getClusterOrder, setClusterOrder } = await import(
    "../src/chartState.mjs"
  );
  let state = createChartState(dataFor("a", "b"));

  assert.deepEqual(getClusterOrder(state), ["a", "b"]);

  setClusterOrder(state, ["b", "a"]);
  state = createChartState(dataFor("a", "b", "c"), state);
  assert.deepEqual(getClusterOrder(state), ["b", "a", "c"]);

  state = createChartState(dataFor("b", "c"), state);
  assert.deepEqual(getClusterOrder(state), ["b", "c"]);
});

test("chart state moves a cluster to a requested row", async () => {
  const { createChartState, getClusterOrder, moveClusterToIndex } = await import(
    "../src/chartState.mjs"
  );
  const state = createChartState(dataFor("a", "b", "c"));

  moveClusterToIndex(state, "c", 1);
  assert.deepEqual(getClusterOrder(state), ["a", "c", "b"]);

  moveClusterToIndex(state, "a", 2);
  assert.deepEqual(getClusterOrder(state), ["c", "b", "a"]);
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
