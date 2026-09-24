const test = require("node:test");
const assert = require("node:assert/strict");

test("Canvas backend retains the latest scene for ordinary paints", async () => {
  const { createCanvasBackend } = await import("../src/canvasBackend.mjs");
  const calls = [];
  const backend = createCanvasBackend({ render: (request) => {
    calls.push(request);
    return "painted";
  } });
  const canvas = {};
  const scene = { uid: "scene" };

  backend.setScene(scene);
  assert.equal(backend.paint({ canvas, camera: { k: 1 } }), "painted");
  assert.equal(calls[0].scene, scene);
  assert.deepEqual(calls[0].camera, { k: 1 });

  backend.destroy();
  assert.equal(backend.pendingScene, null);
  assert.equal(backend.paint({ canvas }), null);
});
