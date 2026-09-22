const test = require("node:test");
const assert = require("node:assert/strict");

const createLocus = () => ({
  uid: "locus",
  name: "locus",
  start: 0,
  end: 10000,
  _start: 0,
  _end: 10000,
  _flipped: false,
  _trimLeft: null,
  _trimRight: null,
  genes: [
    { uid: "a", _locus: "locus", start: 0, end: 1000, strand: -1 },
    { uid: "b", _locus: "locus", start: 2500, end: 3500, strand: 1 },
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

test("recalculating a trimmed locus updates gene and locus coordinates", async () => {
  const { createChartState, getGeneState, recalculateLocusCoordinates } = await import(
    "../src/chartState.mjs"
  );
  const locus = createLocus();
  const state = createChartState({ clusters: [{ loci: [locus] }] });
  state.loci.get(locus.uid).trimLeft = locus.genes[1];
  state.loci.get(locus.uid).trimRight = locus.genes[1];

  const { oldStart } = recalculateLocusCoordinates(state, locus, true);

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

test("flipping a trimmed locus recalculates its bounds in display coordinates", async () => {
  const { createChartState, flipLocus, getGeneState, recalculateLocusCoordinates } = await import(
    "../src/chartState.mjs"
  );
  const locus = createLocus();
  locus.genes.push({ uid: "c", _locus: "locus", start: 5500, end: 6500, strand: -1 });
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  // This is the state produced by trimming the original locus at gene c's end.
  const locusState = state.loci.get(locus.uid);
  locusState.trimRight = locus.genes[2];
  locusState.end = 6500;

  flipLocus(state, locus);
  recalculateLocusCoordinates(state, locus, true);

  // The retained portion is now the right-hand side of the flipped display.
  assert.equal(locusState.start, 3500);
  assert.equal(locusState.end, 10000);
  assert.deepEqual(
    locus.genes.map((gene) => getGeneState(state, gene).start),
    [3500, 6500, 9000]
  );
});

test("trimming a flipped locus retains the selected display-side genes", async () => {
  const { createChartState, flipLocus, getGeneState, recalculateLocusCoordinates } = await import(
    "../src/chartState.mjs"
  );
  const locus = createLocus();
  locus.genes.push({ uid: "c", _locus: "locus", start: 5500, end: 6500, strand: -1 });
  const state = createChartState({ clusters: [{ loci: [locus] }] });

  flipLocus(state, locus);
  const locusState = state.loci.get(locus.uid);
  const displayedMiddleGene = locus.genes[1];
  locusState.trimRight = displayedMiddleGene;
  locusState.end = getGeneState(state, displayedMiddleGene).end;

  recalculateLocusCoordinates(state, locus, true);

  assert.equal(locusState.start, 0);
  assert.equal(locusState.end, 7500);
  assert.deepEqual(
    locus.genes.map((gene) => getGeneState(state, gene).start),
    [3500, 6500, 9000]
  );
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
    _bio_start: 0,
    _bio_end: 10000,
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
