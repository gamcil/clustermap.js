import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChartData } from "../../src/data/normalize.mjs";
import { createChartIndex } from "../../src/data/index.mjs";
import { applyChartOperations } from "../../src/data/operations.mjs";
import { rerootTree, resetTreeRoot } from "../../src/tree/rooting.mjs";
import { treeMetrics, treeClusterOrder } from "../../src/tree/model.mjs";

function input() {
  return { clusters: ["a", "b", "c"].map((uid) => ({ uid, loci: [] })), links: [], groups: [], tree: {
    root: "r", rooted: false, nodes: [
      { uid: "r", children: ["p", "c"] },
      { uid: "p", children: ["a", "b"], branchLength: 2, support: { value: 90, scale: "percent" } },
      { uid: "a", cluster: "a", branchLength: 1 }, { uid: "b", cluster: "b", branchLength: 3 },
      { uid: "c", cluster: "c", branchLength: 4 },
    ],
  } };
}

function distances(tree) {
  const { nodes, parents } = treeMetrics(tree);
  const edges = new Map(tree.nodes.map(({ uid }) => [uid, []]));
  for (const [child, parent] of parents) {
    edges.get(child).push([parent, nodes.get(child).branchLength]);
    edges.get(parent).push([child, nodes.get(child).branchLength]);
  }
  return tree.nodes.filter((node) => node.cluster !== undefined).map((node) => node.uid).sort().flatMap((from, i, leaves) => {
    const lengths = new Map();
    const visit = (uid, parent, distance) => { lengths.set(uid, distance); for (const [child, length] of edges.get(uid)) if (child !== parent) visit(child, uid, distance + length); };
    visit(from, null, 0);
    return leaves.slice(i + 1).map((to) => lengths.get(to));
  });
}

for (const nodeId of ["a", "b", "c", "p"]) {
  test(`rerooting at ${nodeId} preserves distances, IDs, support and source ownership`, () => {
    const data = normalizeChartData(input()), original = structuredClone(data.tree);
    const result = rerootTree(data.tree, nodeId);
    assert.deepEqual(data.tree, original);
    normalizeChartData({ ...data, tree: result });
    assert.equal(result.rooted, false);
    assert.equal(result.nodes.find(({ uid }) => uid === result.root).children[0], nodeId);
    assert.deepEqual(distances(result), distances(original));
    assert.equal(result.nodes.filter(({ support }) => support).length, 1);
    assert.equal(result.nodes.find(({ uid }) => uid === result.root).support, undefined);
    assert.deepEqual(resetTreeRoot(result), original);
  });
}

test("repeated rooting reuses one root and persists reset through JSON", () => {
  const data = normalizeChartData(input()), original = structuredClone(data.tree);
  for (const nodeId of ["a", "p", "c", "b", "a"]) {
    data.tree = rerootTree(data.tree, nodeId);
    assert.equal(data.tree.nodes.length, original.nodes.length + 1);
    assert.deepEqual(distances(data.tree), distances(original));
    data.tree = normalizeChartData(JSON.parse(JSON.stringify(data))).tree;
  }
  assert.deepEqual(resetTreeRoot(data.tree), original);
  assert.equal(treeClusterOrder(data.tree)[0], "a");
});

test("branch styles follow edges, node labels persist, and changed collapsed clades expand", () => {
  const data = input();
  data.tree.presentation = { nodes: { p: { branch: { colour: "red", width: 2 }, label: { text: "Clade" } } }, subtrees: { p: { collapsed: true } } };
  const rooted = rerootTree(normalizeChartData(data).tree, "a");
  assert.deepEqual(rooted.presentation.nodes.r.branch, { colour: "red", width: 2 });
  assert.deepEqual(rooted.presentation.nodes.p.label, { text: "Clade" });
  assert.equal(rooted.presentation.subtrees?.p?.collapsed, undefined);
  rooted.nodes.find(({ uid }) => uid === "p").label = "Edited node name";
  rooted.presentation.nodes.r.branch.colour = "blue";
  const reset = resetTreeRoot(rooted);
  assert.equal(reset.nodes.find(({ uid }) => uid === "p").label, "Edited node name");
  assert.equal(reset.presentation.nodes.p.branch.colour, "blue");
  assert.deepEqual(reset.presentation.nodes.p.label, { text: "Clade" });
  normalizeChartData({ ...data, tree: reset });
});

test("rerooting preserves missing lengths and avoids generated ID collisions", () => {
  const data = input(); delete data.tree.nodes[2].branchLength;
  data.tree.nodes[0].uid = "clustermap-root"; data.tree.root = "clustermap-root";
  const rooted = rerootTree(normalizeChartData(data).tree, "a");
  assert.equal(rooted.root, "clustermap-root-");
  for (const uid of rooted.nodes.find(({ uid }) => uid === rooted.root).children) {
    assert.equal(rooted.nodes.find((node) => node.uid === uid).branchLength, undefined);
  }
  assert.deepEqual(resetTreeRoot(rooted), normalizeChartData(data).tree);
});

test("multifurcations and zero-length branches survive rooting and reset", () => {
  const data = input();
  data.clusters.push({ uid: "d", loci: [] }); data.tree.nodes[0].children.push("d");
  data.tree.nodes.push({ uid: "d", cluster: "d", branchLength: 0 }); data.tree.nodes[1].branchLength = 0;
  const original = normalizeChartData(data).tree, rooted = rerootTree(original, "p");
  normalizeChartData({ ...data, tree: rooted });
  assert.deepEqual(distances(rooted), distances(original));
  assert.deepEqual(resetTreeRoot(rooted), original);
});

test("structural tree edits rebuild state and undo topology exactly", () => {
  const data = normalizeChartData(input()), original = structuredClone(data);
  treeMetrics(data.tree);
  const apply = (ops) => applyChartOperations(data, createChartIndex(data), ops);
  const edit = apply([{ type: "tree.reroot", nodeId: "b" }]);
  const rooted = structuredClone(data);
  assert.deepEqual(edit.effects, { reindex: false, rebuildState: true });
  assert.equal(treeMetrics(data.tree).parents.get("b"), data.tree.root);
  apply(edit.inverse); assert.deepEqual(data, original);
  apply(edit.operations); assert.deepEqual(data, rooted);
  const reset = apply([{ type: "tree.reroot.reset" }]);
  assert.deepEqual(data, original);
  apply(reset.inverse); assert.deepEqual(data, rooted);
});

test("invalid rooting and saved baselines are rejected atomically", () => {
  const data = normalizeChartData(input()), original = structuredClone(data);
  for (const nodeId of ["missing", "r", null]) {
    assert.throws(() => applyChartOperations(data, createChartIndex(data), [
      { type: "clusters.update", ids: ["a"], changes: { name: "Must not change" } },
      { type: "tree.reroot", nodeId },
    ]), /root|node/);
    assert.deepEqual(data, original);
  }
  for (const baseline of [null, {}, { root: "r", node: "r", children: [] }]) {
    assert.throws(() => normalizeChartData({ ...data, tree: { ...data.tree, rooting: baseline } }), /rooting/);
  }
  const rooted = rerootTree(data.tree, "a"); rooted.rooting.children[0][1] = ["a", "c"];
  assert.throws(() => normalizeChartData({ ...data, tree: rooted }), /rooting/);
  data.tree.distance = { kind: "mergeHeight" };
  assert.throws(() => rerootTree(data.tree, "a"), /merge-height/);
  const unary = input(); unary.tree.nodes.push({ uid: "unary", children: ["r"] }); unary.tree.root = "unary";
  assert.throws(() => rerootTree(normalizeChartData(unary).tree, "a"), /unary display root/);
});
