const test = require("node:test");
const assert = require("node:assert/strict");

test("chart normalization establishes explicit hierarchy relationships", async () => {
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const data = {
    clusters: [
      {
        uid: "cluster-a",
        loci: [
          {
            uid: "locus-a",
            _cluster: "legacy-cluster",
            start: 0,
            end: 100,
            genes: [
              {
                uid: "gene-a",
                _locus: "legacy-locus",
                _cluster: "legacy-cluster",
                start: 0,
                end: 20,
                strand: 1,
              },
            ],
          },
        ],
      },
    ],
    links: [],
  };

  const normalized = normalizeChartData(data);
  const locus = normalized.clusters[0].loci[0];
  const gene = locus.genes[0];

  assert.equal(locus.clusterUid, "cluster-a");
  assert.equal(gene.locusUid, "locus-a");
  assert.equal(gene.clusterUid, "cluster-a");
  assert.equal(locus._cluster, undefined);
  assert.equal(gene._locus, undefined);
  assert.equal(gene._cluster, undefined);
  assert.equal(data.clusters[0].loci[0]._cluster, "legacy-cluster");
});

test("chart normalization preserves source data and records biological coordinates", async () => {
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const data = {
    clusters: [
      {
        uid: "cluster-a",
        loci: [
          {
            uid: "locus-a",
            start: 500,
            end: 700,
            genes: [{ uid: "gene-a", start: 550, end: 600, strand: 1 }],
          },
        ],
      },
    ],
    links: [],
  };

  const normalized = normalizeChartData(data);
  const locus = normalized.clusters[0].loci[0];
  const gene = locus.genes[0];

  assert.notEqual(normalized, data);
  assert.notEqual(locus, data.clusters[0].loci[0]);
  assert.notEqual(gene, data.clusters[0].loci[0].genes[0]);
  assert.deepEqual(locus.bio, { start: 500, end: 700 });
  assert.deepEqual(gene.bio, { start: 550, end: 600, strand: 1 });
  assert.equal(data.clusters[0].loci[0].bio, undefined);
  assert.equal(data.clusters[0].loci[0].genes[0].bio, undefined);
});
