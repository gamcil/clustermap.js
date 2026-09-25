import test from "node:test";
import assert from "node:assert/strict";

const data = {
  clusters: [{
    uid: "cluster-1",
    loci: [{
      uid: "locus-1",
      start: 0,
      end: 100,
      genes: [{ uid: "gene-1", start: 0, end: 50, strand: 1 }],
    }],
  }],
  links: [],
  groups: [{ uid: "group-1", label: "Old label", genes: ["gene-1"], colour: "#000000" }],
};

test("chart operations update selected genes and groups atomically", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  const result = applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "genes.update", ids: ["gene-1"], changes: { label: "Core enzyme", colour: "#ff0000" } },
    { type: "groups.update", ids: ["group-1"], changes: { label: "Core group", hidden: true } },
    { type: "loci.update", ids: ["locus-1"], changes: { name: "Neighbourhood" } },
    { type: "clusters.update", ids: ["cluster-1"], changes: { label: "Reference genome" } },
  ]);

  assert.equal(chartData.clusters[0].loci[0].genes[0].label, "Core enzyme");
  assert.equal(chartData.groups[0].label, "Core group");
  assert.equal(chartData.groups[0].hidden, true);
  assert.equal(chartData.clusters[0].loci[0].name, "Neighbourhood");
  assert.equal(chartData.clusters[0].label, "Reference genome");
  assert.deepEqual(result.operations.map(({ type }) => type), ["genes.update", "groups.update", "loci.update", "clusters.update"]);
});

test("chart operations reject an invalid batch without partial changes", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "groups.update", ids: ["group-1"], changes: { label: "Would change" } },
    { type: "genes.update", ids: ["missing"], changes: { label: "Invalid" } },
  ]), /unknown ID missing/);
  assert.equal(chartData.groups[0].label, "Old label");
});

test("structural group operations preserve exclusive gene membership", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  applyChartOperations(chartData, createChartIndex(chartData), [
    {
      type: "groups.create",
      group: { uid: "group-2", label: "New group" },
      geneIds: ["gene-1"],
    },
    { type: "groups.unassignGenes", geneIds: ["gene-1"] },
    { type: "groups.assignGenes", groupId: "group-1", geneIds: ["gene-1"] },
  ]);

  assert.deepEqual(chartData.groups.map((group) => [group.uid, group.genes]), [
    ["group-1", ["gene-1"]],
    ["group-2", []],
  ]);
  assert.equal(chartData.config.updateGroups, false);

  applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "groups.merge", targetId: "group-1", sourceIds: ["group-2"] },
    { type: "groups.delete", ids: ["group-1"] },
  ]);
  assert.deepEqual(chartData.groups, []);
});

test("structural group batches reject unknown genes without mutation", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "groups.create", group: { uid: "new-group", label: "New" }, geneIds: ["gene-1"] },
    { type: "groups.assignGenes", groupId: "new-group", geneIds: ["missing"] },
  ]), /unknown gene missing/);
  assert.deepEqual(chartData.groups.map((group) => group.uid), ["group-1"]);
});

test("groups can be created without assigning genes", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "groups.create",
    group: { uid: "empty-group", label: "Empty group" },
    geneIds: [],
  }]);

  assert.deepEqual(chartData.groups.at(-1), {
    uid: "empty-group",
    label: "Empty group",
    genes: [],
  });
});

test("deleting a gene preserves its link records", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const { filterLinks } = await import("../src/links/groups.mjs");
  const raw = structuredClone(data);
  raw.clusters[0].loci[0].genes.push({ uid: "gene-2", start: 60, end: 90, strand: 1 });
  raw.links = [{
    uid: "link-1",
    query: { uid: "gene-1" },
    target: { uid: "gene-2" },
    identity: 0.9,
  }];
  const chartData = normalizeChartData(raw);

  applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "genes.delete",
    ids: ["gene-1"],
  }]);

  assert.deepEqual(chartData.clusters[0].loci[0].genes.map((gene) => gene.uid), ["gene-2"]);
  assert.equal(chartData.links.length, 1, "the relationship remains in editable data");
  const index = createChartIndex(chartData);
  assert.deepEqual(filterLinks(chartData.links, {
    groupForGene: () => "group-1",
    geneForUid: (uid) => index.geneById.get(uid),
    bestOnly: false,
    threshold: 0,
  }), [], "a dangling relationship is omitted from rendering");
});

test("link operations change or remove relationships without touching genes", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const raw = structuredClone(data);
  raw.clusters[0].loci[0].genes.push({ uid: "gene-2", start: 60, end: 90, strand: 1 });
  raw.links = [{
    uid: "link-1",
    query: { uid: "gene-1" },
    target: { uid: "gene-2" },
    identity: 0.9,
  }];
  const chartData = normalizeChartData(raw);

  applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "links.update",
    ids: ["link-1"],
    changes: { label: "Ortholog", colour: "#123456", hidden: true, identity: 0.75 },
  }]);
  assert.deepEqual(chartData.links[0], {
    uid: "link-1",
    query: { uid: "gene-1" },
    target: { uid: "gene-2" },
    identity: 0.75,
    label: "Ortholog",
    colour: "#123456",
    hidden: true,
  });

  applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "links.delete",
    ids: ["link-1"],
  }]);
  assert.deepEqual(chartData.links, []);
  assert.equal(chartData.clusters[0].loci[0].genes.length, 2);
});

test("link identity rejects values outside the normalized percentage range", async () => {
  const { createChartIndex } = await import("../src/data/index.mjs");
  const { normalizeChartData } = await import("../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../src/data/operations.mjs");
  const raw = structuredClone(data);
  raw.clusters[0].loci[0].genes.push({ uid: "gene-2", start: 60, end: 90, strand: 1 });
  raw.links = [{ uid: "link-1", query: { uid: "gene-1" }, target: { uid: "gene-2" }, identity: 0.9 }];
  const chartData = normalizeChartData(raw);
  assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "links.update",
    ids: ["link-1"],
    changes: { identity: 1.01 },
  }]), /identity must be a number from 0 to 1/);
  assert.equal(chartData.links[0].identity, 0.9);
});
