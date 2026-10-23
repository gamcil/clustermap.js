import test from "node:test";
import assert from "node:assert/strict";

test("spatial index finds viewport overlaps and point candidates by extent", async () => {
  const {
    createSpatialIndex,
    patchSpatialIndex,
    queryPoint,
    queryPointOrdered,
    queryViewport,
    queryViewportOrdered,
  } = await import("../../src/scene/spatialIndex.mjs");
  const index = createSpatialIndex(
    [
      ["left", { minX: 0, maxX: 10, minY: 0, maxY: 10 }],
      ["right", { minX: 110, maxX: 120, minY: 0, maxY: 10 }],
      // Its centre lies outside the viewport, but its extent overlaps it.
      ["wide-link", { minX: 20, maxX: 220, minY: 20, maxY: 30 }],
      ["front", { minX: 0, maxX: 10, minY: 0, maxY: 10 }],
    ],
    { cellWidth: 50, cellHeight: 20 }
  );

  assert.deepEqual(
    queryViewport(index, { minX: 0, maxX: 40, minY: 0, maxY: 40 }),
    new Set(["left", "wide-link", "front"])
  );
  assert.deepEqual(queryPoint(index, { x: 115, y: 5 }), new Set(["right"]));
  assert.deepEqual(queryPoint(index, { x: 25, y: 25 }), new Set(["wide-link"]));
  assert.deepEqual(queryPointOrdered(index, { x: 5, y: 5 }), ["left", "front"]);
  assert.deepEqual(
    queryViewportOrdered(index, { minX: 0, maxX: 230, minY: 0, maxY: 40 }),
    ["left", "right", "wide-link", "front"]
  );
  const patched = patchSpatialIndex(index, [
    ["right", { minX: 30, maxX: 40, minY: 0, maxY: 10 }],
    ["wide-link", null],
  ]);
  assert.deepEqual(queryPoint(patched, { x: 115, y: 5 }), new Set());
  assert.deepEqual(queryPoint(patched, { x: 35, y: 5 }), new Set(["right"]));
  assert.deepEqual(
    queryViewportOrdered(patched, { minX: 0, maxX: 230, minY: 0, maxY: 40 }),
    ["left", "right", "front"]
  );
  assert.deepEqual(queryPoint(index, { x: 115, y: 5 }), new Set(["right"]));
});

test("broad viewport scans exact bounds while preserving patched painter order", async () => {
  const { createSpatialIndex, patchSpatialIndex, queryViewport, queryViewportOrdered } = await import("../../src/scene/spatialIndex.mjs");
  const box = (x) => ({ minX: x, maxX: x + 10, minY: -10, maxY: 10 });
  let index = createSpatialIndex([["a", box(-100)], ["b", box(0)], ["c", box(100)], ["outside", box(100000)]]);
  index = patchSpatialIndex(index, [["b", null]]);
  index = patchSpatialIndex(index, [["b", box(0)]]);
  index.cells = { get: () => { throw new Error("broad viewport must bypass the grid"); } };
  const viewport = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
  assert.deepEqual(queryViewport(index, viewport), new Set(["a", "b", "c"]));
  assert.deepEqual(queryViewportOrdered(index, viewport), ["a", "b", "c"]);
  const empty = createSpatialIndex([]);
  assert.deepEqual(queryViewport(empty, viewport), new Set());
});

test("small viewports retain grid lookup and agree with broad scans at boundaries", async () => {
  const { createSpatialIndex, queryViewport } = await import("../../src/scene/spatialIndex.mjs");
  const entries = Array.from({ length: 50 }, (_, i) => [i, { minX: i * 20 - 200, maxX: i * 20 - 190, minY: -10, maxY: 10 }]);
  const index = createSpatialIndex(entries, { cellWidth: 10, cellHeight: 10 });
  const cells = index.cells; let lookups = 0;
  index.cells = { get: (key) => { lookups++; return cells.get(key); } };
  const viewport = { minX: -200, maxX: -190, minY: -10, maxY: 10 };
  assert.deepEqual(queryViewport(index, viewport), new Set([0]));
  assert.ok(lookups > 0);
  for (const viewport of [
    { minX: -200, maxX: 0, minY: -500, maxY: 500 },
    { minX: 0, maxX: 0, minY: 10, maxY: 10 },
    { minX: -10000, maxX: 10000, minY: -10000, maxY: 10000 },
  ]) {
    const expected = entries.filter(([, b]) => b.minX <= viewport.maxX && b.maxX >= viewport.minX && b.minY <= viewport.maxY && b.maxY >= viewport.minY).map(([id]) => id);
    assert.deepEqual(queryViewport(index, viewport), new Set(expected));
  }
});
