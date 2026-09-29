import test from "node:test";
import assert from "node:assert/strict";

test("chart factory exposes only the supported public methods", async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };

  try {
    const { default: clusterMap } = await import("../src/clusterMap.js");
    const chart = clusterMap();

    assert.equal(typeof chart, "function");
    assert.equal(typeof chart.config, "function");
    assert.equal(typeof chart.data, "function");
    assert.equal(typeof chart.state, "function");
    assert.equal(typeof chart.patch, "function");
    assert.equal(typeof chart.highlight, "function");
    assert.equal(typeof chart.locusSelection, "function");
    assert.equal(typeof chart.flipLoci, "function");
    assert.equal(typeof chart.focus, "function");
    assert.equal(typeof chart.on, "function");
    assert.equal(typeof chart.exportSvg, "function");
    assert.equal(typeof chart.destroy, "function");
    assert.equal(chart.config({ plot: { renderer: "canvas" } }), chart);
    assert.equal(chart.config().plot.renderer, "canvas");
  } finally {
    globalThis.document = previousDocument;
  }
});
