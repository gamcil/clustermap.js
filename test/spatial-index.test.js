const test = require("node:test");
const assert = require("node:assert/strict");

test("spatial index finds viewport overlaps and point candidates by extent", async () => {
  const {
    createSpatialIndex,
    queryPoint,
    queryPointOrdered,
    queryViewport,
    queryViewportOrdered,
  } = await import("../src/spatialIndex.mjs");
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
});
