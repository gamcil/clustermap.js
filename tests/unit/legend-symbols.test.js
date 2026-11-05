import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChartData } from "../../src/data/normalize.mjs";
import { createChartIndex } from "../../src/data/index.mjs";
import { createChartRuntime } from "../../src/chart/runtime.js";
import { createChartState } from "../../src/chart/state.mjs";
import { containsRegion } from "../../src/scene/hitTest.mjs";
import { legendContentBounds } from "../../src/annotations/model.mjs";
import { renderCanvas, hitTestCanvas } from "../../src/renderers/canvas.js";

function fixture(symbol) {
  const data = normalizeChartData({ clusters: [{ uid: "a", name: "A", loci: [{ uid: "l", start: 0, end: 100,
    genes: [{ uid: "g", start: 10, end: 80, strand: 1 }] }] }], links: [],
    groups: [{ uid: "group", label: "Group", subtitle: "Subtitle", genes: ["g"], colour: "#123456" }] });
  const runtime = createChartRuntime();
  runtime.configure({ legend: { symbol }, scaleBar: { show: false }, colourBar: { show: false } });
  runtime.setChartIndex(createChartIndex(data)); runtime.setChartState(createChartState(data));
  const scene = runtime.updateScene(data), calls = [];
  const context = new Proxy({ measureText: (text) => ({ width: String(text).length * 6 }) }, {
    get: (target, key) => key in target ? target[key] : (...args) => calls.push([key, ...args]),
  });
  const canvas = { width: 0, height: 0, getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 2000, height: 1000 }) };
  return { runtime, scene, calls, canvas };
}

for (const shape of ["circle", "square", "arrow"]) test(`${shape} legend symbols share bounds, paint geometry and exact hit regions`, () => {
  const { runtime, scene, calls, canvas } = fixture(shape), legend = scene.chrome.legend;
  const symbol = legend.symbol, item = legend.items[0], box = symbol.bounds;
  assert.equal(symbol.type, shape === "circle" ? "circle" : "polygon");
  if (symbol.points) assert.equal(symbol.points.length, shape === "arrow" ? 14 : 8);
  const centerY = (box.minY + box.maxY) / 2;
  const point = shape === "square" ? { x: box.maxX * 0.9, y: box.maxY - 0.1 }
    : shape === "arrow" ? { x: box.minX * 0.95, y: centerY } : { x: 0, y: centerY };
  assert.ok(containsRegion(symbol, point));
  assert.equal(containsRegion(symbol, { x: box.minX - 1, y: centerY }), false);
  if (shape === "arrow") assert.equal(containsRegion(symbol, { x: box.maxX - 0.1, y: box.minY + 0.1 }), false);
  const bounds = legendContentBounds(legend);
  assert.ok(bounds.minX <= item.x + box.minX && bounds.minY <= item.y + box.minY);
  assert.ok(bounds.maxY >= item.y + box.maxY && bounds.maxX >= item.x + box.maxX);
  assert.ok(item.textX > box.maxX);
  renderCanvas({ canvas, scene, layers: ["chrome"], camera: { x: 0, y: 0, k: 1 }, config: runtime.renderConfig, scales: runtime.scales });
  assert.equal(calls.some(([method]) => method === "arc"), shape === "circle");
  if (symbol.points) {
    assert.deepEqual(calls.find(([method]) => method === "moveTo"), ["moveTo", ...symbol.points.slice(0, 2)]);
    assert.equal(calls.filter(([method]) => method === "lineTo").length, symbol.points.length / 2 - 1);
  }
  const hit = hitTestCanvas({ canvas, scene, camera: { x: 0, y: 0, k: 1 }, config: runtime.renderConfig,
    event: { clientX: legend.position.x + item.x + point.x, clientY: legend.position.y + item.y + point.y } });
  assert.equal(hit.action, "legend-colour"); assert.equal(hit.group.uid, "group");
});

test("legend symbol configuration rejects unsupported shapes without changing the scene", () => {
  const { runtime } = fixture("circle"), before = runtime.config;
  assert.throws(() => runtime.configure({ legend: { symbol: "triangle" } }), /legend.symbol/);
  assert.deepEqual(runtime.config, before);
});
