import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeChartData } from "../src/data/normalize.mjs";
import { createChartState, getClusterOrder, setTreeClusterOrder } from "../src/chartState.mjs";
import { chartStateFromSnapshot, serializeChartState } from "../src/chartStateSnapshot.mjs";

function example() {
  return {
    clusters: ["a", "b", "c"].map((uid) => ({ uid, name: uid, loci: [] })),
    links: [], groups: [],
    tree: {
      root: "root", rooted: null,
      nodes: [
        { uid: "root", children: ["pair", "leaf-c"] },
        { uid: "pair", children: ["leaf-a", "leaf-b"], branchLength: 0, support: { value: 0.95, scale: "proportion", type: "posterior" } },
        { uid: "leaf-a", cluster: "a", branchLength: 0.1, label: "same label" },
        { uid: "leaf-b", cluster: "b", branchLength: 0.2, label: "same label" },
        { uid: "leaf-c", cluster: "c", branchLength: 0.4 },
      ],
    },
  };
}

const pair = (data) => data.tree.nodes.find((node) => node.uid === "pair");

test("tree normalization owns child order and support metadata without changing supplied values", () => {
  const input = example();
  const original = structuredClone(input);
  const normalized = normalizeChartData(input);
  assert.deepEqual(normalized.tree, input.tree);
  assert.equal(pair(normalized).branchLength, 0);
  assert.equal(pair(normalized).support.value, 0.95);
  pair(normalized).children.reverse();
  pair(normalized).support.value = 0.8;
  assert.deepEqual(input, original);
});

for (const [name, change, message] of [
  ["invalid tree shape", (d) => { d.tree = false; }, /expected an object/],
  ["invalid rootedness", (d) => { d.tree.rooted = "true"; }, /rooted/],
  ["empty node ID", (d) => { pair(d).uid = " "; }, /non-empty strings/],
  ["duplicate node ID", (d) => { d.tree.nodes.push({ uid: "pair" }); }, /duplicate node ID/],
  ["unknown root", (d) => { d.tree.root = "missing"; }, /root .* does not exist/],
  ["unknown child", (d) => { pair(d).children[0] = "missing"; }, /child .* does not exist/],
  ["cycle", (d) => { pair(d).children[0] = "root"; }, /cycle/],
  ["shared child", (d) => { d.tree.nodes[0].children.push("leaf-a"); }, /more than one parent/],
  ["unreachable node", (d) => { d.tree.nodes.push({ uid: "orphan", cluster: "a" }); }, /reachable/],
  ["empty internal node", (d) => { pair(d).children = []; }, /internal node/],
  ["mixed leaf and internal node", (d) => { pair(d).cluster = "a"; }, /internal node/],
  ["unknown cluster", (d) => { d.tree.nodes[2].cluster = "missing"; }, /existing cluster/],
  ["duplicate leaf mapping", (d) => { d.tree.nodes[3].cluster = "a"; }, /referenced more than once/],
  ["unmapped cluster", (d) => { d.clusters.push({ uid: "d", loci: [] }); }, /every plotted cluster/],
  ["negative length", (d) => { pair(d).branchLength = -1; }, /finite and non-negative/],
  ["nonfinite length", (d) => { pair(d).branchLength = Infinity; }, /finite and non-negative/],
  ["root length", (d) => { d.tree.nodes[0].branchLength = 0; }, /root cannot have/],
  ["root support", (d) => { d.tree.nodes[0].support = { value: 90 }; }, /root cannot have/],
  ["non-text label", (d) => { pair(d).label = 5; }, /label .* must be text/],
  ["null support", (d) => { pair(d).support = null; }, /finite value/],
  ["nonfinite support", (d) => { pair(d).support.value = NaN; }, /finite value/],
  ["unknown support scale", (d) => { pair(d).support.scale = "bootstrap"; }, /support scale/],
  ["percent outside range", (d) => { pair(d).support = { value: 101, scale: "percent" }; }, /outside its percent scale/],
  ["proportion outside range", (d) => { pair(d).support.value = -0.1; }, /outside its proportion scale/],
]) {
  test(`tree validation rejects ${name} with an actionable error`, () => {
    const input = example();
    change(input);
    assert.throws(() => normalizeChartData(input), (error) => {
      assert.ok(error instanceof TypeError);
      assert.match(error.message, /^Invalid tree:/);
      assert.match(error.message, message);
      return true;
    });
  });
}

test("unary nodes, multifurcations, unknown lengths and unspecified support remain supported", () => {
  const data = example();
  pair(data).children.push("leaf-c");
  data.tree.nodes[0].children = ["pair"];
  delete pair(data).branchLength;
  pair(data).support = { value: 123, scale: "unspecified" };
  assert.doesNotThrow(() => normalizeChartData(data));
});

test("tree fixtures satisfy the public input contract", async () => {
  for (const name of ["testing-with-tree", "bua-genbank-tree", "tree-styling"]) {
    const fixture = JSON.parse(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url)));
    const normalized = normalizeChartData(fixture);
    assert.equal(getClusterOrder(createChartState(normalized)).length, fixture.clusters.length);
  }
});

test("tree ordering survives JSON project data/state round-trips and subsequent state rebuilds", () => {
  const data = normalizeChartData(example());
  const state = createChartState(data);
  const before = serializeChartState(state, data);
  assert.deepEqual(before.clusterOrder, ["a", "b", "c"], "tree snapshots keep explicit order even when it matches source data");
  const reordered = chartStateFromSnapshot(data, { ...before, clusterOrder: ["c", "b", "a"] });
  assert.deepEqual(getClusterOrder(createChartState(data, reordered)), ["c", "b", "a"]);
  const saved = JSON.parse(JSON.stringify({ data, state: serializeChartState(reordered, data) }));
  const restoredData = normalizeChartData(saved.data);
  const restoredState = chartStateFromSnapshot(restoredData, saved.state);
  assert.deepEqual(restoredData.tree, data.tree);
  assert.deepEqual(serializeChartState(restoredState, restoredData), saved.state);
  assert.deepEqual(getClusterOrder(createChartState(restoredData, restoredState)), ["c", "b", "a"]);
  const undone = chartStateFromSnapshot(restoredData, before);
  assert.deepEqual(getClusterOrder(undone), ["a", "b", "c"]);
  assert.deepEqual(restoredData.tree, example().tree, "restoring state also restores ordered children");
});

test("invalid programmatic ordering cannot change the topology or child order", () => {
  const data = example();
  const original = structuredClone(data.tree);
  for (const order of [["a", "c", "b"], ["a", "a", "c"], ["a", "b"]]) {
    assert.throws(() => setTreeClusterOrder(data.tree, order), /every tree clade contiguous/);
    assert.deepEqual(data.tree, original);
  }
  assert.throws(() => chartStateFromSnapshot(data, { clusterOrder: ["a", "c", "b"] }), /every tree clade contiguous/);
  assert.deepEqual(data.tree, original);
});
