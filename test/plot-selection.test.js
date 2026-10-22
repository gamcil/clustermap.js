import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeChartData, validateTree } from "../src/data/normalize.mjs";
import { createChartIndex } from "../src/data/index.mjs";
import { visibleChartData, visibleTree } from "../src/data/visibility.mjs";
import { createChartState, setTreeClusterOrder } from "../src/chart/state.mjs";
import { serializeChartState, chartStateFromSnapshot } from "../src/chart/snapshot.mjs";
import { createChartRuntime } from "../src/chart/runtime.js";
import { plotSelectionOptions } from "../src/interaction/controller.mjs";
import { RowSelection } from "../src/ui/selection.mjs";

const fixture = async () => normalizeChartData(JSON.parse(await readFile(new URL("../fixtures/heatmap.json", import.meta.url), "utf8")));

test("tree pruning collapses unary chains, preserves distances and leaves the source intact", async () => {
  const data = await fixture();
  data.tree.presentation = { subtrees: { x: { branch: { colour: "#abcdef" } } } };
  const before = structuredClone(data), aliases = new Map();
  const clusters = data.clusters.filter((cluster) => cluster.uid !== "a");
  const tree = visibleTree(data.tree, new Set(clusters.map((cluster) => cluster.uid)), aliases);
  assert.equal(tree.nodes.some((node) => node.uid === "x"), false);
  assert.equal(tree.nodes.find((node) => node.uid === "b").branchLength, 7);
  assert.equal(aliases.get("x"), "b");
  assert.equal(tree.presentation.nodes.b.branch.colour, "#abcdef");
  validateTree(tree, clusters);
  const last = visibleTree(data.tree, new Set(["e"]));
  assert.equal(last.root, "e");
  assert.equal(last.nodes.length, 1);
  assert.equal(last.nodes[0].branchLength, undefined);
  assert.equal(last.nodes[0].support, undefined);
  validateTree(last, data.clusters.filter((cluster) => cluster.uid === "e"));
  assert.equal(visibleTree(data.tree, new Set()), null);
  assert.deepEqual(data, before);
});

test("plot exclusions filter contents, links, keys and clade markers without deleting source data", async () => {
  const data = await fixture();
  data.links = [{ uid: "ab", query: { uid: "gene-a" }, target: { uid: "gene-b" }, identity: 1 }];
  data.annotationPanels.push({ uid: "clades", type: "groups", groups: [{ uid: "ab", nodeUid: "x" }] });
  const before = structuredClone(data);
  const state = createChartState(data, { excludedClusters: ["a"], excludedLoci: ["locus-c"] });
  const view = visibleChartData(data, state);
  assert.deepEqual(view.clusters.map((cluster) => cluster.uid), ["b", "d", "e"]);
  assert.equal(view.links.length, 0);
  for (const panel of view.annotationPanels.filter((panel) => panel.values)) {
    assert.equal(Object.hasOwn(panel.values, "a"), false);
    assert.equal(Object.hasOwn(panel.values, "c"), false);
  }
  assert.equal(view.annotationPanels.find((panel) => panel.uid === "clades").groups[0].nodeUid, "b");
  assert.equal(view.groups.some((group) => group.genes.includes("gene-a") || group.genes.includes("gene-c")), false);
  validateTree(view.tree, view.clusters);
  assert.deepEqual(data, before);
  assert.equal(visibleChartData(data, createChartState(data)), data);
});

test("exclusion snapshots retain hidden locus edits and allow compatible tree reorder", async () => {
  const data = await fixture();
  const state = createChartState(data, { excludedClusters: ["a"], excludedLoci: ["locus-c", "missing"] });
  state.loci.get("locus-a").end = 5000;
  state.loci.get("locus-a").flipped = true;
  const order = setTreeClusterOrder(data.tree, ["d", "b", "e"], { partial: true });
  state.clusterOrder = order;
  const snapshot = serializeChartState(state, data);
  const restored = chartStateFromSnapshot(data, JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(serializeChartState(restored, data), snapshot);
  assert.equal(restored.loci.get("locus-a").end, 5000);
  assert.equal(restored.excludedLoci.has("missing"), false);
  const view = visibleChartData(data, restored);
  validateTree(view.tree, view.clusters);
  assert.deepEqual(restored.clusterOrder.filter((uid) => view.clusters.some((cluster) => cluster.uid === uid)), ["d", "b", "e"]);
  assert.throws(() => setTreeClusterOrder(data.tree, ["b", "d", "e"]), /contiguous/);
});

test("parent-row ranges select member genes and keep the original range anchor", () => {
  const selection = new RowSelection();
  const members = new Map([["a", [1, 2]], ["b", [3]], ["c", [4, 5]], ["d", [6]]]);
  const options = { orderedIds: [...members.keys()], idsFor: (key) => members.get(key) };
  selection.select("b", true, options);
  selection.select("c", true, { ...options, range: true });
  selection.select("d", true, { ...options, range: true });
  assert.deepEqual([...selection], [3, 4, 5, 6]);
  selection.select("c", false, { ...options, range: true });
  assert.deepEqual([...selection], [6]);
});

test("plot modifier keys distinguish single toggles from explicit ranges", () => {
  for (const modifiers of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    assert.deepEqual(plotSelectionOptions(modifiers), { range: false, subtract: false });
  }
  for (const modifiers of [{ shiftKey: true, ctrlKey: true }, { shiftKey: true, metaKey: true }]) {
    assert.deepEqual(plotSelectionOptions(modifiers), { range: true, subtract: false });
  }
  assert.deepEqual(plotSelectionOptions({ shiftKey: true, altKey: true }), { range: true, subtract: true });
});

test("selection pruning validates parent anchors separately from member gene IDs", () => {
  const selection = new RowSelection();
  const members = new Map([["cluster:a", [1]], ["cluster:b", [2]], ["cluster:c", [3]]]);
  const options = { orderedIds: [...members.keys()], idsFor: (key) => members.get(key) };
  selection.select("cluster:a", true, options);
  selection.prune([1, 2, 3], members.keys());
  selection.select("cluster:c", true, { ...options, range: true });
  assert.deepEqual([...selection], [1, 2, 3]);
  selection.prune([2, 3], ["cluster:b", "cluster:c"]);
  selection.select("cluster:c", false, { ...options, range: true });
  assert.deepEqual([...selection], [2]);
});

test("shared highlight and hit geometry fits tight row gaps, including scene patches", async () => {
  const data = await fixture(), state = createChartState(data), runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state); runtime.updateGroups(data.groups);
  const height = runtime.renderConfig.gene.shape.tipHeight * 2 + runtime.renderConfig.gene.shape.bodyHeight;
  for (const spacing of [40, 10, 4, 0]) {
    runtime.configure({ cluster: { spacing } }); runtime.updateScales(data);
    const scene = runtime.buildScene(data), loci = [...scene.loci.values()].sort((a, b) => a.y - b.y);
    const padding = Math.min(10, spacing / 4);
    assert.equal(loci[0].hover.y, -padding);
    assert.equal(loci[0].hover.height, height + padding * 2);
    for (let i = 1; i < loci.length; i++) {
      assert.ok(loci[i - 1].y + loci[i - 1].hover.y + loci[i - 1].hover.height <= loci[i].y + loci[i].hover.y);
    }
    state.loci.get("locus-a").end -= 1;
    const patched = runtime.patchScene(scene, { loci: ["locus-a"] }, data);
    assert.equal(patched.loci.get("locus-a").hover.height, height + padding * 2);
  }
});
