import test from "node:test";
import assert from "node:assert/strict";
import { DataPanelModel } from "../../src/editor/components/data-panel/model.js";

function fixture() {
  const model = new DataPanelModel();
  model.data = {
    clusters: [
      { uid: "a", loci: [
        { uid: "a1", genes: [{ uid: 1, label: "First" }, { uid: 2 }] },
        { uid: "a2", genes: [{ uid: 3 }] },
      ] },
      { uid: "b", loci: [{ uid: "b1", genes: [{ uid: 4 }] }] },
    ],
    groups: [{ uid: 0, genes: [1] }, { uid: "other", genes: [2, 3, 4] }],
    links: [],
  };
  return model;
}

const options = (changes = {}) => ({ kind: "genes", geneView: "tree", filter: "", memberGroupId: null, sort: null, expanded: new Set(), ...changes });

test("link rows display, filter and sort locus spans in both small and paged views", () => {
  const model = fixture();
  model.data.clusters[0].loci[0].name = "Sequence A";
  const span = { uid: "span", query: { kind: "span", locusId: "a1", start: 10, end: 30 },
    target: { kind: "gene", geneId: 2 }, identity: 0.9 };
  model.data.links = [span];
  const view = () => model.view(options({ kind: "links", filter: "sequence a", sort: { key: "source", direction: 1 } }));
  assert.deepEqual(view().rows.map(({ source, target, groups }) => [source, target, groups]), [["Sequence A:11-30", 2, "— / Ungrouped"]]);
  model.data.links = Array.from({ length: 1001 }, (_, i) => ({ ...span, uid: `span-${i}` }));
  model.data = model.data;
  const paged = view();
  assert.equal(paged.total, 1001);
  assert.equal(paged.rows[0].source, "Sequence A:11-30");
  assert.equal(paged.rows[0].groups, "— / Ungrouped");
});

test("compact span rows remain paged and searchable", async () => {
  const { CompactLinkStore, linkArrayView } = await import("../../src/data/linkStore.mjs");
  const count = 1001, zeros = () => new Float64Array(count), ends = () => new Float64Array(count).fill(20);
  const store = new CompactLinkStore({ genes: [], query: new Uint32Array(count), target: new Uint32Array(count).fill(1),
    identity: new Float32Array(count).fill(0.9), similarity: new Float32Array(count).fill(1),
    spans: { loci: ["a1", "b1"], kinds: new Uint8Array(count).fill(3), orientation: new Int8Array(count),
      queryStart: zeros(), queryEnd: ends(), targetStart: zeros(), targetEnd: ends() } });
  let reads = 0; const get = store.getAt.bind(store);
  store.getAt = (position) => { reads++; return get(position); };
  const model = fixture(); model.data.links = linkArrayView(store);
  const result = model.view(options({ kind: "links", filter: "a1:1-20", sort: { key: "source", direction: 1 } }));
  assert.equal(result.total, count);
  assert.equal(result.rows.length, 250);
  assert.equal(result.rows[0].source, "a1:1-20");
  assert.equal(reads, 250, "only the visible page materializes complete records");
});

test("collapsed views retain branches and parent keys without rendering their genes", () => {
  const model = fixture(), view = model.view(options());
  assert.deepEqual(view.rows.map(({ key }) => key), ["cluster:a", "cluster-locus:b:b1"]);
  assert.deepEqual(view.branches.map(({ key }) => key), ["cluster:a", "locus:a1", "locus:a2", "cluster-locus:b:b1"]);
  assert.equal(view.branches.find(({ key }) => key === "locus:a2").parentKey, "cluster:a");
  const expanded = new Set(view.branches.map(({ key }) => key));
  const open = model.view(options({ expanded }));
  assert.equal(open.hasCollapsed, false);
  assert.deepEqual(open.rows.filter(({ type }) => type === "gene").map(({ id }) => id), [1, 2, 3, 4]);
});

test("filtered expansion uses projected branches while removal requires complete membership", () => {
  const model = fixture(), view = model.view(options({ memberGroupId: 0 }));
  assert.deepEqual(view.branches.map(({ key }) => key), ["cluster-locus:a:a1"]);
  assert.deepEqual(view.ids, [1]);
  const expanded = new Set(view.branches.map(({ key }) => key));
  assert.deepEqual(model.view(options({ memberGroupId: 0, expanded })).rows.map(({ type }) => type), ["cluster-locus", "gene"]);
  assert.deepEqual(model.selectedParents("loci", new Set([1])), []);
  assert.deepEqual(model.selectedParents("clusters", new Set([1])), []);
  assert.deepEqual(model.selectedParents("loci", new Set([1, 2])), ["a1"]);
  assert.deepEqual(model.selectedParents("clusters", new Set([1, 2, 3])), ["a"]);
});

test("refreshing the same data object invalidates row and membership caches", () => {
  const model = fixture(), expanded = new Set(["cluster:a", "locus:a1"]);
  model.view(options({ expanded }));
  const data = model.data;
  data.clusters[0].loci[0].genes[0].label = "Edited";
  data.clusters[0].loci[0].genes.push({ uid: 5 });
  model.data = data;
  assert.equal(model.view(options({ expanded })).rows.find(({ id }) => id === 1).label, "Edited");
  assert.deepEqual(model.selectedParents("loci", new Set([1, 2])), []);
  assert.deepEqual(model.selectedParents("loci", new Set([1, 2, 5])), ["a1"]);
});

test("plot targets preserve typed IDs and include selected groups outside the filter", () => {
  const model = fixture();
  model.view(options({ kind: "groups", filter: "no match" }));
  assert.equal(model.groupId("0"), 0);
  assert.deepEqual(model.plotTarget("groups", new Set([0])), { genes: [1] });
  assert.deepEqual(model.plotTarget("genes", [1, 2]), { genes: [1, 2] });
  assert.deepEqual(model.plotTarget("links", [0]), { links: [0] });
});

test("large compact link views page sorted and filtered rows without expanding the link table", async () => {
  const { CompactLinkStore, linkArrayView } = await import("../../src/data/linkStore.mjs");
  const count = 1250, genes = ["a", "b", "c"];
  const store = new CompactLinkStore({ genes,
    query: Uint32Array.from({ length: count }, (_, i) => i % 3),
    target: Uint32Array.from({ length: count }, (_, i) => (i + 1) % 3),
    identity: Float64Array.from({ length: count }, (_, i) => (i % 10) / 10),
    similarity: new Float64Array(count).fill(0.9) });
  let reads = 0;
  const get = store.getAt.bind(store);
  store.getAt = (position) => { reads++; return get(position); };
  const model = new DataPanelModel();
  model.data = { clusters: [{ uid: "cluster", loci: [{ uid: "locus", genes: genes.map((uid) => ({ uid, label: `Gene ${uid}` })) }] }],
    groups: [{ uid: "group", genes }], links: linkArrayView(store) };
  const settings = options({ kind: "links", sort: { key: "identity", direction: -1 }, page: 0 });
  const first = model.view(settings);
  assert.equal(first.total, count);
  assert.equal(first.rows.length, 250);
  assert.equal(first.pageCount, 5);
  assert.equal(first.rows[0].identity, 90);
  assert.equal(reads, 250, "only the visible page is materialized");
  const second = model.view({ ...settings, page: 1 });
  assert.equal(second.rows.length, 250);
  assert.equal(reads, 500, "changing pages reuses the sorted position index");
  assert.equal(new Set([...first.ids, ...second.ids]).size, 500);
  const filtered = model.view({ ...settings, filter: "gene a", page: 0 });
  const expected = [...store.values()].filter((link) => [link.query.uid, link.target.uid].includes("a"));
  assert.equal(filtered.total, expected.length);
  assert.deepEqual(model.existingIds("links", ["link-1", "missing"]), ["link-1"]);
});

test("large link pages preserve existing global sort, tie and filter semantics", () => {
  const genes = [{ uid: "a", label: "gene 10" }, { uid: "b", label: "Gene 2" }, { uid: "c", label: "gene 2" }];
  const links = Array.from({ length: 1100 }, (_, i) => ({ uid: `link-${i}`,
    query: { uid: genes[i % 3].uid }, target: { uid: genes[(i * 2 + 1) % 3].uid },
    identity: (i % 9) / 10, label: i % 3 ? "alpha" : "Alpha" }));
  const model = new DataPanelModel();
  model.data = { clusters: [{ uid: "cluster", loci: [{ uid: "locus", genes }] }],
    groups: [{ uid: "g", label: "Group", genes: genes.map((gene) => gene.uid) }], links };
  const gene = new Map(genes.map((item) => [item.uid, item.label]));
  const rows = links.map((link) => ({ id: link.uid, source: gene.get(link.query.uid), target: gene.get(link.target.uid),
    identity: Math.round(link.identity * 1000) / 10, groups: "Group / Group", label: link.label }));
  for (const key of ["source", "target", "identity", "groups", "label"]) for (const direction of [1, -1]) {
    const expected = [...rows].sort((a, b) => (typeof a[key] === "number" ? a[key] - b[key] :
      a[key].localeCompare(b[key], undefined, { numeric: true, sensitivity: "base" })) * direction);
    const got = [];
    for (let page = 0; page < 5; page++) got.push(...model.view(options({ kind: "links", page, sort: { key, direction } })).ids);
    assert.deepEqual(got, expected.map((row) => row.id), `${key} direction ${direction}`);
  }
});
