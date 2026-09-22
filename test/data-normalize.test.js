const test = require("node:test");
const assert = require("node:assert/strict");

test("cluster normalization initializes display fields and relationships", async () => {
  const { initializeClusterData } = await import("../src/data/normalize.mjs");
  const cluster = {
    uid: "cluster-a",
    loci: [
      {
        uid: "locus-a",
        start: 0,
        end: 100,
        genes: [{ uid: "gene-a", start: 0, end: 20, strand: 0 }],
      },
    ],
  };

  initializeClusterData(cluster);

  const [locus] = cluster.loci;
  const [gene] = locus.genes;
  assert.deepEqual(
    {
      offset: locus._offset,
      cluster: locus._cluster,
    },
    {
      offset: 0,
      cluster: "cluster-a",
    }
  );
  assert.deepEqual(
    {
      locus: gene._locus,
      cluster: gene._cluster,
    },
    { locus: "locus-a", cluster: "cluster-a" }
  );
});

test("cluster normalization preserves existing display state", async () => {
  const { initializeClusterData } = await import("../src/data/normalize.mjs");
  const cluster = {
    uid: "cluster-a",
    loci: [
      {
        uid: "locus-a",
        start: 0,
        end: 100,
        genes: [
          {
            uid: "gene-a",
            start: 0,
            end: 20,
            strand: 1,
            _strand: 0,
          },
        ],
      },
    ],
  };

  initializeClusterData(cluster);

  assert.equal(cluster.loci[0].genes[0]._strand, 0);
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
