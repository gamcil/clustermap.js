import test from "node:test";
import assert from "node:assert/strict";

const paintRequest = (canvas, scene) => ({
  canvas,
  scene,
  preview: null,
  camera: { x: 0, y: 0, k: 1 },
  scales: {},
  config: {},
  dimensions: { width: 100, height: 100 },
  pixelRatio: 1,
});

for (const failure of ["render", "adoptScene", "device"]) {
  test(`WebGPU falls back after a ${failure} failure and ignores stale device errors`, async (t) => {
    const { createWebGpuBackend } = await import("../../src/renderers/webgpuBackend.mjs");
    t.mock.method(console, "warn", () => {});
    let onError, broken = false, destroyed = 0, setups = 0;
    const fallbacks = [];
    const backend = createWebGpuBackend({ paintOverlay() {},
      paintFallback: (request) => fallbacks.push(request), createRenderer: async (_canvas, options) => {
      setups++;
      onError = options.onError;
      const attempt = () => { if (broken) throw new Error("GPU failure"); };
      return { render: attempt, adoptScene: attempt, destroy: () => { destroyed++; } };
    } });
    const canvas = { dataset: {} }, scene = {};
    const request = { ...paintRequest(canvas, scene), overlayCanvas: {} };
    backend.paint(request);
    await Promise.resolve();
    broken = true;
    if (failure === "render") backend.paint(request);
    else if (failure === "adoptScene") backend.setScene({}, { sourceScene: scene });
    else onError(new Error("device lost"));
    assert.equal(fallbacks.length, 1);
    assert.equal(fallbacks[0].canvas, request.overlayCanvas, "fallback uses the 2D overlay, not the GPU surface");
    assert.equal(destroyed, 1);
    assert.equal(canvas.dataset.webgpu, "error");
    onError(new Error("stale callback"));
    assert.equal(fallbacks.length, 1);
    const nextScene = {};
    backend.paint({ ...request, scene: nextScene });
    assert.equal(fallbacks.length, 2);
    assert.equal(fallbacks.at(-1).scene, nextScene, "subsequent frames use the latest scene");
    assert.equal(setups, 1, "failed GPU initialization is not retried every frame");
    backend.destroy();
    onError(new Error("disposed callback"));
    assert.equal(fallbacks.length, 2);
    assert.equal(destroyed, 1);
  });
}

test("WebGPU backend renders the newest scene after asynchronous initialization", async () => {
  const { createWebGpuBackend } = await import("../../src/renderers/webgpuBackend.mjs");
  let resolveRenderer;
  const rendererPromise = new Promise((resolve) => {
    resolveRenderer = resolve;
  });
  const draws = [];
  const backend = createWebGpuBackend({ createRenderer: () => rendererPromise });
  const canvas = { dataset: {} };

  backend.paint(paintRequest(canvas, { uid: "first" }));
  backend.paint(paintRequest(canvas, { uid: "latest" }));
  resolveRenderer({ render: (request) => draws.push(request), destroy: () => {} });
  await rendererPromise;
  await Promise.resolve();

  assert.equal(canvas.dataset.webgpu, "active");
  assert.equal(draws.length, 1);
  assert.equal(draws[0].nextScene.uid, "latest");
});

test("WebGPU coordinates its overlay and GPU pass from the same frame", async () => {
  const { createWebGpuBackend } = await import("../../src/renderers/webgpuBackend.mjs");
  const overlays = [], draws = [];
  const backend = createWebGpuBackend({
    createRenderer: async () => ({ render: (request) => draws.push(request), destroy() {} }),
    paintOverlay: (request) => overlays.push(request),
    paintFallback: () => assert.fail("an active renderer should not fall back"),
  });
  const request = { ...paintRequest({ dataset: {} }, { uid: "scene" }), overlayCanvas: {},
    dimensions: { get width() { return 200; }, get height() { return 150; } } };
  backend.paint(request);
  await Promise.resolve();
  assert.equal(overlays.length, 1);
  assert.equal(overlays[0].canvas, request.overlayCanvas);
  assert.equal(overlays[0].scene, request.scene);
  assert.ok(overlays[0].layers.includes("clusterLabels"));
  assert.ok(!overlays[0].layers.includes("genes"));
  assert.equal(draws[0].canvas, request.canvas);
  assert.equal(draws[0].nextScene, request.scene);
  assert.equal(draws[0].width, 200);
  assert.equal(draws[0].height, 150);
  backend.destroy();
});

test("destroying a WebGPU backend invalidates a pending initialization", async () => {
  const { createWebGpuBackend } = await import("../../src/renderers/webgpuBackend.mjs");
  let resolveRenderer;
  const rendererPromise = new Promise((resolve) => {
    resolveRenderer = resolve;
  });
  let destroyed = false;
  const backend = createWebGpuBackend({ createRenderer: () => rendererPromise });
  const canvas = { dataset: {} };

  backend.paint(paintRequest(canvas, { uid: "pending" }));
  backend.destroy();
  resolveRenderer({ render: () => assert.fail("stale renderer should not draw"), destroy: () => { destroyed = true; } });
  await rendererPromise;
  await Promise.resolve();

  assert.equal(destroyed, true);
  assert.notEqual(canvas.dataset.webgpu, "active", "a disposed initialization cannot activate its surface");
});

test("replacing the canvas invalidates an in-flight WebGPU initialization", async () => {
  const { createWebGpuBackend } = await import("../../src/renderers/webgpuBackend.mjs");
  const resolvers = [];
  const backend = createWebGpuBackend({
    createRenderer: () => new Promise((resolve) => resolvers.push(resolve)),
  });
  const firstCanvas = { dataset: {} };
  const secondCanvas = { dataset: {} };
  let staleDestroyed = false;
  const draws = [];

  backend.paint(paintRequest(firstCanvas, { uid: "first" }));
  backend.paint(paintRequest(secondCanvas, { uid: "second" }));
  resolvers[0]({ render: () => assert.fail("stale renderer should not draw"), destroy: () => { staleDestroyed = true; } });
  resolvers[1]({ render: (request) => draws.push(request), destroy: () => {} });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(staleDestroyed, true);
  assert.equal(secondCanvas.dataset.webgpu, "active");
  assert.equal(draws[0].nextScene.uid, "second");
});

test("accepting a scene patch delegates buffer reuse to the active renderer", async () => {
  const { createWebGpuBackend } = await import("../../src/renderers/webgpuBackend.mjs");
  const draws = [], adoptions = [];
  const backend = createWebGpuBackend({ createRenderer: async () => ({
    render: (request) => draws.push(request.nextScene),
    adoptScene: (...args) => { adoptions.push(args); return false; },
    destroy() {},
  }) });
  const canvas = { dataset: {} }, sourceScene = {}, scene = { changes: { loci: new Set(["locus"]) } };
  const request = paintRequest(canvas, sourceScene);
  backend.paint(request);
  await Promise.resolve();
  backend.setScene(scene, { sourceScene, scales: request.scales, config: request.config });
  backend.paint({ ...request, scene });
  assert.deepEqual(adoptions, [[scene, sourceScene, { scales: request.scales, config: request.config }]]);
  assert.deepEqual(draws, [sourceScene, scene], "a rejected adoption still renders the new scene");
  const annotations = { changes: { annotationsOnly: true } };
  backend.setScene(annotations, { sourceScene: scene, scales: request.scales, config: request.config });
  backend.paint({ ...request, scene: annotations });
  assert.equal(adoptions.length, 1, "annotation-only edits bypass biological buffer adoption");
  assert.equal(draws.at(-1), annotations);
  backend.destroy();
});
