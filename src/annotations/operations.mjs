import { validateAnnotationPanels } from "./model.mjs";

const styleFields = new Set(["show", "title", "columns", "scale", "cellWidth", "cellHeight", "gap",
  "groups", "markerWidth", "laneGap", "fontSize", "missingColour", "headingRotation", "showColumnLabels", "showKey",
  "cellGap", "cellBorderWidth", "cellBorderColour", "width", "colour"]);
const fields = new Set([...styleFields, "values"]);
const fail = (message) => { throw new TypeError(`Invalid annotation operation: ${message}`); };

export const isAnnotationOperation = (operation) => typeof operation?.type === "string" && operation.type.startsWith("annotationPanels.");

export function normalizeAnnotationOperation(data, operation) {
  const known = new Set((data.annotationPanels || []).map((panel) => panel.uid));
  if (operation.type === "annotationPanels.create") {
    if (!operation.panel || typeof operation.panel.uid !== "string" || !operation.panel.uid.trim() || known.has(operation.panel.uid)) fail("create requires a new, non-empty panel uid.");
    const index = operation.index ?? known.size;
    if (!Number.isInteger(index) || index < 0 || index > known.size) fail("index must be a valid panel insertion position.");
    return { type: operation.type, panel: structuredClone(operation.panel), index };
  }
  if (operation.type === "annotationPanels.reorder") {
    if (!Array.isArray(operation.ids) || operation.ids.length !== known.size || new Set(operation.ids).size !== known.size ||
        operation.ids.some((uid) => !known.has(uid))) fail("reorder must contain every panel uid exactly once.");
    return { type: operation.type, ids: [...operation.ids] };
  }
  if (operation.type === "annotationPanels.delete") {
    if (!Array.isArray(operation.ids) || !operation.ids.length || operation.ids.some((uid) => !known.has(uid))) fail("delete requires existing panel IDs.");
    return { type: operation.type, ids: [...new Set(operation.ids)] };
  }
  if (operation.type === "annotationPanels.updateRows") {
    const panel = data.annotationPanels?.find((panel) => panel.uid === operation.uid);
    if (!panel || panel.type === "groups" || !operation.values || typeof operation.values !== "object" ||
        Array.isArray(operation.values) || !Object.keys(operation.values).length ||
        Object.values(operation.values).some((row) => row !== null && !Array.isArray(row))) fail("updateRows requires a matrix panel and row arrays (or null to remove a row).");
    const clusterIds = new Set(data.clusters.map((cluster) => cluster.uid));
    if (Object.keys(operation.values).some((uid) => !clusterIds.has(uid))) fail("updateRows requires existing cluster IDs.");
    return { type: operation.type, uid: operation.uid, values: structuredClone(operation.values) };
  }
  if (operation.type === "annotationPanels.replaceStyle") {
    if (!known.has(operation.uid) || !operation.style || typeof operation.style !== "object" ||
        Array.isArray(operation.style) || Object.keys(operation.style).some((key) => !styleFields.has(key))) fail("replaceStyle requires an existing panel and supported style fields.");
    return { type: operation.type, uid: operation.uid, style: structuredClone(operation.style) };
  }
  if (operation.type !== "annotationPanels.update") fail(`unsupported type '${operation.type}'.`);
  if (!Array.isArray(operation.ids) || !operation.ids.length || operation.ids.some((uid) => !known.has(uid))) fail("ids must reference existing panels.");
  const changes = operation.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length ||
      Object.keys(changes).some((key) => !fields.has(key))) fail("changes contains unsupported fields.");
  return { type: operation.type, ids: [...new Set(operation.ids)], changes: structuredClone(changes) };
}

export function applyAnnotationOperation(data, operation) {
  const panels = data.annotationPanels || [];
  if (operation.type === "annotationPanels.create") {
    data.annotationPanels = [...panels];
    data.annotationPanels.splice(operation.index, 0, structuredClone(operation.panel));
    return;
  }
  if (operation.type === "annotationPanels.delete") {
    data.annotationPanels = panels.filter((panel) => !operation.ids.includes(panel.uid));
    return;
  }
  if (operation.type === "annotationPanels.reorder") {
    const byId = new Map(panels.map((panel) => [panel.uid, panel]));
    data.annotationPanels = operation.ids.map((uid) => byId.get(uid));
    return;
  }
  if (operation.type === "annotationPanels.updateRows") {
    data.annotationPanels = panels.map((panel) => {
      if (panel.uid !== operation.uid) return panel;
      const values = { ...panel.values, ...structuredClone(operation.values) };
      for (const [uid, row] of Object.entries(operation.values)) if (row === null) delete values[uid];
      return { ...panel, values };
    });
    return;
  }
  data.annotationPanels = panels.map((panel) => operation.type === "annotationPanels.replaceStyle"
    ? panel.uid === operation.uid ? {
      ...Object.fromEntries(Object.entries(panel).filter(([key]) => !styleFields.has(key))),
      ...structuredClone(operation.style),
    } : panel
    : operation.ids.includes(panel.uid) ? { ...panel, ...structuredClone(operation.changes) } : panel);
}

export function inverseAnnotationOperation(data, operation) {
  if (operation.type === "annotationPanels.create") return [{ type: "annotationPanels.delete", ids: [operation.panel.uid] }];
  if (operation.type === "annotationPanels.reorder") return [{ type: operation.type, ids: (data.annotationPanels || []).map((panel) => panel.uid) }];
  if (operation.type === "annotationPanels.delete") return data.annotationPanels.flatMap((panel, index) =>
    operation.ids.includes(panel.uid) ? [{ type: "annotationPanels.create", panel: structuredClone(panel), index }] : []);
  if (operation.type === "annotationPanels.updateRows") {
    const panel = data.annotationPanels.find((panel) => panel.uid === operation.uid);
    return [{ type: operation.type, uid: panel.uid, values: structuredClone(Object.fromEntries(
      Object.keys(operation.values).map((uid) => [uid, Object.hasOwn(panel.values, uid) ? panel.values[uid] : null]))) }];
  }
  const ids = operation.type === "annotationPanels.replaceStyle" ? [operation.uid] : operation.ids;
  return data.annotationPanels.filter((panel) => ids.includes(panel.uid))
    .flatMap((panel) => [
      { type: "annotationPanels.replaceStyle", uid: panel.uid,
        style: structuredClone(Object.fromEntries(Object.entries(panel).filter(([key]) => styleFields.has(key)))) },
      ...(operation.type === "annotationPanels.update" && Object.hasOwn(operation.changes, "values")
        ? [{ type: "annotationPanels.update", ids: [panel.uid], changes: { values: structuredClone(panel.values) } }] : []),
    ]);
}

// The operation normalizer has already built this private candidate array.
export function validateAnnotationChanges(data, panels) {
  if (panels === data.annotationPanels) return;
  validateAnnotationPanels(panels, data.clusters, { previousPanels: data.annotationPanels, tree: data.tree });
}
