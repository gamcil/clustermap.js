import test from "node:test";
import assert from "node:assert/strict";
import { ArrayLinkStore, CompactLinkStore } from "../../src/data/linkStore.mjs";
import { createChartIndex } from "../../src/data/index.mjs";
import { clusterPairKey } from "../../src/links/layout.mjs";
import { createLinkVisibility, filterLinks } from "../../src/links/groups.mjs";

const input = () => ({ genes: ["a", "b", "c", "missing"],
  query: new Uint32Array([0, 0, 1, 0]), target: new Uint32Array([1, 2, 1, 3]),
  identity: new Float64Array([0.9, 0.8, 0.7, 0.6]), similarity: new Float64Array([1, 0.9, 0.8, 0.7]) });

test("compact and array stores preserve link identity, ordering and double precision", () => {
  const columns = input(), compact = new CompactLinkStore(columns);
  const records = [...compact.values()], array = new ArrayLinkStore(records);
  assert.equal(compact.byteLength, 24 * records.length);
  assert.deepEqual([...compact], [...array]);
  for (let i = 0; i < records.length; i++) {
    assert.deepEqual(compact.getAt(i), array.getAt(i));
    assert.equal(compact.order(`link-${i}`), i);
  }
  assert.equal(compact.order("link-01"), undefined);
  assert.equal(compact.order("link-4"), undefined);
  columns.query[0] = 2; columns.identity[0] = 0;
  assert.equal(compact.get("link-0").query.uid, "a");
  assert.equal(compact.get("link-0").identity, 0.9);
  compact.get("link-0").query.uid = "changed";
  assert.equal(compact.get("link-0").query.uid, "a");
});

test("compact indexes and filtering match array-backed records", () => {
  const compact = new CompactLinkStore(input()), records = [...compact.values()];
  const clusters = [{ uid: "one", loci: [{ uid: "l1", genes: [{ uid: "a" }] }] },
    { uid: "two", loci: [{ uid: "l2", genes: [{ uid: "b" }, { uid: "c" }] }] }];
  const legacy = createChartIndex({ clusters, groups: [], links: records });
  const index = createChartIndex({ clusters, groups: [], links: compact });
  for (const uid of ["a", "b", "c", "missing", "unknown"]) {
    assert.deepEqual(index.linksByGeneId.get(uid), legacy.linksByGeneId.get(uid));
  }
  for (const pair of [clusterPairKey("one", "two"), clusterPairKey("two", "two"), "unknown"]) {
    assert.deepEqual(index.linksByClusterPair.get(pair), legacy.linksByClusterPair.get(pair));
  }
  for (const bestOnly of [false, true]) {
    const geneForUid = (uid) => uid === "a" ? { clusterUid: "one" } : ["b", "c"].includes(uid) ? { clusterUid: "two" } : undefined;
    const options = { groupForGene: () => 0, geneForUid, bestOnly, threshold: 0.75 };
    const expected = new Set(filterLinks(records, options).map(({ uid }) => uid));
    const visible = createLinkVisibility(compact.values(), options, compact);
    for (const record of records) assert.equal(visible.has(record.uid), expected.has(record.uid));
  }
});

test("compact links reject invalid columns and endpoints", () => {
  const data = input();
  assert.throws(() => new CompactLinkStore({ ...data, target: new Uint32Array(1) }), /equal-length/);
  data.target[0] = 99;
  assert.throws(() => new CompactLinkStore(data), /position 0/);
});

test("compact links produce the same filtered scene as array links", async () => {
  const [{ normalizeChartData }, { createChartRuntime }, { createChartState }] = await Promise.all([
    import("../../src/data/normalize.mjs"), import("../../src/chart/runtime.js"), import("../../src/chart/state.mjs"),
  ]);
  const records = [...new CompactLinkStore(input()).values()];
  const data = normalizeChartData({ clusters: ["a", "b", "c"].map((uid) => ({ uid,
    loci: [{ uid: `l-${uid}`, start: 0, end: 100, genes: [{ uid, start: 10, end: 20, strand: 1 }] }] })),
    links: records, groups: [{ uid: "group", genes: ["a", "b", "c"] }], config: { updateGroups: false } });
  const compactData = { ...data, links: new CompactLinkStore(input()) };
  const render = (source, order, bestOnly) => {
    const runtime = createChartRuntime(), state = createChartState(source);
    state.clusterOrder = order;
    runtime.setChartIndex(createChartIndex(source)); runtime.setChartState(state);
    runtime.configure({ link: { threshold: 0.75, bestOnly }, colourBar: { domain: { maxMode: "data" } } });
    const scene = runtime.updateScene(source);
    return records.map(({ uid }) => {
      const link = scene.links.get(uid);
      return { uid, allowed: link.allowed, visible: link.visible, anchors: link.anchors };
    });
  };
  for (const bestOnly of [false, true]) for (const order of [["a", "b", "c"], ["a", "c", "b"]]) {
    assert.deepEqual(render(compactData, order, bestOnly), render(data, order, bestOnly));
  }
});
