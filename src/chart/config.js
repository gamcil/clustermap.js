import { color } from "d3-color";
import { TRIM_INDICATOR_DEFAULTS } from "../loci/trimIndicators.mjs";
import { isRendererMode } from "../renderers/mode.mjs";
import { TREE_COLOURING_DEFAULTS, validateTreeColouring } from "../tree/model.mjs";

import { clonePlainValue, isPlainObject } from "../utils/values.mjs";

// Each leaf declares the earliest stage affected by changes to that setting.
const field = (value, effect, validation = {}) => ({ value, effect, ...validation });
export const configSchema = {
  // Optional row-aligned metadata panels. Synteny remains the default view.
  annotations: { enabled: field(false, "geometry") },
  tree: {
    show: field(true, "presentation"),
    colouring: {
      mode: field(TREE_COLOURING_DEFAULTS.mode, "presentation", { external: true }),
      cutHeight: field(TREE_COLOURING_DEFAULTS.cutHeight, "presentation", { external: true }),
      palette: field(TREE_COLOURING_DEFAULTS.palette, "presentation", { external: true }),
      showCutLine: field(TREE_COLOURING_DEFAULTS.showCutLine, "presentation", { external: true }),
    },
    width: field(100, "presentation", { positive: true }),
    useBranchLengths: field(true, "presentation"),
    node: { show: field(true, "presentation") },
    rootStem: { show: field(false, "presentation") },
    branch: { width: field(1.5, "presentation", { positive: true }), colour: field(null, "presentation") },
    support: { show: field(true, "presentation"), fontSize: field(9, "presentation", { positive: true }), precision: field(1, "presentation", { integer: true, range: [0, 100] }) },
    scaleBar: { show: field(true, "presentation"), label: field("", "presentation", { empty: true }) },
    leafGuide: { show: field(false, "presentation"), colour: field(null, "presentation"), width: field(1, "presentation", { positive: true }), dash: field("4 3", "presentation", { kind: "dash" }) },
  },
  plot: {
    // Figure appearance is stable across interface and system themes.
    background: field("#ffffff", "geometry", { kind: "colour" }),
    showFigureFrame: field(true, "geometry"),
    transitionDuration: field(250, "geometry"),
    renderer: field("svg", "geometry", { kind: "renderer" }),
    // Canvas may reduce resolution during motion and at small zoom scales.
    // Disable for fixed-resolution output or renderer comparisons.
    adaptiveResolution: field(true, "geometry"),
    minZoom: field(0, "geometry"),
    maxZoom: field(8, "geometry", { positive: true }),
    minimap: {
      show: field(false, "geometry"),
      width: field(220, "geometry", { positive: true }),
      height: field(160, "geometry", { positive: true }),
      margin: field(12, "geometry"),
      showLinks: field(false, "geometry"),
    },
    scaleFactor: field(15, "geometry", { positive: true }),
    scaleGenes: field(true, "geometry"),
    fontFamily:
      field('system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Oxygen, Cantarell, sans-serif', "geometry"),
  },
  legend: {
    symbol: field("circle", "geometry", { choices: ["circle", "square", "arrow"] }),
    symbolScale: field(1, "geometry", { positive: true }),
    symbolBorderWidth: field(0, "geometry"),
    symbolBorderColour: field(null, "geometry"),
    columns: field(1, "geometry", { positive: true, integer: true }),
    columnWidth: field(160, "geometry", { positive: true }),
    entryHeight: field(18, "geometry", { positive: true }),
    fontSize: field(14, "geometry", { positive: true }),
    subtitleFontSize: field(10, "geometry", { positive: true }),
    onClickSymbol: field(null, "geometry", { kind: "callback" }),
    onClickText: field(null, "geometry", { kind: "callback" }),
    // Optional hook exposed as a deliberate action in the group context menu.
    // Consumers can use it to reveal a group in an adjacent inspector.
    onReveal: field(null, "geometry", { kind: "callback" }),
    // "right" keeps the historical layout. "bottom" places the legend
    // below the chart's content bounds, aligned with its left edge.
    position: field("right", "geometry", { choices: ["right", "bottom"] }),
    show: field(true, "geometry"),
    marginLeft: field(20, "geometry", { signed: true }),
    marginTop: field(20, "geometry", { signed: true }),
  },
  colourBar: {
    fontSize: field(10, "geometry", { positive: true }),
    height: field(12, "geometry", { positive: true }),
    show: field(true, "geometry"),
    width: field(150, "geometry", { positive: true }),
    marginTop: field(20, "geometry", { signed: true }),
    // Bounds describe the colour mapping only; link.threshold remains the
    // separate visibility filter. "data" resolves against all link records.
    domain: {
      min: field(0, "geometry", { range: [0, 1] }),
      max: field(1, "geometry", { range: [0, 1] }),
      minMode: field("fixed", "geometry", { choices: ["fixed", "data"] }),
      maxMode: field("fixed", "geometry", { choices: ["fixed", "data"] }),
    },
  },
  scaleBar: {
    colour: field(null, "geometry"),
    fontSize: field(10, "geometry", { positive: true }),
    height: field(12, "geometry", { positive: true }),
    basePair: field(2500, "geometry", { positive: true }),
    show: field(true, "geometry"),
    stroke: field(1, "geometry"),
    marginTop: field(20, "geometry", { signed: true }),
  },
  link: {
    show: field(true, "geometry"),
    asLine: field(false, "geometry"),
    straight: field(false, "geometry"),
    threshold: field(0, "linkFilter", { range: [0, 1] }),
    strokeWidth: field(0.5, "geometry"),
    groupColour: field(false, "geometry"),
    bestOnly: field(false, "linkFilter"),
    label: {
      show: field(false, "geometry"),
      fontSize: field(10, "geometry", { positive: true }),
      background: field(true, "geometry"),
      position: field(0.5, "geometry", { range: [0, 1] }),
    },
  },
  cluster: {
    nameFontSize: field(12, "geometry", { positive: true }),
    lociFontSize: field(10, "geometry", { positive: true }),
    hideLocusLabels: field(false, "geometry"),
    hideLocusCoordinates: field(false, "geometry"),
    spacing: field(40, "geometry"),
    alignLabels: field(true, "clusterLabels"),
    labelAlignment: field("right", "clusterLabels", { choices: ["left", "right"] }),
  },
  locus: {
    trimIndicators: {
      show: field(TRIM_INDICATOR_DEFAULTS.show, "geometry"),
      fontSize: field(TRIM_INDICATOR_DEFAULTS.fontSize, "geometry", { positive: true, range: [6, 48] }),
      fontWeight: field(TRIM_INDICATOR_DEFAULTS.fontWeight, "geometry", { range: [100, 900] }),
      borderWidth: field(TRIM_INDICATOR_DEFAULTS.borderWidth, "geometry", { range: [0, 12] }),
      borderOpacity: field(TRIM_INDICATOR_DEFAULTS.borderOpacity, "geometry", { range: [0, 1] }),
    },
    trackBar: {
      colour: field(null, "geometry"),
      stroke: field(1, "geometry"),
    },
    spacing: field(50, "geometry"),
  },
  gene: {
    shape: {
      bodyHeight: field(12, "geometry"),
      tipHeight: field(5, "geometry"),
      tipLength: field(12, "geometry"),
      onClick: field(null, "geometry", { kind: "callback" }),
      // Optional hook exposed as a deliberate action in the gene context menu.
      // It intentionally does not replace the normal click-to-anchor behaviour.
      onReveal: field(null, "geometry", { kind: "callback" }),
      stroke: field(null, "geometry"),
      strokeWidth: field(1, "geometry"),
    },
    label: {
      anchor: field("start", "geometry", { choices: ["start", "middle", "end"] }),
      fontSize: field(10, "geometry", { positive: true }),
      rotation: field(25, "geometry", { signed: true }),
      position: field("top", "geometry", { choices: ["top", "middle", "bottom"] }),
      spacing: field(2, "geometry", { signed: true }),
      show: field(false, "geometry"),
      start: field(0.5, "geometry", { range: [0, 1] }),
      name: field("uid", "geometry"),
    },
  },
};

function schemaDefaults(schema) {
  return Object.fromEntries(Object.entries(schema).map(([key, entry]) => [key,
    Object.hasOwn(entry, "effect") ? clonePlainValue(entry.value) : schemaDefaults(entry),
  ]));
}
const defaultConfig = schemaDefaults(configSchema);

/** Compare settings using the effects declared alongside their defaults. */
export function configurationEffects(before, after) {
  let presentationOnly = true, clusterLabels = false, refilterLinks = false;
  const visit = (left, right, schema) => {
    if (Object.is(left, right)) return;
    if (schema && !Object.hasOwn(schema, "effect") && isPlainObject(left) && isPlainObject(right)) {
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        visit(left[key], right[key], schema[key]);
      }
      return;
    }
    if (Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
        left.every((value, index) => Object.is(value, right[index]))) return;
    switch (schema?.effect) {
      case "presentation": break;
      case "clusterLabels": clusterLabels = true; break;
      case "geometry": presentationOnly = false; break;
      default: presentationOnly = false; refilterLinks = true; break;
    }
  };
  visit(before, after, configSchema);
  return { presentationOnly, clusterLabels, refilterLinks };
}

/** Return independent, recursively cloned defaults for one chart instance. */
export function createDefaultConfig() {
  return clonePlainValue(defaultConfig);
}

const fail = (path, message) => { throw new TypeError(`Invalid configuration: ${path} ${message}`); };

function validateValue(value, schema, path) {
  const fallback = schema.value;
  // The tree model owns the colouring contract, including palette entries.
  if (schema.external) return;
  if (fallback === null) {
    if (schema.kind === "callback") {
      if (value !== null && typeof value !== "function") fail(path, "must be a function or null.");
    } else if (value !== null && (typeof value !== "string" || !color(value))) fail(path, "must be a valid colour or null.");
    return;
  }
  if (typeof value !== typeof fallback) fail(path, `must be ${typeof fallback}.`);
  if (typeof fallback === "number") {
    if (!Number.isFinite(value)) fail(path, "must be finite.");
    if (!schema.signed && value < 0) fail(path, "must be non-negative.");
    if (schema.positive && value <= 0) fail(path, "must be positive.");
    if (schema.integer && !Number.isInteger(value)) fail(path, "must be an integer.");
    const range = schema.range;
    if (range && (value < range[0] || value > range[1])) fail(path, `must be between ${range[0]} and ${range[1]}.`);
  } else if (typeof fallback === "string") {
    if (!schema.empty && !value.trim()) fail(path, "must not be empty.");
    if (schema.choices && !schema.choices.includes(value)) fail(path, `must be one of ${schema.choices.join(", ")}.`);
    if (schema.kind === "renderer" && !isRendererMode(value)) fail(path, "must be svg, canvas or webgpu.");
    if (schema.kind === "colour" && !color(value)) fail(path, "must be a valid colour.");
    if (schema.kind === "dash" && value.trim().split(/[\s,]+/).some((part) => !part || !Number.isFinite(Number(part)) || Number(part) < 0)) fail(path, "must contain non-negative dash lengths.");
  }
}

function merge(target, patch, schema, path = "config") {
  if (!isPlainObject(patch)) fail(path, "must be a plain object.");
  const result = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    const name = path === "config" ? key : `${path}.${key}`;
    if (!Object.hasOwn(schema, key)) fail(name, "is not a supported setting.");
    const entry = schema[key];
    if (!Object.hasOwn(entry, "effect")) result[key] = merge(target[key], value, entry, name);
    else {
      validateValue(value, entry, name);
      result[key] = clonePlainValue(value);
    }
  }
  return result;
}

/** Prepare an owned, validated configuration before replacing live settings. */
export function mergeConfig(current, patch) {
  const candidate = merge(current, patch, configSchema);
  validateTreeColouring(candidate.tree.colouring);
  if (candidate.plot.minZoom > candidate.plot.maxZoom) fail("plot.minZoom", "must not exceed plot.maxZoom.");
  const domain = candidate.colourBar.domain;
  if (domain.minMode === "fixed" && domain.maxMode === "fixed" && domain.min > domain.max) fail("colourBar.domain.min", "must not exceed colourBar.domain.max.");
  if (candidate.gene.shape.bodyHeight + candidate.gene.shape.tipHeight * 2 <= 0) fail("gene.shape", "must have positive total height.");
  return candidate;
}
