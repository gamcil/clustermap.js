const test = require("node:test");
const assert = require("node:assert/strict");

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
