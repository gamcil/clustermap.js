const test = require("node:test");
const assert = require("node:assert/strict");

test("raster minimap retains an overview and maps pointer movement to the shared camera", async () => {
  const { createRasterMinimap } = await import("../src/rasterMinimap.mjs");
  let frame = null;
  const calls = [];
  const context = new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      return (...args) => calls.push([property, ...args]);
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
  const overview = {
    width: 0,
    height: 0,
    isConnected: true,
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 80 }),
  };
  const surface = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
  };
  const scene = {
    bounds: { minX: 0, maxX: 200, minY: 0, maxY: 100 },
    figureBounds: { minX: -20, maxX: 220, minY: 0, maxY: 120 },
  };
  const minimap = createRasterMinimap({
    requestFrame: (callback) => {
      frame = callback;
      return 1;
    },
    cancelFrame: () => {
      frame = null;
    },
    createCanvas: () => ({ width: 0, height: 0 }),
  });
  let rendered = null;
  let painted = 0;
  minimap.scheduleBase({
    scene,
    minimap: overview,
    options: { width: 100, height: 80 },
    renderBase: (value) => {
      rendered = value;
    },
    onPaint: () => {
      painted += 1;
    },
  });
  assert.ok(frame, "overview drawing is deferred to an animation frame");
  frame();
  assert.equal(rendered.scene, scene);
  assert.equal(rendered.projection.width, 100);
  assert.equal(painted, 1);

  const result = minimap.paint({
    minimap: overview,
    surface,
    scene,
    options: { width: 100, height: 80 },
    camera: { x: 0, y: 0, k: 1 },
    pixelRatio: 1,
  });
  assert.equal(result.width, 100);
  assert.ok(calls.some(([name]) => name === "drawImage"));

  const camera = minimap.cameraForPointer({
    event: { clientX: 60, clientY: 60 },
    minimap: overview,
    surface,
    scene,
    options: { width: 100, height: 80 },
    camera: { x: 0, y: 0, k: 1 },
  });
  assert.ok(Math.abs(camera.x - 100) < 1e-9);
  assert.equal(camera.y, 90);
  assert.equal(camera.k, 1);

  const handlers = new Map();
  const selection = {
    on(name, handler) {
      handlers.set(name, handler);
      return this;
    },
  };
  const pointer = {
    getBoundingClientRect: overview.getBoundingClientRect,
    captured: false,
    setPointerCapture() { this.captured = true; },
    hasPointerCapture() { return this.captured; },
    releasePointerCapture() { this.captured = false; },
  };
  const moved = [];
  const cursors = [];
  let started = 0;
  let ended = 0;
  minimap.bind(selection, {
    getSurface: () => surface,
    getScene: () => scene,
    getCamera: () => ({ x: 0, y: 0, k: 1 }),
    options: { width: 100, height: 80 },
    moveCamera: (value) => moved.push(value),
    beginMotion: () => { started += 1; },
    endMotion: () => { ended += 1; },
    setCursor: (_surface, cursor) => cursors.push(cursor),
  });
  const pointerEvent = {
    button: 0,
    pointerId: 1,
    clientX: 60,
    clientY: 60,
    preventDefault() {},
  };
  handlers.get("pointerdown.minimap").call(pointer, pointerEvent);
  handlers.get("pointerup.minimap pointercancel.minimap").call(pointer, pointerEvent);
  assert.equal(started, 1);
  assert.equal(ended, 1);
  assert.equal(moved.length, 1);
  assert.deepEqual(cursors, ["grabbing", "grab"]);
});
