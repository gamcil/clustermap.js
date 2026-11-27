import test from "node:test";
import assert from "node:assert/strict";

test("automatic groups agree for compact and object links without materializing compact records", async () => {
  const [{ createLinkGroups }, { CompactLinkStore }] = await Promise.all([
    import("../../src/links/groups.mjs"), import("../../src/data/linkStore.mjs"),
  ]);
  const store = new CompactLinkStore({ genes: ["a", "b", "missing"],
    query: new Uint32Array([0, 1, 0]), target: new Uint32Array([1, 2, 0]),
    identity: new Float32Array([0.9, 0.8, 0.7]), similarity: new Float32Array([1, 1, 1]),
    spans: { loci: ["locus"], kinds: new Uint8Array([0, 0, 2]), orientation: new Int8Array(3),
      queryStart: new Float64Array(3), queryEnd: new Float64Array(3),
      targetStart: new Float64Array([0, 0, 1]), targetEnd: new Float64Array([0, 0, 2]) } });
  const records = [...store.values()], genes = new Set(["a", "b"]);
  const expected = createLinkGroups(records, [], genes);
  store.getAt = () => { throw new Error("grouping must not materialize compact links"); };
  assert.deepEqual(createLinkGroups(store, [], genes), expected);
  assert.deepEqual(expected.map(({ genes }) => genes), [["a", "b"]]);
});

test("span links use identity filtering without gene-group or best-match rules", async () => {
  const { filterLinks, createLinkGroups } = await import("../../src/links/groups.mjs");
  const genes = new Map([["g", { clusterUid: "a" }], ["h", { clusterUid: "b" }]]);
  const loci = new Set(["l1", "l2"]);
  const links = [
    { uid: "dna", query: { kind: "span", locusId: "l1" }, target: { kind: "span", locusId: "l2" }, identity: 0.8 },
    { uid: "mixed", query: { kind: "gene", geneId: "g" }, target: { kind: "span", locusId: "l2" }, identity: 0.7 },
    { uid: "missing", query: { kind: "span", locusId: "absent" }, target: { uid: "g" }, identity: 0.9 },
    { uid: "protein", query: { uid: "g" }, target: { uid: "h" }, identity: 0.9 },
  ];
  const options = { groupForGene: () => null, geneForUid: (uid) => genes.get(uid),
    locusForUid: (uid) => loci.has(uid), threshold: 0.5 };
  for (const bestOnly of [false, true]) {
    assert.deepEqual(new Set(filterLinks(links, { ...options, bestOnly }).map(({ uid }) => uid)), new Set(["dna", "mixed"]));
  }
  assert.deepEqual(createLinkGroups(links).map(({ genes }) => genes), [["g", "h"]]);
});

const link = (uid, query, target, identity) => ({
  uid,
  query: { uid: query },
  target: { uid: target },
  identity,
});

test("link grouping merges overlapping links and omits hidden groups from scales", async () => {
  const { createLinkGroups, getGroupScaleValues } = await import(
    "../../src/links/groups.mjs"
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
  const { createLinkGroups } = await import("../../src/links/groups.mjs");
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
  const { createLinkGroups } = await import("../../src/links/groups.mjs");
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
  const { filterLinks } = await import("../../src/links/groups.mjs");
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
  const { filterLinks } = await import("../../src/links/groups.mjs");
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
  const { filterLinks } = await import("../../src/links/groups.mjs");
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
  const { filterLinks } = await import("../../src/links/groups.mjs");
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

test("filtering preserves input order, records and equal-identity ties", async () => {
  const { filterLinks } = await import("../../src/links/groups.mjs");
  const genes = new Map([["a", { clusterUid: "one" }], ["b", { clusterUid: "two" }],
    ["c", { clusterUid: "two" }]]);
  const links = [link("first", "a", "b", 0.8), link("tie", "a", "c", 0.8),
    { ...link("hidden", "a", "b", 1), hidden: true }, link("missing", "a", "absent", 1)];
  const original = [...links];
  const options = { groupForGene: () => 0, geneForUid: (uid) => genes.get(uid), threshold: 0, bestOnly: false };
  assert.deepEqual(filterLinks(links, options), links.slice(0, 2));
  assert.deepEqual(filterLinks(links, { ...options, bestOnly: true }), links.slice(0, 2));
  assert.deepEqual(links, original);
});

test("compact link visibility matches filtering, including ties and missing endpoints", async () => {
  const [{ filterLinks, createLinkVisibility }, { createChartIndex }] = await Promise.all([
    import("../../src/links/groups.mjs"), import("../../src/data/index.mjs"),
  ]);
  const genes = [{ uid: "a" }, { uid: "b" }, { uid: "c" }];
  const data = { clusters: [{ uid: "one", loci: [{ uid: "l1", genes: [genes[0]] }] },
    { uid: "two", loci: [{ uid: "l2", genes: genes.slice(1) }] }], groups: [], links: [
      link("a", "a", "b", 0.9), link("b", "a", "c", 0.9),
      { ...link("hidden", "a", "b", 0.8), hidden: true },
      link("low", "a", "b", 0.1), link("missing", "a", "missing", 0.9),
    ] };
  const index = createChartIndex(data);
  for (const bestOnly of [false, true]) {
    const options = { groupForGene: () => 0, geneForUid: (uid) => {
      const gene = index.geneById.get(uid);
      return gene ? { ...gene, clusterUid: uid === "a" ? "one" : "two" } : undefined;
    }, bestOnly, threshold: 0.5 };
    const expected = new Set(filterLinks(data.links, options).map((item) => item.uid));
    const visibility = createLinkVisibility(data.links, options, index.linkById);
    assert.equal(visibility.byteLength, 1);
    for (const record of data.links) assert.equal(visibility.has(record.uid), expected.has(record.uid));
    assert.equal(visibility.has("unknown"), false);
  }
});
