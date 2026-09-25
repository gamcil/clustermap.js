const test = require("node:test");
const assert = require("node:assert/strict");

test("raster interaction bindings adapt stable IDs to source records", async () => {
  const { createRasterInteractionBindings } = await import(
    "../src/rasterInteractionBindings.mjs"
  );
  const gene = { uid: "gene-1" };
  const locus = { uid: "locus-1" };
  const calls = [];
  const bindings = createRasterInteractionBindings({
    getGene: (uid) => (uid === gene.uid ? gene : null),
    getLocus: (uid) => (uid === locus.uid ? locus : null),
    config: { legend: {} },
    interactions: {
      beginClusterDrag: () => {}, moveClusterDrag: () => {}, endClusterDrag: () => {},
      cancelClusterDrag: () => {}, beginLocusDrag: () => {}, moveLocusDrag: () => {},
      endLocusDrag: () => {}, cancelLocusDrag: () => {}, beginLocusTrim: () => {},
      moveLocusTrim: (...args) => calls.push(["trim", ...args]),
      endLocusTrim: (...args) => calls.push(["finish-trim", ...args]),
      cancelLocusTrim: () => {}, flipLocus: (value) => calls.push(["flip", value]),
      onGeneClick: (_event, value) => calls.push(["gene", value]),
      showGeneMenu: (_event, value) => calls.push(["menu", value]),
      showGroupMenu: (_event, value) => calls.push(["group-menu", value]),
      setScaleBarLength: () => {}, chooseLegendColour: (value) => calls.push(["colour", value]),
    },
  });

  bindings.interactions.moveLocusTrim(locus.uid, "left", 12);
  bindings.interactions.endLocusTrim(locus.uid);
  bindings.actions.geneClick({}, gene.uid);
  bindings.actions.flipLocus(locus.uid);
  bindings.actions.legendColour({}, "group-1");

  assert.deepEqual(calls, [
    ["trim", locus, "left", 12],
    ["finish-trim", locus],
    ["gene", gene],
    ["flip", locus],
    ["colour", "group-1"],
  ]);
});
