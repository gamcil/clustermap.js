import { renderSvg } from "./svgRenderer.js";

// SVG has no device context to initialise, but it still benefits from the
// same retained-scene lifecycle as the raster backends. The controller owns
// the SVG surface and interaction policy; this adapter owns the last scene
// supplied to the SVG renderer.
export function createSvgBackend({ render = renderSvg } = {}) {
  let pendingScene = null;

  return {
    get pendingScene() {
      return pendingScene;
    },
    setScene: (scene) => {
      pendingScene = scene;
    },
    paint: ({ plot, scene, ...options }) => {
      if (scene) pendingScene = scene;
      if (!plot || !pendingScene) return null;
      return render({ plot, scene: pendingScene, ...options });
    },
    destroy: () => {
      pendingScene = null;
    },
  };
}
