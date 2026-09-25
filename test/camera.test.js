import test from "node:test";
import assert from "node:assert/strict";

test("camera fitting centres figures that fit in the viewport", async () => {
  const { fitCameraForBounds } = await import("../src/camera.mjs");
  const camera = fitCameraForBounds({
    bounds: { minX: 0, maxX: 100, minY: 0, maxY: 50 },
    viewport: { width: 400, height: 300 },
  });

  assert.deepEqual(camera, { x: 140, y: 120, k: 1.2, fitScale: 1.2, cropped: false });
});

test("camera fitting keeps oversized figures readable and top-aligned", async () => {
  const { fitCameraForBounds } = await import("../src/camera.mjs");
  const camera = fitCameraForBounds({
    bounds: { minX: -100, maxX: 900, minY: 10, maxY: 2010 },
    viewport: { width: 400, height: 300 },
    minimumReadableScale: 1,
  });

  assert.deepEqual(camera, { x: 120, y: 10, k: 1, fitScale: 0.13, cropped: true });
});

test("camera fitting applies configured zoom constraints", async () => {
  const { fitCameraForBounds } = await import("../src/camera.mjs");
  const camera = fitCameraForBounds({
    bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
    viewport: { width: 400, height: 300 },
    constrainScale: (scale) => Math.max(0.5, scale),
  });

  assert.equal(camera.k, 0.5);
  assert.equal(camera.cropped, true);
  assert.deepEqual({ x: camera.x, y: camera.y }, { x: 20, y: 20 });
});
