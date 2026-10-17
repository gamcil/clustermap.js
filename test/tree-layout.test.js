import test from "node:test";
import assert from "node:assert/strict";
import { layoutTree, interpolateTreeLayout, hitTestTreeNode } from "../src/treeLayout.mjs";

function example() {
  const tree = {
    root: "root",
    nodes: [
      { uid: "root", children: ["pair", "c"] },
      { uid: "pair", branchLength: 0.2, support: { value: 98.24 }, children: ["a", "b"] },
      { uid: "a", cluster: "a", branchLength: 0.1 },
      { uid: "b", cluster: "b", branchLength: 0.2 },
      { uid: "c", cluster: "c", branchLength: 0.8 },
    ],
  };
  const scene = {
    clusters: new Map(["a", "b", "c"].map((uid, i) => [uid, {
      source: { uid, name: uid }, x: i === 0 ? 260 : 600, y: i * 100,
      info: { x: 0, locusText: uid },
    }])),
    chrome: { scaleBar: { position: { y: 300 }, height: 12, fontSize: 10, fontFamily: "sans-serif", colour: "black", strokeWidth: 2 } },
  };
  const config = {
    tree: { show: true, width: 160, support: { show: true }, leafGuide: { show: true } },
    plot: { fontFamily: "sans-serif" },
    gene: { shape: { tipHeight: 5, bodyHeight: 10 } },
  };
  const build = (options = {}) => layoutTree({ tree, scene, config, measureLabel: () => 100, trackAnchor: false, ...options });
  const reorderedScene = (order) => ({ ...scene, clusters: new Map(order.map((uid, i) => [uid, { ...scene.clusters.get(uid), y: i * 100 }])) });
  return { tree, scene, config, build, reorderedScene };
}

const mark = (marks, uid) => marks.find((value) => value.uid === uid);

test("the first leaf/label collision positions a proportional tree, independent of its longest branch", () => {
  const { build } = example();
  const layout = build();
  const a = mark(layout.guides, "a");
  const c = mark(layout.guides, "c");
  assert.equal(a.x2 - a.x1, 16);
  assert.ok(c.x2 - c.x1 > 16);
  assert.equal(c.x1 - layout.rootBranch.x2, 160, "configured width covers the longest root-to-tip path");
  const pair = mark(layout.nodes, "pair");
  assert.ok(Math.abs((pair.x - layout.rootBranch.x2) / (c.x1 - layout.rootBranch.x2) - 0.25) < 1e-10);
});

test("a leaf-pair flip collapses its stem without moving ancestor nodes", () => {
  const { tree, scene, build, reorderedScene } = example();
  const previousTree = structuredClone(tree);
  tree.nodes.find((node) => node.uid === "pair").children.reverse();
  const layout = build({ scene: reorderedScene(["b", "a", "c"]), previousTree, previousScene: scene });
  const start = interpolateTreeLayout(layout, 0);
  const middle = interpolateTreeLayout(layout, 0.5);
  const stem = mark(middle.stems, "pair");
  assert.equal(stem.y1, stem.y2);
  for (const uid of ["root", "pair"]) {
    assert.equal(mark(start.nodes, uid).y, mark(middle.nodes, uid).y);
    assert.equal(mark(middle.nodes, uid).y, mark(layout.nodes, uid).y);
  }
  for (const guide of middle.guides.filter((guide) => guide.uid !== "c")) {
    assert.equal(guide.y1, stem.y1, "guides remain attached to the crossing leaves");
  }
});

test("an outer flip folds the root stem and keeps support text attached to its node", () => {
  const { tree, scene, build, reorderedScene } = example();
  const previousTree = structuredClone(tree);
  tree.nodes[0].children.reverse();
  const layout = build({ scene: reorderedScene(["c", "a", "b"]), previousTree, previousScene: scene });
  const middle = interpolateTreeLayout(layout, 0.5);
  const stem = mark(middle.stems, "root");
  assert.equal(stem.y1, stem.y2);
  const pair = mark(middle.nodes, "pair");
  const label = mark(middle.supports, "pair");
  assert.equal(label.text, "98.2");
  assert.equal(label.x, pair.x - 4);
  assert.equal(label.y, pair.y - 4);
  assert.deepEqual(hitTestTreeNode(middle, pair), { action: "tree-node", nodeUid: "pair" });
});

test("tree animation uses the target scene once even when the adapter is drawing an intermediate scene", () => {
  const { tree, scene, build, reorderedScene } = example();
  const previousTree = structuredClone(tree);
  tree.nodes[0].children.reverse();
  const targetScene = reorderedScene(["c", "a", "b"]);
  const intermediateScene = { ...scene, clusters: new Map([...scene.clusters].map(([uid, cluster]) => [uid, {
    ...cluster, y: (cluster.y + targetScene.clusters.get(uid).y) / 2,
  }])) };
  const options = { previousTree, previousScene: scene, targetScene };
  assert.deepEqual(
    interpolateTreeLayout(build({ ...options, scene: intermediateScene }), 0.5),
    interpolateTreeLayout(build({ ...options, scene: targetScene }), 0.5)
  );
});

test("label changes and drag previews reposition the tree and guides through the same layout", () => {
  const { build } = example();
  const initial = build({ trackAnchor: true });
  const preview = {
    type: "cluster-drag",
    clusterLabelOffsets: new Map([["a", -30]]),
    clusterOffsets: new Map([["a", 20]]),
  };
  const dragged = build({ trackAnchor: true, preview });
  assert.equal(dragged.rootBranch.x1, initial.rootBranch.x1 - 30);
  assert.equal(mark(dragged.guides, "a").x2, mark(initial.guides, "a").x2 - 30);
  assert.equal(mark(dragged.guides, "a").y1, mark(initial.guides, "a").y1 + 20);
  preview.clusterLabelOffsets.set("a", -10);
  assert.equal(build({ trackAnchor: true, preview }).rootBranch.x1, initial.rootBranch.x1 - 10);
  const smallerLabel = build({ measureLabel: () => 50 });
  assert.equal(smallerLabel.rootBranch.x1, initial.rootBranch.x1 + 50);
});

test("tree scales inherit clustermap styling and fall back to depth when lengths are incomplete", () => {
  const { tree, scene, build } = example();
  const proportional = build();
  assert.equal(proportional.scaleBar.fontSize, scene.chrome.scaleBar.fontSize);
  assert.equal(proportional.scaleBar.fontFamily, scene.chrome.scaleBar.fontFamily);
  assert.equal(proportional.scaleBar.strokeWidth, scene.chrome.scaleBar.strokeWidth);
  assert.equal(proportional.scaleBar.lines[1].y2 - proportional.scaleBar.lines[1].y1, 12);
  delete tree.nodes.find((node) => node.uid === "a").branchLength;
  const cladogram = build();
  assert.equal(cladogram.scaleBar.label.text, "1 branch");
  assert.equal(mark(cladogram.guides, "a").x1, mark(cladogram.guides, "b").x1);
  assert.equal(build({ config: { tree: { show: false } } }), null);
});
