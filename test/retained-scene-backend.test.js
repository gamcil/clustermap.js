import test from "node:test";
import assert from "node:assert/strict";

test("retained scene backend paints the latest scene on its configured surface", async () => {
  const { createRetainedSceneBackend } = await import("../src/retainedSceneBackend.mjs");

  for (const surface of ["canvas", "plot"]) {
    const calls = [];
    const backend = createRetainedSceneBackend({
      surface,
      render: (request) => {
        calls.push(request);
        return "painted";
      },
    });
    const target = {};
    const scene = { uid: `${surface}-scene` };

    backend.setScene(scene);
    assert.equal(backend.paint({ [surface]: target, animate: false }), "painted");
    assert.equal(calls[0].scene, scene);
    assert.equal(calls[0][surface], target);

    backend.destroy();
    assert.equal(backend.pendingScene, null);
    assert.equal(backend.paint({ [surface]: target }), null);
  }
});
