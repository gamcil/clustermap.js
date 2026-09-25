import test from "node:test";
import assert from "node:assert/strict";

test("runtime keeps default interaction callbacks declarative", async () => {
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
});
