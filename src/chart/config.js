import { color } from "d3-color";
import { TRIM_INDICATOR_DEFAULTS } from "../loci/trimIndicators.mjs";
import { isRendererMode } from "../renderers/mode.mjs";
import { TREE_COLOURING_DEFAULTS, validateTreeColouring } from "../tree/model.mjs";

import { clonePlainValue, isPlainObject } from "../utils/values.mjs";

// Each leaf declares the earliest stage affected by changes to that setting.
const field = (value, effect) => ({ value, effect });
const configSchema = {
  // Optional row-aligned metadata panels. Synteny remains the default view.
  annotations: { enabled: field(false, "geometry") },
  tree: {
    show: field(true, "presentation"),
    colouring: {
      mode: field(TREE_COLOURING_DEFAULTS.mode, "presentation"),
      cutHeight: field(TREE_COLOURING_DEFAULTS.cutHeight, "presentation"),
      palette: field(TREE_COLOURING_DEFAULTS.palette, "presentation"),
      showCutLine: field(TREE_COLOURING_DEFAULTS.showCutLine, "presentation"),
    },
    width: field(100, "presentation"),
    useBranchLengths: field(true, "presentation"),
    node: { show: field(true, "presentation") },
    rootStem: { show: field(false, "presentation") },
    branch: { width: field(1.5, "presentation"), colour: field(null, "presentation") },
    support: { show: field(true, "presentation"), fontSize: field(9, "presentation"), precision: field(1, "presentation") },
    scaleBar: { show: field(true, "presentation"), label: field("", "presentation") },
    leafGuide: { show: field(false, "presentation"), colour: field(null, "presentation"), width: field(1, "presentation"), dash: field("4 3", "presentation") },
  },
  plot: {
    // Figure appearance is stable across interface and system themes.
    background: field("#ffffff", "geometry"),
    showFigureFrame: field(true, "geometry"),
    transitionDuration: field(250, "geometry"),
    renderer: field("svg", "geometry"),
    // Canvas may reduce resolution during motion and at small zoom scales.
    // Disable for fixed-resolution output or renderer comparisons.
    adaptiveResolution: field(true, "geometry"),
    minZoom: field(0, "geometry"),
    maxZoom: field(8, "geometry"),
    minimap: {
      show: field(false, "geometry"),
      width: field(220, "geometry"),
      height: field(160, "geometry"),
      margin: field(12, "geometry"),
      showLinks: field(false, "geometry"),
    },
    scaleFactor: field(15, "geometry"),
    scaleGenes: field(true, "geometry"),
    fontFamily:
      field('system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Oxygen, Cantarell, sans-serif', "geometry"),
  },
  legend: {
    symbol: field("circle", "geometry"),
    symbolScale: field(1, "geometry"),
    symbolBorderWidth: field(0, "geometry"),
    symbolBorderColour: field(null, "geometry"),
    columns: field(1, "geometry"),
    columnWidth: field(160, "geometry"),
    entryHeight: field(18, "geometry"),
    fontSize: field(14, "geometry"),
    subtitleFontSize: field(10, "geometry"),
    onClickSymbol: field(null, "geometry"),
    onClickText: field(null, "geometry"),
    // Optional hook exposed as a deliberate action in the group context menu.
    // Consumers can use it to reveal a group in an adjacent inspector.
    onReveal: field(null, "geometry"),
    // "right" keeps the historical layout. "bottom" places the legend
    // below the chart's content bounds, aligned with its left edge.
    position: field("right", "geometry"),
    show: field(true, "geometry"),
    marginLeft: field(20, "geometry"),
    marginTop: field(20, "geometry"),
  },
  colourBar: {
    fontSize: field(10, "geometry"),
    height: field(12, "geometry"),
    show: field(true, "geometry"),
    width: field(150, "geometry"),
    marginTop: field(20, "geometry"),
    // Bounds describe the colour mapping only; link.threshold remains the
    // separate visibility filter. "data" resolves against all link records.
    domain: {
      min: field(0, "geometry"),
      max: field(1, "geometry"),
      minMode: field("fixed", "geometry"),
      maxMode: field("fixed", "geometry"),
    },
  },
  scaleBar: {
    colour: field(null, "geometry"),
    fontSize: field(10, "geometry"),
    height: field(12, "geometry"),
    basePair: field(2500, "geometry"),
    show: field(true, "geometry"),
    stroke: field(1, "geometry"),
    marginTop: field(20, "geometry"),
  },
  link: {
    show: field(true, "geometry"),
    asLine: field(false, "geometry"),
    straight: field(false, "geometry"),
    threshold: field(0, "linkFilter"),
    strokeWidth: field(0.5, "geometry"),
    groupColour: field(false, "geometry"),
    bestOnly: field(false, "linkFilter"),
    label: {
      show: field(false, "geometry"),
      fontSize: field(10, "geometry"),
      background: field(true, "geometry"),
      position: field(0.5, "geometry"),
    },
  },
  cluster: {
    nameFontSize: field(12, "geometry"),
    lociFontSize: field(10, "geometry"),
    hideLocusLabels: field(false, "geometry"),
    hideLocusCoordinates: field(false, "geometry"),
    spacing: field(40, "geometry"),
    alignLabels: field(true, "clusterLabels"),
    labelAlignment: field("right", "clusterLabels"),
  },
  locus: {
    trimIndicators: {
      show: field(TRIM_INDICATOR_DEFAULTS.show, "geometry"),
      fontSize: field(TRIM_INDICATOR_DEFAULTS.fontSize, "geometry"),
      fontWeight: field(TRIM_INDICATOR_DEFAULTS.fontWeight, "geometry"),
      borderWidth: field(TRIM_INDICATOR_DEFAULTS.borderWidth, "geometry"),
      borderOpacity: field(TRIM_INDICATOR_DEFAULTS.borderOpacity, "geometry"),
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
      onClick: field(null, "geometry"),
      // Optional hook exposed as a deliberate action in the gene context menu.
      // It intentionally does not replace the normal click-to-anchor behaviour.
      onReveal: field(null, "geometry"),
      stroke: field(null, "geometry"),
      strokeWidth: field(1, "geometry"),
    },
    label: {
      anchor: field("start", "geometry"),
      fontSize: field(10, "geometry"),
      rotation: field(25, "geometry"),
      position: field("top", "geometry"),
      spacing: field(2, "geometry"),
      show: field(false, "geometry"),
      start: field(0.5, "geometry"),
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

const choices = {
  "legend.symbol": ["circle", "square", "arrow"],
  "legend.position": ["right", "bottom"],
  "cluster.labelAlignment": ["left", "right"],
  "colourBar.domain.minMode": ["fixed", "data"],
  "colourBar.domain.maxMode": ["fixed", "data"],
  "gene.label.anchor": ["start", "middle", "end"],
  "gene.label.position": ["top", "middle", "bottom"],
};
const positive = new Set([
  "tree.width", "tree.branch.width", "tree.leafGuide.width", "plot.scaleFactor", "plot.maxZoom",
  "plot.minimap.width", "plot.minimap.height", "legend.columns", "legend.columnWidth",
  "legend.symbolScale", "legend.entryHeight", "colourBar.width", "colourBar.height", "scaleBar.height", "scaleBar.basePair",
]);
const signed = new Set(["gene.label.rotation", "gene.label.spacing", "legend.marginLeft", "legend.marginTop",
  "colourBar.marginTop", "scaleBar.marginTop"]);
const ranges = {
  "link.threshold": [0, 1], "link.label.position": [0, 1], "gene.label.start": [0, 1],
  "colourBar.domain.min": [0, 1], "colourBar.domain.max": [0, 1],
  "tree.support.precision": [0, 100],
  "locus.trimIndicators.fontSize": [6, 48], "locus.trimIndicators.fontWeight": [100, 900],
  "locus.trimIndicators.borderWidth": [0, 12], "locus.trimIndicators.borderOpacity": [0, 1],
};
const fail = (path, message) => { throw new TypeError(`Invalid configuration: ${path} ${message}`); };

function validateValue(value, fallback, path) {
  // The tree model owns the colouring contract, including palette entries.
  if (path.startsWith("tree.colouring.")) return;
  if (fallback === null) {
    if (/\.on[A-Z]/.test(path)) {
      if (value !== null && typeof value !== "function") fail(path, "must be a function or null.");
    } else if (value !== null && (typeof value !== "string" || !color(value))) fail(path, "must be a valid colour or null.");
    return;
  }
  if (typeof value !== typeof fallback) fail(path, `must be ${typeof fallback}.`);
  if (typeof fallback === "number") {
    if (!Number.isFinite(value)) fail(path, "must be finite.");
    if (!signed.has(path) && value < 0) fail(path, "must be non-negative.");
    if ((positive.has(path) || /(?:fontSize|FontSize)$/.test(path)) && value <= 0) fail(path, "must be positive.");
    if (["legend.columns", "tree.support.precision"].includes(path) && !Number.isInteger(value)) fail(path, "must be an integer.");
    const range = ranges[path];
    if (range && (value < range[0] || value > range[1])) fail(path, `must be between ${range[0]} and ${range[1]}.`);
  } else if (typeof fallback === "string") {
    if (path !== "tree.scaleBar.label" && !value.trim()) fail(path, "must not be empty.");
    if (choices[path] && !choices[path].includes(value)) fail(path, `must be one of ${choices[path].join(", ")}.`);
    if (path === "plot.renderer" && !isRendererMode(value)) fail(path, "must be svg, canvas or webgpu.");
    if (path === "plot.background" && !color(value)) fail(path, "must be a valid colour.");
    if (path === "tree.leafGuide.dash" && value.trim().split(/[\s,]+/).some((part) => !part || !Number.isFinite(Number(part)) || Number(part) < 0)) fail(path, "must contain non-negative dash lengths.");
  }
}

function merge(target, patch, defaults, path = "config") {
  if (!isPlainObject(patch)) fail(path, "must be a plain object.");
  const result = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    const name = path === "config" ? key : `${path}.${key}`;
    if (!Object.hasOwn(defaults, key)) fail(name, "is not a supported setting.");
    if (isPlainObject(defaults[key])) result[key] = merge(target[key], value, defaults[key], name);
    else {
      validateValue(value, defaults[key], name);
      result[key] = clonePlainValue(value);
    }
  }
  return result;
}

/** Prepare an owned, validated configuration before replacing live settings. */
export function mergeConfig(current, patch) {
  const candidate = merge(current, patch, defaultConfig);
  validateTreeColouring(candidate.tree.colouring);
  if (candidate.plot.minZoom > candidate.plot.maxZoom) fail("plot.minZoom", "must not exceed plot.maxZoom.");
  const domain = candidate.colourBar.domain;
  if (domain.minMode === "fixed" && domain.maxMode === "fixed" && domain.min > domain.max) fail("colourBar.domain.min", "must not exceed colourBar.domain.max.");
  if (candidate.gene.shape.bodyHeight + candidate.gene.shape.tipHeight * 2 <= 0) fail("gene.shape", "must have positive total height.");
  return candidate;
}
