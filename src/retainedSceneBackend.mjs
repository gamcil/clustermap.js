// Canvas and SVG both consume an already-projected scene synchronously. Keep
// their retained-scene contract in one place; backends with resource setup
// (WebGPU) intentionally own their more involved lifecycle separately.
export function createRetainedSceneBackend({ render, surface }) {
  let pendingScene = null;

  return {
    get pendingScene() {
      return pendingScene;
    },
    setScene: (scene) => {
      pendingScene = scene;
    },
    paint: (request) => {
      if (request.scene) pendingScene = request.scene;
      if (!request[surface] || !pendingScene) return null;
      return render({ ...request, scene: pendingScene });
    },
    destroy: () => {
      pendingScene = null;
    },
  };
}
