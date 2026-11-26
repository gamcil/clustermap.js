import test from "node:test";
import assert from "node:assert/strict";
import { operationEffects } from "../../src/data/operations.mjs";

test("edit impacts combine presentation, biological and history requirements", () => {
  const tree = { type: "tree.presentation.update" };
  const annotation = { type: "annotationPanels.update" };
  assert.deepEqual(operationEffects([tree, annotation]), {
    presentationOnly: true, refilterLinks: false, reindex: false, rebuildState: false, captureState: false,
  });
  assert.deepEqual(operationEffects([tree, { type: "groups.delete" }, { type: "genes.delete" }]), {
    presentationOnly: false, refilterLinks: true, reindex: "data", rebuildState: true, captureState: true,
  });
  assert.equal(operationEffects([{ type: "unknown" }]).refilterLinks, true);
});
