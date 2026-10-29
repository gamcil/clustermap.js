import { invalidateTreePresentation, invalidateTreeTopology, validateTreePresentation, treeMetrics } from "./model.mjs";
import { rerootTree, resetTreeRoot } from "./rooting.mjs";
import { validateTree } from "../data/normalize.mjs";

const fail = (message) => { throw new TypeError(`Invalid chart operation: ${message}`); };
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const types = new Set(["tree.presentation.update", "tree.presentation.reset", "tree.presentation.restore"]);
export const isTreePresentationOperation = (operation) => types.has(operation?.type);
export const isTreeTopologyOperation = (operation) => ["tree.reroot", "tree.reroot.reset", "tree.restore"].includes(operation?.type);
export const isTreeOperation = (operation) => isTreePresentationOperation(operation) || isTreeTopologyOperation(operation);

export function normalizeTreeOperation(tree, operation) {
  if (!tree) fail("tree edits require a loaded tree.");
  if (isTreeTopologyOperation(operation)) {
    if (operation.type === "tree.reroot") {
      if (typeof operation.nodeId !== "string" || !operation.nodeId.trim()) fail("rerooting requires a nodeId.");
      return { type: operation.type, nodeId: operation.nodeId };
    }
    if (operation.type === "tree.restore") {
      if (!object(operation.tree)) fail("tree.restore requires a tree.");
      return { type: operation.type, tree: structuredClone(operation.tree) };
    }
    return { type: operation.type };
  }
  if (operation.type === "tree.presentation.restore") {
    return { type: operation.type, ...(own(operation, "presentation") ? { presentation: structuredClone(operation.presentation) } : {}) };
  }
  const { type, scope } = operation;
  if (!["tree", "node", "subtree", "manual"].includes(scope)) fail("unknown tree presentation scope.");
  if (scope === "manual" && type !== "tree.presentation.reset") fail("manual scope is only for resetting all manual styles.");
  if (scope === "tree" && type === "tree.presentation.reset") fail("use manual scope to reset all manual styles; update colouring to reset its policy.");
  let ids;
  if (["node", "subtree"].includes(scope)) {
    if (!Array.isArray(operation.ids) || !operation.ids.length) fail(`${scope} scope requires node IDs.`);
    ids = [...new Set(operation.ids)];
    const nodes = treeMetrics(tree).nodes;
    for (const uid of ids) {
      if (!nodes.has(uid)) fail(`unknown tree node '${uid}'.`);
      if (scope === "subtree" && !nodes.get(uid).children) fail(`subtree '${uid}' is not internal.`);
    }
  } else if (operation.ids !== undefined) fail(`${scope} scope does not accept ids.`);
  const result = { type, scope, ...(ids ? { ids } : {}) };
  if (type === "tree.presentation.update") {
    if (!object(operation.changes) || !Object.keys(operation.changes).length) fail("tree presentation updates require changes.");
    const allowed = scope === "tree" ? ["colouring"] : scope === "subtree" ? ["branch", "collapsed"] : ["branch", "label"];
    if (Object.keys(operation.changes).some((key) => !allowed.includes(key))) fail("unsupported tree presentation update field.");
    const fields = { branch: ["colour", "width"], label: ["text", "colour", "fontSize", "fontWeight", "fontStyle"], colouring: ["mode", "cutHeight", "palette", "showCutLine"] };
    for (const [key, value] of Object.entries(operation.changes)) {
      if (value === null) continue;
      if (key === "collapsed") {
        if (typeof value !== "boolean") fail("collapsed must be boolean.");
        continue;
      }
      if (!object(value) || Object.keys(value).some((field) => !fields[key].includes(field))) {
        fail(`unsupported ${key} fields in tree presentation update.`);
      }
    }
    result.changes = structuredClone(operation.changes);
  }
  return result;
}

// Construct own properties rather than assigning UID keys onto prototypes.
function mergeSparse(previous, changes) {
  const entries = new Map(Object.entries(object(previous) ? previous : {}));
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) entries.delete(key);
    else if (object(value)) {
      const merged = mergeSparse(entries.get(key), value);
      if (Object.keys(merged).length) entries.set(key, merged);
      else entries.delete(key);
    } else entries.set(key, structuredClone(value));
  }
  return Object.fromEntries(entries);
}

export function applyTreeOperation(tree, operation) {
  if (isTreeTopologyOperation(operation)) {
    const next = operation.type === "tree.reroot" ? rerootTree(tree, operation.nodeId)
      : operation.type === "tree.reroot.reset" ? resetTreeRoot(tree) : structuredClone(operation.tree);
    for (const key of Object.keys(tree)) delete tree[key];
    Object.assign(tree, next);
    invalidateTreeTopology(tree);
    return;
  }
  if (operation.type === "tree.presentation.restore") {
    if (own(operation, "presentation")) tree.presentation = structuredClone(operation.presentation);
    else delete tree.presentation;
  } else {
    let presentation = structuredClone(tree.presentation || {});
    if (operation.scope === "manual") {
      delete presentation.nodes;
      delete presentation.subtrees;
    } else if (operation.scope === "tree") presentation = mergeSparse(presentation, operation.changes);
    else {
      const key = operation.scope === "node" ? "nodes" : "subtrees";
      const records = new Map(Object.entries(presentation[key] || {}));
      for (const uid of operation.ids) {
        if (operation.type === "tree.presentation.reset") records.delete(uid);
        else {
          const record = mergeSparse(records.get(uid), operation.changes);
          if (Object.keys(record).length) records.set(uid, record);
          else records.delete(uid);
        }
      }
      if (records.size) presentation[key] = Object.fromEntries(records);
      else delete presentation[key];
    }
    if (Object.keys(presentation).length) tree.presentation = presentation;
    else delete tree.presentation;
  }
  invalidateTreePresentation(tree);
}

export function inverseTreeOperation(tree, operation = null) {
  if (isTreeTopologyOperation(operation)) return { type: "tree.restore", tree: structuredClone(tree) };
  return { type: "tree.presentation.restore", ...(own(tree, "presentation") ? { presentation: structuredClone(tree.presentation) } : {}) };
}

export function validateTreeOperationBatch(tree, operations, config, clusters) {
  if (!operations.some(isTreeOperation)) return;
  const structural = operations.some(isTreeTopologyOperation);
  const draft = structural ? structuredClone(tree) : { ...tree, ...(own(tree, "presentation") ? { presentation: structuredClone(tree.presentation) } : {}) };
  for (const operation of operations.filter(isTreeOperation)) {
    applyTreeOperation(draft, operation);
    if (structural) validateTree(draft, clusters);
    validateTreePresentation(draft, config);
  }
}
