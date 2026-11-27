import { createChartIndex } from "../data/index.mjs";
import { applyChartOperations, operationEffects } from "../data/operations.mjs";
import { createLinkGroups } from "../links/groups.mjs";
import { createChartState } from "./state.mjs";
import { chartStateFromSnapshot, createChartStateSerializer } from "./snapshot.mjs";

function automaticGroups(data) { return data?.config?.updateGroups !== false; }

function refreshGroups(data, index, derive = automaticGroups(data)) {
  if (derive) {
    // Deleted genes retain their links, but dangling endpoints cannot group.
    data.groups = createLinkGroups(data.links, data.groups, index.geneById);
  } else data.groups ??= [];
  index.groupById = new Map(data.groups.map((group) => [group.uid, group]));
}

// Own committed data, indexes, snapshots and history. Rendering and transient
// interaction state remain with the chart until their own boundaries exist.
export function createChartModel() {
  let data = null, index = null;
  const snapshots = createChartStateSerializer(), history = [], future = [];
  const stacks = (direction) => direction === "undo" ? [history, future] : [future, history];

  return {
    get data() { return data; },
    get index() { return index; },
    snapshots,
    prepare(nextData, previousState, state = null) {
      const nextIndex = createChartIndex(nextData);
      refreshGroups(nextData, nextIndex);
      return { data: nextData, index: nextIndex, state: state || createChartState(nextData, previousState) };
    },
    install(prepared) {
      data = prepared.data; index = prepared.index;
      snapshots.reset(data);
    },
    clear() { data = index = null; snapshots.reset(); },
    historyStatus() { return { canUndo: history.length > 0, canRedo: future.length > 0 }; },
    clearHistory() { history.length = future.length = 0; },
    commit(change) {
      if (!change) return;
      history.push(change);
      if (history.length > 100) history.shift();
      future.length = 0;
    },
    peek(direction) { return stacks(direction)[0].at(-1); },
    completeReplay(direction) { const [source, target] = stacks(direction); target.push(source.pop()); },
    applyPatch(operations, currentState, treeConfig, { record = true, automaticGroups: restoreAutomatic, state = null } = {}) {
      const impact = operationEffects(operations);
      // In-place edits invalidate the cached biological defaults.
      if (!impact.presentationOnly) snapshots.reset();
      const groupsAutomaticBefore = automaticGroups(data);
      const undoState = record && impact.captureState ? snapshots.serialize(currentState, data) : null;
      const result = applyChartOperations(data, index, operations, treeConfig);
      const restoringAutomatic = restoreAutomatic !== undefined && restoreAutomatic !== automaticGroups(data);
      if (restoringAutomatic) data.config = { ...(data.config || {}), updateGroups: restoreAutomatic };
      const groupsAutomaticAfter = automaticGroups(data);
      const refreshAutomatic = groupsAutomaticAfter && (restoringAutomatic || !groupsAutomaticBefore);
      let indexChanged = false, stateChanged = false, nextState = currentState;
      if (!result.effects.presentationOnly || restoringAutomatic) {
        if (result.effects.reindex === "data" && !result.indexPrepared) index = createChartIndex(data);
        if (result.effects.reindex || refreshAutomatic) {
          refreshGroups(data, index, groupsAutomaticAfter && (result.effects.reindex === "data" || refreshAutomatic));
          indexChanged = true;
        }
        if (result.effects.rebuildState) {
          nextState = createChartState(data, currentState);
          stateChanged = true;
        }
        snapshots.reset(data);
      }
      if (state) { nextState = chartStateFromSnapshot(data, state); stateChanged = true; }
      return { ...result, state: nextState, indexChanged, stateChanged, restoringAutomatic,
        refilterLinks: result.effects.refilterLinks || restoreAutomatic !== undefined,
        history: record ? { kind: "patch", undo: result.inverse, redo: result.operations,
          groupsAutomaticBefore, groupsAutomaticAfter, ...(undoState ? { undoState } : {}) } : null };
    },
  };
}
