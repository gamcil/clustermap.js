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

test("array and compact link batches validate sequentially and round-trip", async () => {
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  for (const compact of [false, true]) {
    const base = new CompactLinkStore(input());
    const data = { clusters: [{ uid: "one", loci: [{ uid: "l1", genes: [{ uid: "a" }, { uid: "b" }, { uid: "c" }] }] }],
      groups: [], links: compact ? base : [...base.values()] };
    const read = () => compact ? [...data.links.values()] : structuredClone(data.links);
    const apply = (ops) => applyChartOperations(data, createChartIndex(data), ops);
    const before = read();
    for (const second of [
      { type: "links.update", ids: ["link-0"], changes: { label: "invalid" } },
      { type: "links.delete", ids: ["link-0"] },
    ]) {
      assert.throws(() => apply([{ type: "links.delete", ids: ["link-0"] }, second]), /unknown/);
      assert.deepEqual(read(), before);
    }
    const edit = apply([{ type: "links.delete", ids: ["link-0"] },
      { type: "links.restore", records: [{ index: 0, link: before[0] }] },
      { type: "links.update", ids: ["link-0"], changes: { label: "updated" } }]);
    const after = read();
    assert.equal(after[0].label, "updated");
    const undo = apply(edit.inverse);
    assert.deepEqual(read(), before);
    apply(undo.inverse);
    assert.deepEqual(read(), after);
  }
});

test("mixed structural batches keep indexes and undo consistent", async () => {
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  for (const compact of [false, true]) {
    const base = new CompactLinkStore(input());
    const data = { clusters: [{ uid: "one", loci: [{ uid: "l1", genes: [{ uid: "a" }, { uid: "b" }, { uid: "c" }] }] }],
      groups: [], links: compact ? base : [...base.values()] };
    const index = createChartIndex(data), before = [...base.values()];
    const edit = applyChartOperations(data, index, [
      { type: "genes.delete", ids: ["a"] },
      { type: "links.delete", ids: ["link-0"] },
      { type: "links.delete", ids: ["link-1"] },
      { type: "links.update", ids: ["link-2"], changes: { label: "changed" } },
    ]);
    const updated = compact ? index : createChartIndex(data);
    assert.equal(edit.indexPrepared, compact);
    assert.equal(updated.geneById.has("a"), false);
    assert.deepEqual([...updated.linkById.keys()], ["link-2", "link-3"]);
    assert.equal(updated.linksByGeneId.get("b")[0].label, "changed");
    applyChartOperations(data, updated, edit.inverse);
    assert.deepEqual(JSON.parse(JSON.stringify(compact ? [...data.links.values()] : data.links)), before);
    assert.deepEqual(data.clusters[0].loci[0].genes.map((gene) => gene.uid), ["a", "b", "c"]);
  }
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

test("compact best-match visibility matches object filtering without materializing links", () => {
  const genes = ["a", "b", "c", "d", "missing"], count = 300;
  const store = new CompactLinkStore({ genes,
    query: Uint32Array.from({ length: count }, (_, i) => (i * 13) % genes.length),
    target: Uint32Array.from({ length: count }, (_, i) => (i * 7 + 1) % genes.length),
    identity: Float64Array.from({ length: count }, (_, i) => (i % 6) / 5),
    similarity: new Float64Array(count).fill(0.9) })
    .withUpdates([{ uid: "link-3", changes: { hidden: true } }, { uid: "link-7", changes: { identity: 0.73 } }])
    .withDeleted(["link-2", "link-21"]);
  const options = { bestOnly: true, threshold: 0.2,
    groupForGene: (uid) => uid === "d" ? null : 0,
    geneForUid: (uid) => uid === "missing" ? undefined : { clusterUid: uid === "a" || uid === "b" ? "left" : "right" } };
  const expected = new Set(filterLinks([...store.values()], options).map((link) => link.uid));
  store.getAt = () => { throw new Error("best-match filtering materialized a link"); };
  const actual = createLinkVisibility(store, options, store);
  assert.deepEqual([...store.keys()].filter((uid) => actual.has(uid)), [...store.keys()].filter((uid) => expected.has(uid)));
});

test("best-match selection agrees for ties, reversed pairs and lower scores", () => {
  const store = new CompactLinkStore({ genes: ["a", "b", "c", "d"],
    query: new Uint32Array([0, 2, 0, 0, 1]), target: new Uint32Array([2, 0, 3, 2, 3]),
    identity: new Float32Array([1, 1, 1, 0.5, 0.5]), similarity: new Float32Array(5) });
  const options = { bestOnly: true, threshold: 0, groupForGene: () => 0,
    geneForUid: (uid) => ({ clusterUid: uid === "a" || uid === "b" ? "left" : "right" }) };
  const expected = ["link-0", "link-1", "link-2"];
  assert.deepEqual(filterLinks([...store.values()], options).map((link) => link.uid), expected);
  const visible = createLinkVisibility(store, options, store);
  assert.deepEqual([...store.keys()].filter((uid) => visible.has(uid)), expected);
});

test("compact link snapshots preserve sparse edits, deletions and undefined values", () => {
  const base = new CompactLinkStore(input());
  const edited = base.withUpdates([{ uid: "link-0", changes: { hidden: true, label: "chosen" } },
    { uid: "link-1", changes: { identity: undefined } }, { uid: "link-2", changes: { colour: "red" } }])
    .withDeleted(["link-2"]);
  const snapshot = JSON.parse(JSON.stringify(edited.snapshotEdits()));
  const loaded = base.applyEdits(snapshot);
  assert.deepEqual([...loaded.values()], [...edited.values()]);
  assert.equal(loaded.get("link-1").identity, undefined);
  assert.equal(base.isUnedited, true);
  assert.equal(edited.sharesBase(base), true);
  assert.equal(edited.sharesBase(new CompactLinkStore(input())), false);
  assert.equal(base.fingerprint, new CompactLinkStore(input()).fingerprint);
  const other = input(); other.identity[0] = 0.1;
  assert.throws(() => new CompactLinkStore(other).applyEdits(snapshot), /does not match/);
  assert.throws(() => edited.applyEdits(snapshot), /edited base/);
  assert.throws(() => base.applyEdits({ version: 1, base: base.fingerprint, deleted: [0], updates: [[0, [["hidden", true]]]] }), /update snapshot/);
  assert.throws(() => base.applyEdits({ version: 1, base: base.fingerprint, deleted: [99], updates: [] }), /deletion snapshot/);
});

test("compact columns can transfer ownership without copying and invalid input stays attached", () => {
  const columns = input(), expected = [...new CompactLinkStore(columns).values()];
  const store = CompactLinkStore.fromTransferred(columns);
  assert.deepEqual([...store.values()], expected);
  for (const key of ["query", "target", "identity", "similarity"]) assert.equal(columns[key].byteLength, 0);
  const invalid = input(); invalid.target[0] = 99;
  assert.throws(() => CompactLinkStore.fromTransferred(invalid), /position 0/);
  assert.equal(invalid.query.byteLength, 16);
});

test("compact construction validates the same columns it uses", () => {
  for (const transfer of [false, true]) {
    const columns = input();
    let reads = 0;
    const supplied = { ...columns, get query() { reads++; return columns.query; } };
    const store = transfer ? CompactLinkStore.fromTransferred(supplied) : new CompactLinkStore(supplied);
    assert.equal(reads, 1);
    assert.equal(store.size, 4);
    assert.equal(columns.query.byteLength, transfer ? 0 : 16);
  }
});

test("compact positions remain correct with large exclusions and shared edit views", () => {
  const count = 1000, genes = ["a", "b"];
  const store = new CompactLinkStore({ genes,
    query: Uint32Array.from({ length: count }, (_, i) => i % 2), target: new Uint32Array(count),
    identity: new Float64Array(count).fill(0.9), similarity: new Float64Array(count).fill(0.95) });
  const filtered = store.filterEndpoints(new Set(["a"]));
  assert.equal(filtered.size, 500);
  for (let i = 0; i < filtered.size; i++) {
    assert.equal(filtered.uidAt(i), `link-${i * 2}`);
    assert.equal(filtered.order(`link-${i * 2}`), i);
  }
  const changed = filtered.withUpdates([{ uid: "link-998", changes: { hidden: true } }]);
  assert.equal(changed.getAt(499).hidden, true);
  assert.equal(filtered.getAt(499).hidden, undefined);
  assert.equal(store.size, count);
});

test("32-bit base scores preserve their exact values, fingerprints and full-precision edits", () => {
  const original = input();
  const columns = { ...original, identity: Float32Array.from(original.identity), similarity: Float32Array.from(original.similarity) };
  const retained = new CompactLinkStore(columns);
  const widened = new CompactLinkStore({ ...columns, identity: Float64Array.from(columns.identity), similarity: Float64Array.from(columns.similarity) });
  assert.equal(retained.byteLength, 16 * retained.size);
  assert.equal(retained.fingerprint, widened.fingerprint);
  assert.deepEqual([...retained.values()], [...widened.values()]);
  assert.equal(CompactLinkStore.supportsFloat32Scores, true);
  assert.equal(retained.geneCount, 4);
  assert.equal(retained.geneAt(1), "b");
  assert.equal(retained.queryIndexAt(0), 0);
  assert.equal(retained.targetIndexAt(0), 1);
  assert.equal(retained.similarityAt(1), columns.similarity[1]);
  assert.equal(retained.queryIndexAt(99), undefined);
  const edited = retained.withUpdates([{ uid: "link-0", changes: { identity: 0.912345678901234 } }]);
  assert.equal(edited.identityAt(0), 0.912345678901234);
  const restored = widened.applyEdits(JSON.parse(JSON.stringify(edited.snapshotEdits())));
  assert.equal(restored.identityAt(0), 0.912345678901234);
  const transferred = CompactLinkStore.fromTransferred(columns);
  assert.equal(columns.identity.byteLength, 0);
  assert.equal(transferred.fingerprint, widened.fingerprint);
});

test("compact snapshots survive JSON round trips of negative zero scores", () => {
  for (const ScoreColumn of [Float32Array, Float64Array]) {
    const columns = { genes: ["a"], query: new Uint32Array([0]), target: new Uint32Array([0]),
      identity: new ScoreColumn([-0]), similarity: new ScoreColumn([-0]) };
    const original = new CompactLinkStore(columns);
    const json = JSON.parse(JSON.stringify({ identity: [...columns.identity], similarity: [...columns.similarity] }));
    const restored = new CompactLinkStore({ ...columns, identity: new ScoreColumn(json.identity),
      similarity: new ScoreColumn(json.similarity) });
    const snapshot = original.withUpdates([{ uid: "link-0", changes: { hidden: true } }]).snapshotEdits();
    assert.equal(original.fingerprint, restored.fingerprint);
    assert.equal(restored.applyEdits(snapshot).getAt(0).hidden, true);
  }
});
