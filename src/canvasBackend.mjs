import { renderCanvas } from "./canvasRenderer.js";
import { createRetainedSceneBackend } from "./retainedSceneBackend.mjs";

// The Canvas backend owns the retained scene used by ordinary full-surface
// paints. Canvas-only composition (the flip bitmap and minimap) remains a
// controller concern because it deliberately paints partial surfaces.
export function createCanvasBackend({ render = renderCanvas } = {}) {
  return createRetainedSceneBackend({ render, surface: "canvas" });
}
