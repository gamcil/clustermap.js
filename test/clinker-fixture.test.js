const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

async function assertCanonicalFixture(filename, expected) {
  const data = JSON.parse(
    await readFile(join(__dirname, "..", "fixtures", filename))
  );
  const genes = new Set(
    data.clusters.flatMap((cluster) =>
      cluster.loci.flatMap((locus) => {
        assert.equal(locus.start, 0);
        assert.ok(locus.end > locus.start);
        return locus.genes.map((gene) => {
          assert.ok(gene.start >= locus.start);
          assert.ok(gene.end <= locus.end);
          return gene.uid;
        });
      })
    )
  );

  assert.equal(data.schemaVersion, 1);
  assert.equal(data.coordinateSystem, "locus-relative");
  assert.equal(data.config.updateGroups, false);
  assert.equal(data.clusters.length, expected.clusters);
  assert.equal(genes.size, expected.genes);
  assert.equal(data.links.length, expected.links);
  assert.equal(data.groups.length, expected.groups);
  for (const link of data.links) {
    assert.ok(genes.has(link.query.uid));
    assert.ok(genes.has(link.target.uid));
  }
  for (const group of data.groups) {
    for (const geneUid of group.genes) assert.ok(genes.has(geneUid));
  }
}

test("mcaA fixture is canonical locus-relative clustermap data", async () => {
  await assertCanonicalFixture("mcaa-neighbourhoods-173.json", {
    clusters: 173,
    genes: 7511,
    links: 11489,
    groups: 1200,
  });
});

test("PKS fixture is canonical locus-relative clustermap data", async () => {
  await assertCanonicalFixture("pks-regions-142.json", {
    clusters: 142,
    genes: 7359,
    links: 112320,
    groups: 726,
  });
});
