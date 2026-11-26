import test from "node:test";
import assert from "node:assert/strict";

test("runtime keeps default interaction callbacks declarative", async () => {
  const { createChartRuntime } = await import("../../src/chart/runtime.js");
  const runtime = createChartRuntime();

  assert.equal(runtime.config.gene.shape.onClick, null);
  assert.equal(runtime.config.legend.onClickText, null);
  assert.equal(typeof runtime.anchorGene, "function");
  assert.equal(typeof runtime.updateScene, "function");
  assert.equal(typeof runtime.updateScales, "function");
  assert.equal("plot" in runtime, false);
  assert.equal("scale" in runtime, false);

  runtime.configure({ plot: { renderer: "canvas" } });
  assert.equal(runtime.config.plot.renderer, "canvas");
  assert.throws(
    () => runtime.configure({ plot: { renderer: "webgl" } }),
    /plot.renderer must be svg, canvas or webgpu/
  );
  assert.equal(runtime.config.plot.renderer, "canvas");
});

test("colour scale resolves data domains without scanning links for fixed domains", async () => {
  const [{ createChartRuntime }, { createChartState }] = await Promise.all([
    import("../../src/chart/runtime.js"), import("../../src/chart/state.mjs"),
  ]);
  const runtime = createChartRuntime();
  const data = { clusters: [], links: [], groups: [] };
  runtime.setChartState(createChartState(data));
  data.links = { [Symbol.iterator]: () => { throw new Error("fixed domain scanned links"); } };
  runtime.updateScales(data);
  assert.deepEqual(runtime.scales.score.domain(), [0, 1]);
  data.links = [{ identity: 0.8 }, { identity: 0.2 }, { identity: NaN }];
  runtime.configure({ colourBar: { domain: { minMode: "data", maxMode: "data" } } });
  runtime.updateScales(data);
  assert.deepEqual(runtime.scales.score.domain(), [0.2, 0.8]);
  data.links = [{ identity: 0.5 }];
  runtime.updateScales(data);
  assert.deepEqual(runtime.scales.score.domain(), [0.495, 0.505]);
  data.links = [];
  runtime.updateScales(data);
  assert.deepEqual(runtime.scales.score.domain(), [0, 1]);
});

test("scene patches retain nonadjacent links and reveal them after row changes", async () => {
  const [{ createChartRuntime }, { normalizeChartData }, { createChartIndex },
    { createChartState, setClusterOffset }] = await Promise.all([
    import("../../src/chart/runtime.js"), import("../../src/data/normalize.mjs"),
    import("../../src/data/index.mjs"), import("../../src/chart/state.mjs"),
  ]);
  const data = normalizeChartData({ clusters: ["a", "b", "c"].map((uid) => ({ uid,
    loci: [{ uid: `l-${uid}`, start: 0, end: 100,
      genes: [{ uid: `g-${uid}`, start: 10, end: 20, strand: 1 }] }] })),
    links: [{ uid: "ac", query: { uid: "g-a" }, target: { uid: "g-c" }, identity: 0.9 }],
    groups: [{ uid: "group", genes: ["g-a", "g-c"] }], config: { updateGroups: false } });
  const runtime = createChartRuntime(), state = createChartState(data);
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state);
  const initial = runtime.updateScene(data);
  assert.equal(initial.links.get("ac").visible, false);
  assert.equal(initial.links.geometry.size, 0, "nonadjacent links have no retained scene layout");
  assert.equal(initial.links.get("ac").anchors, null);
  assert.equal(initial.links.get("ac").bounds, null);
  assert.equal(initial.links.get("ac").labelPosition, null);
  const byGene = initial.linksByGene, get = byGene.get;
  byGene.get = () => { throw new Error("row translations must use adjacent pair indexes"); };
  setClusterOffset(state, "a", 10);
  const moved = runtime.updateScene(data, { sourceScene: initial, changes: { clusters: ["a"] } });
  assert.deepEqual(moved.links.get("ac"), initial.links.get("ac"));
  state.clusterOrder = ["a", "c", "b"];
  const reordered = runtime.updateScene(data, { sourceScene: moved, changes: {} });
  assert.equal(reordered.links.get("ac").visible, true);
  assert.ok(reordered.index.links.boundsById.has("ac"));
  assert.equal(initial.links.get("ac").visible, false);
  byGene.get = get;
});

test("lazy link visibility is retained by the scene that created it", async () => {
  const [{ createChartRuntime }, { normalizeChartData }, { createChartIndex }, { createChartState }] = await Promise.all([
    import("../../src/chart/runtime.js"), import("../../src/data/normalize.mjs"),
    import("../../src/data/index.mjs"), import("../../src/chart/state.mjs"),
  ]);
  const ids = ["a", "b", "c"];
  const data = normalizeChartData({ clusters: ids.map((uid) => ({ uid,
    loci: [{ uid: `l-${uid}`, start: 0, end: 100, genes: [{ uid: `g-${uid}`, start: 10, end: 20, strand: 1 }] }] })),
    links: [{ uid: "ac", query: { uid: "g-a" }, target: { uid: "g-c" }, identity: 0.6 }],
    groups: [{ uid: "group", genes: ids.map((uid) => `g-${uid}`) }], config: { updateGroups: false } });
  const runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(createChartState(data));
  const before = runtime.updateScene(data);
  runtime.configure({ link: { threshold: 0.9 } });
  const after = runtime.updateScene(data);
  assert.equal(before.links.get("ac").allowed, true);
  assert.equal(after.links.get("ac").allowed, false);
});

test("row translations and reorder patches match a full scene rebuild", async () => {
  const [{ createChartRuntime }, { normalizeChartData }, { createChartIndex },
    { createChartState, setClusterOffset, setLocusOffset }] = await Promise.all([
    import("../../src/chart/runtime.js"), import("../../src/data/normalize.mjs"),
    import("../../src/data/index.mjs"), import("../../src/chart/state.mjs"),
  ]);
  const ids = ["a", "b", "c", "d", "e"];
  const links = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    links.push({ uid: `${ids[i]}-${ids[j]}`, query: { uid: `g-${ids[i]}` },
      target: { uid: `g-${ids[j]}` }, identity: 0.9 });
  }
  const data = normalizeChartData({ clusters: ids.map((uid) => ({ uid,
    loci: [{ uid: `l-${uid}`, start: 0, end: 100,
      genes: [{ uid: `g-${uid}`, start: 10, end: 20, strand: 1 }] }] })),
    links, groups: [{ uid: "group", genes: ids.map((uid) => `g-${uid}`) }], config: { updateGroups: false } });
  const runtime = createChartRuntime(), state = createChartState(data);
  const { allIndexedIds } = await import("../../src/scene/spatialIndex.mjs");
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state);
  let scene = runtime.updateScene(data);
  const compare = (patched, rebuilt) => {
    assert.deepEqual([...patched.links].map(([uid, link]) => [uid, link.visible, link.anchors]),
      [...rebuilt.links].map(([uid, link]) => [uid, link.visible, link.anchors]));
    assert.deepEqual([...patched.index.links.boundsById.keys()].sort(), [...rebuilt.index.links.boundsById.keys()].sort());
    assert.deepEqual(allIndexedIds(patched.index.links), allIndexedIds(rebuilt.index.links));
  };
  setClusterOffset(state, "b", 25);
  let patched = runtime.updateScene(data, { sourceScene: scene, changes: { clusters: ["b"] } });
  compare(patched, runtime.updateScene(data));
  scene = patched;
  state.clusterOrder = ["e", "b", "a", "d", "c"];
  patched = runtime.updateScene(data, { sourceScene: scene, changes: {} });
  compare(patched, runtime.updateScene(data));
  scene = patched;
  setLocusOffset(state, "l-b", 15);
  const byGene = scene.linksByGene, get = byGene.get;
  byGene.get = () => { throw new Error("locus scene patches must use adjacent pair indexes"); };
  patched = runtime.updateScene(data, { sourceScene: scene, changes: { loci: ["l-b"] } });
  byGene.get = get;
  compare(patched, runtime.updateScene(data));
});

test("runtime applies best-only link visibility to the shared scene", async () => {
  const [
    { createChartRuntime },
    { normalizeChartData },
    { createChartIndex },
    { createChartState },
  ] = await Promise.all([
    import("../../src/chart/runtime.js"),
    import("../../src/data/normalize.mjs"),
    import("../../src/data/index.mjs"),
    import("../../src/chart/state.mjs"),
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
  const index = createChartIndex(data);
  runtime.setChartIndex(index);
  runtime.setChartState(createChartState(data));
  runtime.configure({ link: { bestOnly: true } });

  const scene = runtime.updateScene(data);
  assert.equal(scene.linksByGene, index.linksByGeneId);
  assert.equal(scene.linksByClusterPair, index.linksByClusterPair);
  assert.equal(scene.links.get("lower").allowed, false);
  assert.equal(scene.links.get("lower").visible, false);
  assert.equal(scene.links.get("higher").allowed, true);
  assert.equal(scene.links.get("higher").visible, true);
});

test("runtime accepts initial locus offsets in sequence-coordinate units", async () => {
  const [
    { createChartRuntime },
    { normalizeChartData },
    { createChartIndex },
    { createChartState, setLocusOffset },
  ] = await Promise.all([
    import("../../src/chart/runtime.js"),
    import("../../src/data/normalize.mjs"),
    import("../../src/data/index.mjs"),
    import("../../src/chart/state.mjs"),
  ]);
  const data = normalizeChartData({
    clusters: [{
      uid: "cluster",
      loci: [
        { uid: "aligned", offset: -500, start: 0, end: 100, genes: [] },
        { uid: "packed", start: 0, end: 100, genes: [] },
      ],
    }],
    links: [],
    groups: [],
  });
  const runtime = createChartRuntime();
  const state = createChartState(data);
  runtime.setChartIndex(createChartIndex(data));
  runtime.setChartState(state);
  runtime.updateScales(data);

  assert.equal(
    runtime.scales.locus("aligned"),
    runtime.scales.x(-500) - runtime.scales.x(0)
  );
  assert.notEqual(runtime.scales.locus("packed"), runtime.scales.locus("aligned"));

  setLocusOffset(state, "aligned", 42);
  runtime.updateScales(data);
  assert.equal(runtime.scales.locus("aligned"), 42);
});


test("presentation configuration scene matches a full rebuild", async () => {
  const [{ createChartRuntime }, { normalizeChartData }, { createChartIndex }, { createChartState }] = await Promise.all([
    import("../../src/chart/runtime.js"), import("../../src/data/normalize.mjs"),
    import("../../src/data/index.mjs"), import("../../src/chart/state.mjs"),
  ]);
  const data = normalizeChartData({ clusters: ["a", "b"].map((uid) => ({ uid, name: uid,
    loci: [{ uid: `l-${uid}`, start: 0, end: 100, genes: [{ uid: `g-${uid}`, start: 10, end: 20, strand: 1 }] }] })),
    links: [{ uid: "ab", query: { uid: "g-a" }, target: { uid: "g-b" }, identity: 0.9 }],
    groups: [{ uid: "group", genes: ["g-a", "g-b"] }], config: { updateGroups: false } });
  const runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(createChartState(data));
  const initial = runtime.updateScene(data);
  runtime.configure({ cluster: { labelAlignment: "left" }, tree: { leafGuide: { show: true } } });
  const patched = runtime.updateScene(data, { sourceScene: initial, changes: { presentationOnly: true, clusterLabels: true } });
  const rebuilt = runtime.updateScene(data);
  assert.deepEqual([...patched.clusters], [...rebuilt.clusters]);
  assert.deepEqual([...patched.links], [...rebuilt.links]);
  assert.deepEqual(patched.annotations, rebuilt.annotations);
});
