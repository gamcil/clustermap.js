import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultConfig, mergeConfig } from "../../src/chart/config.js";
import { createChartRuntime } from "../../src/chart/runtime.js";
import { normalizeChartData } from "../../src/data/normalize.mjs";
import { chartStateFromSnapshot, createChartStateSerializer } from "../../src/chart/snapshot.mjs";
import { textBounds, textDimensions, textFont } from "../../src/scene/text.mjs";
import { createChartIndex } from "../../src/data/index.mjs";
import { createChartState, setLocusOffset } from "../../src/chart/state.mjs";
import { createLocusOffsetsPreview } from "../../src/scene/preview.mjs";
import { createLargeTestingData } from "../../fixtures/synthetic.mjs";
import { readFile } from "node:fs/promises";
import { applyChartOperations } from "../../src/data/operations.mjs";

test("tree, annotation and mixed presentation edits retain geometry and spatial indexes", async () => {
  const data = normalizeChartData(JSON.parse(await readFile(new URL("../../fixtures/heatmap.json", import.meta.url), "utf8")));
  const runtime = createChartRuntime(), index = createChartIndex(data), state = createChartState(data);
  runtime.configure({ annotations: { enabled: true } });
  runtime.setChartIndex(index); runtime.setChartState(state);
  const initial = runtime.updateScene(data);
  let scene = initial;
  const treeEdit = { type: "tree.presentation.update", scope: "subtree", ids: ["x"], changes: { collapsed: true } };
  const annotationEdit = { type: "annotationPanels.update", ids: [data.annotationPanels[0].uid], changes: { title: "New title" } };
  for (const operations of [[treeEdit], [annotationEdit], [treeEdit, annotationEdit]]) {
    const result = applyChartOperations(data, index, operations);
    scene = runtime.updateScene(data, { sourceScene: scene, changes: { presentationOnly: true } });
    for (const key of ["genes", "links", "loci", "clusters", "index", "hitRegions", "bounds"]) {
      assert.equal(scene[key], initial[key], `${key} is retained`);
    }
    assert.equal(scene.changes.presentationOnly, true);
    assert.equal(scene.annotationPanels[0].definition, data.annotationPanels[0]);
    applyChartOperations(data, index, result.inverse);
    scene = runtime.updateScene(data, { sourceScene: scene, changes: { presentationOnly: true } });
    assert.equal(scene.index, initial.index, "undo keeps the spatial indexes");
  }
});

for (const scaleGenes of [false, true]) for (const flipped of [false, true]) {
  test(`gene restoration preserves display state, scaleGenes=${scaleGenes}, flipped=${flipped}`, async () => {
    const { flipLocus, getGeneState, getDisplayGenes } = await import("../../src/chart/state.mjs");
    const data = normalizeChartData({ clusters: [{ uid: "cluster", loci: [{ uid: "locus", start: 0, end: 10000,
      genes: [1000, 4000, 7000].map((start, index) => ({ uid: `g${index}`, start, end: start + 500, strand: 1 })) }] }], links: [], groups: [] });
    const runtime = createChartRuntime(); runtime.configure({ plot: { scaleGenes } });
    let state = createChartState(data);
    const update = () => { runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state); runtime.updateScene(data); };
    update();
    const locus = data.clusters[0].loci[0];
    if (flipped) { flipLocus(state, locus); update(); }
    const before = structuredClone(locus.genes);
    const displayed = locus.genes.map((gene) => ({ ...getGeneState(state, gene) }));
    const deletion = applyChartOperations(data, createChartIndex(data), [{ type: "genes.delete", ids: ["g1"] }]);
    state = createChartState(data, state); update();
    applyChartOperations(data, createChartIndex(data), deletion.inverse);
    state = createChartState(data, state); update();
    assert.deepEqual(getDisplayGenes(state, locus.genes).map(({ uid }) => uid), flipped ? ["g2", "g1", "g0"] : ["g0", "g1", "g2"]);
    assert.deepEqual(locus.genes, before);
    assert.deepEqual(locus.genes.map((gene) => getGeneState(state, gene)), displayed);
  });
}

test("public configuration reads and subscriber snapshots are independently owned", async () => {
  const { default: clusterMap } = await import("../../src/chart/chart.js");
  const chart = clusterMap();
  const snapshot = chart.config(); snapshot.tree.colouring.palette[0] = "red";
  assert.notEqual(chart.config().tree.colouring.palette[0], "red");
  chart.on("change", (event) => { if (event.config) event.config.tree.colouring.palette[0] = "green"; });
  let received;
  chart.on("change", (event) => { if (event.config) received = event.config.tree.colouring.palette; });
  const palette = ["red", "blue"];
  chart.config({ tree: { colouring: { palette } } }); palette[0] = "yellow";
  assert.deepEqual(chart.config().tree.colouring.palette, ["red", "blue"]);
  assert.deepEqual(received, ["red", "blue"]);
});

for (const alignLabels of [false, true]) for (const labelAlignment of ["left", "right"]) {
  test(`${labelAlignment}, aligned=${alignLabels}: label previews agree with committed geometry`, () => {
    const data = normalizeChartData(createLargeTestingData({ clusterCount: 3, genesPerCluster: 3 }));
    const runtime = createChartRuntime(), state = createChartState(data);
    runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state);
    runtime.configure({ cluster: { alignLabels, labelAlignment } });
    const scene = runtime.updateScene(data), locus = [...scene.loci.values()][0];
    const offset = locus.localX + 25;
    const preview = createLocusOffsetsPreview(scene, new Map([[locus.source.uid, offset]]), { alignLabels });
    setLocusOffset(state, locus.source.uid, offset);
    const next = runtime.updateScene(data);
    for (const [uid, cluster] of scene.clusters) {
      const actual = cluster.x + cluster.info.x + (preview.clusterLabelOffsets.get(uid) || 0);
      const expected = next.clusters.get(uid).x + next.clusters.get(uid).info.x;
      assert.ok(Math.abs(actual - expected) < 1e-10, `label ${uid} follows the same placement rule`);
    }
  });
}

test("configuration merges own their inputs and reject invalid updates atomically", () => {
  const runtime = createChartRuntime(), before = structuredClone(runtime.config);
  for (const patch of [
    null, [], { unknown: true }, { plot: { theme: "dark" } }, { tree: null },
    { legend: { columns: 1.5 } }, { plot: { minZoom: 9 } },
    { plot: { background: "not-a-colour" } }, { cluster: { spacing: NaN } },
    { link: { show: "false" } }, { tree: { support: { precision: -1 } } },
    { tree: { colouring: { palette: [] } } }, { gene: { shape: { onClick: "run" } } },
    { colourBar: { domain: { min: 0.9, max: 0.5 } } },
  ]) {
    assert.throws(() => runtime.configure(patch), TypeError);
    assert.deepEqual(runtime.config, before);
  }
  const palette = ["red", "blue"], callback = () => {};
  runtime.configure({ tree: { colouring: { palette } }, gene: { shape: { onClick: callback } } });
  palette[0] = "green";
  assert.deepEqual(runtime.config.tree.colouring.palette, ["red", "blue"]);
  assert.equal(runtime.config.gene.shape.onClick, callback);
  assert.equal(mergeConfig(createDefaultConfig(), { tree: { scaleBar: { label: "Distance" } } }).tree.scaleBar.label, "Distance");
});

const input = () => ({ clusters: [{ uid: "a", loci: [{ uid: "locus", start: 0, end: 100,
  genes: [{ uid: "gene", start: 10, end: 30, strand: 1 }] }] }], links: [], groups: [] });

test("gene state IDs remain independent across delimiter and numeric identifiers", () => {
  const data = normalizeChartData({ clusters: [{ uid: "cluster", loci: [
    { uid: "a:b", start: 0, end: 100, genes: [{ uid: "c", start: 10, end: 20, strand: 1 }] },
    { uid: "a", start: 0, end: 100, genes: [{ uid: "b:c", start: 30, end: 40, strand: -1 }] },
    { uid: "numeric", start: 0, end: 100, genes: [{ uid: 0, start: 50, end: 60, strand: 1 }] },
  ] }], links: [], groups: [] });
  const state = createChartState(data);
  assert.equal(state.genes.size, 3);
  state.genes.get("c").start = 5;
  state.genes.get(0).end = 65;
  assert.equal(state.genes.get("b:c").start, 30);
  const serializer = createChartStateSerializer();
  const snapshot = serializer.serialize(state, data);
  assert.deepEqual(snapshot.genes.map(([uid]) => uid), ["c", 0]);
  assert.deepEqual(serializer.serialize(chartStateFromSnapshot(data, JSON.parse(JSON.stringify(snapshot))), data), snapshot);
  assert.throws(() => chartStateFromSnapshot(data, { ...snapshot, version: 1 }), /expected version 2/);
});

test("record IDs are unique within each kind, including across parent records", () => {
  for (const kind of ["clusters", "loci", "genes", "links", "groups"]) {
    const data = input();
    if (kind === "clusters") data.clusters.push(structuredClone(data.clusters[0]));
    if (kind === "loci") data.clusters.push({ uid: "b", loci: [structuredClone(data.clusters[0].loci[0])] });
    if (kind === "genes") data.clusters[0].loci.push({ uid: "other", start: 0, end: 100,
      genes: [structuredClone(data.clusters[0].loci[0].genes[0])] });
    if (kind === "links") data.links = [{ uid: "link" }, { uid: "link" }];
    if (kind === "groups") data.groups = [{ uid: 0 }, { uid: 0 }];
    assert.throws(() => normalizeChartData(data), new RegExp(`duplicate ${kind} ID`));
  }
});

test("snapshots reject malformed values without modifying source data", () => {
  const data = normalizeChartData(input()), before = structuredClone(data);
  for (const snapshot of [
    {}, { version: 3 }, { version: 2, camera: { x: 0, y: 0, k: 0 } },
    { version: 2, loci: [["locus", { start: 50, end: 20 }]] },
    { version: 2, loci: [["locus", { flipped: "false" }]] },
    { version: 2, loci: [["locus", { trimLeft: { uid: "gene" } }]] },
    { version: 2, locusOffsets: [["locus", Infinity]] },
  ]) {
    assert.throws(() => chartStateFromSnapshot(data, snapshot), TypeError);
    assert.deepEqual(data, before);
  }
  assert.equal(chartStateFromSnapshot(data, { version: 2, loci: [["locus", { trimLeft: "gene" }]] })
    .loci.get("locus").trimLeft.uid, "gene");
});

test("shared text bounds preserve anchors, rotations, baselines and overhang", () => {
  const style = { fontSize: 10, fontFamily: "Arial" };
  const measure = () => ({ width: 20, actualBoundingBoxLeft: 2, actualBoundingBoxRight: 19,
    actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
  assert.deepEqual(textBounds("A", style, measure), { minX: -2, maxX: 19, minY: -8, maxY: 2 });
  assert.deepEqual(textBounds("A", { ...style, anchor: "end" }, measure), { minX: -22, maxX: -1, minY: -8, maxY: 2 });
  assert.deepEqual(textDimensions("A", style, measure), { width: 24, overhang: 2, height: 10 });
  const rotated = textBounds("A", { ...style, rotation: 90 }, measure);
  for (const [key, value] of Object.entries({ minX: -2, maxX: 8, minY: -2, maxY: 19 })) {
    assert.ok(Math.abs(rotated[key] - value) < 1e-10);
  }
  assert.deepEqual(textBounds("AB", { ...style, baseline: "top" }), { minX: 0, maxX: 12, minY: 0, maxY: 10 });
  assert.deepEqual(textBounds("AB", { ...style, baseline: "middle" }), { minX: 0, maxX: 12, minY: -5, maxY: 5 });
  assert.equal(textFont({ ...style, fontWeight: 700, fontStyle: "italic" }), "italic 700 10px Arial");
});
