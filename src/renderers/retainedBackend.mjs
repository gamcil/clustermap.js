// Retain a synchronous renderer's scene between full redraws and preview paints.
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
