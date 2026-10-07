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

test("flipping a locus twice restores its gene state", async () => {
  const { createChartState, flipLocus } = await import("../src/chartState.mjs");
  const locus = createLocus();
  const before = structuredClone(locus);
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  flipLocus(state, locus);
  flipLocus(state, locus);

  assert.deepEqual(locus, before);
});

test("synchronizing a trimmed locus updates gene and locus coordinates", async () => {
  const { createChartState, getGeneState, synchronizeLocusState } = await import(
    "../src/chartState.mjs"
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
  const { createChartState, flipLocus, getGeneState, synchronizeLocusState } = await import(
    "../src/chartState.mjs"
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
    locus.genes.map((gene) => getGeneState(state, gene).start),
    [3500, 6500, 9000]
  );
});

test("trimming a flipped locus retains the selected display-side genes", async () => {
  const { createChartState, flipLocus, getGeneState, synchronizeLocusState } = await import(
    "../src/chartState.mjs"
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
    locus.genes.map((gene) => getGeneState(state, gene).start),
    [3500, 6500, 9000]
  );
});

test("trimming selects display-side gene boundaries without renderer state", async () => {
  const { createChartState, trimLocus } = await import("../src/chartState.mjs");
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
  const { createChartState, trimLocusToGeneBounds } = await import("../src/chartState.mjs");
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
  const { createChartState, flipLocus, trimLocusToGeneBounds } = await import("../src/chartState.mjs");
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
  } = await import("../src/chartState.mjs");
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
  } = await import("../src/chartState.mjs");
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
  const { createChartState, formatLocusText } = await import("../src/chartState.mjs");
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
  const { createChartState, formatLocusText } = await import("../src/chartState.mjs");
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
