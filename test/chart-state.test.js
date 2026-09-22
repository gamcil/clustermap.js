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
