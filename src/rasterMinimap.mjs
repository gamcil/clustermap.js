import {
  cameraForMinimapPoint,
  createMinimapProjection,
  renderCanvasMinimap,
} from "./canvasRenderer.js";

/**
 * Retain the overview bitmap separately from either raster backend. The
 * controller deliberately knows nothing about D3 or chart state: callers
 * provide the current scene, camera, and the callback that draws an overview.
 */
export function createRasterMinimap({
  requestFrame = globalThis.requestAnimationFrame,
  cancelFrame = globalThis.cancelAnimationFrame,
  createCanvas = () => document.createElement("canvas"),
} = {}) {
  let baseCanvas = null;
  let baseFrame = null;

  const projectionFor = (scene, options) =>
    createMinimapProjection({
      bounds: scene?.figureBounds || scene?.bounds,
      width: options.width,
      height: options.height,
    });

  return {
    clear() {
      if (baseFrame !== null) cancelFrame(baseFrame);
      baseFrame = null;
    },

    paint({ minimap, surface, scene, options, camera, pixelRatio }) {
      const projection = projectionFor(scene, options);
      if (!minimap || !surface || !projection) return null;
      const bounds = surface.getBoundingClientRect();
      return renderCanvasMinimap({
        canvas: minimap,
        baseCanvas,
        projection,
        camera,
        viewport: { width: bounds.width, height: bounds.height },
        pixelRatio,
      });
    },

    scheduleBase({ scene, minimap, options, renderBase, onPaint }) {
      if (!scene?.bounds || !minimap) return;
      if (baseFrame !== null) cancelFrame(baseFrame);
      baseFrame = requestFrame(() => {
        baseFrame = null;
        const projection = projectionFor(scene, options);
        if (!projection || !minimap.isConnected) return;
        if (!baseCanvas) baseCanvas = createCanvas();
        renderBase({ canvas: baseCanvas, scene, projection });
        onPaint();
      });
    },

    cameraForPointer({ event, minimap, surface, scene, options, camera }) {
      const projection = projectionFor(scene, options);
      if (!projection || !minimap || !surface) return null;
      const minimapBounds = minimap.getBoundingClientRect();
      const surfaceBounds = surface.getBoundingClientRect();
      return cameraForMinimapPoint(
        projection,
        { x: event.clientX - minimapBounds.left, y: event.clientY - minimapBounds.top },
        { width: surfaceBounds.width, height: surfaceBounds.height },
        camera
      );
    },
  };
}
