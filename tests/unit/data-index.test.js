import test from "node:test";
import assert from "node:assert/strict";
import { recordForId } from "../../src/data/index.mjs";

test("record lookups preserve typed IDs before falling back to their text form", () => {
  const zero = { uid: 0 }, numeric = { uid: 1 }, text = { uid: "1" };
  const records = new Map([[0, zero], [1, numeric], ["1", text]]);
  assert.equal(recordForId(records, 0), zero);
  assert.equal(recordForId(records, "0"), zero);
  assert.equal(recordForId(records, 1), numeric);
  assert.equal(recordForId(records, "1"), text);
  assert.equal(recordForId(records, "missing"), undefined);
  assert.equal(recordForId(null, 0), undefined);
});

test("chart index maps hierarchy and links by stable identifiers", async () => {
  const { createChartIndex } = await import("../../src/data/index.mjs");
  const geneA = { uid: "gene-a", start: 0, end: 10, strand: 1 };
  const geneB = { uid: "gene-b", start: 20, end: 30, strand: 0 };
  const link = {
    uid: "link-a-b",
    query: { uid: "gene-a" },
    target: { uid: "gene-b" },
  };
  const data = {
    clusters: [
      {
        uid: "cluster-a",
        loci: [{ uid: "locus-a", start: 0, end: 100, genes: [geneA, geneB] }],
      },
    ],
    links: [link],
  };

  const index = createChartIndex(data);

  assert.equal(index.clusterById.get("cluster-a"), data.clusters[0]);
  assert.equal(index.locusById.get("locus-a"), data.clusters[0].loci[0]);
  assert.equal(index.geneById.get("gene-b"), geneB);
  assert.deepEqual(index.linkById.get("link-a-b"), link);
  assert.deepEqual(index.linksByGeneId.get("gene-a"), [link]);
  assert.deepEqual(index.linksByGeneId.get("gene-b"), [link]);
  assert.equal(geneA.locusUid, undefined);
  assert.equal(geneB.clusterUid, undefined);
});

test("link indexes retain input order, dangling endpoints and self links", async () => {
  const [{ createChartIndex }, { clusterPairKey }] = await Promise.all([
    import("../../src/data/index.mjs"), import("../../src/links/layout.mjs"),
  ]);
  const links = [
    { uid: "cross", query: { uid: "a" }, target: { uid: "b" } },
    { uid: "self", query: { uid: "a" }, target: { uid: "a" } },
    { uid: "missing", query: { uid: "a" }, target: { uid: "missing" } },
  ];
  const data = { clusters: [{ uid: "one", loci: [{ uid: "l1", genes: [{ uid: "a" }] }] },
    { uid: "two", loci: [{ uid: "l2", genes: [{ uid: "b" }] }] }], links };
  const index = createChartIndex(data);
  assert.deepEqual(index.linksByGeneId.get("a"), links);
  assert.deepEqual(index.linksByClusterPair.get(clusterPairKey("one", "two")), ["cross"]);
  assert.deepEqual(index.linksByClusterPair.get(clusterPairKey("one", "one")), ["self"]);
});

test("cluster-pair indexes include span endpoints without treating loci as genes", async () => {
  const [{ createChartIndex }, { clusterPairKey }] = await Promise.all([
    import("../../src/data/index.mjs"), import("../../src/links/layout.mjs"),
  ]);
  const links = [
    { uid: "dna", query: { kind: "span", locusId: "l1", start: 2, end: 4 },
      target: { kind: "span", locusId: "l2", start: 3, end: 5 } },
    { uid: "mixed", query: { kind: "gene", geneId: "a" },
      target: { kind: "span", locusId: "l2", start: 3, end: 5 } },
    { uid: "missing", query: { kind: "span", locusId: "absent", start: 0, end: 1 }, target: { uid: "a" } },
  ];
  const data = { clusters: [{ uid: "one", loci: [{ uid: "l1", genes: [{ uid: "a" }] }] },
    { uid: "two", loci: [{ uid: "l2", genes: [] }] }], links };
  const index = createChartIndex(data);
  assert.deepEqual(index.linksByClusterPair.get(clusterPairKey("one", "two")), ["dna", "mixed"]);
  assert.deepEqual(index.linksByGeneId.get("a"), [links[1], links[2]]);
  assert.deepEqual(index.linksByLocusId.get("l1"), [links[0]]);
  assert.deepEqual(index.linksByLocusId.get("l2"), [links[0], links[1]]);
  assert.equal(index.linksByGeneId.has("l1"), false);
});

test("link indexes merge duplicate dictionary IDs and retain typed span identities after deletions", async () => {
  const [{ createChartIndex }, { CompactLinkStore }, { clusterPairKey }] = await Promise.all([
    import("../../src/data/index.mjs"), import("../../src/data/linkStore.mjs"), import("../../src/links/layout.mjs"),
  ]);
  const links = new CompactLinkStore({ genes: [1, 1, "1"], query: new Uint32Array([0, 1, 0, 0]), target: new Uint32Array([1, 2, 0, 0]),
    identity: new Float32Array([1, 1, 1, 1]), similarity: new Float32Array(4),
    spans: { loci: [1], kinds: new Uint8Array([0, 0, 2, 1]), orientation: new Int8Array(4),
      queryStart: new Float64Array([0, 0, 0, 1]), queryEnd: new Float64Array([0, 0, 0, 2]),
      targetStart: new Float64Array([0, 0, 1, 0]), targetEnd: new Float64Array([0, 0, 2, 0]) } }).withDeleted(["link-1"]);
  const index = createChartIndex({ links, clusters: [{ uid: "a", loci: [{ uid: 1, genes: [{ uid: 1 }] }] },
    { uid: "b", loci: [{ uid: "locus", genes: [{ uid: "1" }] }] }] });
  assert.deepEqual(index.linksByGeneId.get(1).map(({ uid }) => uid), ["link-0", "link-2", "link-3"]);
  assert.deepEqual(index.linksByLocusId.get(1).map(({ uid }) => uid), ["link-2", "link-3"]);
  assert.deepEqual(index.linksByClusterPair.get(clusterPairKey("a", "a")), ["link-0", "link-2", "link-3"]);
  assert.equal(index.linksByGeneId.has("1"), false);
});

test("link index keys follow first endpoint occurrence rather than dictionary order", async () => {
  const [{ createChartIndex }, { CompactLinkStore }] = await Promise.all([
    import("../../src/data/index.mjs"), import("../../src/data/linkStore.mjs"),
  ]);
  const links = new CompactLinkStore({ genes: ["unused", "second", "first"], query: new Uint32Array([2]),
    target: new Uint32Array([1]), identity: new Float32Array([1]), similarity: new Float32Array([1]) });
  const index = createChartIndex({ links, clusters: [] });
  assert.deepEqual([...index.linksByGeneId.keys()], ["first", "second"]);
});
