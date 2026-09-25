import test from "node:test";
import assert from "node:assert/strict";

test("bottom legends stack below lower chart chrome", async () => {
  const [{ buildScene }, { createLocusOffsetPreview }] = await Promise.all([
    import("../src/layout.mjs"),
    import("../src/scenePreview.mjs"),
  ]);
  const data = {
    clusters: [{
      uid: "cluster",
      loci: [{
        uid: "locus",
        start: 0,
        end: 100,
        genes: [
          { uid: "gene-a", start: 0, end: 10, strand: 1 },
          { uid: "gene-b", start: 20, end: 30, strand: 1 },
          { uid: "gene-c", start: 40, end: 50, strand: 1 },
        ],
      }],
    }],
    links: [],
  };
  const scene = buildScene(data, {
    scaleX: (value) => value,
    scaleY: () => 0,
    clusterOffset: () => 0,
    locusOffset: () => 0,
    getLocusState: (locus) => ({ start: locus.start, end: locus.end, flipped: false }),
    getGeneState: (gene) => gene,
    areClustersAdjacent: () => false,
    shape: { tipHeight: 5, bodyHeight: 12, tipLength: 4 },
    label: { start: 0.5, position: "middle", anchor: "middle", rotation: 0 },
    link: { threshold: 0, labelPosition: 0.5 },
    chrome: {
      legend: {
        show: true,
        placement: "bottom",
        marginLeft: 20,
        marginTop: 20,
        entryHeight: 18,
        fontSize: 14,
        fontFamily: "sans-serif",
        columns: 2,
        columnWidth: 100,
        groups: [
          { uid: "group-a", label: "Group A", hidden: false },
          { uid: "group-b", label: "Group B", hidden: false },
          { uid: "group-c", label: "Group C", hidden: false },
        ],
        groupForGene: (uid) => `group-${uid.at(-1)}`,
        colourForGroup: () => "purple",
      },
      scaleBar: {
        show: true,
        x: 0,
        marginTop: 20,
        basePair: 20,
        coordinateFor: (value) => value,
        height: 12,
        colour: "black",
        strokeWidth: 1,
        fontSize: 10,
        fontFamily: "sans-serif",
      },
      colourBar: {
        show: true,
        x: 40,
        marginTop: 20,
        width: 50,
        height: 12,
        fontSize: 10,
        fontFamily: "sans-serif",
        scoreColour: () => "black",
      },
      link: { show: true, groupColour: false },
    },
  });

  assert.equal(scene.chrome.legend.placement, "bottom");
  assert.equal(scene.chrome.legend.columns, 2);
  assert.equal(scene.chrome.legend.bottomOffset, 50);
  assert.deepEqual(scene.chrome.legend.position, { x: 0, y: 92 });
  assert.deepEqual(scene.figureBounds, { minX: -6, maxX: 200, minY: 0, maxY: 130 });
  assert.deepEqual(
    scene.chrome.legend.items.map(({ uid, x, y }) => ({ uid, x, y })),
    [
      { uid: "group-a", x: 0, y: 0 },
      { uid: "group-b", x: 0, y: 24 },
      { uid: "group-c", x: 100, y: 0 },
    ]
  );
  assert.equal(scene.chrome.scaleBar.position.y, 42);
  const preview = createLocusOffsetPreview(scene, "locus", -20, { alignLabels: true });
  assert.equal(preview.chrome.legend.position.x, 0);
});
