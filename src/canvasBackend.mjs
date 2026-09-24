import { renderCanvas } from "./canvasRenderer.js";

// The Canvas backend owns the retained scene used by ordinary full-surface
// paints. Canvas-only composition (the flip bitmap and minimap) remains a
// controller concern because it deliberately paints partial surfaces.
export function createCanvasBackend({ render = renderCanvas } = {}) {
  let pendingScene = null;

  return {
    get pendingScene() {
      return pendingScene;
    },
    setScene: (scene) => {
      pendingScene = scene;
    },
    paint: ({ canvas, scene, ...options }) => {
      if (scene) pendingScene = scene;
      if (!canvas || !pendingScene) return null;
      return render({ canvas, scene: pendingScene, ...options });
    },
    destroy: () => {
      pendingScene = null;
    },
  };
}
