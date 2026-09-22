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
  const { flipLocus } = await import("../src/loci/state.mjs");
  const locus = createLocus();
  const before = structuredClone(locus);

  flipLocus(locus);
  flipLocus(locus);

  assert.deepEqual(locus, before);
});

test("recalculating a trimmed locus updates gene and locus coordinates", async () => {
  const { recalculateLocusCoordinates } = await import(
    "../src/loci/state.mjs"
  );
  const locus = createLocus();
  locus._trimLeft = { start: 2500 };
  locus._trimRight = { end: 3500 };

  const { oldStart } = recalculateLocusCoordinates(locus, true);

  assert.equal(oldStart, 0);
  assert.equal(locus._start, 2500);
  assert.equal(locus._end, 3500);
  assert.deepEqual(
    locus.genes.map(({ start, end, strand }) => ({ start, end, strand })),
    [
      { start: 0, end: 1000, strand: -1 },
      { start: 2500, end: 3500, strand: 1 },
    ]
  );
});

test("locus labels show trimmed and reversed coordinates", async () => {
  const { formatLocusText } = await import("../src/loci/state.mjs");
  const locus = createLocus();
  locus._start = 2500;
  locus._end = 6500;

  assert.equal(formatLocusText([locus], false), "locus:2501-6500");

  locus._flipped = true;
  assert.equal(
    formatLocusText([locus], false),
    "locus (reversed):6500-2501"
  );
});
