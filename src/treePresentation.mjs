import { color } from "d3-color";

export const TREE_COLOURING_DEFAULTS = {
  mode: "none",
  cutHeight: "auto",
  palette: ["#267c9e", "#d7752d", "#5c8f39", "#9963a5", "#c34d61", "#9e8433"],
  showCutLine: false,
};
const metricsCache = new WeakMap();
const stylesCache = new WeakMap();
const fail = (message) => { throw new TypeError(`Invalid tree presentation: ${message}`); };
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function fields(value, allowed, where) {
  if (!object(value)) fail(`${where} must be an object.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${where}.${key} is unsupported.`);
}
function colour(value, where) {
  if (typeof value !== "string" || !color(value)) fail(`${where} must be a valid colour.`);
}
function positive(value, where) {
  if (!Number.isFinite(value) || value <= 0) fail(`${where} must be finite and positive.`);
}
export function validateTreeColouring(policy) {
  if (policy === undefined) return;
  fields(policy, ["mode", "cutHeight", "palette", "showCutLine"], "colouring");
  if (own(policy, "mode") && !["none", "cutHeight"].includes(policy.mode)) fail("colouring.mode must be none or cutHeight.");
  if (own(policy, "cutHeight") && policy.cutHeight !== "auto" && (!Number.isFinite(policy.cutHeight) || policy.cutHeight < 0)) {
    fail('colouring.cutHeight must be "auto" or a finite non-negative number.');
  }
  if (own(policy, "showCutLine") && typeof policy.showCutLine !== "boolean") fail("colouring.showCutLine must be boolean.");
  if (own(policy, "palette")) {
    if (!Array.isArray(policy.palette) || !policy.palette.length) fail("colouring.palette must be a non-empty colour array.");
    policy.palette.forEach((entry) => colour(entry, "colouring.palette"));
  }
}

/** Biological distances and canonical ID order survive child rotation unchanged. */
function treeMetrics(tree) {
  if (metricsCache.has(tree)) return metricsCache.get(tree);
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const parents = new Map();
  const distances = new Map([[tree.root, 0]]);
  let complete = true;
  const visit = (uid) => {
    for (const child of nodes.get(uid).children || []) {
      const length = nodes.get(child).branchLength;
      if (!Number.isFinite(length) || length < 0) complete = false;
      parents.set(child, uid);
      distances.set(child, distances.get(uid) + (Number.isFinite(length) ? length : 0));
      visit(child);
    }
  };
  visit(tree.root);
  const tips = tree.nodes.filter((node) => !node.children);
  const height = Math.max(0, ...tips.map((node) => distances.get(node.uid)));
  // Absolute 1e-12 plus relative 1e-9 tolerance, measured in input distance units.
  const tolerance = 1e-12 + 1e-9 * height;
  const ultrametric = complete && tips.every((node) => Math.abs(distances.get(node.uid) - height) <= tolerance);
  const result = {
    nodes, parents, height, ultrametric,
    heights: new Map([...distances].map(([uid, distance]) => [uid, Math.max(0, height - distance)])),
    canonical: [...tree.nodes].sort((a, b) => a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
  };
  metricsCache.set(tree, result);
  return result;
}

function validateBranch(style, where) {
  fields(style, ["colour", "width"], where);
  if (own(style, "colour")) colour(style.colour, `${where}.colour`);
  if (own(style, "width")) positive(style.width, `${where}.width`);
}

/** Validate optional data fields and the effective tree/config colouring policy. */
export function validateTreePresentation(tree, config = {}) {
  validateTreeColouring(config.colouring);
  if (!tree) return;
  if (tree.distance !== undefined) {
    fields(tree.distance, ["kind", "label"], "distance");
    if (tree.distance.kind !== "mergeHeight") fail("distance.kind must be mergeHeight.");
    if (own(tree.distance, "label") && typeof tree.distance.label !== "string") fail("distance.label must be text.");
  }
  const presentation = tree.presentation;
  if (presentation !== undefined) {
    fields(presentation, ["colouring", "subtrees", "nodes"], "presentation");
    validateTreeColouring(presentation.colouring);
    const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
    for (const scope of ["subtrees", "nodes"]) {
      if (presentation[scope] === undefined) continue;
      if (!object(presentation[scope])) fail(`presentation.${scope} must be a node-ID dictionary.`);
      for (const [uid, record] of Object.entries(presentation[scope])) {
        const node = nodes.get(uid);
        if (!node) fail(`presentation.${scope} refers to unknown node '${uid}'.`);
        fields(record, scope === "subtrees" ? ["branch"] : ["branch", "label"], `${scope}.${uid}`);
        if (scope === "subtrees" && !node.children) fail(`subtree '${uid}' must be an internal node.`);
        if (record.branch !== undefined) {
          if (scope === "nodes" && uid === tree.root) fail("the display root has no incoming edge to style.");
          validateBranch(record.branch, `${scope}.${uid}.branch`);
        }
        if (record.label !== undefined) {
          if (!node.children) fail(`annotation '${uid}' must belong to an internal node.`);
          const label = record.label;
          fields(label, ["text", "colour", "fontSize", "fontWeight", "fontStyle"], `nodes.${uid}.label`);
          if (own(label, "text") && typeof label.text !== "string") fail(`annotation '${uid}' text must be a string.`);
          if (own(label, "colour")) colour(label.colour, `annotation '${uid}' colour`);
          if (own(label, "fontSize")) positive(label.fontSize, `annotation '${uid}' fontSize`);
          if (own(label, "fontWeight") && ![400, 700].includes(label.fontWeight)) fail("annotation fontWeight must be 400 or 700.");
          if (own(label, "fontStyle") && !["normal", "italic"].includes(label.fontStyle)) fail("annotation fontStyle must be normal or italic.");
        }
      }
    }
  }
  const policy = { ...TREE_COLOURING_DEFAULTS, ...config.colouring, ...presentation?.colouring };
  if (policy.mode === "cutHeight") {
    if (tree.distance?.kind !== "mergeHeight") fail("cutHeight colouring requires distance.kind = mergeHeight.");
    if (!treeMetrics(tree).ultrametric) fail("cutHeight colouring requires complete lengths and equal root-to-tip distances (absolute 1e-12 + relative 1e-9 tolerance).");
  }
}

export function invalidateTreePresentation(tree) {
  if (tree) stylesCache.delete(tree);
}

/** Resolve properties once per presentation/config revision, never per tween. */
export function resolveTreePresentation(tree, config = {}) {
  const defaults = { ...TREE_COLOURING_DEFAULTS, ...config.colouring };
  const signature = JSON.stringify([config.branch?.colour, config.branch?.width, defaults]);
  const cached = stylesCache.get(tree);
  if (cached && cached.presentation === tree.presentation && cached.signature === signature) return cached.value;
  validateTreePresentation(tree, config);
  const metrics = treeMetrics(tree);
  const policy = { ...defaults, ...tree.presentation?.colouring };
  const threshold = policy.cutHeight === "auto" ? metrics.height * 0.7 : policy.cutHeight;
  const groups = new Map();
  if (policy.mode === "cutHeight" && threshold > 0) {
    for (const node of metrics.canonical) {
      if (!node.children || metrics.heights.get(node.uid) >= threshold) continue;
      const parent = metrics.parents.get(node.uid);
      if (parent === undefined || metrics.heights.get(parent) >= threshold) {
        groups.set(node.uid, policy.palette[groups.size % policy.palette.length]);
      }
    }
  }
  const base = { colour: config.branch?.colour || "#555", width: Number(config.branch?.width) || 1.5 };
  const branches = new Map();
  const stems = new Map();
  const annotations = new Map();
  const visit = (uid, inherited = {}, groupColour = null) => {
    const node = metrics.nodes.get(uid);
    const automatic = groups.get(uid) || groupColour;
    const subtree = { ...inherited, ...tree.presentation?.subtrees?.[uid]?.branch };
    const mergeStyle = { ...base, ...(automatic ? { colour: automatic } : {}), ...subtree };
    if (node.children) stems.set(uid, mergeStyle);
    const label = tree.presentation?.nodes?.[uid]?.label;
    if (label?.text) annotations.set(uid, { colour: "#333", fontSize: 10, fontWeight: 400, fontStyle: "normal", ...label });
    for (const child of node.children || []) {
      branches.set(child, { ...mergeStyle, ...tree.presentation?.nodes?.[child]?.branch });
      visit(child, subtree, automatic);
    }
  };
  visit(tree.root);
  const value = { base, branches, stems, annotations, policy, height: metrics.height, threshold, metric: policy.mode === "cutHeight" };
  stylesCache.set(tree, { presentation: tree.presentation, signature, value });
  return value;
}
