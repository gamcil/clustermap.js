import test from "node:test";
import assert from "node:assert/strict";
import { createCanvasBackend } from "../../src/renderers/canvasBackend.mjs";

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
  assert.equal(backend.paint(request), "painted");
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
  assert.equal(backend.paint({ canvas: request.canvas }), null);
  backend.prepareFlip("locus"); backend.warmLocus("locus");
  assert.equal(frames.size, 0); assert.equal(renders.length, 1);
});

function annotationFixture() {
  const setup = fixture(), { backend, request } = setup;
  request.scene = { ...request.scene, clusters: new Map(), annotationPanels: [{}] };
  backend.paint(request);
  return { ...setup, editAnnotations() {
    request.scene = { ...request.scene, changes: { presentationOnly: true } };
    return backend.paint(request);
  } };
}

test("stable annotation scenes retain biology before the first edit", () => {
  const { request, renders, images, canvases, editAnnotations } = annotationFixture();
  assert.equal(canvases.length, 2, "initial paint captures biology once");
  assert.ok(renders[0].layers.includes("genes"));
  assert.ok(!renders[0].layers.includes("annotations"));
  assert.deepEqual(renders[1].layers, ["annotations", "annotationLabels", "chrome"]);
  assert.equal(renders[1].clear, false);
  assert.equal(images[0][0], request.canvas, "snapshot comes from the visible biology pass");
  assert.equal(editAnnotations(), "painted");
  assert.equal(renders.length, 3, "the first edit needs only the annotation pass");
  editAnnotations();
  assert.equal(renders.length, 4, "subsequent edits need only one annotation pass");
  assert.equal(canvases.length, 2, "reuse does not allocate another bitmap");
  assert.equal(images[1][0], canvases[1], "reuse restores the retained biology");
});

test("a tree presentation change invalidates the cached tree pixels", () => {
  const { request, renders, editAnnotations } = annotationFixture();
  request.tree = { presentation: {} };
  editAnnotations();
  const before = renders.length;
  request.tree.presentation = { subtrees: { root: { collapsed: true } } };
  editAnnotations();
  assert.equal(renders.length, before + 2, "the old tree bitmap is replaced before painting annotations");
  assert.ok(renders.at(-2).layers.includes("tree"));
  editAnnotations();
  assert.equal(renders.length, before + 3, "unchanged tree presentation still reuses the bitmap");
});

for (const change of ["camera", "dimensions", "pixelRatio", "config", "scales", "tree", "canvas",
  "hoverLocusUid", "suppressLocusHover", "preview", "previousScene", "previousTree", "treeProgress",
  "genes", "links", "loci", "clusters"]) {
  test(`annotation biology invalidates when ${change} changes`, () => {
    const { backend, request, renders, size, editAnnotations } = annotationFixture();
    editAnnotations();
    if (change === "camera") request.camera.x = 20;
    else if (change === "dimensions") size.width = 500;
    else if (change === "pixelRatio") request.pixelRatio = 1;
    else if (change === "canvas") request.canvas = request.canvas.ownerDocument.createElement("canvas");
    else if (change === "hoverLocusUid") request.hoverLocusUid = "locus";
    else if (change === "suppressLocusHover") request.suppressLocusHover = true;
    else if (change === "treeProgress") request.treeProgress = 0.5;
    else if (["genes", "links", "loci", "clusters"].includes(change)) {
      request.scene = { ...request.scene, [change]: new Map(request.scene[change]) };
    } else request[change] = { ...request[change] };
    const before = renders.length;
    backend.paint(request);
    assert.ok(renders.slice(before).some(({ layers }) => !layers || layers.includes("genes")),
      "changed frame redraws biology instead of restoring stale pixels");
  });
}

for (const key of ["highlightGeneIds", "highlightLinkIds", "highlightLocusIds", "highlightClusterIds"]) {
  test(`annotation reuse snapshots ${key} membership and avoids drawing it twice`, () => {
    const { request, renders, editAnnotations } = annotationFixture();
    request[key] = new Set(["selected"]);
    request.hoverLocusUid = "locus";
    editAnnotations();
    const before = renders.length;
    request[key] = new Set(["selected"]);
    editAnnotations();
    assert.equal(renders.length, before + 1, "equal membership reuses the snapshot");
    assert.equal(renders.at(-1)[key], null, "annotation pass omits retained highlights");
    assert.equal(renders.at(-1).hoverLocusUid, null);
    assert.equal(renders.at(-1).suppressLocusHover, true);
    request[key].add("another");
    editAnnotations();
    assert.equal(renders.length, before + 3, "in-place membership changes rebuild biology");
    assert.deepEqual([...renders.at(-2)[key]], ["selected", "another"]);
    request[key].clear();
    editAnnotations();
    assert.equal(renders.length, before + 5, "clearing selection also rebuilds biology");
  });
}

test("non-annotation scene commits and destroy rebuild retained biology", () => {
  const { backend, request, renders, canvases, editAnnotations } = annotationFixture();
  editAnnotations();
  request.scene = { ...request.scene, changes: {} };
  backend.paint(request);
  assert.ok(renders.at(-2).layers.includes("genes"), "new scenes capture fresh biology");
  assert.equal(canvases.length, 3);
  editAnnotations();
  assert.equal(canvases.length, 3);
  backend.destroy();
  const before = renders.length;
  backend.paint(request);
  assert.equal(renders.length, before + 2, "destroyed snapshot must be rebuilt");
  assert.equal(canvases.length, 4);
});

test("navigation paints do not capture biology until the next annotation edit", () => {
  const { backend, request, renders, canvases, editAnnotations } = annotationFixture();
  for (let step = 1; step <= 5; step++) {
    request.camera.x = step * 20;
    backend.paint(request);
    assert.equal(renders.at(-1).layers, undefined, "navigation uses the ordinary full paint");
  }
  assert.equal(canvases.length, 2, "navigation does not allocate snapshots per frame");
  editAnnotations();
  assert.equal(canvases.length, 3, "the next edit captures the settled viewport");
  const before = renders.length;
  editAnnotations();
  assert.equal(renders.length, before + 1, "later edits reuse that viewport");
});
