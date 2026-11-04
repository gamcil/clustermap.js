import test from "node:test";
import assert from "node:assert/strict";
import { layoutAnnotationPanels, annotationPanelsForFrame, annotationPanelsInViewport, annotationPanelBounds } from "../../src/annotations/model.mjs";
import { drawCanvasAnnotations } from "../../src/annotations/render.mjs";
import { applyChartOperations } from "../../src/data/operations.mjs";
import { createChartIndex } from "../../src/data/index.mjs";

function fixture(type, settings = {}) {
  const clusters = new Map(["a", "b", "c"].map((uid, i) => [uid, { source: { uid, name: uid }, y: 20 + i * 40 }]));
  const definition = { uid: "panel", type, title: "", showKey: false, showColumnLabels: false,
    ...(type === "groups" ? { groups: [{ uid: "g", clusterIds: ["a", "b"], label: "Group" }] }
      : { columns: ["Value"], values: { a: [1], b: [2], c: [3] } }), ...settings };
  const panels = layoutAnnotationPanels([definition], clusters, { minX: 0, maxX: 100, minY: 0, maxY: 120 });
  return { definition, clusters, scene: { clusters, annotationPanels: panels } };
}

for (const type of ["heatmap", "bar", "groups"]) {
  test(`${type} axis decorations are optional, independently enabled and bounded`, () => {
    const hidden = fixture(type);
    assert.equal(annotationPanelsForFrame(hidden.scene)[0].rects.some((rect) => rect.kind), false);
    for (const [axis, grid] of [[true, false], [false, true], [true, true]]) {
      const { definition, scene } = fixture(type, { showYAxisLine: axis, showXGridLines: grid });
      const before = structuredClone(definition), frame = annotationPanelsForFrame(scene)[0];
      const lines = frame.rects.filter((rect) => rect.kind === "x-grid"), axes = frame.rects.filter((rect) => rect.kind === "y-axis");
      assert.equal(axes.length, Number(axis));
      assert.deepEqual(lines.map((line) => line.x), grid ? frame.gridX ?? [] : []);
      assert.ok(lines.every((line) => line.background && line.width === 1 && line.y === 10 && line.height === 100));
      if (axis) {
        assert.deepEqual([axes[0].x, axes[0].y, axes[0].height], [0, 10, 100]);
        assert.ok(annotationPanelBounds(frame).minX <= frame.x);
      }
      assert.deepEqual(definition, before);
      const visible = annotationPanelsInViewport(scene, null, { minX: frame.x - 1, maxX: frame.x + frame.width, minY: 55, maxY: 65 })[0];
      assert.equal(visible.rects.filter((rect) => rect.kind === "x-grid").length, lines.length);
      assert.ok(visible.rects.every((rect) => frame.rects[rect.keyIndex] === rect));
      const moved = { ...scene, clusters: new Map([...scene.clusters].map(([uid, cluster]) => [uid, { ...cluster, y: cluster.y + 25 }])) };
      assert.deepEqual(annotationPanelsForFrame(moved)[0].rects.filter((rect) => rect.kind === "x-grid").map((rect) => rect.y + 0.5), lines.map(() => 35.5));
      const preview = annotationPanelsForFrame(scene, { clusterOffsets: new Map([["b", 15]]) })[0];
      assert.deepEqual(preview.rects.filter((rect) => rect.kind === "x-grid").map((rect) => rect.y + 0.5), lines.map(() => 10.5));
    }
  });
}

test("Canvas draws grid lines behind data and the axis above data", () => {
  const { scene } = fixture("bar", { showYAxisLine: true, showXGridLines: true }), fills = [];
  const context = { save() {}, restore() {}, translate() {}, rotate() {}, fillText() {}, fillRect(...args) { fills.push(args); } };
  drawCanvasAnnotations(context, scene);
  assert.equal(fills.length > 4, true);
  const frame = annotationPanelsForFrame(scene)[0];
  assert.deepEqual(fills.slice(0, frame.gridX.length), frame.gridX.map((x) => [x, 10, 1, 100]));
  assert.deepEqual(fills.at(-1), [0, 10, 1, 100]);
});

test("the bar y-axis joins the x-axis when it is shown", () => {
  const { scene } = fixture("bar", { showYAxisLine: true, showKey: true });
  const frame = annotationPanelsForFrame(scene)[0], axis = frame.rects.find((rect) => rect.kind === "y-axis");
  const xAxis = frame.rects.find((rect) => !rect.kind && rect.width === frame.width && rect.height === 1);
  assert.equal(axis.x, xAxis.x);
  assert.equal(axis.y + axis.height, xAxis.y + xAxis.height);
});

test("annotation axis settings validate and undo with the other panel styles", () => {
  const { definition } = fixture("heatmap");
  const data = { clusters: ["a", "b", "c"].map((uid) => ({ uid, loci: [] })), links: [], groups: [], annotationPanels: [definition] };
  const before = structuredClone(data.annotationPanels);
  const edit = applyChartOperations(data, createChartIndex(data), [{ type: "annotationPanels.update", ids: ["panel"], changes: { showYAxisLine: true, showXGridLines: true } }]);
  assert.equal(data.annotationPanels[0].showYAxisLine, true);
  applyChartOperations(data, createChartIndex(data), edit.inverse);
  assert.deepEqual(data.annotationPanels, before);
  for (const changes of [{ showYAxisLine: "true" }, { showXGridLines: 1 }]) {
    assert.throws(() => applyChartOperations(data, createChartIndex(data), [{ type: "annotationPanels.update", ids: ["panel"], changes }]), /must be a boolean/);
    assert.deepEqual(data.annotationPanels, before);
  }
});

test("bar grids match x-axis ticks and extend to the shared axis baseline", () => {
  const { scene } = fixture("bar", { showXGridLines: true, showYAxisLine: true, showKey: true,
    scale: { domain: [-2, 4] } });
  const frame = annotationPanelsForFrame(scene)[0];
  const grids = frame.rects.filter((rect) => rect.kind === "x-grid");
  const ticks = frame.rects.filter((rect) => !rect.kind && rect.height === 5);
  assert.deepEqual(grids.map((rect) => rect.x), ticks.map((rect) => rect.x));
  const axis = frame.rects.find((rect) => rect.kind === "y-axis");
  assert.ok(grids.every((rect) => rect.y === axis.y && rect.height === axis.height));
  const hidden = fixture("bar", { showXGridLines: true, showKey: false, scale: { domain: [-2, 4] } });
  assert.deepEqual(annotationPanelsForFrame(hidden.scene)[0].rects.filter((rect) => rect.kind === "x-grid").map((rect) => rect.x), grids.map((rect) => rect.x));
});

test("custom bar tick spacing shares positions with grids and retains fractional labels", () => {
  for (const [domain, tickStep, labels] of [
    [[0, 100], 25, ["0", "25", "50", "75", "100"]],
    [[-0.3, 0.3], 0.1, ["-0.3", "-0.2", "-0.1", "0", "0.1", "0.2", "0.3"]],
    [[-0.25, 0.35], 0.1, ["-0.2", "-0.1", "0", "0.1", "0.2", "0.3"]],
    [[0, 1000], 999.5, ["0", "999.5"]],
  ]) {
    const { definition, scene } = fixture("bar", { tickStep, scale: { domain }, showKey: true, showXGridLines: true });
    const before = structuredClone(definition), frame = annotationPanelsForFrame(scene)[0];
    assert.deepEqual(frame.texts.map((item) => item.text), labels);
    const ticks = frame.rects.filter((rect) => !rect.kind && rect.height === 5);
    assert.deepEqual(frame.rects.filter((rect) => rect.kind === "x-grid").map((rect) => rect.x), ticks.map((rect) => rect.x));
    assert.deepEqual(definition, before);
  }
});

test("bar tick spacing validates atomically and supports undo and automatic reset", () => {
  const { definition } = fixture("bar", { scale: { domain: [0, 100] } });
  const data = { clusters: ["a", "b", "c"].map((uid) => ({ uid, loci: [] })), links: [], groups: [], annotationPanels: [definition] };
  const before = structuredClone(data.annotationPanels), index = createChartIndex(data);
  for (const tickStep of [0, -1, "25", Infinity, 0.001]) {
    assert.throws(() => applyChartOperations(data, index, [{ type: "annotationPanels.update", ids: ["panel"], changes: { tickStep } }]), /tickStep/);
    assert.deepEqual(data.annotationPanels, before);
  }
  const edit = applyChartOperations(data, index, [{ type: "annotationPanels.update", ids: ["panel"], changes: { tickStep: 25 } }]);
  assert.equal(data.annotationPanels[0].tickStep, 25);
  applyChartOperations(data, index, [{ type: "annotationPanels.update", ids: ["panel"], changes: { tickStep: null } }]);
  const automatic = fixture("bar", { showKey: true, scale: { domain: [0, 100] } });
  const reset = fixture("bar", { showKey: true, scale: { domain: [0, 100] }, tickStep: data.annotationPanels[0].tickStep });
  assert.deepEqual(annotationPanelsForFrame(reset.scene)[0].texts, annotationPanelsForFrame(automatic.scene)[0].texts);
  applyChartOperations(data, index, edit.inverse);
  assert.deepEqual(data.annotationPanels, before);
});
