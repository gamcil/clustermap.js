import test from "node:test";
import assert from "node:assert/strict";

const createLocus = () => ({
  uid: "locus",
  name: "locus",
  start: 0,
  end: 10000,
  genes: [
    { uid: "a", locusUid: "locus", start: 0, end: 1000, strand: -1 },
    { uid: "b", locusUid: "locus", start: 2500, end: 3500, strand: 1 },
  ],
});

for (const scaleGenes of [false, true]) for (const flipped of [false, true]) {
  test(`deleting trim anchors retains surviving boundaries, scaleGenes=${scaleGenes}, flipped=${flipped}`, async () => {
    const { createChartState, flipLocus, synchronizeLocusState, trimLocusToGeneBounds } = await import("../../src/chart/state.mjs");
    const { createChartIndex } = await import("../../src/data/index.mjs");
    const { applyChartOperations } = await import("../../src/data/operations.mjs");
    const locus = { ...createLocus(), genes: [0, 1, 2].map((index) => ({ uid: `g${index}`, locusUid: "locus",
      start: 100 + index * 2000, end: 1000 + index * 2000, strand: 1 })) };
    const data = { clusters: [{ uid: "c", loci: [locus] }], links: [], groups: [] };
    let state = createChartState(data);
    if (flipped) flipLocus(state, locus);
    synchronizeLocusState(state, locus, scaleGenes);
    trimLocusToGeneBounds(state, locus);
    const original = state.loci.get(locus.uid), right = original.trimRight.uid;
    applyChartOperations(data, createChartIndex(data), [{ type: "genes.delete", ids: [original.trimLeft.uid] }]);
    state = createChartState(data, state);
    synchronizeLocusState(state, locus, scaleGenes);
    assert.equal(state.loci.get(locus.uid).trimLeft.uid, "g1");
    assert.equal(state.loci.get(locus.uid).trimRight.uid, right);
    assert.equal(original.trimLeft.uid, flipped ? "g2" : "g0", "preparing state leaves previous trims intact");
    applyChartOperations(data, createChartIndex(data), [{ type: "genes.delete", ids: locus.genes.map(({ uid }) => uid) }]);
    state = createChartState(data, state);
    synchronizeLocusState(state, locus, scaleGenes);
    assert.deepEqual(state.loci.get(locus.uid), { start: 0, end: scaleGenes ? 10000 : 0,
      flipped, trimLeft: null, trimRight: null });
  });
}

for (const flipped of [false, true]) {
  test(`batch trim preserves existing bounds, flipped=${flipped}`, async () => {
    const { createChartState, flipLocus, getGeneState, trimLocusToGeneBounds } = await import("../../src/chart/state.mjs");
    const locus = { ...createLocus(), genes: [
      { uid: "a", locusUid: "locus", start: 100, end: 1000 },
      { uid: "b", locusUid: "locus", start: 2500, end: 4500 },
      { uid: "c", locusUid: "locus", start: 3500, end: 4000 },
      { uid: "d", locusUid: "locus", start: 7000, end: 9000 },
    ] };
    const state = createChartState({ clusters: [{ loci: [locus] }] });
    if (flipped) flipLocus(state, locus);
    const current = state.loci.get(locus.uid);
    Object.assign(current, flipped ? { start: 5400, end: 8000 } : { start: 2000, end: 4600 });
    assert.equal(trimLocusToGeneBounds(state, locus), true);
    assert.equal(current.start, Math.min(...[1, 2].map((i) => getGeneState(state, locus.genes[i]).start)));
    assert.equal(current.end, Math.max(...[1, 2].map((i) => getGeneState(state, locus.genes[i]).end)));
    assert.equal(trimLocusToGeneBounds(state, locus), false);
    Object.assign(current, { start: 4600, end: 5000, trimLeft: null, trimRight: null });
    const before = { ...current };
    assert.equal(trimLocusToGeneBounds(state, locus), false);
    assert.deepEqual(current, before, "an empty visible range is left intact");
  });
}

test("flipping a locus twice restores its gene state", async () => {
  const { createChartState, flipLocus, getDisplayGenes } = await import("../../src/chart/state.mjs");
  const locus = createLocus();
  const before = structuredClone(locus);
  const state = createChartState({ clusters: [{ loci: [locus] }] });
  Object.freeze(locus.genes);

  flipLocus(state, locus);
  assert.deepEqual(locus, before, "a single flip leaves source records and their order intact");
  assert.deepEqual(getDisplayGenes(state, locus.genes).map(({ uid }) => uid), ["b", "a"]);
  flipLocus(state, locus);

  assert.deepEqual(locus, before);
});

for (const scaleGenes of [false, true]) {
  test(`flips, trims and restored snapshots preserve source order, scaleGenes=${scaleGenes}`, async () => {
    const { createChartState, flipLocus, getGeneState, getDisplayGenes, synchronizeLocusState, trimLocus } =
      await import("../../src/chart/state.mjs");
    const { serializeChartState, chartStateFromSnapshot } = await import("../../src/chart/snapshot.mjs");
    const locus = { ...createLocus(), genes: [
      { uid: "c", locusUid: "locus", start: 4500, end: 6000, strand: 1 },
      { uid: "a", locusUid: "locus", start: 1000, end: 2000, strand: -1 },
      { uid: "b", locusUid: "locus", start: 2500, end: 3000, strand: 1 },
    ] };
    const data = { clusters: [{ uid: "cluster", loci: [locus] }] }, before = structuredClone(data);
    Object.freeze(locus.genes);
    let state = createChartState(data);
    synchronizeLocusState(state, locus, scaleGenes);
    const initial = serializeChartState(state, data);
    assert.deepEqual(getDisplayGenes(state, locus.genes).map(({ uid }) => uid), ["a", "b", "c"]);
    flipLocus(state, locus); synchronizeLocusState(state, locus, scaleGenes);
    assert.deepEqual(getDisplayGenes(state, locus.genes).map(({ uid }) => uid), ["c", "b", "a"]);
    assert.equal(state.loci.get(locus.uid).end, scaleGenes ? 10000 : 3000);
    trimLocus(state, locus, { edge: "left", position: getGeneState(state, locus.genes[2]).start,
      coordinateFor: (value) => value, scaleGenes });
    synchronizeLocusState(state, locus, scaleGenes);
    const trimmed = serializeChartState(state, data);
    state = chartStateFromSnapshot(data, trimmed); synchronizeLocusState(state, locus, scaleGenes);
    assert.deepEqual(serializeChartState(state, data), trimmed);
    state = chartStateFromSnapshot(data, initial); synchronizeLocusState(state, locus, scaleGenes);
    assert.deepEqual(serializeChartState(state, data), initial);
    assert.deepEqual(data, before);
  });
}

test("an empty unscaled locus has no packed gene extent", async () => {
  const { createChartState, synchronizeLocusState } = await import("../../src/chart/state.mjs");
  const locus = { ...createLocus(), genes: [] };
  const state = createChartState({ clusters: [{ loci: [locus] }] });
  synchronizeLocusState(state, locus, false);
  assert.equal(state.loci.get(locus.uid).end, 0);
});

test("synchronizing a trimmed locus updates gene and locus coordinates", async () => {
  const { createChartState, getGeneState, synchronizeLocusState } = await import(
    "../../src/chart/state.mjs"
  );
  const locus = createLocus();
  const state = createChartState({ clusters: [{ loci: [locus] }] });
  state.loci.get(locus.uid).trimLeft = locus.genes[1];
  state.loci.get(locus.uid).trimRight = locus.genes[1];

  const { oldStart } = synchronizeLocusState(state, locus, true);

  assert.equal(oldStart, 0);
  assert.equal(state.loci.get(locus.uid).start, 2500);
  assert.equal(state.loci.get(locus.uid).end, 3500);
  assert.deepEqual(
    locus.genes.map((gene) => getGeneState(state, gene)),
    [
      { start: 0, end: 1000, strand: -1 },
      { start: 2500, end: 3500, strand: 1 },
    ]
  );
});

test("flipping a trimmed locus synchronizes its bounds in display coordinates", async () => {
  const { createChartState, flipLocus, getGeneState, getDisplayGenes, synchronizeLocusState } = await import(
    "../../src/chart/state.mjs"
  );
  const locus = createLocus();
  locus.genes.push({ uid: "c", locusUid: "locus", start: 5500, end: 6500, strand: -1 });
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  // This is the state produced by trimming the original locus at gene c's end.
  const locusState = state.loci.get(locus.uid);
  locusState.trimRight = locus.genes[2];
  locusState.end = 6500;

  flipLocus(state, locus);
  synchronizeLocusState(state, locus, true);

  // The retained portion is now the right-hand side of the flipped display.
  assert.equal(locusState.start, 3500);
  assert.equal(locusState.end, 10000);
  assert.deepEqual(
    getDisplayGenes(state, locus.genes).map((gene) => getGeneState(state, gene).start),
    [3500, 6500, 9000]
  );
});

test("trimming a flipped locus retains the selected display-side genes", async () => {
  const { createChartState, flipLocus, getGeneState, getDisplayGenes, synchronizeLocusState } = await import(
    "../../src/chart/state.mjs"
  );
  const locus = createLocus();
  locus.genes.push({ uid: "c", locusUid: "locus", start: 5500, end: 6500, strand: -1 });
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  flipLocus(state, locus);
  const locusState = state.loci.get(locus.uid);
  const displayedMiddleGene = locus.genes[1];
  locusState.trimRight = displayedMiddleGene;
  locusState.end = getGeneState(state, displayedMiddleGene).end;

  synchronizeLocusState(state, locus, true);

  assert.equal(locusState.start, 0);
  assert.equal(locusState.end, 7500);
  assert.deepEqual(
    getDisplayGenes(state, locus.genes).map((gene) => getGeneState(state, gene).start),
    [3500, 6500, 9000]
  );
});

test("trimming selects display-side gene boundaries without renderer state", async () => {
  const { createChartState, trimLocus } = await import("../../src/chart/state.mjs");
  const locus = createLocus();
  locus.genes.push({ uid: "c", locusUid: "locus", start: 5500, end: 6500, strand: -1 });
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  trimLocus(state, locus, {
    edge: "left",
    position: 2400,
    coordinateFor: (value) => value,
    scaleGenes: true,
  });
  assert.equal(state.loci.get(locus.uid).start, 2500);
  assert.equal(state.loci.get(locus.uid).trimLeft, locus.genes[1]);

  trimLocus(state, locus, {
    edge: "right",
    position: 3400,
    coordinateFor: (value) => value,
    scaleGenes: true,
  });
  assert.equal(state.loci.get(locus.uid).end, 3500);
  assert.equal(state.loci.get(locus.uid).trimRight, locus.genes[1]);
});

test("trimming to gene bounds removes both locus flanks", async () => {
  const { createChartState, trimLocusToGeneBounds } = await import("../../src/chart/state.mjs");
  const locus = {
    uid: "locus",
    start: 0,
    end: 10000,
    genes: [
      { uid: "a", locusUid: "locus", start: 1200, end: 2300, strand: 1 },
      { uid: "b", locusUid: "locus", start: 5000, end: 6800, strand: -1 },
    ],
  };
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  assert.equal(trimLocusToGeneBounds(state, locus), true);
  assert.deepEqual(state.loci.get(locus.uid), {
    start: 1200,
    end: 6800,
    flipped: false,
    trimLeft: locus.genes[0],
    trimRight: locus.genes[1],
  });
  assert.equal(trimLocusToGeneBounds(state, locus), false);
});

test("trimming to gene bounds follows displayed gene order after a flip", async () => {
  const { createChartState, flipLocus, trimLocusToGeneBounds } = await import("../../src/chart/state.mjs");
  const locus = {
    uid: "locus",
    start: 0,
    end: 10000,
    genes: [
      { uid: "a", locusUid: "locus", start: 1200, end: 2300, strand: 1 },
      { uid: "b", locusUid: "locus", start: 5000, end: 6800, strand: -1 },
    ],
  };
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  flipLocus(state, locus);
  trimLocusToGeneBounds(state, locus);
  assert.equal(state.loci.get(locus.uid).start, 3200);
  assert.equal(state.loci.get(locus.uid).end, 8800);
  assert.equal(state.loci.get(locus.uid).trimLeft.uid, "b");
  assert.equal(state.loci.get(locus.uid).trimRight.uid, "a");
});

test("restoring locus bounds preserves a flipped orientation", async () => {
  const {
    createChartState,
    flipLocus,
    restoreLocusBounds,
    trimLocusToGeneBounds,
  } = await import("../../src/chart/state.mjs");
  const locus = {
    uid: "locus",
    start: 0,
    end: 10000,
    genes: [
      { uid: "a", locusUid: "locus", start: 1200, end: 2300, strand: 1 },
      { uid: "b", locusUid: "locus", start: 5000, end: 6800, strand: -1 },
    ],
  };
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  flipLocus(state, locus);
  trimLocusToGeneBounds(state, locus);
  assert.equal(restoreLocusBounds(state, locus), true);
  assert.deepEqual(state.loci.get(locus.uid), {
    start: 0,
    end: 10000,
    flipped: true,
    trimLeft: null,
    trimRight: null,
  });
  assert.equal(restoreLocusBounds(state, locus), false);
});

test("trimming previews bounds without changing committed locus state", async () => {
  const {
    commitPreviewLocusState,
    createChartState,
    getLocusState,
    previewLocusTrim,
  } = await import("../../src/chart/state.mjs");
  const locus = createLocus();
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  previewLocusTrim(state, locus, {
    edge: "left",
    position: 2400,
    coordinateFor: (value) => value,
    scaleGenes: true,
  });
  assert.equal(getLocusState(state, locus).start, 2500);
  assert.equal(state.loci.get(locus.uid).start, 0);

  commitPreviewLocusState(state, locus);
  assert.equal(state.loci.get(locus.uid).start, 2500);
});

test("locus labels show trimmed and reversed coordinates", async () => {
  const { createChartState, formatLocusText } = await import("../../src/chart/state.mjs");
  const locus = createLocus();
  const state = createChartState({ clusters: [{ loci: [locus] }] });
  state.loci.get(locus.uid).start = 2500;
  state.loci.get(locus.uid).end = 6500;

  assert.equal(formatLocusText([locus], state, false), "locus:2501-6500");

  state.loci.get(locus.uid).flipped = true;
  assert.equal(
    formatLocusText([locus], state, false),
    "locus (reversed):6500-2501"
  );
});

test("locus labels preserve zero-based biological coordinates after a flip", async () => {
  const { createChartState, formatLocusText } = await import("../../src/chart/state.mjs");
  const locus = {
    ...createLocus(),
    bio: { start: 0, end: 10000 },
  };
  const state = createChartState({ clusters: [{ loci: [locus] }] });
  Object.assign(state.loci.get(locus.uid), {
    // This is the display state after flipping and then trimming at 7500.
    start: 0,
    end: 7500,
    flipped: true,
  });

  assert.equal(
    formatLocusText([locus], state, false),
    "locus (reversed):10000-2501"
  );
});
