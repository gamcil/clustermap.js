const test = require("node:test");
const assert = require("node:assert/strict");

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

test("WebGPU backend renders the newest scene after asynchronous initialization", async () => {
  const { createWebGpuBackend } = await import("../src/webgpuBackend.mjs");
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
  const { createWebGpuBackend } = await import("../src/webgpuBackend.mjs");
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
  const { createWebGpuBackend } = await import("../src/webgpuBackend.mjs");
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
