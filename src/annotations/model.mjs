import { textBounds } from "../scene/text.mjs";
import { includeBounds } from "../scene/bounds.mjs";
import { boundsInViewport } from "../scene/camera.mjs";
import { validateGroupPanel, layoutGroupPanel, groupPanelMarks } from "./groups.mjs";
import { color } from "d3-color";
import { scaleLinear, scaleOrdinal } from "d3-scale";
import { clusterOffsetForPreview, annotationOffsetForPreview } from "../scene/preview.mjs";
import { sameArray } from "../utils/values.mjs";
export { annotationOffsetForPreview } from "../scene/preview.mjs";

const sequential = ["#f7fbff", "#08306b"];
const categorical = ["#4477aa", "#ee6677", "#228833", "#ccbb44", "#66ccee", "#aa3377", "#bbbbbb"];
export const ANNOTATION_DEFAULTS = Object.freeze({ cellWidth: 32, cellHeight: 20, gap: 24,
  titleFontSize: 10, columnFontSize: 10, labelFontSize: 10, headingRotation: -60, missingColour: "#eeeeee",
  cellGap: 0, cellBorderWidth: 0, cellBorderColour: "#ffffff", width: 120, colour: "#267c9e" });
export const ANNOTATION_PALETTES = {
  Blue: sequential,
  "Blue–red": ["#2166ac", "#f7f7f7", "#b2182b"],
  Viridis: ["#440154", "#21918c", "#fde725"],
  Qualitative: categorical,
};

// Validate at the JSON boundary; renderers only consume projected records.
export function validateAnnotationPanels(panels, clusters, { previousPanels = null, tree = null } = {}) {
  if (panels == null) return;
  const fail = (message) => { throw new TypeError(`Invalid annotationPanels: ${message}`); };
  if (!Array.isArray(panels)) fail("expected an array.");
  const ids = new Set(), previous = new Map(previousPanels?.map((panel) => [panel.uid, panel]));
  let clusterIds;
  for (const panel of panels) {
    if (!panel || typeof panel !== "object") fail("each panel must be an object.");
    if (typeof panel.uid !== "string" || !panel.uid.trim() || ids.has(panel.uid)) fail("panels require unique, non-empty uid strings.");
    ids.add(panel.uid);
    const before = previous.get(panel.uid);
    if (before === panel) continue;
    if (!["heatmap", "bar", "groups"].includes(panel.type)) fail(`unsupported type for '${panel.uid}'; expected heatmap, bar or groups.`);
    if (panel.title != null && typeof panel.title !== "string") fail("title must be text.");
    for (const key of ["show", "showKey", "showColumnLabels"]) {
      if (panel[key] !== undefined && typeof panel[key] !== "boolean") fail(`${key} must be a boolean.`);
    }
    if (panel.headingRotation !== undefined && (!Number.isFinite(panel.headingRotation) || panel.headingRotation < -90 || panel.headingRotation > 0)) fail("headingRotation must be between -90 and 0 degrees.");
    for (const key of ["cellWidth", "cellHeight", "titleFontSize", "columnFontSize", "labelFontSize", "width"]) {
      if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] <= 0)) fail(`${key} must be positive.`);
    }
    if (panel.gap !== undefined && (!Number.isFinite(panel.gap) || panel.gap < 0)) fail("gap must be non-negative.");
    for (const key of ["cellGap", "cellBorderWidth"]) {
      if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] < 0)) fail(`${key} must be non-negative.`);
    }
    if ((panel.cellGap ?? 0) >= Math.min(panel.cellWidth ?? ANNOTATION_DEFAULTS.cellWidth,
      panel.cellHeight ?? ANNOTATION_DEFAULTS.cellHeight)) fail("cellGap must be smaller than cellWidth and cellHeight.");
    if (panel.cellBorderColour !== undefined && (typeof panel.cellBorderColour !== "string" || !color(panel.cellBorderColour))) fail("cellBorderColour must be a CSS colour.");
    if (panel.colour !== undefined && (typeof panel.colour !== "string" || !color(panel.colour))) fail("colour must be a CSS colour.");
    if (panel.type === "groups") {
      clusterIds ??= new Set(clusters.map((cluster) => cluster.uid));
      validateGroupPanel(panel, clusterIds, tree, fail);
      continue;
    }
    if (!Array.isArray(panel.columns) || !panel.columns.length ||
        panel.columns.some((column) => typeof column !== "string" || !column.trim()) ||
        new Set(panel.columns).size !== panel.columns.length) fail("columns must be unique, non-empty strings.");
    if (panel.type === "bar" && panel.columns.length !== 1) fail("bar panels require exactly one column.");
    if (!panel.values || typeof panel.values !== "object" || Array.isArray(panel.values)) fail("values must map cluster IDs to row arrays.");
    const scale = panel.scale ?? {};
    if (!scale || typeof scale !== "object" || Array.isArray(scale)) fail("scale must be an object.");
    const type = scale.type ?? "continuous";
    if (panel.type === "bar" && type !== "continuous") fail("bar panels require a continuous scale.");
    if (!["continuous", "categorical"].includes(type)) fail("scale.type must be continuous or categorical.");
    if (scale.colours !== undefined && (!Array.isArray(scale.colours) || !scale.colours.length ||
        scale.colours.some((value) => typeof value !== "string" || !color(value)))) fail("scale.colours must contain valid CSS colours.");
    if (type === "continuous" && scale.colours?.length < 2) fail("continuous scales need at least two colours.");
    if (panel.missingColour !== undefined && (typeof panel.missingColour !== "string" || !color(panel.missingColour))) fail("missingColour must be a CSS colour.");
    if (scale.domain !== undefined) {
      if (!Array.isArray(scale.domain)) fail("scale.domain must be an array.");
      if (type === "continuous" && (scale.domain.length !== 2 || !scale.domain.every(Number.isFinite) || scale.domain[0] >= scale.domain[1])) fail("continuous domain must be [min, max] with min < max.");
      if (panel.type === "bar" && (scale.domain[0] > 0 || scale.domain[1] < 0)) fail("bar domains must include zero.");
      if (type === "categorical" && (scale.domain.some((value) => typeof value !== "string") || new Set(scale.domain).size !== scale.domain.length)) fail("categorical domain must contain unique strings.");
    }
    // Presentation changes leave the matrix valid unless they change its
    // shape, value type or allowed categories. JSON loading always checks it.
    const oldScale = before?.scale ?? {};
    const sameCategories = sameArray(oldScale.domain, scale.domain);
    const sameValueRules = before?.columns?.length === panel.columns.length &&
      (oldScale.type ?? "continuous") === type && (type !== "categorical" || sameCategories);
    if (before?.values === panel.values && sameValueRules) continue;
    clusterIds ??= new Set(clusters.map((cluster) => cluster.uid));
    const categories = type === "categorical" && scale.domain ? new Set(scale.domain) : null;
    for (const [uid, values] of Object.entries(panel.values)) {
      if (!clusterIds.has(uid)) fail(`unknown cluster '${uid}'.`);
      if (sameValueRules && before.values[uid] === values) continue;
      if (!Array.isArray(values) || values.length !== panel.columns.length) fail(`row '${uid}' must have one value per column.`);
      for (const value of values) {
        if (value === null) continue;
        if (type === "continuous" ? !Number.isFinite(value) : typeof value !== "string") fail(`invalid ${type} value in row '${uid}'.`);
        if (categories && !categories.has(value)) fail(`category '${value}' is absent from scale.domain.`);
      }
    }
  }
}

const numberLabel = (value) => Number(value.toPrecision(3)).toString();
const text = (value, x, y, extra = {}) => ({ text: String(value), x, y, anchor: "start", ...extra });

/** Right edge of scale/identity decorations; gene legends are placed separately. */
export function annotationChromeRightEdge(chrome, measureText = null) {
  let right = -Infinity;
  const bar = chrome?.scaleBar, identity = chrome?.colourBar;
  if (bar?.visible) {
    const label = textBounds(bar.label, { fontSize: bar.fontSize, fontFamily: bar.fontFamily, anchor: "middle" }, measureText);
    right = Math.max(right, bar.position.x + bar.length + (bar.strokeWidth || 0) / 2,
      bar.position.x + bar.length / 2 + label.maxX);
  }
  if (identity?.visible) {
    const label = textBounds(identity.label, { fontSize: identity.fontSize, fontFamily: identity.fontFamily, anchor: "middle" }, measureText);
    const start = textBounds(identity.startLabel, { fontSize: identity.fontSize, fontFamily: identity.fontFamily }, measureText);
    right = Math.max(right, identity.position.x + identity.width + 0.5,
      identity.position.x + identity.width / 2 + label.maxX, identity.position.x + start.maxX);
  }
  return right;
}

/** Visible legend footprint; column spacing is not trailing figure padding. */
export function legendContentBounds(legend, measureText = null) {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const include = (minX, maxX, minY, maxY) => {
    bounds.minX = Math.min(bounds.minX, minX); bounds.maxX = Math.max(bounds.maxX, maxX);
    bounds.minY = Math.min(bounds.minY, minY); bounds.maxY = Math.max(bounds.maxY, maxY);
  };
  if (!legend.visible || !legend.items.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  for (const item of legend.items) {
    include(item.x - item.radius, item.x + item.radius,
      item.y + item.circleY - item.radius, item.y + item.circleY + item.radius);
    const addText = (value, fontSize, y) => {
      if (!value) return;
      const text = textBounds(value, { fontSize, fontFamily: legend.fontFamily, baseline: "middle" }, measureText);
      include(item.x + item.textX + text.minX, item.x + item.textX + text.maxX,
        item.y + y + text.minY, item.y + y + text.maxY);
    };
    addText(item.label, legend.fontSize, item.textY);
    addText(item.subtitle, legend.subtitleFontSize, item.subtitleY);
  }
  return bounds;
}

/** Top ink extent relative to a legend's origin, including tall text/subtitles. */
export function legendTopExtent(legend, measureText = null) {
  return Math.min(0, legendContentBounds(legend, measureText).minY);
}

// Values are replaced at data boundaries and shared by presentation edits.
// Retain only their inferred domain, not a second flattened copy of the matrix.
const domainCache = new WeakMap();
function inferredDomain(values, type, isBar) {
  let cached = domainCache.get(values);
  if (!cached) { cached = {}; domainCache.set(values, cached); }
  const key = type === "categorical" ? "categories" : isBar ? "bars" : "numeric";
  if (cached[key]) return cached[key];
  const categories = new Set();
  let min = Infinity, max = -Infinity, count = 0;
  for (const row of Object.values(values)) for (const value of row) {
    if (value === null) continue;
    count++;
    if (type === "categorical") categories.add(value);
    else { min = Math.min(min, value); max = Math.max(max, value); }
  }
  if (isBar) { min = Math.min(0, min); max = Math.max(0, max); }
  return cached[key] = type === "categorical" ? [...categories]
    : !count || isBar && min === max ? [0, 1]
    : min === max ? [min - 0.5, max + 0.5] : [min, max];
}

/** Resolve scales identically for layout and the appearance editor. */
export function resolveAnnotationScale(source) {
  const scale = source.scale ?? {}, type = scale.type ?? "continuous";
  const domain = scale.domain ?? inferredDomain(source.values, type, source.type === "bar");
  const colours = scale.colours ?? (type === "continuous" ? sequential : categorical);
  const colour = type === "categorical"
    ? scaleOrdinal(domain, colours).unknown(source.missingColour ?? "#eeeeee")
    : scaleLinear().domain(colours.map((_, i) => domain[0] + (domain[1] - domain[0]) * i / (colours.length - 1))).range(colours).clamp(true);
  return { type, domain, colours, colour };
}

// Draw the fill and a non-overlapping inset border ring using ordinary rects.
// All backends consume the same primitives, including instanced WebGPU cells.
function cellRectangles(rect, borderWidth, borderColour) {
  const result = [rect];
  const width = Math.min(borderWidth, rect.width / 2, rect.height / 2);
  if (!width) return result;
  const { x, y, width: w, height: h } = rect;
  result.push(
    { x, y, width: w, height: width, fill: borderColour },
    { x, y: y + h - width, width: w, height: width, fill: borderColour },
  );
  if (h > width * 2) result.push(
    { x, y: y + width, width, height: h - width * 2, fill: borderColour },
    { x: x + w - width, y: y + width, width, height: h - width * 2, fill: borderColour },
  );
  return result;
}

function barRectangles(value, position, width, height, fill, missingColour, borderWidth, borderColour) {
  const zero = position(0);
  if (value === null) {
    const markerWidth = Math.min(6, width);
    return [{ x: Math.max(0, Math.min(width - markerWidth, zero - markerWidth / 2)),
      y: -height / 2, width: markerWidth, height, fill: missingColour }];
  }
  const end = position(value);
  // The baseline remains visible for zero values and when bars are narrower
  // than a pixel. It is a rectangle, so all renderers share its geometry.
  const rects = [{ x: Math.max(0, Math.min(width - Math.min(1, width), zero - 0.5)),
    y: -height / 2, width: Math.min(1, width), height, fill: "#999999" }];
  if (end !== zero) rects.push(...cellRectangles({ x: Math.min(zero, end), y: -height / 2,
    width: Math.abs(end - zero), height, fill }, borderWidth, borderColour));
  return rects;
}

function sameCellStyle(before, after) {
  return before && sameArray(before.columns, after.columns) &&
    ["type", "width", "cellWidth", "cellHeight", "cellGap", "cellBorderWidth", "cellBorderColour", "colour", "missingColour"]
      .every((field) => before[field] === after[field]) &&
    before.scale?.type === after.scale?.type &&
    sameArray(before.scale?.colours, after.scale?.colours);
}

function samePanelRows(panel, clusters) {
  return panel?.rows.length === clusters.size && panel.rows.every((row) => clusters.has(row.uid));
}

function layoutMatrixPanel(source, clusters, { before, labelFontSize, columnFontSize, cellHeight, theme }) {
  const isBar = source.type === "bar";
  const cellWidth = isBar ? source.width ?? ANNOTATION_DEFAULTS.width : source.cellWidth ?? ANNOTATION_DEFAULTS.cellWidth;
  const width = cellWidth * source.columns.length;
  const { type, domain, colour } = resolveAnnotationScale(source);
  const cellGap = isBar ? 0 : source.cellGap ?? ANNOTATION_DEFAULTS.cellGap;
  const borderWidth = source.cellBorderWidth ?? ANNOTATION_DEFAULTS.cellBorderWidth;
  const borderColour = source.cellBorderColour ?? ANNOTATION_DEFAULTS.cellBorderColour;
  const missingColour = source.missingColour ?? theme?.missing ?? ANNOTATION_DEFAULTS.missingColour;
  const position = isBar ? scaleLinear().domain(domain).range([0, width]).clamp(true) : null;
  const reuseRows = sameCellStyle(before?.definition, source) && sameArray(before.domain, domain) &&
    before.missingColour === missingColour;
  const sameRows = samePanelRows(before, clusters);
  const previousRows = reuseRows && (before.definition.values !== source.values || !sameRows)
    ? new Map(before.rows.map((row) => [row.uid, row])) : null;
  const rows = reuseRows && sameRows && before.definition.values === source.values ? before.rows : [...clusters.keys()].map((uid) => {
    if (previousRows?.has(uid) && before.definition.values[uid] === source.values[uid]) return previousRows.get(uid);
    return { uid, cells: source.columns.map((_, i) => {
      const value = Object.hasOwn(source.values, uid) ? source.values[uid][i] : null;
      const rect = { x: i * cellWidth + cellGap / 2, y: -cellHeight / 2 + cellGap / 2,
        width: cellWidth - cellGap, height: cellHeight - cellGap,
        fill: value === null ? missingColour : colour(value) };
      return { ...rect, value, column: source.columns[i], columnIndex: i,
        rects: isBar ? barRectangles(value, position, width, cellHeight,
          source.colour ?? ANNOTATION_DEFAULTS.colour, missingColour,
          borderWidth, borderColour) : cellRectangles(rect, borderWidth, borderColour) };
    }) };
  });
  const rotation = source.headingRotation ?? (isBar ? 0 : ANNOTATION_DEFAULTS.headingRotation);
  const header = source.showColumnLabels === false ? [] : source.columns.map((column, i) => text(column, isBar ? 0 : (i + 0.5) * cellWidth, 0, { rotation, fontSize: columnFontSize }));
  const footer = [], key = [];
  if (source.showKey !== false && isBar) {
    key.push({ x: 0, y: 0, width, height: 1, fill: theme?.muted ?? "#555555" });
    const ticks = position.ticks(Math.max(2, Math.min(6, Math.floor(width / 40))));
    if (!ticks.includes(0)) ticks.push(0);
    for (const value of ticks.sort((a, b) => a - b)) {
      const tickX = position(value);
      key.push({ x: Math.max(0, Math.min(width - Math.min(1, width), tickX - 0.5)), y: 0,
        width: Math.min(1, width), height: 5, fill: theme?.muted ?? "#555555" });
      footer.push(text(numberLabel(value), tickX, labelFontSize + 9,
        { anchor: tickX === 0 ? "start" : tickX === width ? "end" : "middle" }));
    }
  } else if (source.showKey !== false && type === "continuous") {
    for (let i = 0; i < 32; i++) key.push({ x: i * width / 32, y: 0, width: width / 32 + 0.1, height: 8,
      fill: colour(domain[0] + (domain[1] - domain[0]) * i / 31) });
    footer.push(text(numberLabel(domain[0]), 0, 8 + labelFontSize + 3),
      text(numberLabel(domain[1]), width, 8 + labelFontSize + 3, { anchor: "end" }));
  } else if (source.showKey !== false) domain.forEach((category, i) => {
    key.push({ x: 0, y: i * (labelFontSize + 6), width: 10, height: 10, fill: colour(category) });
    footer.push(text(category, 15, i * (labelFontSize + 6) + 9));
  });
  for (const item of footer) item.fontSize = labelFontSize;
  return { width, rows, header, footer, key, domain, missingColour };
}

const panelLayoutInputs = new WeakMap();

/** Project JSON annotations once, using the same row coordinates as loci. */
export function layoutAnnotationPanels(definitions, clusters, bounds,
  { fontFamily = "sans-serif", rowOffset = 0, anchorX = bounds?.maxX, measureText = null,
    textMetricsRevision = 0, previousPanels = null, theme = null, tree = null } = {}) {
  if (!definitions?.length || !bounds || !clusters.size) return [];
  const previous = new Map(previousPanels?.map((panel) => [panel.uid, panel]));
  let right = anchorX;
  const panels = definitions.filter((source) => source.show !== false).map((source) => {
    const before = previous.get(source.uid);
    const inputs = panelLayoutInputs.get(before);
    const place = (panel) => {
      // x remains the origin of the data marks; gap separates full footprints.
      const x = right + (source.gap ?? ANNOTATION_DEFAULTS.gap) - panel.horizontalBounds.minX;
      const placed = panel.x === x ? panel : { ...panel, x };
      right = x + panel.horizontalBounds.maxX;
      panelLayoutInputs.set(placed, { measureText, textMetricsRevision, theme, tree });
      return placed;
    };
    if (inputs && before.definition === source && before.fontFamily === fontFamily && before.rowOffset === rowOffset &&
        inputs.measureText === measureText && inputs.textMetricsRevision === textMetricsRevision &&
        inputs.theme === theme && (source.type !== "groups" || inputs.tree === tree) &&
        samePanelRows(before, clusters)) return place(before);
    const titleFontSize = source.titleFontSize ?? ANNOTATION_DEFAULTS.titleFontSize;
    const columnFontSize = source.columnFontSize ?? ANNOTATION_DEFAULTS.columnFontSize;
    const labelFontSize = source.labelFontSize ?? ANNOTATION_DEFAULTS.labelFontSize;
    const cellHeight = source.cellHeight ?? ANNOTATION_DEFAULTS.cellHeight;
    const measureBounds = (value, options = {}) => textBounds(value,
      { ...options, fontSize: options.fontSize ?? labelFontSize, fontFamily, fontWeight: options.weight ?? 400 }, measureText);
    const geometry = source.type === "groups"
      ? layoutGroupPanel(source, clusters, { tree, measureBounds })
      : layoutMatrixPanel(source, clusters, { before, labelFontSize, columnFontSize, cellHeight, theme });
    const { header = [], footer = [], key = [] } = geometry;
    for (const item of [...header, ...footer]) item.bounds = measureBounds(item.text, item);
    const headingHeight = Math.max(0, ...header.map((item) => -item.bounds.minY));
    const title = source.title ?? source.uid;
    let titleDescent = 0;
    if (title) {
      const item = text(title, 0, 0, { weight: 700, kind: "title", fontSize: titleFontSize });
      item.bounds = measureBounds(title, item);
      titleDescent = Math.max(0, item.bounds.maxY);
      header.push(item);
    }
    const panel = { ...geometry, uid: source.uid, definition: source, title, cellHeight, rowOffset,
      labelFontSize, fontFamily, textColour: theme?.foreground ?? "#333333", header, footer, key,
      headingHeight, titleDescent };
    const texts = [...header, ...footer];
    panel.horizontalBounds = {
      minX: Math.min(0, ...texts.map((item) => item.x + item.bounds.minX), ...key.map((item) => item.x)),
      maxX: Math.max(panel.width, ...texts.map((item) => item.x + item.bounds.maxX),
        ...key.map((item) => item.x + item.width)),
    };
    return place(panel);
  });
  return sameArray(panels, previousPanels) ? previousPanels : panels;
}

// Keep the static projection and only the latest preview per scene. Weak keys
// let retired scenes go; a long drag cannot accumulate preview snapshots.
const frameCache = new WeakMap();
const emptyFrames = Object.freeze([]);
const rowIndexes = new WeakMap();

function rowBoundary(rows, y, upper = false) {
  let low = 0, high = rows.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (rows[mid].y < y || upper && rows[mid].y === y) low = mid + 1; else high = mid;
  }
  return low;
}

function rowsInRange(panel, minY, maxY) {
  let sorted = rowIndexes.get(panel);
  if (!sorted) { sorted = [...panel.rows].sort((a, b) => a.y - b.y); rowIndexes.set(panel, sorted); }
  return sorted.slice(rowBoundary(sorted, minY - panel.cellHeight / 2),
    rowBoundary(sorted, maxY + panel.cellHeight / 2, true));
}

/** Cull shared records, retaining source cells and their contiguous column range. */
export function annotationPanelsInViewport(scene, preview, viewport, { geometry = true, labels = true } = {}) {
  const panels = annotationPanelsForFrame(scene, preview);
  if (!viewport) return panels;
  const visible = [];
  for (const panel of panels) {
    const texts = labels ? panel.texts.filter((item) => boundsInViewport({
      minX: panel.x + item.x + item.bounds.minX, maxX: panel.x + item.x + item.bounds.maxX,
      minY: item.y + item.bounds.minY, maxY: item.y + item.bounds.maxY }, viewport)) : emptyFrames;
    const rects = geometry ? panel.rects.filter((rect) => boundsInViewport({
      minX: panel.x + rect.x, maxX: panel.x + rect.x + rect.width,
      minY: rect.y, maxY: rect.y + rect.height }, viewport)) : emptyFrames;
    let rows = emptyFrames;
    if (geometry && panel.x <= viewport.maxX && panel.x + panel.width >= viewport.minX) {
      const count = panel.rows[0]?.cells.length || 1, cellWidth = panel.width / count;
      const firstCell = Math.max(0, Math.floor((viewport.minX - panel.x) / cellWidth));
      const lastCell = Math.min(count, Math.floor((viewport.maxX - panel.x) / cellWidth) + 1);
      rows = rowsInRange(panel, viewport.minY, viewport.maxY).map((row) => ({ ...row, firstCell, lastCell }));
    }
    if (rows.length || rects.length || texts.length) visible.push({ ...panel, rows, rects, texts });
  }
  return visible;
}

/** Read-only frame records shared by rendering, bounds and hit testing. */
export function annotationPanelsForFrame(scene, preview = null) {
  if (!scene.annotationPanels?.length) return emptyFrames;
  let cached = frameCache.get(scene);
  if (!cached) { cached = {}; frameCache.set(scene, cached); }
  if (!preview && cached.static) return cached.static;
  if (preview && cached.preview === preview) return cached.frame;
  const frames = projectAnnotationFrame(scene, preview);
  if (!preview) cached.static = frames;
  else { cached.preview = preview; cached.frame = frames; }
  return frames;
}

function projectAnnotationFrame(scene, preview) {
  const dx = annotationOffsetForPreview(scene, preview);
  // Shared header and key baselines keep every panel aligned, including when
  // their labels, font sizes or cell heights differ.
  const cellHeight = Math.max(...scene.annotationPanels.map((panel) => panel.cellHeight));
  const headingHeight = Math.max(...scene.annotationPanels.map((panel) => panel.headingHeight));
  const titleDescent = Math.max(...scene.annotationPanels.map((panel) => panel.titleDescent));
  const titleOffset = headingHeight > 0 ? headingHeight + 6 + titleDescent : 0;
  const frames = scene.annotationPanels.map((panel) => {
    const rows = panel.rows.map((row) => ({ ...row,
      y: scene.clusters.get(row.uid).y + panel.rowOffset + clusterOffsetForPreview(preview, row.uid) }));
    let minY = Infinity, maxY = -Infinity;
    for (const row of rows) { minY = Math.min(minY, row.y); maxY = Math.max(maxY, row.y); }
    const top = minY - cellHeight / 2 - 10, bottom = maxY + cellHeight / 2 + 20;
    const groupMarks = panel.markerGroups ? groupPanelMarks(panel, rows) : null;
    return { ...panel, x: panel.x + dx, rows: groupMarks ? [] : rows,
      texts: [...(groupMarks?.texts ?? []), ...panel.header.map((item) => ({ ...item, y: (item.kind === "title" ? -titleOffset : item.y) + top })),
        ...panel.footer.map((item) => ({ ...item, y: item.y + bottom }))],
      rects: groupMarks?.rects ?? panel.key.map((item, keyIndex) => ({ ...item, keyIndex, y: item.y + bottom })) };
  });
  let minY = Infinity, maxY = -Infinity;
  for (const frame of frames) {
    const bounds = annotationPanelBounds(frame);
    minY = Math.min(minY, bounds.minY); maxY = Math.max(maxY, bounds.maxY);
  }
  return frames.map((frame) => ({ ...frame, verticalBounds: { minY, maxY } }));
}

export function annotationFigureBounds(bounds, panels, clusters, frames = null) {
  if (!bounds || !panels.length) return bounds;
  const result = { ...bounds };
  for (const panel of frames || annotationPanelsForFrame({ annotationPanels: panels, clusters })) {
    includeBounds(result, annotationPanelBounds(panel));
  }
  return result;
}

/** Panel area includes whitespace between rows, headings and the colour key. */
export function annotationPanelBounds(panel) {
  const bounds = { minX: panel.x + panel.horizontalBounds.minX,
    maxX: panel.x + panel.horizontalBounds.maxX, minY: Infinity, maxY: -Infinity };
  if (panel.verticalBounds) return { ...bounds, ...panel.verticalBounds };
  for (const item of panel.texts) {
    bounds.minY = Math.min(bounds.minY, item.y + item.bounds.minY);
    bounds.maxY = Math.max(bounds.maxY, item.y + item.bounds.maxY);
  }
  for (const rect of panel.rects) {
    bounds.minY = Math.min(bounds.minY, rect.y);
    bounds.maxY = Math.max(bounds.maxY, rect.y + rect.height);
  }
  for (const row of panel.rows) {
    bounds.minY = Math.min(bounds.minY, row.y - panel.cellHeight / 2);
    bounds.maxY = Math.max(bounds.maxY, row.y + panel.cellHeight / 2);
  }
  return bounds;
}

/** Shared cell hit testing, independent of DOM elements or raster backends. */
export function hitTestAnnotationCell(scene, point, preview = null) {
  if (!scene?.annotationPanels?.length) return null;
  const panels = annotationPanelsForFrame(scene, preview);
  for (let index = panels.length - 1; index >= 0; index--) {
    const panel = panels[index];
    if (point.x < panel.x || point.x > panel.x + panel.width) continue;
    for (const row of rowsInRange(panel, point.y, point.y)) {
      const cell = row.cells.find((cell) => point.x >= panel.x + cell.x && point.x <= panel.x + cell.x + cell.width &&
        point.y >= row.y + cell.y && point.y <= row.y + cell.y + cell.height);
      if (cell) return { panelUid: panel.uid, title: panel.title, clusterUid: row.uid,
        clusterName: scene.clusters.get(row.uid).source.name || row.uid,
        column: cell.column, value: cell.value };
    }
  }
  return null;
}
