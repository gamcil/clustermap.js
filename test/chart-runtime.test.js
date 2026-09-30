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

test("runtime applies best-only link visibility to the shared scene", async () => {
  const [
    { createChartRuntime },
    { normalizeChartData },
    { createChartIndex },
    { createChartState },
  ] = await Promise.all([
    import("../src/chartRuntime.js"),
    import("../src/data/normalize.mjs"),
    import("../src/data/index.mjs"),
    import("../src/chartState.mjs"),
  ]);
  const data = normalizeChartData({
    clusters: [
      {
        uid: "left",
        name: "Left",
        loci: [{
          uid: "left-locus", start: 0, end: 100,
          genes: [{ uid: "query", start: 10, end: 20, strand: 1 }],
        }],
      },
      {
        uid: "right",
        name: "Right",
        loci: [{
          uid: "right-locus", start: 0, end: 100,
          genes: [
            { uid: "lower-target", start: 10, end: 20, strand: 1 },
            { uid: "higher-target", start: 40, end: 50, strand: 1 },
          ],
        }],
      },
    ],
    links: [
      { uid: "lower", query: { uid: "query" }, target: { uid: "lower-target" }, identity: 0.6 },
      { uid: "higher", query: { uid: "query" }, target: { uid: "higher-target" }, identity: 0.9 },
    ],
    groups: [{ uid: "group", label: "Group", genes: ["query", "lower-target", "higher-target"] }],
  });
  const runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data));
  runtime.setChartState(createChartState(data));
  runtime.updateGroups(data.groups);
  runtime.updateScales(data);
  runtime.configure({ link: { bestOnly: true } });

  const scene = runtime.buildScene(data);
  assert.equal(scene.links.get("lower").allowed, false);
  assert.equal(scene.links.get("lower").visible, false);
  assert.equal(scene.links.get("higher").allowed, true);
  assert.equal(scene.links.get("higher").visible, true);
});
