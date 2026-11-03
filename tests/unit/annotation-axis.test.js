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
  test(`${type} y-axis decorations are optional, independently enabled and bounded`, () => {
    const hidden = fixture(type);
    assert.equal(annotationPanelsForFrame(hidden.scene)[0].rects.some((rect) => rect.kind), false);
    for (const [axis, grid] of [[true, false], [false, true], [true, true]]) {
      const { definition, scene } = fixture(type, { showYAxisLine: axis, showYGridLines: grid });
      const before = structuredClone(definition), frame = annotationPanelsForFrame(scene)[0];
      const lines = frame.rects.filter((rect) => rect.kind === "y-grid"), axes = frame.rects.filter((rect) => rect.kind === "y-axis");
      assert.equal(axes.length, Number(axis)); assert.equal(lines.length, grid ? 3 : 0);
      assert.deepEqual(lines.map((line) => line.y + 0.5), grid ? [20, 60, 100] : []);
      assert.ok(lines.every((line) => line.background && line.width === frame.width));
      if (axis) {
        assert.deepEqual([axes[0].x, axes[0].y, axes[0].height], [-1, 10, 100]);
        assert.ok(annotationPanelBounds(frame).minX <= frame.x - 1);
      }
      assert.deepEqual(definition, before);
      const visible = annotationPanelsInViewport(scene, null, { minX: frame.x - 1, maxX: frame.x + frame.width, minY: 55, maxY: 65 })[0];
      assert.equal(visible.rects.filter((rect) => rect.kind === "y-grid").length, Number(grid));
      assert.ok(visible.rects.every((rect) => frame.rects[rect.keyIndex] === rect));
      const moved = { ...scene, clusters: new Map([...scene.clusters].map(([uid, cluster]) => [uid, { ...cluster, y: cluster.y + 25 }])) };
      assert.deepEqual(annotationPanelsForFrame(moved)[0].rects.filter((rect) => rect.kind === "y-grid").map((rect) => rect.y + 0.5), grid ? [45, 85, 125] : []);
      const preview = annotationPanelsForFrame(scene, { clusterOffsets: new Map([["b", 15]]) })[0];
      assert.deepEqual(preview.rects.filter((rect) => rect.kind === "y-grid").map((rect) => rect.y + 0.5), grid ? [20, 75, 100] : []);
    }
  });
}

test("Canvas draws grid lines behind data and the axis above data", () => {
  const { scene } = fixture("bar", { showYAxisLine: true, showYGridLines: true }), fills = [];
  const context = { save() {}, restore() {}, translate() {}, rotate() {}, fillText() {}, fillRect(...args) { fills.push(args); } };
  drawCanvasAnnotations(context, scene);
  assert.equal(fills.length > 4, true);
  assert.deepEqual(fills.slice(0, 3).map((rect) => rect[1]), [19.5, 59.5, 99.5]);
  assert.deepEqual(fills.at(-1), [-1, 10, 1, 100]);
});

test("the bar y-axis joins the x-axis when it is shown", () => {
  const { scene } = fixture("bar", { showYAxisLine: true, showKey: true });
  const frame = annotationPanelsForFrame(scene)[0], axis = frame.rects.find((rect) => rect.kind === "y-axis");
  const xAxis = frame.rects.find((rect) => !rect.kind && rect.width === frame.width && rect.height === 1);
  assert.equal(axis.y + axis.height, xAxis.y);
});

test("annotation axis settings validate and undo with the other panel styles", () => {
  const { definition } = fixture("heatmap");
  const data = { clusters: ["a", "b", "c"].map((uid) => ({ uid, loci: [] })), links: [], groups: [], annotationPanels: [definition] };
  const before = structuredClone(data.annotationPanels);
  const edit = applyChartOperations(data, createChartIndex(data), [{ type: "annotationPanels.update", ids: ["panel"], changes: { showYAxisLine: true, showYGridLines: true } }]);
  assert.equal(data.annotationPanels[0].showYAxisLine, true);
  applyChartOperations(data, createChartIndex(data), edit.inverse);
  assert.deepEqual(data.annotationPanels, before);
  for (const changes of [{ showYAxisLine: "true" }, { showYGridLines: 1 }]) {
    assert.throws(() => applyChartOperations(data, createChartIndex(data), [{ type: "annotationPanels.update", ids: ["panel"], changes }]), /must be a boolean/);
    assert.deepEqual(data.annotationPanels, before);
  }
});
