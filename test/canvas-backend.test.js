import test from "node:test";
import assert from "node:assert/strict";
import { createCanvasBackend } from "../src/canvasBackend.mjs";

function fixture() {
  const renders = [], images = [], frames = new Map(), canvases = [];
  let serial = 0;
  const context = Object.fromEntries(["setTransform", "clearRect", "save", "beginPath", "rect", "clip", "translate", "scale", "restore"]
    .map((name) => [name, () => {}]));
  context.drawImage = (...args) => images.push(args);
  const size = { width: 400, height: 200 };
  const document = { createElement() {
    const canvas = { ownerDocument: document, width: 0, height: 0, getContext: () => context,
      getBoundingClientRect: () => size };
    canvases.push(canvas); return canvas;
  } };
  const link = { uid: "link", query: { uid: "gene" }, target: { uid: "neighbour" } };
  const bounds = { minX: 10, maxX: 40, minY: 20, maxY: 30 };
  const scene = { loci: new Map([["locus", { bounds, genes: [{ source: { uid: "gene" } }] }]]),
    genes: new Map(["gene", "neighbour"].map((uid) => [uid, { bounds }])),
    links: new Map([["link", { bounds }]]), linksByGene: new Map([["gene", [link]]]) };
  const request = { canvas: document.createElement("canvas"), scene, camera: { x: 0, y: 0, k: 1 },
    config: { link: { asLine: true } }, pixelRatio: 2, tree: null, scales: {} };
  const backend = createCanvasBackend({
    requestFrame: (action) => { frames.set(++serial, action); return serial; },
    cancelFrame: (id) => frames.delete(id),
    render(options) {
      const bounds = options.dimensions || options.canvas.getBoundingClientRect();
      options.canvas.width = bounds.width * options.pixelRatio; options.canvas.height = bounds.height * options.pixelRatio;
      renders.push(options); return "painted";
    },
  });
  return { backend, request, renders, images, frames, canvases, size };
}

test("Canvas flip warming and playback share one layer cache", () => {
  const { backend, request, renders, images, frames, canvases } = fixture();
  backend.setScene(request.scene);
  assert.equal(backend.paint({ ...request, scene: undefined }), "painted");
  backend.warmLocus("locus");
  assert.equal(frames.size, 1);
  const [id, warm] = frames.entries().next().value; frames.delete(id); warm();
  assert.equal(canvases.length, 3, "one surface and two offscreen layers");
  assert.equal(renders.length, 4, "ordinary paint plus three layer passes");
  assert.deepEqual([...renders[1].omit.links], ["link"]);
  assert.deepEqual([...renders[1].omit.genes], ["gene", "neighbour"]);
  backend.prepareFlip("locus");
  assert.equal(renders.length, 4, "a warmed flip does not repeat preparation");
  const preview = { type: "locus-flip", locusUid: "locus", progress: 0.4, axes: new Map([["locus", 25]]) };
  backend.paint({ ...request, preview });
  assert.equal(images.length, 2, "restores the dirty region and composites the locus");
  assert.equal(renders[4].config.link.asLine, false);
  assert.equal(request.config.link.asLine, true, "frame rendering leaves configuration intact");
  assert.deepEqual([...renders[5].include.genes], ["neighbour"]);
  assert.equal(canvases.length, 3);
  backend.clearFlip();
  assert.equal(backend.paint({ ...request, preview }), "painted", "cleared caches use ordinary scene rendering");
});

for (const change of ["camera", "dimensions", "pixelRatio", "config", "scene", "tree", "canvas"]) {
  test(`Canvas flip layers invalidate when ${change} changes`, () => {
    const { backend, request, renders, canvases, size } = fixture();
    backend.paint(request); backend.prepareFlip("locus");
    if (change === "camera") request.camera.x = 20;
    else if (change === "dimensions") size.width = 500;
    else if (change === "pixelRatio") request.pixelRatio = 1;
    else if (change === "canvas") request.canvas = request.canvas.ownerDocument.createElement("canvas");
    else request[change] = { ...request[change] };
    const before = renders.length;
    backend.paint(request); backend.prepareFlip("locus");
    assert.equal(renders.length, before + 4, "changed frame rebuilds the layers");
    assert.equal(canvases.length, change === "canvas" ? 6 : 5);
  });
}

test("Canvas backend cancels warming and releases its retained frame on destroy", () => {
  const { backend, request, renders, frames } = fixture();
  backend.paint(request); backend.warmLocus("locus"); backend.warmLocus("locus");
  assert.equal(frames.size, 1);
  backend.destroy();
  assert.equal(frames.size, 0);
  assert.equal(backend.pendingScene, null);
  assert.equal(backend.paint({ canvas: request.canvas }), null);
  backend.prepareFlip("locus"); backend.warmLocus("locus");
  assert.equal(frames.size, 0); assert.equal(renders.length, 1);
});
