import test from "node:test";
import assert from "node:assert/strict";
import { normalizeChartData } from "../../src/data/normalize.mjs";

function input() {
  return { clusters: [{ uid: "c", loci: [{ uid: "l", start: 0, end: 100,
    genes: [{ uid: "g", start: 10, end: 20, strand: 1 }] }] }],
    links: [{ uid: "link", query: { uid: "g" }, target: { uid: "missing" }, identity: 0.5 }],
    groups: [{ uid: "group", genes: ["g", "missing"] }] };
}

test("normalization rejects malformed geometry and relationships before projection", () => {
  const cases = [
    ["locus", { start: NaN }, /finite start/],
    ["locus", { end: -1 }, /finite start/],
    ["locus", { offset: Infinity }, /offset must be finite/],
    ["locus", { bio: { start: 5, end: 1 } }, /bio requires finite/],
    ["gene", { end: Infinity }, /finite start/],
    ["gene", { start: 30 }, /finite start/],
    ["gene", { strand: "1" }, /strand must/],
    ["gene", { bio: null }, /bio requires/],
    ["gene", { bio: { start: 10, end: 20, strand: 2 } }, /strand must/],
    ["link", { query: null }, /query requires/],
    ["link", { target: { uid: "" } }, /target requires/],
    ["link", { identity: NaN }, /identity must/],
    ["link", { identity: 1.1 }, /identity must/],
    ["group", { genes: "g" }, /genes must be an array/],
    ["group", { genes: [{}] }, /requires gene IDs/],
    ["group", { genes: ["g", "g"] }, /duplicate group membership/],
  ];
  for (const [kind, changes, error] of cases) {
    const data = input();
    const locus = data.clusters[0].loci[0];
    Object.assign({ locus, gene: locus.genes[0], link: data.links[0], group: data.groups[0] }[kind], changes);
    const before = structuredClone(data);
    assert.throws(() => normalizeChartData(data), error, `${kind}: ${Object.keys(changes)}`);
    assert.deepEqual(data, before);
  }
  const data = input();
  data.groups.push({ uid: "other", genes: ["g"] });
  assert.throws(() => normalizeChartData(data), /duplicate group membership/);
  for (const config of [null, [], { updateGroups: "false" }]) {
    assert.throws(() => normalizeChartData({ ...input(), config }), /config/);
  }
});

test("normalization accepts absent endpoints, empty ranges and unknown strand", () => {
  const data = input(), locus = data.clusters[0].loci[0];
  locus.offset = -20;
  Object.assign(locus.genes[0], { start: -10, end: -10, strand: 0 });
  const normalized = normalizeChartData(data);
  assert.deepEqual(normalized.links, data.links);
  assert.deepEqual(normalized.groups, data.groups);
  assert.deepEqual(normalizeChartData(normalized), normalized);
});

test("chart normalization establishes explicit hierarchy relationships", async () => {
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const data = {
    clusters: [
      {
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
              },
            ],
          },
        ],
      },
    ],
    links: [],
  };

  const normalized = normalizeChartData(data);
  const locus = normalized.clusters[0].loci[0];
  const gene = locus.genes[0];

  assert.equal(locus.clusterUid, "cluster-a");
  assert.equal(gene.locusUid, "locus-a");
  assert.equal(gene.clusterUid, "cluster-a");
});

test("chart normalization preserves source data and records biological coordinates", async () => {
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const data = {
    clusters: [
      {
        uid: "cluster-a",
        loci: [
          {
            uid: "locus-a",
            start: 500,
            end: 700,
            genes: [
              {
                uid: "gene-a",
                start: 550,
                end: 600,
                strand: 1,
              },
            ],
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

test("chart normalization owns editable nested records", async () => {
  const { normalizeChartData } = await import("../../src/data/normalize.mjs");
  const data = {
    clusters: [{
      uid: "cluster-a",
      loci: [{
        uid: "locus-a",
        start: 0,
        end: 100,
        genes: [{ uid: "gene-a", start: 0, end: 20, strand: 1, metadata: { note: "source" } }],
      }],
    }],
    links: [{
      uid: "link-a",
      query: { uid: "gene-a", metadata: { source: "query" } },
      target: { uid: "gene-a" },
      metadata: { note: "source" },
    }],
    groups: [{ uid: "group-a", genes: ["gene-a"], metadata: { note: "source" } }],
    config: { updateGroups: false, metadata: { note: "source" } },
  };

  const normalized = normalizeChartData(data);
  normalized.clusters[0].loci[0].genes[0].metadata.note = "edited";
  normalized.links[0].query.metadata.source = "edited";
  normalized.links[0].metadata.note = "edited";
  normalized.groups[0].metadata.note = "edited";
  normalized.config.metadata.note = "edited";

  assert.deepEqual(data, {
    clusters: [{
      uid: "cluster-a",
      loci: [{
        uid: "locus-a",
        start: 0,
        end: 100,
        genes: [{ uid: "gene-a", start: 0, end: 20, strand: 1, metadata: { note: "source" } }],
      }],
    }],
    links: [{
      uid: "link-a",
      query: { uid: "gene-a", metadata: { source: "query" } },
      target: { uid: "gene-a" },
      metadata: { note: "source" },
    }],
    groups: [{ uid: "group-a", genes: ["gene-a"], metadata: { note: "source" } }],
    config: { updateGroups: false, metadata: { note: "source" } },
  });
});
