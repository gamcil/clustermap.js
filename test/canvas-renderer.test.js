import test from "node:test";
import assert from "node:assert/strict";

test("canvas renderer draws world-space scene geometry through the camera", async () => {
  const {
	    cameraForMinimapPoint,
    canvasFigureBounds,
    canvasMinimapViewport,
    canvasPixelRatioForCamera,
    canvasWorldViewport,
    createMinimapProjection,
    hitTestCanvas,
    interpolateCanvasScene,
    renderCanvas,
  } = await import("../src/canvasRenderer.js");
  const minimap = createMinimapProjection({
    bounds: { minX: 10, maxX: 110, minY: 20, maxY: 70 },
    width: 120,
    height: 80,
  });
  const assertCoordinates = (actual, expected) => {
    for (const [key, value] of Object.entries(expected)) {
      assert.ok(Math.abs(actual[key] - value) < 1e-9, `${key}: ${actual[key]} ~= ${value}`);
    }
  };
  assertCoordinates(minimap.frame, { x: 4, y: 12, width: 112, height: 56 });
  assertCoordinates(
    canvasMinimapViewport(minimap, { x: -10, y: -20, k: 1 }, { width: 40, height: 30 }),
    { x: 4, y: 12, width: 44.8, height: 33.6 }
  );
  assertCoordinates(
    cameraForMinimapPoint(
      minimap,
      { x: 60, y: 40 },
      { width: 40, height: 30 },
      { x: 0, y: 0, k: 1 }
    ),
    { x: -40, y: -30, k: 1 }
  );
  assert.equal(
    canvasPixelRatioForCamera({ camera: { k: 1 }, devicePixelRatio: 2 }),
    2,
    "native resolution is retained at a readable zoom"
  );
  assert.equal(
    canvasPixelRatioForCamera({ camera: { k: 0.7 }, devicePixelRatio: 2 }),
    1.5
  );
  assert.equal(
    canvasPixelRatioForCamera({ camera: { k: 0.5 }, devicePixelRatio: 2 }),
    1
  );
  assert.equal(
    canvasPixelRatioForCamera({ camera: { k: 0.2 }, devicePixelRatio: 2 }),
    0.75
  );
  assert.equal(
    canvasPixelRatioForCamera({ camera: { k: 1 }, moving: true, devicePixelRatio: 2 }),
    1,
    "active interaction takes precedence over the resting zoom policy"
  );
  const { createSpatialIndex } = await import("../src/spatialIndex.mjs");
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
    source: { uid: "cluster", name: "cluster" },
    x: 5,
    y: 10,
    info: { x: -10, locusText: "locus:1-10" },
    loci: [
      {
        source: { uid: "locus", clusterUid: "cluster" },
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
          source: { uid: "gene", label: "gene", locusUid: "locus" },
          polygon: [5, 15, 10, 15, 10, 20, 5, 20],
          locus: cluster.loci[0],
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
  const distantGene = {
    visible: true,
    source: { uid: "distant", label: "distant" },
    polygon: [1000, 15, 1005, 15, 1005, 20, 1000, 20],
    locus: { x: 1000, y: 10 },
    label: { x: 0, y: 0, rotation: 0 },
    bounds: { minX: 1000, maxX: 1005, minY: 15, maxY: 20 },
  };
  scene.genes.set("distant", distantGene);
  scene.index = {
    genes: createSpatialIndex([
      ["gene", { minX: 5, maxX: 10, minY: 15, maxY: 20 }],
      ["distant", distantGene.bounds],
    ]),
    loci: createSpatialIndex([["locus", { minX: 5, maxX: 15, minY: 0, maxY: 30 }]]),
    links: createSpatialIndex([]),
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
  scene.bounds = { minX: 0, maxX: 20, minY: 10, maxY: 30 };
  assert.deepEqual(canvasFigureBounds(context, scene, config), {
    minX: -85,
    maxX: 45,
    minY: 10,
    maxY: 34,
  });

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

  const highResolution = renderCanvas({
    canvas,
    scene,
    camera: { x: 20, y: 30, k: 2 },
    config,
    scales: { group: () => null, colour: () => "#bbb", score: () => "#000" },
    pixelRatio: 2,
  });
  assert.deepEqual(highResolution, { width: 200, height: 100, pixelRatio: 2 });
  assert.equal(canvas.width, 400);
  assert.equal(canvas.height, 200);

  const callsBeforeSuppressedHover = calls.length;
  renderCanvas({
    canvas,
    scene,
    camera: { x: 20, y: 30, k: 2 },
    config,
    scales: { group: () => null, colour: () => "#bbb", score: () => "#000" },
    hoverLocusUid: "locus",
    suppressLocusHover: true,
  });
  assert.ok(
    !calls.slice(callsBeforeSuppressedHover).some((call) => call[0] === "fillRect"),
    "suppressed hover does not draw the selection rectangle or resize handles"
  );

  renderCanvas({
    canvas,
    scene,
    camera: { x: 20, y: 30, k: 2 },
    config,
    scales: { group: () => null, colour: () => "#bbb", score: () => "#000" },
    preview: {
      type: "cluster-drag",
      clusterUid: "cluster",
      clusterOffsets: new Map([["cluster", 20]]),
      clusterOrder: new Map([["cluster", 0]]),
    },
  });
  assert.ok(calls.some((call) => call[0] === "translate" && call[1] === 0 && call[2] === 20));
  assert.ok(calls.some((call) => call[0] === "set" && call[1] === "textAlign" && call[2] === "center"));
  assert.ok(calls.some((call) => call[0] === "fillText" && call[1] === "group" && call[3] === 24));
  assert.ok(!calls.some((call) => call[0] === "moveTo" && call[1] === 1000));
  assert.deepEqual(
    canvasWorldViewport(canvas, { x: 20, y: 30, k: 2 }, 0),
    { minX: -10, maxX: 90, minY: -15, maxY: 35 }
  );
  assert.deepEqual(
    canvasWorldViewport(canvas, { x: 20, y: 30, k: 2 }, 0, { width: 50, height: 40 }),
    { minX: -10, maxX: 15, minY: -15, maxY: 5 }
  );

  const wideLocus = {
    ...cluster.loci[0],
    worldStart: -100,
    worldEnd: 300,
    bounds: { minX: -100, maxX: 300, minY: 0, maxY: 30 },
  };
  const wideScene = {
    ...scene,
    clusters: new Map([[
      "cluster",
      { ...cluster, loci: [wideLocus] },
    ]]),
    loci: new Map([["locus", wideLocus]]),
    index: {
      ...scene.index,
      loci: createSpatialIndex([["locus", wideLocus.bounds]]),
    },
  };
  calls.length = 0;
  renderCanvas({
    canvas,
    scene: wideScene,
    camera: { x: 0, y: 0, k: 1 },
    config,
    scales: { group: () => null, colour: () => "#bbb", score: () => "#000" },
  });
  assert.ok(calls.some((call) => call[0] === "moveTo" && call[1] === -20));
  assert.ok(calls.some((call) => call[0] === "lineTo" && call[1] === 220));
  assert.ok(!calls.some((call) => call[0] === "lineTo" && call[1] === 300));

  calls.length = 0;
  renderCanvas({
    canvas,
    scene,
    camera: { x: 0, y: 0, k: 1 },
    config,
    scales: { group: () => null, colour: () => "#bbb", score: () => "#000" },
    hoverLocusUid: "locus",
    preview: {
      type: "locus-offset",
      locusUid: "locus",
      offsetX: 20,
      clusterLabelOffsets: new Map([["cluster", 20]]),
    },
  });
  assert.ok(calls.some((call) => call[0] === "moveTo" && call[1] === 25));
  assert.ok(calls.some((call) => call[0] === "translate" && call[1] === 20 && call[2] === 0));
  assert.ok(calls.some((call) => call[0] === "fillText" && call[1] === "cluster" && call[2] === 15));
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

  const trackBefore = {
    ...scene,
    loci: new Map([["locus", { ...cluster.loci[0], track: { x1: 0, x2: 10, y: 11 } }]]),
  };
  const trackAfter = {
    ...scene,
    loci: new Map([["locus", { ...cluster.loci[0], track: { x1: 10, x2: 0, y: 11 } }]]),
  };
  const collapsedTrack = interpolateCanvasScene(trackBefore, trackAfter, 0.5);
  assert.deepEqual(collapsedTrack.loci.get("locus").track, { x1: 5, x2: 5, y: 11 });
});
