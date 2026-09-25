import test from "node:test";
import assert from "node:assert/strict";

test("link layout anchors reverse genes on their displayed left edge", async () => {
  const { getLinkAnchors, getLinkLabelPosition } = await import(
    "../src/links/layout.mjs"
  );
  const genes = new Map([
    ["query", { uid: "query", clusterUid: "top", start: 10, end: 20, strand: 0 }],
    ["target", { uid: "target", clusterUid: "bottom", start: 30, end: 40, strand: 1 }],
  ]);
  const anchors = getLinkAnchors(
    { query: { uid: "query" }, target: { uid: "target" } },
    {
      geneForUid: (uid) => genes.get(uid),
      areClustersAdjacent: () => true,
      scaleX: (value) => value,
      horizontalOffset: () => 5,
      verticalPosition: (gene) => (gene.clusterUid === "top" ? 10 : 40),
      geneMidpoint: 2,
    }
  );

  assert.deepEqual(anchors, [25, 15, 12, 35, 45, 42]);
  assert.deepEqual(getLinkLabelPosition(anchors, 0.5), { x: 30, y: 27 });
});

test("link layout produces paths for ribbons and lines", async () => {
  const { getLinkPath } = await import("../src/links/layout.mjs");
  const anchors = [10, 20, 5, 30, 40, 25];

  assert.equal(
    getLinkPath(anchors, { asLine: false, straight: true }),
    "M10,5 L20,5 L40,25 L30,25 L10,5"
  );
  assert.equal(
    getLinkPath(anchors, { asLine: false, straight: false }),
    "M20,5C20,15,40,15,40,25L30,25C30,15,10,15,10,5L20,5"
  );
  assert.equal(
    getLinkPath(anchors, { asLine: true, straight: true }),
    "M15,5 L35,25"
  );
  assert.equal(
    getLinkPath(anchors, { asLine: true, straight: false }),
    "M15,5C15,15,35,15,35,25"
  );
});
