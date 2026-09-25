import test from "node:test";
import assert from "node:assert/strict";
import {
  isCanvasRenderer,
  isRendererMode,
  isRasterRenderer,
  isWebGpuRenderer,
} from "../src/rendererMode.mjs";

test("renderer modes classify retained raster backends", () => {
  assert.equal(isRendererMode("svg"), true);
  assert.equal(isRendererMode("canvas"), true);
  assert.equal(isRendererMode("webgpu"), true);
  assert.equal(isRendererMode("webgl"), false);
  assert.equal(isCanvasRenderer("canvas"), true);
  assert.equal(isWebGpuRenderer("webgpu"), true);
  assert.equal(isRasterRenderer("canvas"), true);
  assert.equal(isRasterRenderer("webgpu"), true);
  assert.equal(isRasterRenderer("svg"), false);
});
