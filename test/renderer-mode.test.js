import test from "node:test";
import assert from "node:assert/strict";
import {
  isCanvasRenderer,
  isRasterRenderer,
  isWebGpuRenderer,
} from "../src/rendererMode.mjs";

test("renderer modes classify retained raster backends", () => {
  assert.equal(isCanvasRenderer("canvas"), true);
  assert.equal(isWebGpuRenderer("webgpu"), true);
  assert.equal(isRasterRenderer("canvas"), true);
  assert.equal(isRasterRenderer("webgpu"), true);
  assert.equal(isRasterRenderer("svg"), false);
});
