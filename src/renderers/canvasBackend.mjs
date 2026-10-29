import { renderCanvas, CANVAS_LAYERS } from "./canvas.js";
import { includeBounds } from "../scene/bounds.mjs";
import { animate as runAnimation, afterPaint } from "./animation.mjs";

const annotationLayers = ["annotations", "annotationLabels", "chrome"];
const biologyLayers = CANVAS_LAYERS.filter((layer) => !annotationLayers.includes(layer));
const highlightKeys = ["highlightGeneIds", "highlightLinkIds", "highlightLocusIds", "highlightClusterIds"];
const noHighlights = Object.fromEntries(highlightKeys.map((key) => [key, null]));

function recordBounds(scene, records) {
  let result = null;
  for (const [type, ids] of Object.entries(records)) for (const uid of ids) {
    result = includeBounds(result, scene[type].get(uid)?.bounds);
  }
  return result;
}

function screenFrame(bounds, dimensions, camera, padding = 12) {
  if (!bounds) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.max(0, camera.x + bounds.minX * camera.k - padding);
  const y = Math.max(0, camera.y + bounds.minY * camera.k - padding);
  const right = Math.min(dimensions.width, camera.x + bounds.maxX * camera.k + padding);
  const bottom = Math.min(dimensions.height, camera.y + bounds.maxY * camera.k + padding);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

function flipRecords(scene, locusUid) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  const loci = new Set([locusUid]), ownGenes = new Set(locus.genes.map((gene) => gene.source.uid));
  const genes = new Set(ownGenes), links = new Set();
  for (const uid of ownGenes) for (const link of scene.linksByGene.get(uid) || []) {
    links.add(link.uid); genes.add(link.query.uid); genes.add(link.target.uid);
  }
  return { locus: { loci, genes: ownGenes }, dynamic: { loci, genes, links },
    stationaryGenes: new Set([...genes].filter((uid) => !ownGenes.has(uid))) };
}

/** Own Canvas resources and bitmap playback; the chart supplies scenes. */
export function createCanvasBackend({ render = renderCanvas,
  requestFrame = globalThis.requestAnimationFrame, cancelFrame = globalThis.cancelAnimationFrame,
  defer = afterPaint, animate = runAnimation } = {}) {
  let latest = null, cached = null, biology = null, warmFrame = null, playback = null;
  const dimensions = (request) => request.dimensions || request.canvas.getBoundingClientRect();
  const canRetainBiology = (request) => request.scene.annotationPanels?.length &&
    !request.preview && !request.previousScene && !request.previousTree &&
    (request.treeProgress ?? 1) === 1;
  const biologyMatches = (request) => {
    if (!biology || !canRetainBiology(request)) return false;
    const previous = biology.request, size = dimensions(request);
    return (previous.scene === request.scene || request.scene.changes?.presentationOnly) &&
      previous.canvas === request.canvas && previous.config === request.config &&
      previous.scales === request.scales && previous.tree === request.tree &&
      biology.treePresentation === request.tree?.presentation &&
      previous.pixelRatio === request.pixelRatio &&
      previous.hoverLocusUid === request.hoverLocusUid &&
      previous.suppressLocusHover === request.suppressLocusHover &&
      biology.highlights.every((ids, index) =>
        ids.size === (request[highlightKeys[index]]?.size || 0) &&
        [...ids].every((uid) => request[highlightKeys[index]].has(uid))) &&
      biology.bitmap.width === request.canvas.width && biology.bitmap.height === request.canvas.height &&
      biology.width === size.width && biology.height === size.height &&
      previous.camera.x === request.camera.x && previous.camera.y === request.camera.y &&
      previous.camera.k === request.camera.k &&
      ["genes", "links", "loci", "clusters"].every((key) => previous.scene[key] === request.scene[key]);
  };
  const paintAnnotations = (request, retain) => {
    const size = dimensions(request), canvas = request.canvas;
    if (retain) {
      render({ ...request, dimensions: size, layers: biologyLayers });
      const bitmap = canvas.ownerDocument.createElement("canvas");
      bitmap.width = canvas.width; bitmap.height = canvas.height;
      bitmap.getContext("2d").drawImage(canvas, 0, 0);
      biology = { request: { ...request, camera: { ...request.camera } },
        treePresentation: request.tree?.presentation,
        highlights: highlightKeys.map((key) => new Set(request[key])),
        width: size.width, height: size.height, bitmap };
    } else {
      const context = canvas.getContext("2d");
      context.save(); context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(biology.bitmap, 0, 0); context.restore();
    }
    return render({ ...request, ...noHighlights, hoverLocusUid: null, suppressLocusHover: true,
      dimensions: size, layers: annotationLayers, clear: false });
  };
  const matches = (request, scene, locusUid) => {
    if (!cached || cached.scene !== scene || cached.locusUid !== locusUid || cached.canvas !== request.canvas ||
        cached.config !== request.config || cached.tree !== request.tree || cached.pixelRatio !== request.pixelRatio) return false;
    const size = dimensions(request), camera = request.camera;
    return size.width === cached.width && size.height === cached.height &&
      camera.x === cached.camera.x && camera.y === cached.camera.y && camera.k === cached.camera.k;
  };
  const cancelWarm = () => {
    if (warmFrame !== null) cancelFrame(warmFrame);
    warmFrame = null;
  };
  const clearFlipCache = () => { cancelWarm(); cached = null; };
  const clearFlip = () => {
    playback?.cancel?.();
    playback = null;
    clearFlipCache();
  };
  const prepareFlip = (locusUid, scene = latest?.scene) => {
    cancelWarm();
    if (!latest?.canvas || !scene || matches(latest, scene, locusUid)) return;
    const records = flipRecords(scene, locusUid);
    if (!records) return;
    const { canvas, camera, config, scales, tree, pixelRatio } = latest;
    const size = dimensions(latest), document = canvas.ownerDocument;
    const baseCanvas = document.createElement("canvas"), locusCanvas = document.createElement("canvas");
    const options = { scene, camera, config, scales, tree, pixelRatio, dimensions: size, suppressLocusHover: true };
    render({ ...options, canvas: baseCanvas, omit: records.dynamic, layers: ["links", "linkLabels"] });
    render({ ...options, canvas: baseCanvas, omit: { loci: records.dynamic.loci, genes: records.dynamic.genes },
      layers: CANVAS_LAYERS.filter((layer) => layer !== "links" && layer !== "linkLabels"), clear: false });
    const locusFrame = screenFrame(recordBounds(scene, records.locus), size, camera);
    render({ ...options, canvas: locusCanvas, camera: { ...camera, x: camera.x - locusFrame.x, y: camera.y - locusFrame.y },
      dimensions: locusFrame, include: records.locus, layers: ["tracks", "trimIndicators", "genes"] });
    cached = { scene, locusUid, canvas, camera: { ...camera }, config, tree, pixelRatio,
      width: size.width, height: size.height, baseCanvas, locusCanvas, locusFrame, records,
      dirtyFrame: screenFrame(recordBounds(scene, records.dynamic), size, camera) };
  };
  const paintFlip = (request) => {
    const { canvas, camera, config, preview, pixelRatio } = request;
    const { baseCanvas, locusCanvas, locusFrame, dirtyFrame, records } = cached;
    const context = canvas.getContext("2d");
    const left = Math.max(0, Math.floor(dirtyFrame.x * pixelRatio));
    const top = Math.max(0, Math.floor(dirtyFrame.y * pixelRatio));
    const width = Math.max(1, Math.min(baseCanvas.width, Math.ceil((dirtyFrame.x + dirtyFrame.width) * pixelRatio)) - left);
    const height = Math.max(1, Math.min(baseCanvas.height, Math.ceil((dirtyFrame.y + dirtyFrame.height) * pixelRatio)) - top);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(left / pixelRatio, top / pixelRatio, width / pixelRatio, height / pixelRatio);
    context.drawImage(baseCanvas, left, top, width, height, left / pixelRatio, top / pixelRatio, width / pixelRatio, height / pixelRatio);
    const options = { canvas, scene: cached.scene, camera, config, preview, pixelRatio,
      scales: request.scales, suppressLocusHover: true, clear: false };
    // Ribbons stay filled during a flip and beneath both endpoint genes.
    render({ ...options, config: { ...config, link: { ...config.link, asLine: false } },
      include: { links: records.dynamic.links }, layers: ["links"] });
    const axis = preview.axes?.get(preview.locusUid);
    if (axis !== undefined) {
      const screenAxis = camera.x + axis * camera.k;
      context.save(); context.beginPath();
      context.rect(dirtyFrame.x, dirtyFrame.y, dirtyFrame.width, dirtyFrame.height); context.clip();
      context.translate(screenAxis, 0); context.scale(1 - 2 * preview.progress, 1); context.translate(-screenAxis, 0);
      context.drawImage(locusCanvas, 0, 0, locusCanvas.width, locusCanvas.height,
        locusFrame.x, locusFrame.y, locusFrame.width, locusFrame.height);
      context.restore();
    }
    if (records.stationaryGenes.size) render({ ...options, preview: null,
      include: { genes: records.stationaryGenes }, layers: ["genes", "geneLabels"] });
    render({ ...options, include: { loci: records.locus.loci }, layers: ["trimIndicators", "clusterLabels"] });
    return dirtyFrame;
  };

  return {
    prepareFlip,
    clearFlip,
    animateFlip(locusUid, scene, { duration, onPrepare, onUpdate, onComplete }) {
      playback?.cancel?.();
      const flip = { cancel: null };
      playback = flip;
      const cancel = () => { if (playback === flip) clearFlip(); };
      const finish = () => {
        if (playback !== flip) return;
        playback = null;
        clearFlipCache();
        onComplete();
      };
      const initialProgress = 0.12;
      onUpdate(initialProgress, false);
      if (playback !== flip) return cancel;
      flip.cancel = defer(() => {
        if (playback !== flip) return;
        flip.cancel = null;
        onPrepare();
        if (playback !== flip) return;
        prepareFlip(locusUid, scene);
        onUpdate(initialProgress, true);
        if (playback !== flip) return;
        if (!duration) { finish(); return; }
        flip.cancel = animate(duration, (progress) => {
          if (playback === flip) onUpdate(initialProgress + (1 - initialProgress) * progress, true);
        }, finish);
      });
      return cancel;
    },
    warmLocus(locusUid) {
      if (!locusUid || !latest || latest.preview?.type === "locus-flip") return;
      cancelWarm();
      warmFrame = requestFrame(() => { warmFrame = null; prepareFlip(locusUid); });
    },
    paint(request) {
      if (!request.canvas || !request.scene) return null;
      // Capture new stable scenes while painting them, without copying navigation frames.
      const newScene = latest?.scene !== request.scene;
      latest = { ...request };
      if (!biologyMatches(request)) biology = null;
      if (cached && !matches(latest, request.scene, cached.locusUid)) clearFlipCache();
      if (cached && request.preview?.type === "locus-flip" && cached.locusUid === request.preview.locusUid) return paintFlip(latest);
      if (biology || newScene && canRetainBiology(request)) return paintAnnotations(latest, !biology);
      return render(latest);
    },
    destroy() { clearFlip(); biology = null; latest = null; },
  };
}
