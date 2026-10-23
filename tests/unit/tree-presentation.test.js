import test from "node:test";
import assert from "node:assert/strict";
import { resolveTreePresentation, validateTreePresentation } from "../../src/tree/model.mjs";
import { createChartRuntime } from "../../src/chart/runtime.js";

function example(cutHeight = 3) {
  return {
    root: "root", distance: { kind: "mergeHeight", label: "Ward merge height" },
    presentation: { colouring: { mode: "cutHeight", cutHeight, palette: ["red", "blue"] } },
    nodes: [
      { uid: "root", children: ["x", "y", "e"] },
      { uid: "x", children: ["a", "b"], branchLength: 8 },
      { uid: "y", children: ["c", "d"], branchLength: 6 },
      { uid: "a", cluster: "a", branchLength: 2 },
      { uid: "b", cluster: "b", branchLength: 2 },
      { uid: "c", cluster: "c", branchLength: 4 },
      { uid: "d", cluster: "d", branchLength: 4 },
      { uid: "e", cluster: "e", branchLength: 10 },
    ],
  };
}
const config = { branch: { colour: "#555", width: 1.5 } };

test("cut colouring owns a merge connector/outgoing edges but leaves the clade's incoming edge neutral", () => {
  const styles = resolveTreePresentation(example(), config);
  assert.equal(styles.stems.get("x").colour, "red");
  for (const uid of ["a", "b"]) assert.equal(styles.branches.get(uid).colour, "red");
  for (const uid of ["x", "y", "c", "d", "e"]) assert.equal(styles.branches.get(uid).colour, "#555");
  assert.equal(styles.height, 10);
});

test("cut boundaries are strict; zero is neutral and a cut above the root colours the whole tree", () => {
  const atTie = resolveTreePresentation(example(4), config);
  assert.equal(atTie.stems.get("y").colour, "#555");
  assert.equal(resolveTreePresentation(example(4.001), config).stems.get("y").colour, "blue");
  assert.ok([...resolveTreePresentation(example(0), config).branches.values()].every((style) => style.colour === "#555"));
  assert.ok([...resolveTreePresentation(example(11), config).branches.values()].every((style) => style.colour === "red"));
  const zero = example("auto");
  zero.nodes.forEach((node) => { if (node.uid !== "root") node.branchLength = 0; });
  assert.equal(resolveTreePresentation(zero, config).threshold, 0);
});

test("palette assignment is stable under rotation and independent of node array order", () => {
  const tree = example(5);
  const first = resolveTreePresentation(tree, config);
  tree.nodes[0].children.reverse();
  tree.nodes.find((node) => node.uid === "x").children.reverse();
  assert.equal(resolveTreePresentation(tree, config), first, "rotation reuses resolved styles instead of classifying every frame");
  const reordered = structuredClone(tree);
  reordered.nodes.reverse();
  assert.deepEqual(resolveTreePresentation(reordered, config).stems, first.stems);
});

test("polytomies use one colour for every edge in a below-cut merge", () => {
  const tree = example(5);
  tree.nodes.find((node) => node.uid === "y").children.push("f");
  tree.nodes.push({ uid: "f", cluster: "f", branchLength: 4 });
  const styles = resolveTreePresentation(tree, config);
  assert.equal(styles.branches.get("c").colour, styles.branches.get("f").colour);
});

test("manual inheritance resolves colour and width independently and respects incoming-edge scope", () => {
  const tree = example();
  tree.presentation.subtrees = { root: { branch: { colour: "green", width: 2 } }, x: { branch: { width: 4 } } };
  tree.presentation.nodes = { x: { branch: { colour: "purple", width: 6 } } };
  const styles = resolveTreePresentation(tree, config);
  assert.deepEqual(styles.branches.get("x"), { colour: "purple", width: 6 });
  assert.deepEqual(styles.stems.get("x"), { colour: "green", width: 4 });
  assert.deepEqual(styles.branches.get("a"), { colour: "green", width: 4 });
  tree.presentation = { ...tree.presentation, subtrees: {}, nodes: {} };
  assert.equal(resolveTreePresentation(tree, config).branches.get("a").colour, "red");
});

test("effective colouring requires explicit merge-height metadata and a complete ultrametric tree", () => {
  const noMetadata = example(); delete noMetadata.distance;
  assert.throws(() => validateTreePresentation(noMetadata), /requires distance.kind/);
  const missing = example(); delete missing.nodes[2].branchLength;
  assert.throws(() => validateTreePresentation(missing), /complete lengths/);
  const unequal = example(); unequal.nodes.at(-1).branchLength = 12;
  assert.throws(() => validateTreePresentation(unequal), /equal root-to-tip/);
  const tolerance = example(); tolerance.nodes.at(-1).branchLength += 1e-10;
  assert.doesNotThrow(() => validateTreePresentation(tolerance));
});

for (const [description, presentation] of [
  ["ambiguous null threshold", { colouring: { cutHeight: null } }],
  ["empty palette", { colouring: { palette: [] } }],
  ["invalid colour", { colouring: { palette: ["not-a-colour"] } }],
  ["unknown node", { subtrees: { missing: { branch: { colour: "red" } } } }],
  ["root incoming edge", { nodes: { root: { branch: { colour: "red" } } } }],
  ["zero width", { subtrees: { x: { branch: { width: 0 } } } }],
  ["leaf annotation", { nodes: { a: { label: { text: "tip" } } } }],
  ["unknown field", { nodes: { x: { unsupported: true } } }],
]) {
  test(`presentation validation rejects ${description}`, () => {
    const tree = example(); tree.presentation = presentation;
    assert.throws(() => validateTreePresentation(tree), /Invalid tree presentation:/);
  });
}

test("a failed global configuration change preserves the previous settings", () => {
  const runtime = createChartRuntime();
  const tree = example(); delete tree.distance; delete tree.presentation;
  const before = JSON.stringify(runtime.config);
  assert.throws(() => runtime.configure({ tree: { colouring: { mode: "cutHeight" } } }, tree), /requires distance.kind/);
  assert.equal(JSON.stringify(runtime.config), before);
  assert.throws(() => runtime.configure({ tree: { colouring: { palette: [] } } }), /non-empty colour array/);
  assert.equal(JSON.stringify(runtime.config), before);
});

import { applyChartOperations } from "../../src/data/operations.mjs";
import { createChartIndex } from "../../src/data/index.mjs";
const operation = (scope, changes, ids) => ({ type: "tree.presentation.update", scope, changes, ...(ids ? { ids } : {}) });
function editable() {
  const tree = example(); delete tree.presentation;
  const data = { tree, clusters: [], links: [], groups: [] };
  return { data, index: createChartIndex(data) };
}

test("tree patches preserve absent fields through exact undo and redo without rebuilding indexes", () => {
  const { data, index } = editable();
  const before = structuredClone(data);
  const result = applyChartOperations(data, index, [
    operation("tree", { colouring: { mode: "cutHeight", cutHeight: 3 } }),
    operation("subtree", { branch: { width: 4 } }, ["x"]),
    operation("node", { label: { text: "<b>plain text</b>", fontWeight: 700 } }, ["x"]),
  ]);
  const after = structuredClone(data);
  assert.deepEqual(result.effects, { reindex: false, rebuildState: false });
  applyChartOperations(data, index, result.inverse);
  assert.deepEqual(data, before);
  applyChartOperations(data, index, result.operations);
  assert.deepEqual(data, after);
});

test("sparse deletion/reset restores inheritance while preserving independent children and policy", () => {
  const { data, index } = editable();
  applyChartOperations(data, index, [
    operation("tree", { colouring: { mode: "cutHeight", cutHeight: 3 } }),
    operation("subtree", { branch: { colour: "green", width: 3 } }, ["root"]),
    operation("subtree", { branch: { width: 5 } }, ["x"]),
    operation("subtree", { branch: { colour: null } }, ["root"]),
  ]);
  assert.deepEqual(data.tree.presentation.subtrees.root.branch, { width: 3 });
  assert.equal(resolveTreePresentation(data.tree, config).stems.get("x").colour, "#267c9e");
  const before = structuredClone(data);
  applyChartOperations(data, index, [{ type: "tree.presentation.reset", scope: "subtree", ids: ["root"] }]);
  assert.deepEqual(data.tree.presentation.subtrees.x.branch, { width: 5 });
  const reset = applyChartOperations(data, index, [{ type: "tree.presentation.reset", scope: "manual" }]);
  assert.deepEqual(Object.keys(data.tree.presentation), ["colouring"]);
  applyChartOperations(data, index, reset.inverse);
  assert.deepEqual(data.tree.presentation.subtrees.x, before.tree.presentation.subtrees.x);
});

test("invalid mixed/tree batches are atomic, including unknown deletion fields", () => {
  const { data, index } = editable();
  const before = structuredClone(data);
  for (const bad of [
    operation("node", { branch: { colour: "invalid" } }, ["x"]),
    operation("subtree", { branch: { unsupported: null } }, ["x"]),
    operation("node", { label: { text: "no" } }, ["a"]),
    operation("node", { branch: { width: 2 } }, ["root"]),
  ]) {
    assert.throws(() => applyChartOperations(data, index, [operation("subtree", { branch: { width: 4 } }, ["x"]), bad]));
    assert.deepEqual(data, before);
  }
});
