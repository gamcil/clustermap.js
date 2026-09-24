import { renderSvg } from "./svgRenderer.js";
import { createRetainedSceneBackend } from "./retainedSceneBackend.mjs";

// SVG has no device context to initialise, but it still benefits from the
// same retained-scene lifecycle as the raster backends. The controller owns
// the SVG surface and interaction policy; this adapter owns the last scene
// supplied to the SVG renderer.
export function createSvgBackend({ render = renderSvg } = {}) {
  return createRetainedSceneBackend({ render, surface: "plot" });
}
