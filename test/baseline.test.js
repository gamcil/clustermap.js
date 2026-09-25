import test from "node:test";
import assert from "node:assert/strict";
import fixture from "../testing.json" with { type: "json" };

function collectEntities(data) {
  const clusters = data.clusters ?? [];
  const loci = clusters.flatMap((cluster) => cluster.loci ?? []);
  const genes = loci.flatMap((locus) => locus.genes ?? []);
  return { clusters, loci, genes };
}

function assertUniqueIds(entities, label) {
  const ids = entities.map((entity) => entity.uid);
  assert.equal(new Set(ids).size, ids.length, `${label} UIDs must be unique`);
  assert.ok(ids.every(Boolean), `${label} must all have UIDs`);
}

test("baseline fixture has a valid cluster-map hierarchy", () => {
  const { clusters, loci, genes } = collectEntities(fixture);

  assert.ok(clusters.length > 0, "fixture must contain clusters");
  assert.ok(loci.length > 0, "fixture must contain loci");
  assert.ok(genes.length > 0, "fixture must contain genes");
  assertUniqueIds(clusters, "cluster");
  assertUniqueIds(loci, "locus");
  assertUniqueIds(genes, "gene");

  for (const locus of loci) {
    assert.ok(Number.isFinite(locus.start));
    assert.ok(Number.isFinite(locus.end));
    assert.ok(locus.end >= locus.start);
  }

  for (const gene of genes) {
    assert.ok(Number.isFinite(gene.start));
    assert.ok(Number.isFinite(gene.end));
    assert.ok(gene.end >= gene.start);
  }
});

test("baseline fixture links and groups refer to known genes", () => {
  const { genes } = collectEntities(fixture);
  const geneIds = new Set(genes.map((gene) => gene.uid));

  assert.ok(Array.isArray(fixture.links));
  for (const link of fixture.links) {
    assert.ok(link.uid, "link must have a UID");
    assert.ok(geneIds.has(link.query.uid), "link query must reference a gene");
    assert.ok(geneIds.has(link.target.uid), "link target must reference a gene");
    assert.ok(Number.isFinite(link.identity), "link identity must be numeric");
  }

  assert.ok(Array.isArray(fixture.groups));
  for (const group of fixture.groups) {
    assert.ok(group.uid != null, "group must have a UID");
    for (const geneId of group.genes) {
      assert.ok(geneIds.has(geneId), "group must reference a gene");
    }
  }
});
