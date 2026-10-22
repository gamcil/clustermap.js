import { worldViewport } from "../scene/camera.mjs";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Project the complete chart bounds into a fixed-size screen-space minimap. */
export function createMinimapProjection({ bounds, width, height, padding = 4 }) {
  if (!bounds || !width || !height) return null;
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
  const frame = {
    x: (width - worldWidth * scale) / 2,
    y: (height - worldHeight * scale) / 2,
    width: worldWidth * scale,
    height: worldHeight * scale,
  };
  return {
    bounds,
    width,
    height,
    scale,
    frame,
    x: frame.x - bounds.minX * scale,
    y: frame.y - bounds.minY * scale,
  };
}

/** Return the main viewport rectangle in minimap screen coordinates. */
export function minimapViewport(projection, camera, viewport) {
  if (!projection || !camera || !viewport) return null;
  const { minX, maxX, minY, maxY } = worldViewport(camera, viewport, 0);
  const { scale, x, y, frame } = projection;
  const left = clamp(x + minX * scale, frame.x, frame.x + frame.width);
  const right = clamp(x + maxX * scale, frame.x, frame.x + frame.width);
  const top = clamp(y + minY * scale, frame.y, frame.y + frame.height);
  const bottom = clamp(y + maxY * scale, frame.y, frame.y + frame.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Centre the existing camera scale on a point selected in the minimap. */
export function cameraForMinimapPoint(projection, point, viewport, camera) {
  const worldX = clamp(
    (point.x - projection.x) / projection.scale,
    projection.bounds.minX,
    projection.bounds.maxX
  );
  const worldY = clamp(
    (point.y - projection.y) / projection.scale,
    projection.bounds.minY,
    projection.bounds.maxY
  );
  return {
    ...camera,
    x: viewport.width / 2 - worldX * camera.k,
    y: viewport.height / 2 - worldY * camera.k,
  };
}

/** Composite a cached overview raster with the live main-camera viewport. */
function renderCanvasMinimap({
  canvas,
  baseCanvas = null,
  projection,
  camera,
  viewport,
  pixelRatio = globalThis.devicePixelRatio || 1,
}) {
  if (!projection) return null;
  const { width, height, frame } = projection;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  if (baseCanvas) context.drawImage(baseCanvas, 0, 0, width, height);
  else {
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
  }
  context.strokeStyle = "rgba(0, 0, 0, 0.55)";
  context.lineWidth = 1;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);
  const visible = minimapViewport(projection, camera, viewport);
  if (visible) {
    context.fillStyle = "rgba(30, 120, 255, 0.16)";
    context.fillRect(visible.x, visible.y, visible.width, visible.height);
    context.strokeStyle = "rgb(30, 120, 255)";
    context.strokeRect(visible.x, visible.y, visible.width, visible.height);
  }
  return { width, height, pixelRatio, viewport: visible };
}

/** Retain the overview bitmap and its projection independently of the main renderer. */
export function createRasterMinimap({
  requestFrame = globalThis.requestAnimationFrame,
  cancelFrame = globalThis.cancelAnimationFrame,
  createCanvas = () => document.createElement("canvas"),
} = {}) {
  let baseCanvas = null;
  let projection = null;
  let baseFrame = null;
  let gesture = false;
  let binding = null;

  const cameraForPointer = ({ event, minimap, surface, camera }) => {
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
      baseFrame = projection = null;
      gesture = false;
      binding?.on(".minimap", null); binding = null;
    },

    paint({ minimap, surface, camera, pixelRatio }) {
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
      const nextProjection = createMinimapProjection({ bounds: scene.figureBounds || scene.bounds,
        width: options.width, height: options.height });
      if (baseFrame !== null) cancelFrame(baseFrame);
      baseFrame = requestFrame(() => {
        baseFrame = null;
        if (!nextProjection || !minimap.isConnected) return;
        if (!baseCanvas) baseCanvas = createCanvas();
        renderBase({ canvas: baseCanvas, scene, projection: nextProjection });
        projection = nextProjection;
        onPaint();
      });
    },

    cameraForPointer,

    bind(selection, {
      getSurface,
      getCamera,
      moveCamera,
      beginMotion,
      endMotion,
      setCursor,
    }) {
      if (binding?.node() === selection.node()) return;
      binding?.on(".minimap", null); binding = selection;
      gesture = false;
      const move = (minimap, event) => {
        const camera = cameraForPointer({
          event,
          minimap,
          surface: getSurface(),
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
