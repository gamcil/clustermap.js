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
