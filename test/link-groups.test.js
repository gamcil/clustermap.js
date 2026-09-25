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
