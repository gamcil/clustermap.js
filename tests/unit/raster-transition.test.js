import test from "node:test";
import assert from "node:assert/strict";
import { createRasterTransition } from "../../src/chart/rasterTransition.mjs";

function harness() {
  let preview = null, paints = 0;
  const runs = [], adopted = [];
  const controller = createRasterTransition({
    getPreview: () => preview, setPreview: (value) => { preview = value; },
    paint: () => { paints++; }, adopt: (target, source) => adopted.push([target, source]),
    animate: (duration, update, complete) => {
      const run = { duration, update, complete, cancelled: false };
      runs.push(run);
      return () => { run.cancelled = true; };
    },
    flipTransition: () => ({ kind: "flip" }),
    flipFrame: (source, flip, progress) => ({ source, flip, progress }),
    interpolate: (source, target, progress) => ({ source, target, progress }),
  });
  const start = (options = {}) => controller.start({ target: {}, enabled: true, source: null,
    renderer: "canvas", duration: 100, clusterLabelText: () => "", ...options });
  return { controller, start, runs, adopted, get preview() { return preview; },
    set preview(value) { preview = value; }, get paints() { return paints; } };
}

test("canvas transitions retain their source when interrupted and adopt the target on completion", () => {
  const h = harness(), source = {}, first = {}, second = {};
  h.controller.scene = source;
  const treeMotion = { previousTree: {}, previousScene: source };
  h.start({ target: first, treeMotion });
  assert.equal(h.controller.scene, first);
  assert.deepEqual(h.controller.animation.tree, { ...treeMotion, targetScene: first });
  h.runs[0].update(0.5);
  assert.equal(h.controller.animation.progress, 0.5);
  h.start({ target: second });
  assert.equal(h.runs[0].cancelled, true);
  assert.equal(h.controller.animation.previousScene, source);
  h.runs[0].complete();
  assert.equal(h.controller.scene, second, "stale completion cannot replace the active target");
  h.runs[1].update(1);
  h.runs[1].complete();
  assert.equal(h.controller.scene, second);
  assert.equal(h.controller.animation, null);
});

test("WebGPU flip transitions clear only their own preview and adopt the target", () => {
  const h = harness(), source = { loci: new Map([["locus", { cluster: { uid: "cluster" } }]]) }, target = {};
  h.controller.scene = source;
  h.start({ target, source, renderer: "webgpu", flippedLoci: ["locus"] });
  h.runs[0].update(0.5);
  assert.equal(h.controller.scene, source);
  assert.equal(h.preview.progress, 0.5);
  h.runs[0].complete();
  assert.equal(h.preview, null);
  assert.deepEqual(h.adopted, [[target, source]]);
  assert.equal(h.controller.scene, target);

  h.controller.scene = source;
  h.start({ target, source, renderer: "webgpu", flippedLoci: ["locus"] });
  h.runs[1].update(0.2);
  const other = { type: "gesture" }; h.preview = other;
  h.controller.stop();
  assert.equal(h.preview, other);
  h.runs[1].update(0.8);
  h.runs[1].complete();
  assert.equal(h.preview, other);
  assert.equal(h.controller.scene, source);
});

test("WebGPU general transitions interpolate and immediately adopt when disabled", () => {
  const h = harness(), source = {}, target = {};
  h.controller.scene = source;
  h.start({ target, source, renderer: "webgpu" });
  h.runs[0].update(0.25);
  assert.deepEqual(h.controller.scene, { source, target, progress: 0.25 });
  h.runs[0].complete();
  assert.deepEqual(h.adopted, [[target, source]]);
  h.start({ target: source, source: target, renderer: "webgpu", enabled: false });
  assert.equal(h.controller.scene, source);
  assert.equal(h.runs.length, 1);
  assert.equal(h.paints, 3);
});
