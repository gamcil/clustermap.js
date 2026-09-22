const test = require("node:test");
const assert = require("node:assert/strict");

const createLocus = () => ({
  name: "locus",
  start: 0,
  end: 10000,
  _start: 0,
  _end: 10000,
  _flipped: false,
  _trimLeft: null,
  _trimRight: null,
  genes: [
    { uid: "a", _start: 0, _end: 1000, _strand: -1 },
    { uid: "b", _start: 2500, _end: 3500, _strand: 1 },
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
  const { createChartState, recalculateLocusCoordinates } = await import(
    "../src/chartState.mjs"
  );
  const locus = createLocus();
  const state = createChartState({ clusters: [{ loci: [locus] }] });
  state.loci.get(locus.uid).trimLeft = { start: 2500 };
  state.loci.get(locus.uid).trimRight = { end: 3500 };

  const { oldStart } = recalculateLocusCoordinates(state, locus, true);

  assert.equal(oldStart, 0);
  assert.equal(state.loci.get(locus.uid).start, 2500);
  assert.equal(state.loci.get(locus.uid).end, 3500);
  assert.deepEqual(
    locus.genes.map(({ start, end, strand }) => ({ start, end, strand })),
    [
      { start: 0, end: 1000, strand: -1 },
      { start: 2500, end: 3500, strand: 1 },
    ]
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
