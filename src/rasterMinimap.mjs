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
  let gesture = false;

  const projectionFor = (scene, options) =>
    createMinimapProjection({
      bounds: scene?.figureBounds || scene?.bounds,
      width: options.width,
      height: options.height,
    });
  const cameraForPointer = ({ event, minimap, surface, scene, options, camera }) => {
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
  };

  return {
    clear() {
      if (baseFrame !== null) cancelFrame(baseFrame);
      baseFrame = null;
      gesture = false;
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

    cameraForPointer,

    bind(selection, {
      getSurface,
      getScene,
      getCamera,
      options,
      moveCamera,
      beginMotion,
      endMotion,
      setCursor,
    }) {
      gesture = false;
      const move = (minimap, event) => {
        const camera = cameraForPointer({
          event,
          minimap,
          surface: getSurface(),
          scene: getScene(),
          options,
          camera: getCamera(),
        });
        if (camera) moveCamera(camera);
      };
      selection
        .on("pointerdown.minimap", function (event) {
          if (event.button) return;
          gesture = true;
          beginMotion();
          this.setPointerCapture(event.pointerId);
          setCursor(this, "grabbing");
          move(this, event);
          event.preventDefault();
        })
        .on("pointermove.minimap", function (event) {
          if (!gesture) return;
          move(this, event);
          event.preventDefault();
        })
        .on("pointerup.minimap pointercancel.minimap", function (event) {
          if (!gesture) return;
          gesture = false;
          if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
          setCursor(this, "grab");
          endMotion();
        });
    },
  };
}
