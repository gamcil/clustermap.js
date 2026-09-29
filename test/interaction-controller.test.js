import test from "node:test";
import assert from "node:assert/strict";

test("interaction controller previews and commits drag state from world coordinates", async () => {
  const { createInteractionController } = await import(
    "../src/interactionController.mjs"
  );
  const calls = [];
  const controller = createInteractionController({
    clusterRows: () => [0, 50, 100],
    getClusterOrder: () => ["a", "b", "c"],
    getClusterPosition: () => 0,
    getLocusOffset: () => 10,
    setDragging: (dragging) => calls.push(["dragging", dragging]),
    previewClusterDrag: (uid, y, order) => calls.push(["cluster", uid, y, order]),
    commitClusterOrder: () => calls.push(["commit-cluster"]),
    previewLocusOffset: (uid, offset) => calls.push(["locus", uid, offset]),
    commitLocusOffset: (uid) => calls.push(["commit-locus", uid]),
    previewLocusTrim: (locus, edge, x) => calls.push(["trim", locus.uid, edge, x]),
    commitLocusTrim: (locus) => calls.push(["commit-trim", locus.uid]),
    flipLocus: (locus) => calls.push(["flip", locus.uid]),
  });

  controller.beginClusterDrag("a", 5);
  controller.moveClusterDrag(30);
  controller.moveClusterDrag(65);
  controller.endClusterDrag();
  controller.beginLocusDrag("locus", 20);
  controller.moveLocusDrag(45);
  controller.endLocusDrag();
  controller.beginLocusTrim();
  controller.moveLocusTrim({ uid: "locus" }, "right", 80);
  controller.endLocusTrim({ uid: "locus" });
  controller.flipLocus({ uid: "locus" });

  assert.deepEqual(calls, [
    ["dragging", true],
    ["cluster", "a", 25, null],
    ["cluster", "a", 60, ["b", "a", "c"]],
    ["dragging", false],
    ["commit-cluster"],
    ["dragging", true],
    ["locus", "locus", 35],
    ["dragging", false],
    ["commit-locus", "locus"],
    ["dragging", true],
    ["trim", "locus", "right", 80],
    ["dragging", false],
    ["commit-trim", "locus"],
    ["flip", "locus"],
  ]);
});

test("interaction controller cancels an unstarted drag without committing state", async () => {
  const { createInteractionController } = await import(
    "../src/interactionController.mjs"
  );
  const calls = [];
  const controller = createInteractionController({
    clusterRows: () => [0],
    getClusterOrder: () => ["cluster"],
    getClusterPosition: () => 0,
    getLocusOffset: () => 0,
    setDragging: (dragging) => calls.push(["dragging", dragging]),
    previewClusterDrag: () => calls.push(["preview-cluster"]),
    commitClusterOrder: () => calls.push(["commit-cluster"]),
    previewLocusOffset: () => calls.push(["preview-locus"]),
    commitLocusOffset: () => calls.push(["commit-locus"]),
    previewLocusTrim: () => calls.push(["preview-trim"]),
    commitLocusTrim: () => calls.push(["commit-trim"]),
    flipLocus: () => {},
  });

  controller.beginClusterDrag("cluster", 0);
  controller.cancelClusterDrag();
  controller.beginLocusDrag("locus", 0);
  controller.cancelLocusDrag();
  controller.beginLocusTrim();
  controller.cancelLocusTrim();

  assert.deepEqual(calls, [
    ["dragging", true],
    ["dragging", false],
    ["dragging", true],
    ["dragging", false],
    ["dragging", true],
    ["dragging", false],
  ]);
});

test("interaction controller drags a selected locus set by one shared delta", async () => {
  const { createInteractionController } = await import(
    "../src/interactionController.mjs"
  );
  const calls = [];
  const controller = createInteractionController({
    clusterRows: () => [0],
    getClusterOrder: () => ["cluster"],
    getClusterPosition: () => 0,
    getLocusOffset: (uid) => uid === "left" ? 10 : 40,
    selectedLocusIds: () => ["left", "right"],
    setDragging: (value) => calls.push(["dragging", value]),
    previewClusterDrag: () => {},
    commitClusterOrder: () => {},
    previewLocusOffset: () => {},
    previewLocusOffsets: (offsets) => calls.push(["preview", [...offsets]]),
    commitLocusOffset: (ids) => calls.push(["commit", ids]),
    previewLocusTrim: () => {},
    commitLocusTrim: () => {},
    flipLocus: () => {},
  });

  controller.beginLocusDrag("left", 100);
  controller.moveLocusDrag(115);
  controller.endLocusDrag();

  assert.deepEqual(calls, [
    ["dragging", true],
    ["preview", [["left", 25], ["right", 55]]],
    ["dragging", false],
    ["commit", ["left", "right"]],
  ]);
});
