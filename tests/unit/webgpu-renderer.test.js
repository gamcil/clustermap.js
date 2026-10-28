import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createWebGpuRenderer } from "../../src/renderers/webgpu.js";
import { normalizeChartData } from "../../src/data/normalize.mjs";
import { createChartIndex } from "../../src/data/index.mjs";
import { createChartRuntime } from "../../src/chart/runtime.js";
import { createClusterDragPreview, createLocusOffsetsPreview, createLocusFlipPreview } from "../../src/scene/preview.mjs";
import { createLargeTestingData } from "../../fixtures/synthetic.mjs";
import { applyChartOperations } from "../../src/data/operations.mjs";
import { createChartState, setClusterOffset, setLocusOffset, setPreviewClusterOrder,
  commitPreviewClusterOrder, flipLocus, trimLocusToGeneBounds } from "../../src/chart/state.mjs";

// Exercise retained geometry without requiring a platform GPU adapter. This
// checks buffer contents/lifetimes; browser tests cover native initialization.
async function gpuHarness(t, options) {
  const buffers = [], writes = [], draws = [];
  let bindings, pipeline, vertexBuffer;
  const pass = {
    setPipeline(value) { pipeline = value; }, setBindGroup() {},
    setVertexBuffer(_slot, value) { vertexBuffer = value; },
    draw(...args) { draws.push({ entryPoint: pipeline.vertex.entryPoint, buffer: vertexBuffer, args }); },
    end() {},
  };
  const device = {
    createShaderModule: () => ({ getCompilationInfo: async () => ({ messages: [] }) }),
    createBindGroupLayout: () => ({}), createPipelineLayout: () => ({}),
    createRenderPipeline: (descriptor) => descriptor,
    createBindGroup: (descriptor) => { bindings = descriptor.entries; return {}; },
    createTexture: () => ({ createView: () => ({}), destroy() {} }),
    createCommandEncoder: () => ({ beginRenderPass: () => pass, finish: () => ({}) }),
    createBuffer: ({ size, usage }) => {
      const buffer = { size, usage, data: new Uint8Array(size), destroyed: false, destroy() { this.destroyed = true; } };
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
  const events = new EventTarget();
  device.addEventListener = events.addEventListener.bind(events);
  device.removeEventListener = events.removeEventListener.bind(events);
  let loseDevice;
  device.lost = new Promise((resolve) => { loseDevice = resolve; });
  const context = { configure() {}, unconfigure() { this.unconfigured = true; }, getCurrentTexture: () => ({ createView: () => ({}) }) };
  const renderer = await createWebGpuRenderer({ width: 0, height: 0, getContext: () => context }, options);
  t.after(() => renderer.destroy());
  return { renderer, buffers, writes, draws, context, events, loseDevice, getBindings: () => bindings };
}

test("tree presentation edits do not allocate or upload biological GPU geometry", async (t) => {
  const { renderer, buffers, writes } = await gpuHarness(t);
  const data = normalizeChartData(JSON.parse(await readFile(new URL("../../fixtures/heatmap.json", import.meta.url), "utf8")));
  const runtime = createChartRuntime(), index = createChartIndex(data);
  runtime.configure({ annotations: { enabled: false } });
  runtime.setChartIndex(index); runtime.setChartState(createChartState(data));
  let scene = runtime.updateScene(data);
  const render = () => renderer.render({ nextScene: scene, scales: runtime.scales, config: runtime.renderConfig,
    camera: { x: 0, y: 0, k: 1 }, width: 800, height: 400, pixelRatio: 1 });
  render();
  const count = buffers.length;
  applyChartOperations(data, index, [{ type: "tree.presentation.update", scope: "subtree", ids: ["x"], changes: { collapsed: true } }]);
  scene = runtime.updateScene(data, { sourceScene: scene, changes: { presentationOnly: true } });
  writes.length = 0;
  render();
  assert.equal(buffers.length, count);
  assert.equal(writes.filter((buffer) => buffer.usage & GPUBufferUsage.VERTEX).length, 0);
});

test("WebGPU reports device errors and releases its canvas on teardown", async (t) => {
  const errors = [];
  const { renderer, context, events, loseDevice } = await gpuHarness(t, { onError: (error) => errors.push(error) });
  const event = new Event("uncapturederror", { cancelable: true });
  event.error = new Error("validation failure");
  events.dispatchEvent(event);
  assert.deepEqual(errors, [event.error]);
  assert.equal(event.defaultPrevented, true);
  loseDevice({ reason: "unknown", message: "adapter lost" });
  await Promise.resolve();
  assert.match(errors[1].message, /adapter lost/);
  renderer.destroy();
  assert.equal(context.unconfigured, true);
  events.dispatchEvent(event);
  assert.equal(errors.length, 2);
});

test("WebGPU hides links without hiding genes and releases emptied geometry", async (t) => {
  const { renderer, buffers, draws } = await gpuHarness(t);
  const data = normalizeChartData(createLargeTestingData({ clusterCount: 3, genesPerCluster: 3 }));
  const runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(createChartState(data));
  let scene = runtime.updateScene(data);
  const options = { scales: runtime.scales, config: runtime.renderConfig };
  const render = () => renderer.render({ nextScene: scene, ...options,
    camera: { x: 0, y: 0, k: 1 }, width: 1500, height: 400, pixelRatio: 1 });
  render();
  const fills = draws.filter((draw) => draw.entryPoint === "vertexMain");
  assert.equal(fills.length, 2, "links and genes both draw initially");
  const linkBuffer = fills[0].buffer, geneBuffer = fills[1].buffer;
  options.config = { ...options.config, link: { ...options.config.link, show: false } };
  draws.length = 0;
  render();
  assert.equal(draws.some((draw) => draw.buffer === linkBuffer), false);
  assert.equal(draws.some((draw) => draw.buffer === geneBuffer), true);
  options.config = { ...options.config, link: { ...options.config.link, show: true } };
  draws.length = 0;
  render();
  assert.equal(draws.some((draw) => draw.buffer === linkBuffer), true);
  const oldGeometry = buffers.filter((buffer) => buffer.usage & GPUBufferUsage.VERTEX);
  // Replacing the scene with empty collections must release every old vertex buffer.
  scene = { ...scene, genes: new Map(), links: new Map(), loci: new Map(), clusters: new Map() };
  render();
  assert.ok(oldGeometry.every((buffer) => buffer.destroyed));
});

test("WebGPU adopts shared scene changes without reallocating geometry", async (t) => {
  const { renderer, buffers, writes, getBindings } = await gpuHarness(t);
  const data = normalizeChartData(JSON.parse(await readFile(new URL("../../fixtures/testing.json", import.meta.url), "utf8")));
  const state = createChartState(data), runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state);
  let scene = runtime.updateScene(data);
  const options = { scales: runtime.scales, config: runtime.renderConfig };
  const render = (preview = null) => renderer.render({ nextScene: scene, preview, ...options, camera: { x: 0, y: 0, k: 1 }, width: 800, height: 400, pixelRatio: 1 });
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
  const offsets = new Float32Array(getBindings().find((entry) => entry.binding === 1).resource.buffer.data.buffer);
  assert.equal(offsets[2], 25, "committed horizontal translation reaches the GPU");
  assert.equal(offsets[3], scene.clusters.get(first.uid).y - initialY, "committed row translation reaches the GPU");
  commit(() => setLocusOffset(state, locus.uid, 35), true);
  commit(() => trimLocusToGeneBounds(state, locus), true, [locus.uid]);
  commit(() => flipLocus(state, locus), true, [locus.uid]);
  render(createClusterDragPreview(scene, {
    clusterUid: first.uid, position: initialY, order: state.clusterOrder, rows: runtime.scales.y.range(),
  }));
  assert.deepEqual(geometryBuffers(), initialGeometry, "cluster previews retain the geometry buffers");
  render();
});

test("WebGPU culls retained geometry after moves and reorders and restores links for previews", async (t) => {
  const { renderer, buffers, writes, draws, getBindings } = await gpuHarness(t);
  const data = normalizeChartData(createLargeTestingData({ clusterCount: 4, genesPerCluster: 4 }));
  const state = createChartState(data), runtime = createChartRuntime();
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(state);
  let scene = runtime.updateScene(data);
  const options = { scales: runtime.scales, config: runtime.renderConfig };
  const linkOrder = [...scene.links.keys()];
  const render = (frame = {}, preview = null) => {
    writes.length = draws.length = 0;
    renderer.render({ nextScene: scene, preview, ...options,
      camera: { x: 0, y: 0, k: 1 }, width: 1500, height: 400, pixelRatio: 1, ...frame });
  };
  render();
  const geometryBuffers = () => buffers.filter((buffer) => buffer.usage & GPUBufferUsage.VERTEX);
  const initialGeometry = geometryBuffers();
  const geneBuffer = draws.filter((draw) => draw.entryPoint === "vertexMain").at(-1).buffer;
  const trackBuffer = draws.find((draw) => draw.entryPoint === "strokeVertex" && draw.args[1] === data.clusters.length).buffer;
  const submittedGenes = () => draws.filter((draw) => draw.entryPoint === "vertexMain" && draw.buffer === geneBuffer)
    .reduce((total, draw) => total + draw.args[0] * (draw.args[1] ?? 1), 0);
  const submittedTracks = () => draws.filter((draw) => draw.entryPoint === "strokeVertex" && draw.buffer === trackBuffer)
    .reduce((total, draw) => total + draw.args[1], 0);
  const linkIndexBuffer = () => getBindings().find((entry) => entry.binding === 3).resource.buffer;
  const submittedLinks = () => {
    const count = draws.find((draw) => draw.entryPoint === "linkFillVertex")?.args[1] || 0;
    return [...new Uint32Array(linkIndexBuffer().data.buffer, 0, count)];
  };
  const allGeneVertices = submittedGenes();
  const first = data.clusters[0], locus = first.loci[0];
  const farAway = { camera: { x: -100000, y: -100000, k: 1 }, width: 100, height: 22 };
  const checkCulling = () => {
    const cluster = scene.clusters.get(first.uid);
    const visibleLinks = [...scene.links.values()].filter((link) => link.visible);
    const expectedLinks = visibleLinks.map((link) => linkOrder.indexOf(link.source.uid));
    const expectedRowLinks = visibleLinks.filter((link) =>
      [link.source.query.uid, link.source.target.uid].some((uid) =>
        scene.genes.get(uid).locus.cluster.uid === first.uid)
    ).map((link) => linkOrder.indexOf(link.source.uid));
    render({ camera: { x: -cluster.x, y: -cluster.y, k: 1 }, width: 100, height: 22 });
    assert.equal(submittedGenes(), allGeneVertices / data.clusters.length, "only the current row's genes are submitted");
    assert.equal(submittedTracks(), 1, "only the current row's track is submitted");
    assert.equal(draws.find((draw) => draw.buffer === geneBuffer && draw.entryPoint === "vertexMain").args[2], 0,
      "the selected ranges belong to the moved row, not its old on-screen neighbour");
    assert.deepEqual(submittedLinks(), expectedRowLinks, "crossing links remain visible even with an offscreen endpoint");
    assert.ok(!writes.some((buffer) => buffer.usage & GPUBufferUsage.VERTEX), "panning does not regenerate geometry");

    render(farAway);
    assert.equal(draws.length, 0, "an empty viewport submits no biological geometry");
    for (const preview of [
      createLocusOffsetsPreview(scene, new Map([[locus.uid, scene.loci.get(locus.uid).localX + 10]]),
        { alignLabels: options.config.cluster.alignLabels }),
      createLocusFlipPreview(scene, locus.uid, { progress: 0.25 }),
    ]) {
      render(farAway, preview);
      assert.equal(submittedGenes(), allGeneVertices, "active locus previews retain the conservative full draw");
      assert.deepEqual(submittedLinks(), expectedLinks, "entering a preview restores previously culled links");
      render(farAway);
      assert.equal(draws.length, 0, "culling resumes after the preview ends");
    }
    render();
    assert.equal(submittedGenes(), allGeneVertices);
    assert.equal(submittedTracks(), data.clusters.length);
    assert.deepEqual(submittedLinks(), expectedLinks, "zooming out restores every visible link");
    render();
    assert.ok(!writes.includes(linkIndexBuffer()), "an unchanged full view does not re-upload the link list");
    assert.deepEqual(geometryBuffers(), initialGeometry, "camera motion and previews retain the original geometry buffers");
  };
  const commit = (change) => {
    const previous = scene;
    change();
    scene = runtime.updateScene(data, { sourceScene: previous });
    assert.equal(renderer.adoptScene(scene, previous, options), true);
    checkCulling();
  };
  commit(() => {
    setPreviewClusterOrder(state, [...state.clusterOrder].reverse()); commitPreviewClusterOrder(state);
  });
  commit(() => setClusterOffset(state, first.uid, 1000));
  commit(() => {
    setPreviewClusterOrder(state, data.clusters.map((cluster) => cluster.uid)); commitPreviewClusterOrder(state);
  });
  commit(() => {
    setPreviewClusterOrder(state, [0, 2, 1, 3].map((index) => data.clusters[index].uid)); commitPreviewClusterOrder(state);
  });
});
