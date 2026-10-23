import { canvasPixelRatioForCamera } from "../renderers/canvas.js";

/**
 * Coordinate raster redraw quality during active gestures. Canvas 2D may
 * temporarily favour throughput; WebGPU remains at native resolution because
 * its geometry redraw is inexpensive and a resolution jump is distracting.
 */
export function createRasterMotion({
  schedulePaint,
  getCamera,
  getRenderer,
  getAdaptiveResolution = () => true,
  devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  settleDelay = 100,
}) {
  let moving = false;
  let settleTimer = null;
  const pixelRatio = () => {
    const ratio = devicePixelRatio();
    if (getRenderer() === "webgpu" || !getAdaptiveResolution()) return ratio;
    return canvasPixelRatioForCamera({ camera: getCamera(), moving, devicePixelRatio: ratio });
  };

  return {
    begin() {
      if (settleTimer !== null) clearTimer(settleTimer);
      settleTimer = null;
      if (moving) return;
      moving = true;
      schedulePaint();
    },

    end() {
      if (settleTimer !== null) clearTimer(settleTimer);
      // D3's zoom end already debounces a wheel gesture. This short extra
      // delay avoids resizing the backing bitmap between pointer updates.
      settleTimer = setTimer(() => {
        settleTimer = null;
        if (!moving) return;
        const previousRatio = pixelRatio();
        moving = false;
        if (pixelRatio() !== previousRatio) schedulePaint();
      }, settleDelay);
    },

    pixelRatio,

    dispose() {
      if (settleTimer !== null) clearTimer(settleTimer);
      settleTimer = null;
      moving = false;
    },
  };
}
