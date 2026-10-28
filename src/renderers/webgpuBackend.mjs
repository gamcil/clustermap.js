import { createWebGpuRenderer } from "./webgpu.js";
import { renderCanvas } from "./canvas.js";

const overlayLayers = ["tree", "trimIndicators", "geneLabels", "linkLabels", "clusterLabels", "annotationLabels", "chrome"];

export function createWebGpuBackend({ createRenderer = createWebGpuRenderer,
  paintOverlay = renderCanvas, paintFallback = renderCanvas } = {}) {
  let renderer = null;
  let canvas = null;
  let initialization = null;
  let unavailable = false;
  let pendingScene = null;
  let latestPaint = null;
  let generation = 0;

  const release = () => {
    generation += 1;
    renderer?.destroy();
    renderer = canvas = initialization = null;
    unavailable = false;
  };

  const fallback = () => {
    if (latestPaint) return paintFallback({ ...latestPaint,
      canvas: latestPaint.overlayCanvas, scene: pendingScene });
  };
  const fail = (error) => {
    if (unavailable) return;
    const failedCanvas = canvas;
    release();
    unavailable = true;
    if (failedCanvas) failedCanvas.dataset.webgpu = error ? "error" : "unavailable";
    if (error) console.warn("WebGPU renderer unavailable; falling back to Canvas 2D.", error);
    fallback();
  };
  const draw = () => {
    if (!renderer || !latestPaint) return;
    const { width, height } = latestPaint.dimensions;
    try { renderer.render({ ...latestPaint, width, height, nextScene: pendingScene }); }
    catch (error) { fail(error); }
  };

  const initialize = (request) => {
    const targetCanvas = request.canvas;
    if (!targetCanvas || !request.scene || unavailable) return;
    pendingScene = request.scene;
    latestPaint = request;
    if (renderer && canvas === targetCanvas || initialization && canvas === targetCanvas) return;
    if (canvas && canvas !== targetCanvas) {
      // A redraw can replace the DOM canvas while adapter setup is in flight.
      // Invalidate that setup before the new canvas acquires a WebGPU context.
      release();
    }
    if (initialization) return;

    canvas = targetCanvas;
    const currentGeneration = ++generation;
    initialization = createRenderer(targetCanvas, { onError: (error) => {
      if (currentGeneration === generation && canvas === targetCanvas) fail(error);
    } })
      .then((nextRenderer) => {
        if (currentGeneration !== generation || canvas !== targetCanvas) {
          nextRenderer?.destroy();
          return;
        }
        renderer = nextRenderer;
        initialization = null;
        if (renderer) {
          targetCanvas.dataset.webgpu = "active";
          draw();
          return;
        }
        fail();
      })
      .catch((error) => {
        if (currentGeneration !== generation || canvas !== targetCanvas) return;
        fail(error);
      });
  };

  return {
    setScene: (scene, { sourceScene, scales, config } = {}) => {
      pendingScene = scene;
      try {
        if (sourceScene && !scene.changes?.presentationOnly) renderer?.adoptScene(scene, sourceScene, { scales, config });
      } catch (error) { fail(error); }
    },
    paint: (request) => {
      const targetCanvas = request.canvas;
      if (!targetCanvas || !request.scene) return;
      pendingScene = request.scene;
      latestPaint = request;
      if (unavailable) {
        return fallback();
      }
      if (request.overlayCanvas) paintOverlay({ ...request, canvas: request.overlayCanvas, layers: overlayLayers });
      if (renderer && canvas === targetCanvas) {
        draw();
        return;
      }
      initialize(request);
    },
    destroy: () => {
      release();
      pendingScene = null;
      latestPaint = null;
    },
  };
}
