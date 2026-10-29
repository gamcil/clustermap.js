import test from "node:test";
import assert from "node:assert/strict";
import { layoutTree, interpolateTreeLayout, hitTestTreeNode } from "../../src/tree/layout.mjs";
import { measureTreeLayout } from "../../src/scene/measure.mjs";

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
    cluster: { nameFontSize: 12, lociFontSize: 10 },
  };
  const build = (options = {}) => layoutTree({ tree, scene, config, measureLabel: () => 100, trackAnchor: false, ...options });
  const reorderedScene = (order) => ({ ...scene, clusters: new Map(order.map((uid, i) => [uid, { ...scene.clusters.get(uid), y: i * 100 }])) });
  return { tree, scene, config, build, reorderedScene };
}

const mark = (marks, uid) => marks.find((value) => value.uid === uid);

test("support labels exclude terminal branches without removing their metadata", () => {
  const { tree, build } = example();
  tree.nodes.find((node) => node.uid === "c").support = { value: 96.4, scale: "percent", type: "bootstrap" };
  const original = structuredClone(tree), layout = build();
  assert.deepEqual(layout.supports.map(({ uid }) => uid), ["pair"]);
  assert.deepEqual(tree, original);
});

test("the optional root stem shares branch styling, positioning and bounds", () => {
  const { tree, config, build } = example();
  config.tree.branch = { colour: "navy", width: 3 };
  config.tree.scaleBar = { show: false }; config.tree.support.show = false;
  const original = structuredClone(tree), hidden = build();
  assert.equal(mark(hidden.branches, "root-stem"), undefined);
  config.tree.rootStem = { show: true };
  const shown = build(), stem = mark(shown.branches, "root-stem");
  assert.equal(stem.x1, shown.rootX - 28); assert.equal(stem.x2, shown.rootX);
  assert.equal(stem.y1, shown.ys.get(tree.root)); assert.equal(stem.y2, stem.y1);
  assert.deepEqual(stem.style, { colour: "navy", width: 3 });
  assert.ok(shown.bounds.minX < hidden.bounds.minX);
  assert.equal(shown.branches.length, hidden.branches.length + 1);
  config.tree.rootStem.show = false;
  assert.deepEqual(build(), hidden);
  assert.deepEqual(tree, original);
});

test("collapsed clades replace descendant marks and keep label clearance and hit testing", () => {
  const { tree, scene, build } = example();
  tree.presentation = { subtrees: { pair: { collapsed: true, branch: { colour: "red", width: 3 } } },
    nodes: { pair: { label: { text: "Clade" } } } };
  const before = structuredClone(scene);
  const layout = build();
  const triangle = mark(layout.triangles, "pair");
  assert.ok(triangle);
  assert.equal(triangle.style.colour, "red");
  assert.equal(triangle.y1, layout.ys.get("a"));
  assert.equal(triangle.y2, layout.ys.get("b"));
  assert.ok(triangle.x2 <= 260 - 100 - 16, "the entire base clears the shortest label anchor");
  assert.equal(mark(layout.branches, "pair:a"), undefined);
  assert.equal(mark(layout.stems, "pair"), undefined);
  assert.ok(mark(layout.branches, "root:pair"), "the incoming branch remains");
  assert.ok(mark(layout.annotations, "pair"));
  assert.deepEqual(hitTestTreeNode(layout, { x: (triangle.x + triangle.x2) / 2, y: triangle.y }),
    { action: "tree-node", nodeUid: "pair" });
  assert.deepEqual(scene, before, "collapse leaves biological rows and labels untouched");
});

test("ancestor collapse retains nested settings and triangle spans follow interpolated rows", () => {
  const { tree, scene, config, build, reorderedScene } = example();
  tree.presentation = { subtrees: { root: { collapsed: true }, pair: { collapsed: true } },
    nodes: { pair: { label: { text: "Hidden annotation" } } } };
  const layout = build({ targetScene: reorderedScene(["c", "b", "a"]), previousTree: tree, previousScene: scene });
  assert.deepEqual(layout.triangles.map(({ uid }) => uid), ["root"]);
  assert.equal(layout.nodes.length, 1);
  assert.equal(layout.branches.length, 0);
  assert.equal(layout.annotations.length, 0);
  const middle = interpolateTreeLayout(layout, 0.25), triangle = middle.triangles[0];
  const ys = triangle.leaves.map((uid) => layout.previousYs.get(uid) * 0.75 + layout.ys.get(uid) * 0.25);
  assert.equal(triangle.y1, Math.min(...ys));
  assert.equal(triangle.y2, Math.max(...ys));
  tree.presentation.subtrees.root.collapsed = false;
  assert.deepEqual(build().triangles.map(({ uid }) => uid), ["pair"]);
  const noNodes = build({ config: { ...config, tree: { ...config.tree, node: { show: false } } } });
  const target = noNodes.triangles[0];
  assert.deepEqual(hitTestTreeNode(noNodes, { x: (target.x + target.x2) / 2, y: target.y }),
    { action: "tree-node", nodeUid: "pair" });
});

const measurementContext = () => ({
  save() {}, restore() {}, measureText: (text) => ({ width: text.length * 8 }),
});

test("settled tree drawing and hit testing share layout until its inputs change", () => {
  const { tree, scene, config, reorderedScene } = example();
  const context = measurementContext();
  const first = measureTreeLayout(context, tree, scene, config, { targetScene: scene, trackAnchor: true });
  assert.equal(measureTreeLayout(context, tree, scene, config, { dragging: false }), first);
  assert.deepEqual(hitTestTreeNode(first, mark(first.nodes, "pair")), { action: "tree-node", nodeUid: "pair" });

  const widerConfig = { ...config, tree: { ...config.tree, width: 320 } };
  const wider = measureTreeLayout(context, tree, scene, widerConfig);
  assert.notEqual(wider.rootX, first.rootX, "styling updates replace cached positions");
  const reordered = measureTreeLayout(context, tree, reorderedScene(["c", "a", "b"]), widerConfig);
  assert.notEqual(mark(reordered.branches, "pair:a").y1, mark(wider.branches, "pair:a").y1, "scene updates move leaves");
  const nextTree = structuredClone(tree);
  nextTree.nodes[1].support.value = 75;
  const relabelled = measureTreeLayout(context, nextTree, scene, config);
  assert.equal(mark(relabelled.supports, "pair").text, "75.0");
  assert.equal(measureTreeLayout(context, nextTree, scene, config), relabelled);
  context.direction = "rtl";
  assert.notEqual(measureTreeLayout(context, nextTree, scene, config), relabelled,
    "text measurement settings also invalidate the layout");
});

test("live tree previews recompute in-place changes and invalidate settled layout", () => {
  const { tree, scene, config } = example();
  const context = measurementContext();
  const first = measureTreeLayout(context, tree, scene, config);
  const preview = { type: "cluster-drag", clusterOffsets: new Map([["a", 20]]) };
  const dragged = measureTreeLayout(context, tree, scene, config, { preview });
  assert.equal(mark(dragged.branches, "pair:a").y1, mark(first.branches, "pair:a").y1 + 20);
  preview.clusterOffsets.set("a", 40);
  const moved = measureTreeLayout(context, tree, scene, config, { preview });
  assert.equal(mark(moved.branches, "pair:a").y1, mark(first.branches, "pair:a").y1 + 40);
  const settled = measureTreeLayout(context, tree, scene, config);
  assert.notEqual(settled, first);
  assert.equal(mark(settled.branches, "pair:a").y1, mark(first.branches, "pair:a").y1);
  assert.equal(measureTreeLayout(context, tree, scene, config), settled);
});

test("tree envelopes include support text, markers, square caps and measured scale labels", () => {
  const { tree, config, build } = example();
  config.tree.support.fontSize = 70;
  config.tree.branch = { width: 100, colour: "black" };
  const layout = build();
  const stem = mark(layout.stems, "pair");
  const label = layout.supports[0];
  assert.ok(layout.bounds.minX <= label.x - label.width);
  assert.ok(layout.bounds.minY <= stem.y1 - 50);
  assert.ok(layout.bounds.maxY >= stem.y2 + 50);
  assert.ok(layout.bounds.minX <= layout.nodes[0].x - 54);
  config.tree.scaleBar = { label: "A very long tree scale label" };
  const scale = build();
  assert.ok(scale.bounds.minX <= scale.scaleBar.label.x - scale.scaleBar.label.width / 2);
  tree.nodes[1].support.value = 0;
  assert.ok(Number.isFinite(build().bounds.minX));
});

test("the first leaf/label collision positions a proportional tree, independent of its longest branch", () => {
  const { build } = example();
  const layout = build();
  const a = mark(layout.branches, "pair:a");
  const c = mark(layout.guides, "c");
  assert.equal(mark(layout.guides, "a"), undefined, "the limiting leaf needs no guide");
  assert.equal(260 - 100 - a.x2, 16, "leaf tips retain the label clearance");
  assert.ok(c.x2 > c.x1);
  assert.equal(c.x1 - layout.rootX, 160, "configured width covers the longest root-to-tip path");
  const pair = mark(layout.nodes, "pair");
  assert.ok(Math.abs((pair.x - layout.rootX) / (c.x1 - layout.rootX) - 0.25) < 1e-10);
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
  assert.equal(dragged.rootX, initial.rootX - 30);
  assert.equal(mark(dragged.branches, "pair:a").x2, mark(initial.branches, "pair:a").x2 - 30);
  assert.equal(mark(dragged.branches, "pair:a").y1, mark(initial.branches, "pair:a").y1 + 20);
  preview.clusterLabelOffsets.set("a", -10);
  assert.equal(build({ trackAnchor: true, preview }).rootX, initial.rootX - 10);
  const smallerLabel = build({ measureLabel: () => 50 });
  assert.equal(smallerLabel.rootX, initial.rootX + 50);
});

test("tree scales inherit clustermap styling and fall back to depth when lengths are incomplete", () => {
  const { tree, scene, build } = example();
  const proportional = build();
  assert.equal(proportional.scaleBar.fontSize, scene.chrome.scaleBar.fontSize);
  assert.equal(proportional.scaleBar.fontFamily, scene.chrome.scaleBar.fontFamily);
  assert.equal(proportional.scaleBar.strokeWidth, scene.chrome.scaleBar.strokeWidth);
  assert.equal(proportional.scaleBar.lines[1].y2 - proportional.scaleBar.lines[1].y1, 12);
  const incomplete = structuredClone(tree);
  delete incomplete.nodes.find((node) => node.uid === "a").branchLength;
  const cladogram = build({ tree: incomplete });
  assert.equal(cladogram.scaleBar.label.text, "1 branch");
  assert.equal(mark(cladogram.branches, "pair:a").x2, mark(cladogram.branches, "pair:b").x2);
  assert.equal(build({ config: { tree: { show: false } } }), null);
});

test("resolved styles and annotations survive interpolation and contribute measured bounds", () => {
  const { tree, scene, build, reorderedScene } = example();
  tree.presentation = {
    subtrees: { pair: { branch: { colour: "purple", width: 4 } } },
    nodes: { pair: { label: { text: "Clade", fontSize: 60, fontWeight: 700 } } },
  };
  const previousTree = structuredClone(tree);
  const before = build({ measureText: () => ({ width: 350, height: 60 }) });
  tree.nodes[0].children.reverse();
  const layout = build({ scene: reorderedScene(["c", "a", "b"]), previousTree, previousScene: scene, measureText: () => ({ width: 350, height: 60 }) });
  const frame = interpolateTreeLayout(layout, 0.5);
  assert.deepEqual(mark(frame.stems, "pair").style, { colour: "purple", width: 4 });
  assert.deepEqual(mark(frame.branches, "pair:a").style, { colour: "purple", width: 4 });
  assert.equal(frame.annotations[0].y, mark(frame.nodes, "pair").y + 6);
  assert.ok(frame.bounds.maxX >= frame.annotations[0].x + 350);
  assert.ok(before.annotations[0].x + 350 <= 500 - 16, "wide annotations leave clearance before overlapping cluster labels");
});

test("metric cut line follows true height and is hidden in cladogram mode or above the root", () => {
  const { tree, config, build } = example();
  tree.distance = { kind: "mergeHeight" };
  tree.nodes.find((node) => node.uid === "b").branchLength = 0.1;
  tree.nodes.find((node) => node.uid === "c").branchLength = 0.3;
  tree.presentation = { colouring: { mode: "cutHeight", cutHeight: 0.15, showCutLine: true } };
  const layout = build();
  assert.ok(Math.abs(layout.cutLine.x1 - (layout.rootX + config.tree.width / 2)) < 1e-10);
  assert.equal(layout.cutLine.label.text, "0.15");
  config.tree.useBranchLengths = false;
  assert.equal(build().cutLine, null);
  assert.notEqual(mark(build().stems, "pair").style.colour, "#555");
  config.tree.useBranchLengths = true;
  tree.presentation = { colouring: { mode: "cutHeight", cutHeight: 1, showCutLine: true } };
  assert.equal(build().cutLine, null);
});
