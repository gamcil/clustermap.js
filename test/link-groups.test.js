import test from "node:test";
import assert from "node:assert/strict";

const link = (uid, query, target, identity) => ({
  uid,
  query: { uid: query },
  target: { uid: target },
  identity,
});

test("link grouping merges overlapping links and omits hidden groups from scales", async () => {
  const { createLinkGroups, getGroupScaleValues } = await import(
    "../src/links/groups.mjs"
  );
  const groups = createLinkGroups([
    link("one", "a", "b", 0.9),
    link("two", "b", "c", 0.8),
    link("three", "d", "e", 0.7),
  ]);

  assert.deepEqual(groups.map((group) => group.genes), [
    ["a", "b", "c"],
    ["d", "e"],
  ]);

  groups[1].hidden = true;
  assert.deepEqual(getGroupScaleValues(groups), {
    domain: ["a", "b", "c"],
    range: [0, 0, 0],
  });
});

test("link grouping retains matching group presentation and unlinked groups", async () => {
  const { createLinkGroups } = await import("../src/links/groups.mjs");
  const groups = createLinkGroups([
    link("one", "a", "b", 0.9),
    link("two", "c", "d", 0.8),
  ], [
    { uid: "second", label: "Second", subtitle: "Stable", colour: "#123456", hidden: true, genes: ["c", "d"] },
    { uid: "first", label: "First", colour: "#654321", genes: ["a", "b"] },
    { uid: "empty", label: "Empty", genes: [] },
  ]);

  assert.deepEqual(groups, [
    { uid: "second", label: "Second", subtitle: "Stable", colour: "#123456", hidden: true, genes: ["c", "d"] },
    { uid: "first", label: "First", colour: "#654321", genes: ["a", "b"] },
    { uid: "empty", label: "Empty", genes: [] },
  ]);
});

test("link grouping handles a large connected component without repeated merging", async () => {
  const { createLinkGroups } = await import("../src/links/groups.mjs");
  const links = Array.from({ length: 20000 }, (_, index) =>
    link(`link-${index}`, `gene-${index}`, `gene-${index + 1}`, 0.9)
  );
  const groups = createLinkGroups(links);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].genes.length, 20001);
  assert.equal(groups[0].genes[0], "gene-0");
  assert.equal(groups[0].genes.at(-1), "gene-20000");
});

test("best-only filtering keeps the highest-identity overlapping link per cluster pair", async () => {
  const { filterLinks } = await import("../src/links/groups.mjs");
  const genes = new Map([
    ["a", { clusterUid: "one" }],
    ["b", { clusterUid: "two" }],
    ["c", { clusterUid: "two" }],
  ]);
  const links = [
    link("lower", "a", "b", 0.6),
    link("higher", "a", "c", 0.9),
  ];

  const filtered = filterLinks(links, {
    groupForGene: () => 0,
    geneForUid: (uid) => genes.get(uid),
    bestOnly: true,
    threshold: 0,
  });

  assert.deepEqual(filtered.map((item) => item.uid), ["higher"]);
});

test("best-only filtering uses one bucket for either cluster-pair direction", async () => {
  const { filterLinks } = await import("../src/links/groups.mjs");
  const genes = new Map([
    ["a", { clusterUid: "one" }],
    ["b", { clusterUid: "two" }],
    ["c", { clusterUid: "two" }],
  ]);
  const filtered = filterLinks([
    link("lower", "a", "b", 0.6),
    link("higher", "c", "a", 0.9),
  ], {
    groupForGene: () => 0,
    geneForUid: (uid) => genes.get(uid),
    bestOnly: true,
    threshold: 0,
  });

  assert.deepEqual(filtered.map((item) => item.uid), ["higher"]);
});

test("best-only filtering retains equal-scoring links and scales within one cluster pair", async () => {
  const { filterLinks } = await import("../src/links/groups.mjs");
  const genes = new Map(
    Array.from({ length: 2002 }, (_, index) => [String(index), { clusterUid: index % 2 ? "one" : "two" }])
  );
  const links = Array.from({ length: 1000 }, (_, index) =>
    link(`link-${index}`, String(index * 2), String(index * 2 + 1), 0.5)
  );
  links.push(link("equal", "0", "3", 0.5));
  const filtered = filterLinks(links, {
    groupForGene: () => 0,
    geneForUid: (uid) => genes.get(uid),
    bestOnly: true,
    threshold: 0,
  });

  assert.equal(filtered.length, 1001);
  assert.ok(filtered.some((item) => item.uid === "equal"));
});

test("identity threshold applies even when best-only filtering is disabled", async () => {
  const { filterLinks } = await import("../src/links/groups.mjs");
  const genes = new Map([
    ["a", { clusterUid: "one" }],
    ["b", { clusterUid: "two" }],
    ["c", { clusterUid: "two" }],
  ]);
  const filtered = filterLinks([
    link("below", "a", "b", 0.29),
    link("at", "a", "c", 0.3),
  ], {
    groupForGene: () => 0,
    geneForUid: (uid) => genes.get(uid),
    bestOnly: false,
    threshold: 0.3,
  });
  assert.deepEqual(filtered.map((item) => item.uid), ["at"]);
});
