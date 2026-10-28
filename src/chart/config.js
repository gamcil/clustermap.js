import { color } from "d3-color";
import { TRIM_INDICATOR_DEFAULTS } from "../loci/trimIndicators.mjs";
import { isRendererMode } from "../renderers/mode.mjs";
import { TREE_COLOURING_DEFAULTS, validateTreeColouring } from "../tree/model.mjs";

import { clonePlainValue, isPlainObject } from "../utils/values.mjs";

const defaultConfig = {
  // Optional row-aligned metadata panels. Synteny remains the default view.
  annotations: { enabled: false },
  tree: {
    show: true,
    colouring: TREE_COLOURING_DEFAULTS,
    width: 100,
    useBranchLengths: true,
    node: { show: true },
    branch: { width: 1.5, colour: null },
    support: { show: true, fontSize: 9, precision: 1 },
    scaleBar: { show: true, label: "" },
    leafGuide: { show: false, colour: null, width: 1, dash: "4 3" },
  },
  plot: {
    // Figure appearance is stable across interface and system themes.
    background: "#ffffff",
    showFigureFrame: true,
    transitionDuration: 250,
    renderer: "svg",
    // Canvas may reduce resolution during motion and at small zoom scales.
    // Disable for fixed-resolution output or renderer comparisons.
    adaptiveResolution: true,
    minZoom: 0,
    maxZoom: 8,
    minimap: {
      show: false,
      width: 220,
      height: 160,
      margin: 12,
      showLinks: false,
    },
    scaleFactor: 15,
    scaleGenes: true,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Oxygen, Cantarell, sans-serif',
  },
  legend: {
    columns: 1,
    columnWidth: 160,
    entryHeight: 18,
    fontSize: 14,
    subtitleFontSize: 10,
    onClickCircle: null,
    onClickText: null,
    // Optional hook exposed as a deliberate action in the group context menu.
    // Consumers can use it to reveal a group in an adjacent inspector.
    onReveal: null,
    // "right" keeps the historical layout. "bottom" places the legend
    // below the chart's content bounds, aligned with its left edge.
    position: "right",
    show: true,
    marginLeft: 20,
    marginTop: 20,
  },
  colourBar: {
    fontSize: 10,
    height: 12,
    show: true,
    width: 150,
    marginTop: 20,
    // Bounds describe the colour mapping only; link.threshold remains the
    // separate visibility filter. "data" resolves against all link records.
    domain: {
      min: 0,
      max: 1,
      minMode: "fixed",
      maxMode: "fixed",
    },
  },
  scaleBar: {
    colour: null,
    fontSize: 10,
    height: 12,
    basePair: 2500,
    show: true,
    stroke: 1,
    marginTop: 20,
  },
  link: {
    show: true,
    asLine: false,
    straight: false,
    threshold: 0,
    strokeWidth: 0.5,
    groupColour: false,
    bestOnly: false,
    label: {
      show: false,
      fontSize: 10,
      background: true,
      position: 0.5,
    },
  },
  cluster: {
    nameFontSize: 12,
    lociFontSize: 10,
    hideLocusLabels: false,
    hideLocusCoordinates: false,
    spacing: 40,
    alignLabels: true,
    labelAlignment: "right",
  },
  locus: {
    trimIndicators: TRIM_INDICATOR_DEFAULTS,
    trackBar: {
      colour: null,
      stroke: 1,
    },
    spacing: 50,
  },
  gene: {
    shape: {
      bodyHeight: 12,
      tipHeight: 5,
      tipLength: 12,
      onClick: null,
      // Optional hook exposed as a deliberate action in the gene context menu.
      // It intentionally does not replace the normal click-to-anchor behaviour.
      onReveal: null,
      stroke: null,
      strokeWidth: 1,
    },
    label: {
      anchor: "start",
      fontSize: 10,
      rotation: 25,
      position: "top",
      spacing: 2,
      show: false,
      start: 0.5,
      name: "uid",
    },
  },
};

/** Return independent, recursively cloned defaults for one chart instance. */
export function createDefaultConfig() {
  return clonePlainValue(defaultConfig);
}

const choices = {
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
  "legend.entryHeight", "colourBar.width", "colourBar.height", "scaleBar.height", "scaleBar.basePair",
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
