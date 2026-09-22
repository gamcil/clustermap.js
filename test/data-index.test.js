const test = require("node:test");
const assert = require("node:assert/strict");

test("chart index maps hierarchy and links by stable identifiers", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const geneA = { uid: "gene-a", start: 0, end: 10, strand: 1 };
  const geneB = { uid: "gene-b", start: 20, end: 30, strand: 0 };
  const link = {
    uid: "link-a-b",
    query: { uid: "gene-a" },
    target: { uid: "gene-b" },
  };
  const data = {
    clusters: [
      {
        uid: "cluster-a",
        loci: [{ uid: "locus-a", start: 0, end: 100, genes: [geneA, geneB] }],
      },
    ],
    links: [link],
  };

  const index = createChartIndex(data);

  assert.equal(index.clusterById.get("cluster-a"), data.clusters[0]);
  assert.equal(index.locusById.get("locus-a"), data.clusters[0].loci[0]);
  assert.equal(index.geneById.get("gene-b"), geneB);
  assert.equal(index.linkById.get("link-a-b"), link);
  assert.deepEqual(index.linksByGeneId.get("gene-a"), [link]);
  assert.deepEqual(index.linksByGeneId.get("gene-b"), [link]);
  assert.equal(geneA._locus, "locus-a");
  assert.equal(geneB._cluster, "cluster-a");
});
