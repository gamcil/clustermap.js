import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createWebGpuRenderer } from "../src/renderers/webgpu.js";
import { normalizeChartData } from "../src/data/normalize.mjs";
import { createChartIndex } from "../src/data/index.mjs";
import { createChartRuntime } from "../src/chart/runtime.js";
import { createChartState, setClusterOffset, setLocusOffset, setPreviewClusterOrder,
  commitPreviewClusterOrder, flipLocus, trimLocusToGeneBounds } from "../src/chart/state.mjs";

// Exercise retained geometry without requiring a platform GPU adapter. This
// checks buffer contents/lifetimes; browser tests cover native initialization.
test("WebGPU adopts shared scene changes without reallocating geometry", async (t) => {
  const buffers = [], writes = [];
  let bindings;
  const pass = { setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, draw() {}, end() {} };
  const device = {
    createShaderModule: () => ({ getCompilationInfo: async () => ({ messages: [] }) }),
    createBindGroupLayout: () => ({}), createPipelineLayout: () => ({}),
    createRenderPipeline: () => ({}),
    createBindGroup: (descriptor) => { bindings = descriptor.entries; return {}; },
    createTexture: () => ({ createView: () => ({}), destroy() {} }),
    createCommandEncoder: () => ({ beginRenderPass: () => pass, finish: () => ({}) }),
    createBuffer: ({ size, usage }) => {
      const buffer = { size, usage, data: new Uint8Array(size), destroy() {} };
      buffers.push(buffer); return buffer;
    },
    queue: {
      submit() {},
      writeBuffer(buffer, offset, source, start = 0, length = source.byteLength) {
        const bytes = source instanceof ArrayBuffer ? new Uint8Array(source, start, length)
          : new Uint8Array(source.buffer, source.byteOffset + start, length);
        buffer.data.set(bytes, offset); writes.push(buffer);
      },
    },
    destroy() {},
  };
  const globals = {
    navigator: { gpu: { requestAdapter: async () => ({ requestDevice: async () => device }), getPreferredCanvasFormat: () => "bgra8unorm" } },
    GPUShaderStage: { VERTEX: 1 }, GPUTextureUsage: { RENDER_ATTACHMENT: 16 },
    GPUBufferUsage: { COPY_DST: 8, VERTEX: 32, UNIFORM: 64, STORAGE: 128 },
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  }
  const context = { configure() {}, getCurrentTexture: () => ({ createView: () => ({}) }) };
  const renderer = await createWebGpuRenderer({ width: 0, height: 0, getContext: () => context });
  t.after(() => renderer.destroy());
  const data = normalizeChartData(JSON.parse(await readFile(new URL("../testing.json", import.meta.url), "utf8")));
  const state = createChartState(data), runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state);
  let scene = runtime.updateScene(data);
  const options = { scales: runtime.scales, config: runtime.renderConfig };
  const render = () => renderer.render({ nextScene: scene, ...options, camera: { x: 0, y: 0, k: 1 }, width: 800, height: 400, pixelRatio: 1 });
  render();
  const geometryBuffers = () => buffers.filter((buffer) => buffer.usage & GPUBufferUsage.VERTEX);
  const initialGeometry = geometryBuffers(), first = data.clusters[0], locus = first.loci[0];
  const initialY = scene.clusters.get(first.uid).y;
  const vertexWrites = () => writes.filter((buffer) => buffer.usage & GPUBufferUsage.VERTEX).length;
  const commit = (change, geometryChanged, loci = []) => {
    const previous = scene;
    change();
    scene = runtime.updateScene(data, { sourceScene: previous, changes: { loci } });
    writes.length = 0;
    assert.equal(renderer.adoptScene(scene, previous, options), true);
    assert.equal(vertexWrites() > 0, geometryChanged);
    render();
    assert.deepEqual(geometryBuffers(), initialGeometry, "commits retain the geometry buffers");
  };
  commit(() => {
    setPreviewClusterOrder(state, [...state.clusterOrder].reverse()); commitPreviewClusterOrder(state);
  }, false);
  commit(() => setClusterOffset(state, first.uid, 25), false);
  const offsets = new Float32Array(bindings.find((entry) => entry.binding === 1).resource.buffer.data.buffer);
  assert.equal(offsets[2], 25, "committed horizontal translation reaches the GPU");
  assert.equal(offsets[3], scene.clusters.get(first.uid).y - initialY, "committed row translation reaches the GPU");
  commit(() => setLocusOffset(state, locus.uid, 35), true);
  commit(() => trimLocusToGeneBounds(state, locus), true, [locus.uid]);
  commit(() => flipLocus(state, locus), true, [locus.uid]);
});
