const test = require("node:test");
const assert = require("node:assert/strict");

test("locus layout calculates ranges and extents from supplied scales", async () => {
  const { getClusterExtent, getLocusScaleValues, xDistance } = await import(
    "../src/loci/layout.mjs"
  );
  const cluster = {
    uid: "cluster-a",
    loci: [
      { uid: "locus-a", start: 0, end: 100 },
      { uid: "locus-b", start: 0, end: 50 },
    ],
  };
  const layout = {
    scaleX: (value) => value / 10,
    clusterOffset: () => 5,
    locusOffset: (uid) => (uid === "locus-a" ? 1 : 0),
    spacing: 4,
  };

  assert.equal(xDistance(layout.scaleX, 20, 70), 5);
  assert.deepEqual(getClusterExtent(cluster, layout), [5, 16]);
  assert.deepEqual(getLocusScaleValues([cluster], layout), {
    domain: ["locus-a", "locus-b"],
    range: [2, 16],
  });
});
