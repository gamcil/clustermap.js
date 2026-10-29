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

for (const operation of [
  { type: "groups.delete", ids: ["g1"] },
  { type: "groups.delete", ids: ["g1", "g2"] },
  { type: "groups.merge", targetId: "g2", sourceIds: ["g1", "empty"] },
  { type: "groups.assignGenes", groupId: "g2", geneIds: ["b"] },
  { type: "groups.unassignGenes", geneIds: ["b"] },
  { type: "groups.create", group: { uid: "new", label: "New" }, geneIds: ["b"] },
  { type: "groups.create", group: { uid: "new", label: "Empty" } },
]) {
  test(`${operation.type} undo restores deleted members, group order and metadata`, async () => {
    const { createChartIndex } = await import("../../src/data/index.mjs");
    const { normalizeChartData } = await import("../../src/data/normalize.mjs");
    const { applyChartOperations } = await import("../../src/data/operations.mjs");
    const chartData = normalizeChartData({ clusters: [{ uid: "cluster", loci: [{ uid: "locus", start: 0, end: 100,
      genes: ["a", "b", "c"].map((uid, index) => ({ uid, start: index * 20, end: index * 20 + 10, strand: 1 })) }] }],
      links: [], config: { updateGroups: false }, groups: [
        { uid: "g1", genes: ["a", "b"], metadata: { note: "Retain producer metadata" } },
        { uid: "empty", genes: [] }, { uid: "g2", genes: ["c"] }, { uid: 0, genes: ["absent"] },
      ] });
    const apply = (operations) => applyChartOperations(chartData, createChartIndex(chartData), operations);
    apply([{ type: "genes.delete", ids: ["a", "c"] }]);
    const before = structuredClone(chartData);
    const edit = apply([operation]), after = structuredClone(chartData);
    const undo = apply(JSON.parse(JSON.stringify(edit.inverse)));
    assert.deepEqual(chartData, before);
    assert.deepEqual(normalizeChartData(chartData), chartData);
    apply(undo.inverse);
    assert.deepEqual(chartData, after, "restoration is reversible without access to deleted genes");
    apply(edit.inverse);
    assert.deepEqual(chartData, before);
    for (const invalid of [
      { type: "groups.assignGenes", groupId: "g2", geneIds: ["a"] },
      { type: "groups.unassignGenes", geneIds: ["a"] },
      { type: "groups.create", group: { uid: "bad" }, geneIds: ["a"] },
    ]) {
      assert.throws(() => apply([invalid]), /unknown gene a/);
      assert.deepEqual(chartData, before);
    }
  });
}

test("group history restores successive membership edits in a batch", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData({ ...data, config: { updateGroups: false },
    groups: [{ uid: "g1", label: "Original label", genes: ["absent", "gene-1"] }, { uid: "g2", genes: [] }, { uid: "g3", genes: [] }] });
  const before = structuredClone(chartData);
  const apply = (operations) => applyChartOperations(chartData, createChartIndex(chartData), operations);
  const edit = apply([
    { type: "groups.update", ids: ["g1"], changes: { label: "Temporary label" } },
    { type: "groups.assignGenes", groupId: "g2", geneIds: ["gene-1"] },
    { type: "groups.assignGenes", groupId: "g3", geneIds: ["gene-1"] },
    { type: "groups.delete", ids: ["g1", "g2"] },
  ]);
  const after = structuredClone(chartData);
  apply(edit.inverse); assert.deepEqual(chartData, before);
  apply(edit.operations); assert.deepEqual(chartData, after);
});

test("group batches can edit newly created groups and undo through deletion", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData({ ...data, config: { updateGroups: false } }), before = structuredClone(chartData);
  const apply = (operations) => applyChartOperations(chartData, createChartIndex(chartData), operations);
  const edit = apply([
    { type: "groups.create", group: { uid: "new", label: "Original" }, geneIds: ["gene-1"] },
    { type: "groups.update", ids: ["new"], changes: { label: "Changed" } },
    { type: "groups.delete", ids: ["new"] },
  ]);
  const after = structuredClone(chartData);
  apply(edit.inverse); assert.deepEqual(chartData, before);
  apply(edit.operations); assert.deepEqual(chartData, after);
});

test("malformed group restoration rejects the whole batch", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData(data), before = structuredClone(chartData);
  for (const records of [null, [{ index: -1, group: { uid: "g", genes: [] } }],
    [{ index: 0, group: { uid: "g", genes: [{}] } }], [{ index: 0, group: { uid: "g", genes: ["a", "a"] } }]]) {
    assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [
      { type: "groups.update", ids: ["group-1"], changes: { label: "Must not change" } },
      { type: "groups.restore", records, removeIds: [] },
    ]), /groups.restore/);
    assert.deepEqual(chartData, before);
  }
});

test("imports and edits share record field validation and reject batches atomically", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const cases = [
    ["genes", "gene-1", { label: {} }], ["genes", "gene-1", { colour: "not a colour" }],
    ["groups", "group-1", { hidden: "false" }], ["groups", "group-1", { subtitle: 42 }],
    ["clusters", "cluster-1", { name: [] }], ["loci", "locus-1", { label: true }],
    ...["0.5", null, Infinity, -0.1, 1.1].map((identity) => ["links", "link-1", { identity }]),
  ];
  for (const [kind, uid, changes] of cases) {
    const raw = structuredClone(data);
    raw.links = [{ uid: "link-1", query: { uid: "gene-1" }, target: { uid: "gene-1" }, identity: 0.5 }];
    const chartData = normalizeChartData(raw), index = createChartIndex(chartData), before = structuredClone(chartData);
    assert.throws(() => applyChartOperations(chartData, index, [
      { type: "groups.update", ids: ["group-1"], changes: { label: "Must not change" } },
      { type: `${kind}.update`, ids: [uid], changes },
    ]), /Invalid chart operation/);
    assert.deepEqual(chartData, before);
    const record = { genes: index.geneById, groups: index.groupById, clusters: index.clusterById,
      loci: index.locusById, links: index.linkById }[kind].get(uid);
    Object.assign(record, changes);
    assert.throws(() => normalizeChartData(chartData), /Invalid chart data/);
  }
});

test("group creation validates IDs and presentation without coercion", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData(data), before = structuredClone(chartData);
  for (const group of [
    ...[null, "", "  ", false, {}, [], NaN, Infinity].map((uid) => ({ uid })),
    { uid: "new", hidden: 1 }, { uid: "new", label: {} }, { uid: "new", colour: "bad" },
  ]) {
    assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [{ type: "groups.create", group }]), /Invalid chart operation/);
    assert.deepEqual(chartData, before);
    assert.throws(() => normalizeChartData({ ...data, groups: [{ ...group, genes: [] }] }), /Invalid chart data/);
  }
  const edit = applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "groups.create", group: { uid: 0, label: null, colour: null, hidden: false } },
    { type: "genes.update", ids: ["gene-1"], changes: { label: "A label", colour: "rebeccapurple" } },
  ]);
  assert.deepEqual(normalizeChartData(chartData), chartData);
  applyChartOperations(chartData, createChartIndex(chartData), edit.inverse);
  assert.deepEqual(normalizeChartData(chartData), chartData);
  assert.equal(chartData.clusters[0].loci[0].genes[0].label, undefined);
});

test("chart operations update selected genes and groups atomically", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  const result = applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "genes.update", ids: ["gene-1"], changes: { label: "Core enzyme", colour: "#ff0000" } },
    { type: "groups.update", ids: ["group-1"], changes: { label: "Core group", subtitle: "Conserved enzymes", hidden: true } },
    { type: "loci.update", ids: ["locus-1"], changes: { name: "Neighbourhood" } },
    { type: "clusters.update", ids: ["cluster-1"], changes: { label: "Reference genome" } },
  ]);

  assert.equal(chartData.clusters[0].loci[0].genes[0].label, "Core enzyme");
  assert.equal(chartData.groups[0].label, "Core group");
  assert.equal(chartData.groups[0].subtitle, "Conserved enzymes");
  assert.equal(chartData.groups[0].hidden, true);
  assert.equal(chartData.clusters[0].loci[0].name, "Neighbourhood");
  assert.equal(chartData.clusters[0].label, "Reference genome");
  assert.deepEqual(result.operations.map(({ type }) => type), ["genes.update", "groups.update", "loci.update", "clusters.update"]);
  assert.deepEqual(result.effects, { reindex: false, rebuildState: false });
});

test("chart operations reject an invalid batch without partial changes", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "groups.update", ids: ["group-1"], changes: { label: "Would change" } },
    { type: "genes.update", ids: ["missing"], changes: { label: "Invalid" } },
  ]), /unknown ID missing/);
  assert.equal(chartData.groups[0].label, "Old label");
});

test("structural group operations preserve exclusive gene membership", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  applyChartOperations(chartData, createChartIndex(chartData), [
    {
      type: "groups.create",
      group: { uid: "group-2", label: "New group", subtitle: "Optional detail" },
      geneIds: ["gene-1"],
    },
    { type: "groups.unassignGenes", geneIds: ["gene-1"] },
    { type: "groups.assignGenes", groupId: "group-1", geneIds: ["gene-1"] },
  ]);

  assert.deepEqual(chartData.groups.map((group) => [group.uid, group.subtitle, group.genes]), [
    ["group-1", undefined, ["gene-1"]],
    ["group-2", "Optional detail", []],
  ]);
  assert.equal(chartData.config.updateGroups, false);

  applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "groups.merge", targetId: "group-1", sourceIds: ["group-2"] },
    { type: "groups.delete", ids: ["group-1"] },
  ]);
  assert.deepEqual(chartData.groups, []);
});

test("structural group batches reject unknown genes without mutation", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [
    { type: "groups.create", group: { uid: "new-group", label: "New" }, geneIds: ["gene-1"] },
    { type: "groups.assignGenes", groupId: "new-group", geneIds: ["missing"] },
  ]), /unknown gene missing/);
  assert.deepEqual(chartData.groups.map((group) => group.uid), ["group-1"]);
});

test("groups can be created without assigning genes", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const chartData = normalizeChartData(structuredClone(data));

  const result = applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "groups.create",
    group: { uid: "empty-group", label: "Empty group" },
    geneIds: [],
  }]);

  assert.deepEqual(chartData.groups.at(-1), {
    uid: "empty-group",
    label: "Empty group",
    genes: [],
  });
  assert.deepEqual(result.effects, { reindex: "groups", rebuildState: false });
});

test("groups can be reordered without changing their membership", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const raw = structuredClone(data);
  raw.groups.push({ uid: "group-2", label: "Second group", genes: [] });
  const chartData = normalizeChartData(raw);

  const result = applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "groups.reorder",
    ids: ["group-2", "group-1"],
  }]);

  assert.deepEqual(chartData.groups.map((group) => [group.uid, group.genes]), [
    ["group-2", []],
    ["group-1", ["gene-1"]],
  ]);
  assert.deepEqual(result.operations, [{ type: "groups.reorder", ids: ["group-2", "group-1"] }]);
  assert.deepEqual(result.effects, { reindex: false, rebuildState: false });
  assert.equal(chartData.config.updateGroups, false);
  assert.throws(() => applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "groups.reorder",
    ids: ["group-1"],
  }]), /must contain every group exactly once/);
});

test("deleting a gene preserves its link records", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
  const { filterLinks } = await import("../../src/links/groups.mjs");
  const raw = structuredClone(data);
  raw.clusters[0].loci[0].genes.push({ uid: "gene-2", start: 60, end: 90, strand: 1 });
  raw.links = [{
    uid: "link-1",
    query: { uid: "gene-1" },
    target: { uid: "gene-2" },
    identity: 0.9,
  }];
  const chartData = normalizeChartData(raw);

  const result = applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "genes.delete",
    ids: ["gene-1"],
  }]);

  assert.deepEqual(chartData.clusters[0].loci[0].genes.map((gene) => gene.uid), ["gene-2"]);
  assert.deepEqual(result.effects, { reindex: "data", rebuildState: true });
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
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
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

  const deleted = applyChartOperations(chartData, createChartIndex(chartData), [{
    type: "links.delete",
    ids: ["link-1"],
  }]);
  assert.deepEqual(chartData.links, []);
  assert.deepEqual(deleted.effects, { reindex: "data", rebuildState: false });
  assert.equal(chartData.clusters[0].loci[0].genes.length, 2);
});

test("link identity rejects values outside the normalized percentage range", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const { applyChartOperations } = await import("../../src/data/operations.mjs");
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
