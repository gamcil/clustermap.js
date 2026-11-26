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

test("compact link edit overlays retain independent historical views", () => {
  const original = new CompactLinkStore(input());
  const edited = original.withUpdates([{ uid: "link-0", changes: { hidden: true, label: "reviewed" } },
    { uid: "link-1", changes: { identity: 0.45 } }]);
  const again = edited.withUpdates([{ uid: "link-0", changes: { hidden: false } }]);
  assert.equal(original.get("link-0").hidden, undefined);
  assert.deepEqual([edited.get("link-0").hidden, edited.get("link-0").label], [true, "reviewed"]);
  assert.deepEqual([again.get("link-0").hidden, again.get("link-0").label], [false, "reviewed"]);
  assert.equal(edited.get("link-1").identity, 0.45);
  assert.equal(original.get("link-1").identity, 0.8);
  assert.equal(again.byteLength, original.byteLength);
  assert.throws(() => original.withUpdates([{ uid: "link-10", changes: { hidden: true } }]), /Unknown/);
  assert.throws(() => original.withUpdates([{ uid: "link-0", changes: { query: { uid: "c" } } }]), /unsupported/);
  assert.throws(() => original.withUpdates([{ uid: "link-0", changes: { identity: 2 } }]), /identity/);
});

test("compact link updates and inverse operations preserve old indexed views", async () => {
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const original = new CompactLinkStore(input());
  const data = { clusters: [{ uid: "one", loci: [{ uid: "l1", genes: [{ uid: "a" }] }] },
    { uid: "two", loci: [{ uid: "l2", genes: [{ uid: "b" }, { uid: "c" }] }] }],
    groups: [], links: original };
  const index = createChartIndex(data), oldByGene = index.linksByGeneId;
  const result = applyChartOperations(data, index, [{ type: "links.update", ids: ["link-0"], changes: { hidden: true, identity: 0.5 } }]);
  assert.equal(original.get("link-0").hidden, undefined);
  assert.equal(oldByGene.get("a")[0].identity, 0.9);
  assert.equal(index.linkById.get("link-0").hidden, true);
  assert.equal(index.linksByGeneId.get("a")[0].identity, 0.5);
  applyChartOperations(data, index, result.inverse);
  assert.equal(index.linkById.get("link-0").hidden, undefined);
  assert.equal(index.linkById.get("link-0").identity, 0.9);
});

test("compact deletions and restorations retain link IDs, edits and ordering", () => {
  const original = new CompactLinkStore(input()).withUpdates([{ uid: "link-2", changes: { hidden: true, label: "kept" } }]);
  const records = [0, 2].map((index) => ({ index, link: original.getAt(index) }));
  const deleted = original.withDeleted(["link-0", "link-2"]);
  assert.deepEqual([...deleted.keys()], ["link-1", "link-3"]);
  assert.equal(deleted.size, 2);
  assert.equal(deleted.order("link-0"), undefined);
  assert.equal(deleted.order("link-3"), 1);
  assert.equal(original.size, 4);
  const index = createChartIndex({ links: deleted, clusters: [{ uid: "c", loci: [{ uid: "l", genes: [{ uid: "a" }, { uid: "b" }, { uid: "c" }] }] }], groups: [] });
  assert.deepEqual(index.linksByGeneId.get("a").map((link) => link.uid), ["link-1", "link-3"]);
  const restored = deleted.withRestored(records);
  assert.deepEqual([...restored.values()], [...original.values()]);
  assert.deepEqual([...deleted.keys()], ["link-1", "link-3"]);
  assert.throws(() => deleted.withRestored([{ ...records[0], index: 1 }]), /canonical order/);
});

test("compact deletion position mapping agrees with array removal", () => {
  const count = 20, all = new CompactLinkStore({ genes: ["a"],
    query: new Uint32Array(count), target: new Uint32Array(count),
    identity: new Float64Array(count).fill(0.8), similarity: new Float64Array(count).fill(0.9) });
  for (let seed = 0; seed < 64; seed++) {
    const removed = Array.from({ length: count }, (_, i) => i).filter((i) => ((i * 17 + seed * 13) % 11) < 4);
    const remaining = Array.from({ length: count }, (_, i) => `link-${i}`).filter((uid) => !removed.includes(Number(uid.slice(5))));
    const store = all.withDeleted(removed.map((i) => `link-${i}`));
    assert.deepEqual([...store.keys()], remaining);
    remaining.forEach((uid, position) => { assert.equal(store.order(uid), position); assert.equal(store.getAt(position).uid, uid); });
  }
});

test("compact link delete and undo operations preserve edits and reject invalid batches atomically", async () => {
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const original = new CompactLinkStore(input()).withUpdates([{ uid: "link-2", changes: { label: "edited" } }]);
  const data = { clusters: [{ uid: "one", loci: [{ uid: "l1", genes: [{ uid: "a" }, { uid: "b" }, { uid: "c" }] }] }],
    groups: [], links: original };
  const index = createChartIndex(data), originalByGene = index.linksByGeneId;
  const deleted = applyChartOperations(data, index, [{ type: "links.delete", ids: ["link-2", "link-0"] }]);
  assert.deepEqual([...data.links.keys()], ["link-1", "link-3"]);
  assert.equal(originalByGene.get("b")[1].label, "edited");
  applyChartOperations(data, index, deleted.inverse);
  assert.deepEqual([...data.links.values()], [...original.values()]);
  assert.equal(index.linksByGeneId.get("b")[1].label, "edited");
  const before = data.links;
  const badRestore = { type: "links.restore", records: [{ index: 0, link: original.get("link-0") }] };
  assert.throws(() => applyChartOperations(data, index, [
    { type: "links.update", ids: ["link-1"], changes: { hidden: true } }, badRestore,
  ]), /restore deleted/);
  assert.equal(data.links, before);
  assert.equal(index.linkById.get("link-1").hidden, undefined);
});

test("normalization and visibility preserve compact storage and link ownership", async () => {
  const [{ normalizeChartData }, { visibleChartData }, { createChartState }] = await Promise.all([
    import("../../src/data/normalize.mjs"), import("../../src/data/visibility.mjs"), import("../../src/chart/state.mjs"),
  ]);
  const store = new CompactLinkStore(input());
  const source = { clusters: ["a", "b", "c"].map((uid) => ({ uid,
    loci: [{ uid: `l-${uid}`, start: 0, end: 100, genes: [{ uid, start: 10, end: 20, strand: 1 }] }] })),
    links: store, groups: [], config: { updateGroups: false } };
  const normalized = normalizeChartData(source);
  assert.equal(normalized.links, store);
  const state = createChartState(normalized);
  state.excludedClusters.add("c");
  const visible = visibleChartData(normalized, state);
  assert.ok(visible.links instanceof CompactLinkStore);
  assert.deepEqual([...visible.links.keys()], ["link-0", "link-2"]);
  assert.equal(store.size, 4);
});

test("compact read views behave like read-only arrays and materialize on access", async () => {
  const { linkArrayView } = await import("../../src/data/linkStore.mjs");
  const store = new CompactLinkStore(input()), view = linkArrayView(store);
  assert.equal(Array.isArray(view), true);
  assert.equal(view.length, 4);
  assert.equal(view[1].uid, "link-1");
  assert.equal(1 in view, true);
  assert.equal(10 in view, false);
  assert.deepEqual(view.map((link) => link.uid), [...store.keys()]);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), [...store.values()]);
  assert.throws(() => { view[0] = {}; }, /read-only/);
  assert.throws(() => view.push({}), /read-only/);
  assert.equal(linkArrayView(store), view);
});
