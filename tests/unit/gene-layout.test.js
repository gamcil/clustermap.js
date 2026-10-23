import test from "node:test";
import assert from "node:assert/strict";

const shape = { bodyHeight: 12, tipHeight: 5, tipLength: 12 };

test("gene layout draws forward and reverse arrow polygons", async () => {
  const { getGenePolygonCoordinates } = await import("../../src/genes/layout.mjs");
  const options = { scaleX: (value) => value / 10, shape };

  assert.equal(
    getGenePolygonCoordinates({ start: 0, end: 200, strand: 1 }, options).join(" "),
    "0 5 8 5 8 0 20 11 8 22 8 17 0 17"
  );
  assert.equal(
    getGenePolygonCoordinates({ start: 0, end: 50, strand: 0 }, options).join(" "),
    "5 5 5 5 5 0 0 11 5 22 5 17 5 17"
  );
});

test("gene layout derives label position and rotation from label config", async () => {
  const { getGeneLabelLayout } = await import(
    "../../src/genes/layout.mjs"
  );
  const label = getGeneLabelLayout(
    { start: 100, end: 200 },
    {
      scaleX: (value) => value / 10,
      shape,
      label: {
        start: 0.5,
        position: "bottom",
        spacing: 3,
        anchor: "end",
        rotation: 25,
      },
    }
  );

  assert.deepEqual(label, { x: 15, y: 25, rotation: 25 });
});
