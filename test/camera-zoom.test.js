import test from "node:test";
import assert from "node:assert/strict";

test("camera zoom binds shared D3 gesture policy and updates its extent", async () => {
  const { bindCameraZoom, updateCameraZoom } = await import("../src/cameraZoom.mjs");
  const calls = [];
  const behavior = {
    scaleExtent(value) { calls.push(["extent", value]); return this; },
    on(name, callback) { calls.push(["on", name, callback]); return this; },
  };
  const surface = {
    call(value) { calls.push(["call", value]); return this; },
    on(name, value) { calls.push(["surface-on", name, value]); return this; },
  };
  const handlers = { zoom() {}, start() {}, end() {} };
  const zoom = bindCameraZoom({
    d3: { zoom: () => behavior },
    surface,
    zoomExtent: () => [0.5, 4],
    onZoom: handlers.zoom,
    onStart: handlers.start,
    onEnd: handlers.end,
  });
  updateCameraZoom(zoom, () => [1, 8]);

  assert.equal(zoom, behavior);
  assert.deepEqual(calls.map(([name]) => name), [
    "extent", "on", "on", "on", "call", "surface-on", "extent",
  ]);
  assert.deepEqual(calls[0][1], [0.5, 4]);
  assert.equal(calls[1][2], handlers.zoom);
  assert.deepEqual(calls[6][1], [1, 8]);
});

test("camera zoom synchronizes a fresh surface with the shared camera", async () => {
  const { syncCameraZoom } = await import("../src/cameraZoom.mjs");
  const node = {};
  const calls = [];
  const surface = {
    node() { return node; },
    call(...args) { calls.push(args); return this; },
  };
  const d3 = {
    zoomTransform() { return { x: 0, y: 0, k: 1 }; },
    zoomIdentity: {
      translate(x, y) {
        return { x, y, scale(k) { return { x, y, k }; } };
      },
    },
  };
  const zoom = { transform: Symbol("transform") };

  syncCameraZoom({ d3, surface, zoom, camera: { x: 40, y: -20, k: 1.5 } });

  assert.deepEqual(calls, [[zoom.transform, { x: 40, y: -20, k: 1.5 }]]);
});

test("camera zoom skips an already synchronized surface", async () => {
  const { syncCameraZoom } = await import("../src/cameraZoom.mjs");
  const surface = {
    node() { return {}; },
    call() { throw new Error("already synchronized"); },
  };
  syncCameraZoom({
    d3: { zoomTransform: () => ({ x: 40, y: -20, k: 1.5 }) },
    surface,
    zoom: { transform: Symbol("transform") },
    camera: { x: 40, y: -20, k: 1.5 },
  });
});
