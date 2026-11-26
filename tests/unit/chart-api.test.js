import test from "node:test";
import assert from "node:assert/strict";

test("chart handles reads and rejects exports before mounting", async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };

  try {
    const { default: clusterMap } = await import("../../src/chart/chart.js");
    const chart = clusterMap();

    assert.equal(chart.rendererStatus(), null);
    assert.equal(chart.tree(), null);
    assert.equal(chart.camera(), null);
    assert.throws(() => chart.fitFigure(), /before the chart has rendered/);
    assert.throws(() => chart.exportProjectBlob(), /before the chart has rendered/);
    assert.equal(chart.figureBounds(), null);
    assert.equal(chart.config({ plot: { renderer: "canvas" } }), chart);
    assert.equal(chart.config().plot.renderer, "canvas");
  } finally {
    globalThis.document = previousDocument;
  }
});
