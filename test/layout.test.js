const test = require("node:test");
const assert = require("node:assert/strict");

test("scene derives world-space geometry without DOM state", async () => {
  const {
    buildScene,
    createClusterDragPreview,
    createLocusFlipPreview,
    createLocusOffsetPreview,
    createLocusTrimPreview,
    patchFlippedLocusScene,
  } = await import("../src/layout.mjs");
  const { hitTest } = await import("../src/hitTest.mjs");
  const { queryViewport } = await import("../src/spatialIndex.mjs");
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
  assert.deepEqual(topGene.bounds, { minX: 8, maxX: 14, minY: 0, maxY: 22 });
  const topLocus = scene.loci.get("top-locus");
  assert.equal(topLocus.worldStart, 6);
  assert.deepEqual(createLocusOffsetPreview(scene, "top-locus", 14, { alignLabels: true }), {
    type: "locus-offset",
    locusUid: "top-locus",
    offsetX: 13,
    clusterLabelOffsets: new Map([
      ["top", 6],
      ["bottom", 6],
    ]),
  });
  assert.equal(createLocusOffsetPreview(scene, "unknown", 14, { alignLabels: true }), null);
  assert.deepEqual(
    createLocusFlipPreview(scene, "top-locus", { scaleX: (value) => value, progress: 0.12 }),
    {
      type: "locus-flip",
      locusUid: "top-locus",
      progress: 0.12,
      axes: new Map([["top-locus", 16]]),
    }
  );
  assert.equal(
    createLocusFlipPreview(scene, "unknown", { scaleX: (value) => value }),
    null
  );
  // The initial loci share the same left coordinate, but `alignLabels: false`
  // must still keep the preview change local to the dragged cluster.
  assert.deepEqual(
    createLocusOffsetPreview(scene, "top-locus", 14, { alignLabels: false }).clusterLabelOffsets,
    new Map([["top", 13]])
  );
  const unalignedScene = {
    ...scene,
    clusters: new Map([
      ["top", { ...scene.clusters.get("top"), info: { x: -10 }, loci: [topLocus] }],
      ["bottom", { ...scene.clusters.get("bottom"), info: { x: -10 }, loci: [scene.loci.get("bottom-locus")] }],
    ]),
  };
  assert.deepEqual(
    createLocusOffsetPreview(unalignedScene, "top-locus", 14, { alignLabels: false })
      .clusterLabelOffsets,
    new Map([["top", 13]])
  );
  assert.deepEqual(
    createClusterDragPreview(scene, {
      clusterUid: "top",
      position: 45,
      order: ["bottom", "top"],
      rows: [0, 30],
    }),
    {
      type: "cluster-drag",
      clusterUid: "top",
      clusterOffsets: new Map([
        ["bottom", -30],
        ["top", 45],
      ]),
      clusterOrder: new Map([
        ["bottom", 0],
        ["top", 1],
      ]),
    }
  );
  const trimPreview = createLocusTrimPreview(
    scene,
    "top-locus",
    { start: 8, end: 20 },
    {
      localXFor: (uid) => (uid === "top-locus" ? -7 : 2),
      scaleX: (value) => value,
      alignLabels: false,
    }
  );
  assert.deepEqual(trimPreview.locusOffsets, new Map([["top-locus", -8], ["bottom-locus", 0]]));
  assert.deepEqual(trimPreview.loci.get("top-locus"), {
    worldStart: 6,
    worldEnd: 18,
    track: { x1: 8, x2: 20, y: 11 },
    hover: {
      x: 8,
      y: -10,
      width: 12,
      height: 42,
      leftHandleX: 0,
      rightHandleX: 20,
    },
  });
  assert.equal(trimPreview.geneVisibility.get("top-gene"), false);
  assert.deepEqual(trimPreview.clusterLabelOffsets, new Map([["top", 0], ["bottom", 0]]));
  assert.deepEqual(topLocus.track, { x1: 0, x2: 20, y: 11 });
  assert.deepEqual(topLocus.genes.map((gene) => gene.source.uid), ["top-gene"]);
  assert.deepEqual(scene.clusters.get("top").bounds, {
    minX: 6,
    maxX: 26,
    minY: -10,
    maxY: 32,
  });
  assert.deepEqual(scene.linksByClusterPair.get("bottom\u0000top"), ["link"]);
  assert.deepEqual(topLocus.hover, {
    x: 0,
    y: -10,
    width: 20,
    height: 42,
    leftHandleX: -8,
    rightHandleX: 20,
  });
  assert.deepEqual(scene.hitRegions.loci.get("top-locus"), {
    move: {
      type: "rect",
      action: "move-locus",
      locusUid: "top-locus",
      x: 6,
      y: -10,
      width: 20,
      height: 42,
    },
    trimLeft: {
      type: "rect",
      action: "trim-locus-left",
      locusUid: "top-locus",
      x: -2,
      y: -10,
      width: 8,
      height: 42,
    },
    trimRight: {
      type: "rect",
      action: "trim-locus-right",
      locusUid: "top-locus",
      x: 26,
      y: -10,
      width: 8,
      height: 42,
    },
  });
  assert.deepEqual(scene.hitRegions.genes.get("top-gene"), {
    type: "polygon",
    action: "gene",
    geneUid: "top-gene",
    points: topGene.polygon,
  });
  assert.equal(hitTest(scene, { x: 2, y: 11 }).action, "trim-locus-left");
  assert.equal(hitTest(scene, { x: 20, y: 11 }).action, "move-locus");
  assert.equal(hitTest(scene, { x: 9, y: 11 }).geneUid, "top-gene");
  assert.equal(
    hitTest({ ...scene, hitRegions: { ...scene.hitRegions, all: [] } }, { x: 2, y: 11 }).action,
    "trim-locus-left"
  );
  assert.equal(hitTest(scene, { x: 200, y: 200 }), null);
  assert.deepEqual(scene.links.get("link").anchors, [8, 14, 11, 28, 22, 41]);
  assert.equal(scene.links.get("link").visible, true);
  assert.deepEqual([...queryViewport(scene.index.genes, { minX: 7, maxX: 15, minY: 0, maxY: 22 })], [
    "top-gene",
  ]);
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

  const flippedLocusStates = new Map(
    [...locusStates].map(([uid, state]) => [uid, { ...state }])
  );
  const flippedGeneStates = new Map(
    [...geneStates].map(([uid, state]) => [uid, { ...state }])
  );
  flippedLocusStates.get("top-locus").flipped = true;
  flippedGeneStates.set("top-gene", { start: 12, end: 18, strand: -1 });
  const patched = patchFlippedLocusScene(scene, data.clusters[0].loci[0], {
    scaleX: (value) => value,
    locusOffset: (uid) => (uid === "top-locus" ? 1 : 2),
    getLocusState: (locus) => flippedLocusStates.get(locus.uid),
    getGeneState: (gene) => flippedGeneStates.get(gene.uid),
    areClustersAdjacent: () => true,
    shape: { tipHeight: 5, bodyHeight: 12, tipLength: 4 },
    label: { start: 0.5, position: "middle", anchor: "middle", rotation: 0 },
    link: { asLine: false, straight: true, threshold: 0.3, labelPosition: 0.5 },
    clusterLabel: () => "flipped",
    linksForGene: (uid) => data.links.filter(
      (source) => source.query.uid === uid || source.target.uid === uid
    ),
  });
  assert.notEqual(patched, scene);
  assert.notEqual(patched.loci.get("top-locus"), scene.loci.get("top-locus"));
  assert.equal(patched.loci.get("bottom-locus"), scene.loci.get("bottom-locus"));
  assert.notEqual(patched.genes.get("top-gene"), scene.genes.get("top-gene"));
  assert.equal(patched.genes.get("bottom-gene"), scene.genes.get("bottom-gene"));
  assert.notDeepEqual(patched.links.get("link").anchors, scene.links.get("link").anchors);
  assert.equal(patched.clusters.get("top").info.locusText, "flipped");
  assert.equal(hitTest(patched, { x: 18, y: 11 }).geneUid, "top-gene");
  assert.deepEqual(
    [...queryViewport(patched.index.genes, { minX: 7, maxX: 11, minY: 0, maxY: 22 })],
    []
  );
  assert.deepEqual(
    [...queryViewport(patched.index.genes, { minX: 16, maxX: 20, minY: 0, maxY: 22 })],
    ["top-gene"]
  );
  assert.deepEqual({ data, locusStates, geneStates }, before);
});
