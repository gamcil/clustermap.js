import test from "node:test";
import assert from "node:assert/strict";
import { createChartModel } from "../../src/chart/model.mjs";
import { CompactLinkStore } from "../../src/data/linkStore.mjs";
import { normalizeChartData } from "../../src/data/normalize.mjs";

for (const compact of [false, true]) test(`model owns patch indexes and history with ${compact ? "compact" : "array"} links`, () => {
  const store = new CompactLinkStore({ genes: ["a", "b"], query: new Uint32Array([0]), target: new Uint32Array([1]),
    identity: new Float32Array([0.75]), similarity: new Float32Array([1]) });
  const data = normalizeChartData({ clusters: [{ uid: "cluster", loci: [{ uid: "locus", start: 0, end: 100,
    genes: [{ uid: "a", start: 0, end: 10, strand: 1 }, { uid: "b", start: 20, end: 30, strand: 1 }] }] }],
    links: compact ? store : [...store.values()], groups: [], config: { updateGroups: false } });
  const model = createChartModel({ historyLimit: 2 }), prepared = model.prepare(data, null);
  model.install(prepared);
  const initialIndex = model.index, initialState = prepared.state;
  const update = model.applyPatch([{ type: "links.update", ids: ["link-0"], changes: { label: "edited" } }], initialState, {});
  assert.equal(model.index, initialIndex, "a non-structural edit retains the index");
  assert.equal(model.index.linkById.get("link-0").label, "edited");
  assert.equal(update.indexChanged, false);
  model.commit(update.history);
  assert.deepEqual(model.historyStatus(), { canUndo: true, canRedo: false });
  assert.throws(() => model.applyPatch([{ type: "links.delete", ids: ["missing"] }], initialState, {}), /unknown/);
  assert.equal(model.index.linkById.get("link-0").label, "edited");
  assert.equal(model.peek("undo"), update.history);
  const undo = model.applyPatch(update.history.undo, initialState, {}, { record: false,
    automaticGroups: update.history.groupsAutomaticBefore });
  model.completeReplay("undo");
  assert.equal(model.index.linkById.get("link-0").label, undefined);
  assert.equal(undo.history, null);
  assert.deepEqual(model.historyStatus(), { canUndo: false, canRedo: true });
  const deletion = model.applyPatch([{ type: "genes.delete", ids: ["a"] }], initialState, {});
  assert.equal(deletion.indexChanged, true);
  assert.equal(deletion.stateChanged, true);
  assert.equal(model.index.geneById.has("a"), false);
  assert.ok(deletion.history.undoState);
  model.commit(deletion.history);
  assert.equal(model.historyStatus().canRedo, false, "new edits clear redo");
  model.clearHistory();
  model.clear();
  assert.equal(model.data, null);
  assert.equal(model.index, null);
  assert.deepEqual(model.historyStatus(), { canUndo: false, canRedo: false });
});
