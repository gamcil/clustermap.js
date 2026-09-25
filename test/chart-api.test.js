const test = require("node:test");
const assert = require("node:assert/strict");

test("chart factory exposes only the supported public methods", async () => {
  const previousD3 = globalThis.d3;
  const previousDocument = globalThis.document;
  globalThis.d3 = await import("d3");
  globalThis.document = { documentElement: {} };

  try {
    const { default: clusterMap } = await import("../src/clusterMap.js");
    const chart = clusterMap();

    assert.equal(typeof chart, "function");
    assert.equal(typeof chart.config, "function");
    assert.equal(typeof chart.data, "function");
    assert.equal(typeof chart.exportSvg, "function");
    assert.equal(chart.config({ plot: { renderer: "canvas" } }), chart);
    assert.equal(chart.config().plot.renderer, "canvas");
  } finally {
    globalThis.d3 = previousD3;
    globalThis.document = previousDocument;
  }
});
