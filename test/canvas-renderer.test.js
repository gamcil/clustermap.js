const test = require("node:test");
const assert = require("node:assert/strict");

test("canvas renderer draws world-space scene geometry through the camera", async () => {
  const { hitTestCanvas, interpolateCanvasScene, renderCanvas } = await import("../src/canvasRenderer.js");
  const calls = [];
  const context = new Proxy(
    {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      measureText: (text) => ({ width: text.length * 8 }),
    },
    {
      get(target, property) {
        if (property in target) return target[property];
        return (...args) => calls.push([property, ...args]);
      },
      set(target, property, value) {
        calls.push(["set", property, value]);
        target[property] = value;
        return true;
      },
    }
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  };
  const cluster = {
    source: { name: "cluster" },
    x: 5,
    y: 10,
    info: { x: -10, locusText: "locus:1-10" },
    loci: [
      {
        source: { uid: "locus" },
        x: 5,
        worldStart: 5,
        worldEnd: 15,
        y: 10,
        track: { y: 11 },
        hover: { x: 0, y: -10, width: 10, height: 30, leftHandleX: -8, rightHandleX: 10 },
      },
    ],
  };
  const scene = {
    clusters: new Map([["cluster", cluster]]),
    loci: new Map([["locus", cluster.loci[0]]]),
    links: new Map(),
    genes: new Map([
      [
        "gene",
        {
          visible: true,
          source: { uid: "gene", label: "gene" },
          polygon: [5, 15, 10, 15, 10, 20, 5, 20],
          locus: { x: 5, y: 10 },
          label: { x: 0, y: 0, rotation: 0 },
        },
      ],
    ]),
    chrome: {
      legend: {
        visible: true,
        position: { x: 0, y: 0 },
        fontSize: 10,
        fontFamily: "sans-serif",
        items: [
          {
            uid: "group",
            label: "group",
            colour: "purple",
            x: 0,
            y: 20,
            radius: 2,
            circleY: 2,
            textX: 5,
            textY: 4,
          },
        ],
      },
      scaleBar: { visible: false },
      colourBar: { visible: false },
    },
    hitRegions: {
      all: [
        {
          type: "rect",
          action: "move-locus",
          locusUid: "locus",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
    },
  };
  const config = {
    plot: { fontFamily: "sans-serif" },
    cluster: { nameFontSize: 12, lociFontSize: 10 },
    locus: { trackBar: { colour: "black", stroke: 1 } },
    gene: {
      shape: { stroke: "black", strokeWidth: 1 },
      label: { show: true, anchor: "middle", fontSize: 10 },
    },
    link: {},
  };

  const result = renderCanvas({
    canvas,
    scene,
    camera: { x: 20, y: 30, k: 2 },
    config,
    scales: { group: () => null, colour: () => "#bbb", score: () => "#000" },
    hoverLocusUid: "locus",
  });

  assert.deepEqual(result, { width: 200, height: 100, pixelRatio: 1 });
  assert.equal(canvas.width, 200);
  assert.equal(canvas.height, 100);
  assert.ok(calls.some((call) => call[0] === "translate" && call[1] === 20));
  assert.ok(calls.some((call) => call[0] === "scale" && call[1] === 2));
  assert.ok(calls.some((call) => call[0] === "lineTo" && call[1] === 15));
  assert.ok(calls.some((call) => call[0] === "fill"));
  assert.ok(calls.some((call) => call[0] === "fillRect" && call[1] === 5 && call[2] === 0));
  assert.ok(calls.some((call) => call[0] === "set" && call[1] === "textAlign" && call[2] === "center"));
  assert.ok(calls.some((call) => call[0] === "fillText" && call[1] === "group" && call[3] === 24));
  assert.deepEqual(
    hitTestCanvas({
      canvas,
      scene,
      camera: { x: 0, y: 0, k: 1 },
      config,
      event: { clientX: 5, clientY: 5 },
    }),
    scene.hitRegions.all[0]
  );
  assert.deepEqual(
    hitTestCanvas({
      canvas,
      scene: { ...scene, hitRegions: { all: [] } },
      camera: { x: 0, y: 0, k: 1 },
      config,
      event: { clientX: 0, clientY: 22 },
    }),
    { action: "legend-colour", group: scene.chrome.legend.items[0].source }
  );

  const previousLocus = {
    ...cluster.loci[0],
    x: 0,
    y: 0,
    worldStart: 0,
    worldEnd: 10,
    track: { y: 11 },
  };
  const previous = {
    ...scene,
    clusters: new Map([["cluster", { ...cluster, x: 0, y: 0, loci: [previousLocus] }]]),
    loci: new Map([["locus", previousLocus]]),
    genes: new Map([["gene", { ...scene.genes.get("gene"), polygon: [0, 5, 5, 5, 5, 10, 0, 10] }]]),
  };
  const midway = interpolateCanvasScene(previous, scene, 0.5);
  assert.equal(midway.clusters.get("cluster").x, 2.5);
  assert.equal(midway.loci.get("locus").worldStart, 2.5);
  assert.deepEqual(midway.genes.get("gene").polygon, [2.5, 10, 7.5, 10, 7.5, 15, 2.5, 15]);
});
