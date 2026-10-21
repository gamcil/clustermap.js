import test from "node:test";
import assert from "node:assert/strict";
import { zoomIdentity } from "d3-zoom";

test("camera zoom binds shared D3 gesture policy and updates its extent", async () => {
  const { bindCameraZoom, updateCameraZoom } = await import("../src/cameraZoom.mjs");
  const calls = [];
  const surface = {
    call(value) { calls.push(["call", value]); return this; },
    on(name, value) { calls.push(["surface-on", name, value]); return this; },
  };
  const handlers = { zoom() {}, start() {}, end() {} };
  const zoom = bindCameraZoom({
    surface,
    zoomExtent: () => [0.5, 4],
    onZoom: handlers.zoom,
    onStart: handlers.start,
    onEnd: handlers.end,
  });
  assert.deepEqual(zoom.scaleExtent(), [0.5, 4]);
  for (const name of ["zoom", "start", "end"]) assert.equal(zoom.on(name), handlers[name]);
  assert.deepEqual(calls, [["call", zoom], ["surface-on", "dblclick.zoom", null]]);
  updateCameraZoom(zoom, () => [1, 8]);
  assert.deepEqual(zoom.scaleExtent(), [1, 8]);
});

test("camera zoom synchronizes a fresh surface with the shared camera", async () => {
  const { syncCameraZoom } = await import("../src/cameraZoom.mjs");
  const node = {};
  const calls = [];
  const surface = {
    node() { return node; },
    call(...args) { calls.push(args); return this; },
  };
  const zoom = { transform: Symbol("transform") };

  syncCameraZoom({ surface, zoom, camera: { x: 40, y: -20, k: 1.5 } });

  assert.deepEqual(calls, [[zoom.transform, zoomIdentity.translate(40, -20).scale(1.5)]]);
});

test("camera zoom skips an already synchronized surface", async () => {
  const { syncCameraZoom } = await import("../src/cameraZoom.mjs");
  const surface = {
    node() { return { __zoom: zoomIdentity.translate(40, -20).scale(1.5) }; },
    call() { throw new Error("already synchronized"); },
  };
  syncCameraZoom({
    surface,
    zoom: { transform: Symbol("transform") },
    camera: { x: 40, y: -20, k: 1.5 },
  });
});
