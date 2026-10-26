import test from "node:test";
import assert from "node:assert/strict";

const paintRequest = (canvas, scene, onUnavailable = () => {}) => ({
  canvas,
  scene,
  preview: null,
  camera: { x: 0, y: 0, k: 1 },
  scales: {},
  config: {},
  width: 100,
  height: 100,
  pixelRatio: 1,
  onUnavailable,
});

for (const failure of ["render", "adoptScene", "device"]) {
  test(`WebGPU falls back after a ${failure} failure and ignores stale device errors`, async (t) => {
    const { createWebGpuBackend } = await import("../../src/renderers/webgpuBackend.mjs");
    t.mock.method(console, "warn", () => {});
    let onError, broken = false, destroyed = 0, setups = 0, fallbacks = 0;
    const backend = createWebGpuBackend({ createRenderer: async (_canvas, options) => {
      setups++;
      onError = options.onError;
      const attempt = () => { if (broken) throw new Error("GPU failure"); };
      return { render: attempt, adoptScene: attempt, destroy: () => { destroyed++; } };
    } });
    const canvas = { dataset: {} }, scene = {};
    const request = paintRequest(canvas, scene, () => { fallbacks++; });
    backend.paint(request);
    await Promise.resolve();
    broken = true;
    if (failure === "render") backend.paint(request);
    else if (failure === "adoptScene") backend.setScene({}, { sourceScene: scene });
    else onError(new Error("device lost"));
    assert.equal(fallbacks, 1);
    assert.equal(destroyed, 1);
    assert.equal(canvas.dataset.webgpu, "error");
    onError(new Error("stale callback"));
    assert.equal(fallbacks, 1);
    backend.paint({ ...request, onUnavailable: () => { fallbacks += 10; } });
    assert.equal(fallbacks, 11, "subsequent frames use the latest fallback");
    assert.equal(setups, 1, "failed GPU initialization is not retried every frame");
    backend.destroy();
    onError(new Error("disposed callback"));
    assert.equal(fallbacks, 11);
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
  assert.equal(backend.hasResources(), false);
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
