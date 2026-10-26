import test from "node:test";
import assert from "node:assert/strict";
import { createSpatialIndex } from "../../src/scene/spatialIndex.mjs";
import { sceneRecordsInViewport } from "../../src/scene/viewport.mjs";

test("fully visible biological geometry skips queries even when decorations are offscreen", () => {
  const scene = {
    bounds: { minX: 0, maxX: 120, minY: 0, maxY: 30 },
    figureBounds: { minX: -100, maxX: 1000, minY: -100, maxY: 5000 },
    index: new Proxy({}, {
      get() { throw new Error("fully visible geometry must not query an index"); },
    }),
  };
  assert.equal(sceneRecordsInViewport(scene, { ...scene.bounds }), null);
});

test("partially visible biological geometry still culls in painter order", () => {
  const left = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
  const right = { minX: 110, maxX: 120, minY: 0, maxY: 10 };
  const crossing = { minX: 5, maxX: 115, minY: 5, maxY: 25 };
  const scene = {
    bounds: { minX: 0, maxX: 120, minY: 0, maxY: 30 },
    figureBounds: { minX: -100, maxX: 1000, minY: -100, maxY: 5000 },
    index: {
      links: createSpatialIndex([["crossing", crossing]]),
      loci: createSpatialIndex([["left-locus", left], ["right-locus", right]]),
      genes: createSpatialIndex([["left-gene", left], ["right-gene", right], ["front-gene", left]]),
    },
  };
  const viewport = { minX: 0, maxX: 40, minY: 0, maxY: 30 };
  assert.deepEqual(sceneRecordsInViewport(scene, viewport), {
    links: ["crossing"], loci: ["left-locus"], genes: ["left-gene", "front-gene"],
  });
  assert.deepEqual(sceneRecordsInViewport(scene, viewport, { links: false, loci: false }), {
    links: null, loci: null, genes: ["left-gene", "front-gene"],
  });
  assert.deepEqual(sceneRecordsInViewport(scene, { minX: 200, maxX: 300, minY: 0, maxY: 30 }), {
    links: [], loci: [], genes: [],
  });
});
