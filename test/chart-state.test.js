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
