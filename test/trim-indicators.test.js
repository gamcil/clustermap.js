import test from "node:test";
import assert from "node:assert/strict";

test("trim indicators describe each hidden locus flank in display coordinates", async () => {
  const { createTrimIndicators } = await import("../src/loci/trimIndicators.mjs");
  const locus = {
    start: 0,
    end: 10000,
    genes: [
      { uid: "left" },
      { uid: "visible" },
      { uid: "right-one" },
      { uid: "right-two" },
    ],
  };
  const states = new Map([
    ["left", { start: 500, end: 1000 }],
    ["visible", { start: 2000, end: 5000 }],
    ["right-one", { start: 6500, end: 7000 }],
    ["right-two", { start: 8000, end: 9000 }],
  ]);

  assert.deepEqual(
    createTrimIndicators({
      locus,
      state: { start: 2000, end: 6500 },
      getGeneState: (gene) => states.get(gene.uid),
      scaleX: (value) => value / 10,
      shape: { tipHeight: 5, bodyHeight: 12 },
    }),
    [
      {
        side: "left",
        x: 203,
        y: 26,
        anchor: "start",
        text: "← 2 kb · 1 feature",
      },
      {
        side: "right",
        x: 647,
        y: 38,
        anchor: "end",
        text: "2 features · 3.5 kb →",
      },
    ]
  );
});

test("trim indicators are absent for an untrimmed locus", async () => {
  const { createTrimIndicators } = await import("../src/loci/trimIndicators.mjs");
  const locus = { start: 0, end: 100, genes: [] };
  assert.deepEqual(
    createTrimIndicators({
      locus,
      state: { start: 0, end: 100 },
      getGeneState: () => null,
      scaleX: (value) => value,
    }),
    []
  );
});
