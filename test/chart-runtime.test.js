const test = require("node:test");
const assert = require("node:assert/strict");

test("runtime keeps default interaction callbacks declarative", async () => {
  const previousD3 = globalThis.d3;
  globalThis.d3 = await import("d3");
  try {
    const { createChartRuntime } = await import("../src/chartRuntime.js");
    const runtime = createChartRuntime();

    assert.equal(runtime.config.gene.shape.onClick, null);
    assert.equal(runtime.config.legend.onClickText, null);
    assert.equal(typeof runtime.anchorGene, "function");
    assert.equal(typeof runtime.buildScene, "function");
    assert.equal(typeof runtime.updateScales, "function");
    assert.equal("plot" in runtime, false);
    assert.equal("scale" in runtime, false);

    runtime.configure({ plot: { renderer: "canvas" } });
    assert.equal(runtime.config.plot.renderer, "canvas");
    assert.throws(
      () => runtime.configure({ plot: { renderer: "webgl" } }),
      /Unknown plot renderer: webgl/
    );
    assert.equal(runtime.config.plot.renderer, "canvas");
  } finally {
    globalThis.d3 = previousD3;
  }
});
