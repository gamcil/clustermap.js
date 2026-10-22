const rendererModes = new Set(["svg", "canvas", "webgpu"]);

export function isRendererMode(renderer) {
  return rendererModes.has(renderer);
}

export function isCanvasRenderer(renderer) {
  return renderer === "canvas";
}

export function isWebGpuRenderer(renderer) {
  return renderer === "webgpu";
}

// Canvas and WebGPU share the retained scene, pointer interaction, minimap,
// and preview paths. SVG is intentionally separate because D3 owns its DOM.
export function isRasterRenderer(renderer) {
  return isCanvasRenderer(renderer) || isWebGpuRenderer(renderer);
}
