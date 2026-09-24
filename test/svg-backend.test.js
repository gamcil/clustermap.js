const test = require("node:test");
const assert = require("node:assert/strict");

test("SVG backend retains the latest scene for ordinary paints", async () => {
  const { createSvgBackend } = await import("../src/svgBackend.mjs");
  const calls = [];
  const backend = createSvgBackend({ render: (request) => {
    calls.push(request);
    return "painted";
  } });
  const plot = {};
  const scene = { uid: "scene" };

  backend.setScene(scene);
  assert.equal(backend.paint({ plot, animate: false }), "painted");
  assert.equal(calls[0].scene, scene);
  assert.equal(calls[0].animate, false);

  backend.destroy();
  assert.equal(backend.pendingScene, null);
  assert.equal(backend.paint({ plot }), null);
});
