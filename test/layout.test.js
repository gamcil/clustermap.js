const test = require("node:test");
const assert = require("node:assert/strict");

test("layout projection derives world-space genes and links without DOM state", async () => {
  const { createLayoutProjection } = await import("../src/layout.mjs");
  const data = {
    clusters: [
      {
        uid: "top",
        loci: [
          {
            uid: "top-locus",
            genes: [{ uid: "top-gene", _locus: "top-locus", _cluster: "top" }],
          },
        ],
      },
      {
        uid: "bottom",
        loci: [
          {
            uid: "bottom-locus",
            genes: [
              { uid: "bottom-gene", _locus: "bottom-locus", _cluster: "bottom" },
            ],
          },
        ],
      },
    ],
    links: [
      {
        uid: "link",
        query: { uid: "top-gene" },
        target: { uid: "bottom-gene" },
        identity: 0.8,
      },
    ],
  };
  const locusStates = new Map([
    ["top-locus", { start: 0, end: 20 }],
    ["bottom-locus", { start: 0, end: 20 }],
  ]);
  const geneStates = new Map([
    ["top-gene", { start: 2, end: 8, strand: 1 }],
    ["bottom-gene", { start: 10, end: 16, strand: 0 }],
  ]);

  const projection = createLayoutProjection(data, {
    scaleX: (value) => value,
    scaleY: (uid) => (uid === "top" ? 0 : 30),
    clusterOffset: (uid) => (uid === "top" ? 5 : 10),
    locusOffset: (uid) => (uid === "top-locus" ? 1 : 2),
    getLocusState: (locus) => locusStates.get(locus.uid),
    getGeneState: (gene) => geneStates.get(gene.uid),
    areClustersAdjacent: () => true,
    shape: { tipHeight: 5, bodyHeight: 12, tipLength: 4 },
    label: { start: 0.5, position: "middle", anchor: "middle", rotation: 0 },
    link: { asLine: false, straight: true, threshold: 0.3, labelPosition: 0.5 },
  });

  const topGene = projection.genes.get("top-gene");
  assert.equal(topGene.visible, true);
  assert.deepEqual(topGene.polygon.slice(0, 2), [6 + 2, 5]);
  assert.equal(projection.loci.get("top-locus").worldStart, 6);
  assert.deepEqual(projection.links.get("link").anchors, [8, 14, 11, 28, 22, 41]);
  assert.equal(projection.links.get("link").visible, true);
  assert.deepEqual(projection.bounds, { minX: 6, maxX: 32, minY: 0, maxY: 52 });
});
