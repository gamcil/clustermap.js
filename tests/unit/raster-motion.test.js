import test from "node:test";
import assert from "node:assert/strict";

test("raster motion restores Canvas detail after a gesture and keeps WebGPU native", async () => {
  const { createRasterMotion } = await import("../../src/interaction/motion.mjs");
  let renderer = "canvas";
  let paintCount = 0;
  let nextTimer = 0;
  const timers = new Map();
  const motion = createRasterMotion({
    schedulePaint: () => {
      paintCount += 1;
    },
    getCamera: () => ({ k: 1 }),
    getRenderer: () => renderer,
    devicePixelRatio: () => 2,
    setTimer: (callback) => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });

  assert.equal(motion.pixelRatio(), 2);
  motion.begin();
  assert.equal(paintCount, 1);
  assert.equal(motion.pixelRatio(), 1, "Canvas favours throughput while moving");
  motion.end();
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.equal(paintCount, 2);
  assert.equal(motion.pixelRatio(), 2, "Canvas detail returns after the settle delay");

  renderer = "webgpu";
  motion.begin();
  assert.equal(motion.pixelRatio(), 2, "WebGPU never enters the low-resolution mode");
  motion.dispose();
});

for (const [renderer, adaptiveResolution, ratio] of [
  ["canvas", false, 2], ["webgpu", true, 2], ["canvas", true, 1],
]) {
  test(`${renderer} at DPR ${ratio}, adaptive ${adaptiveResolution}: unchanged resolution needs no settle repaint`, async () => {
    const { createRasterMotion } = await import("../../src/interaction/motion.mjs");
    let paints = 0, settle;
    const motion = createRasterMotion({
      schedulePaint: () => paints++,
      getCamera: () => ({ k: 1 }),
      getRenderer: () => renderer,
      getAdaptiveResolution: () => adaptiveResolution,
      devicePixelRatio: () => ratio,
      setTimer: (callback) => { settle = callback; return 1; },
    });
    motion.begin(); motion.end(); settle();
    assert.equal(paints, 1, "gesture completion does not repeat an unchanged frame");
    assert.equal(motion.pixelRatio(), ratio);
  });
}
