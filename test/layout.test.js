const test = require("node:test");
const assert = require("node:assert/strict");

test("scene derives world-space geometry without DOM state", async () => {
  const { buildScene } = await import("../src/layout.mjs");
  const data = {
    clusters: [
      {
        uid: "top",
        loci: [
          {
            uid: "top-locus",
            genes: [{ uid: "top-gene", locusUid: "top-locus", clusterUid: "top" }],
          },
        ],
      },
      {
        uid: "bottom",
        loci: [
          {
            uid: "bottom-locus",
            genes: [
              { uid: "bottom-gene", locusUid: "bottom-locus", clusterUid: "bottom" },
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
  const before = structuredClone({ data, locusStates, geneStates });

  const scene = buildScene(data, {
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
    chrome: {
      legend: {
        show: true,
        marginLeft: 20,
        entryHeight: 18,
        fontSize: 14,
        fontFamily: "system-ui",
        groups: [{ uid: "group", label: "Group", hidden: false }],
        groupForGene: () => "group",
        colourForGroup: () => "purple",
      },
      scaleBar: {
        show: true,
        x: 0,
        marginTop: 20,
        basePair: 2500,
        coordinateFor: (value) => value / 100,
        height: 12,
        colour: "black",
        strokeWidth: 1,
        fontSize: 10,
        fontFamily: "system-ui",
      },
      colourBar: {
        show: true,
        x: 45,
        marginTop: 20,
        width: 150,
        height: 12,
        fontSize: 10,
        fontFamily: "system-ui",
        scoreColour: (value) => (value ? "black" : "white"),
      },
      link: { show: true, groupColour: false },
    },
  });

  const topGene = scene.genes.get("top-gene");
  assert.equal(topGene.visible, true);
  assert.deepEqual(topGene.polygon.slice(0, 2), [6 + 2, 5]);
  const topLocus = scene.loci.get("top-locus");
  assert.equal(topLocus.worldStart, 6);
  assert.deepEqual(topLocus.track, { x1: 0, x2: 20, y: 11 });
  assert.deepEqual(topLocus.hover, {
    x: 0,
    y: -10,
    width: 20,
    height: 42,
    leftHandleX: -8,
    rightHandleX: 20,
  });
  assert.deepEqual(scene.links.get("link").anchors, [8, 14, 11, 28, 22, 41]);
  assert.equal(scene.links.get("link").visible, true);
  assert.deepEqual(scene.bounds, { minX: 6, maxX: 32, minY: 0, maxY: 52 });
  assert.deepEqual(scene.chrome.legend.position, { x: 52, y: 0 });
  assert.deepEqual(scene.chrome.legend.items[0], {
    uid: "group",
    source: { uid: "group", label: "Group", hidden: false },
    label: "Group",
    colour: "purple",
    x: 0,
    y: 0,
    radius: 4.5,
    circleY: 4.5,
    textX: 10.5,
    textY: 5.5,
  });
  assert.equal(scene.chrome.scaleBar.position.y, 72);
  assert.equal(scene.chrome.scaleBar.length, 25);
  assert.equal(scene.chrome.scaleBar.label, "2.5kb");
  assert.equal(scene.chrome.colourBar.position.y, 72);
  assert.equal(scene.chrome.colourBar.startColour, "white");
  assert.equal(scene.chrome.colourBar.endColour, "black");
  assert.deepEqual({ data, locusStates, geneStates }, before);
});
