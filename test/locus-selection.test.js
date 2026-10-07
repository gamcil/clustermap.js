import test from "node:test";
import assert from "node:assert/strict";

test("cluster range selection includes every locus in displayed clusters", async () => {
  const { lociForClusterRange } = await import("../src/locusSelection.mjs");
  const clusters = new Map([
    ["a", { loci: [{ uid: "a-1" }] }],
    ["b", { loci: [{ uid: "b-1" }, { uid: "b-2" }] }],
    ["c", { loci: [{ uid: "c-1" }] }],
  ]);

  assert.deepEqual(
    lociForClusterRange(["c", "a", "b"], clusters, "a", "b"),
    ["a-1", "b-1", "b-2"]
  );
  assert.deepEqual(
    lociForClusterRange(["c", "a", "b"], clusters, "b", "c"),
    ["c-1", "a-1", "b-1", "b-2"]
  );
});
