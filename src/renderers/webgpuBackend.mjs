import { createWebGpuRenderer } from "./webgpu.js";

// Owns the lifetime of a WebGPU context, not chart state or interaction
// policy. The chart controller supplies the current scene and the Canvas
// fallback for each paint request.
export function createWebGpuBackend({ createRenderer = createWebGpuRenderer } = {}) {
  let renderer = null;
  let canvas = null;
  let initialization = null;
  let unavailable = false;
  let pendingScene = null;
  let latestPaint = null;
  let generation = 0;

  const draw = () => {
    if (renderer && latestPaint) renderer.render({ ...latestPaint, nextScene: pendingScene });
  };

  const fallback = () => latestPaint?.onUnavailable?.();

  return {
    get pendingScene() {
      return pendingScene;
    },
    hasResources: () => Boolean(renderer || canvas || initialization || unavailable),
    setScene: (scene) => {
      pendingScene = scene;
    },
    paint: (request) => {
      const targetCanvas = request.canvas;
      if (!targetCanvas || !request.scene) return;
      pendingScene = request.scene;
      latestPaint = request;
      if (unavailable) {
        fallback();
        return;
      }
      if (renderer && canvas === targetCanvas) {
        draw();
        return;
      }
      if (canvas && canvas !== targetCanvas) {
        // A redraw can replace the DOM canvas while adapter setup is still in
        // flight. Invalidate that setup before allowing the new canvas to
        // acquire a WebGPU context.
        generation += 1;
        renderer?.destroy();
        renderer = null;
        canvas = null;
        initialization = null;
        unavailable = false;
      }
      if (initialization) return;

      canvas = targetCanvas;
      const currentGeneration = ++generation;
      initialization = createRenderer(targetCanvas)
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
          unavailable = true;
          targetCanvas.dataset.webgpu = "unavailable";
          fallback();
        })
        .catch((error) => {
          if (currentGeneration !== generation || canvas !== targetCanvas) return;
          initialization = null;
          unavailable = true;
          targetCanvas.dataset.webgpu = "error";
          console.warn("WebGPU renderer unavailable; falling back to Canvas 2D.", error);
          fallback();
        });
    },
    adoptScene: (...args) => renderer?.adoptScene(...args) || false,
    destroy: () => {
      generation += 1;
      renderer?.destroy();
      renderer = null;
      canvas = null;
      initialization = null;
      unavailable = false;
      pendingScene = null;
      latestPaint = null;
    },
  };
}
