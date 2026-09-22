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
      start: locus._start,
      end: locus._end,
      offset: locus._offset,
      cluster: locus._cluster,
      flipped: locus._flipped,
      trimLeft: locus._trimLeft,
      trimRight: locus._trimRight,
    },
    {
      start: 0,
      end: 100,
      offset: 0,
      cluster: "cluster-a",
      flipped: false,
      trimLeft: null,
      trimRight: null,
    }
  );
  assert.deepEqual(
    {
      locus: gene._locus,
      cluster: gene._cluster,
      start: gene._start,
      end: gene._end,
      strand: gene._strand,
    },
    { locus: "locus-a", cluster: "cluster-a", start: 0, end: 20, strand: 0 }
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
        _start: 25,
        _flipped: true,
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

  assert.equal(cluster.loci[0]._start, 25);
  assert.equal(cluster.loci[0]._flipped, true);
  assert.equal(cluster.loci[0].genes[0]._strand, 0);
});
