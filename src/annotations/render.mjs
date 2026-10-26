import { annotationPanelsInViewport } from "./model.mjs";
import { sameArray } from "../utils/values.mjs";
import { select } from "d3-selection";
const svgViews = new WeakMap();

const sameView = (one, two) => one.length === two.length && one.every((panel, i) => {
  const next = two[i];
  return panel.uid === next.uid && sameArray(panel.texts, next.texts) && sameArray(panel.rects, next.rects) &&
    panel.rows.length === next.rows.length && panel.rows.every((row, index) =>
      row.uid === next.rows[index].uid && row.firstCell === next.rows[index].firstCell && row.lastCell === next.rows[index].lastCell);
});

/** Camera motion only changes SVG joins when the visible row/column set changes. */
export function updateSvgAnnotationViewport(plot, scene, preview, viewport) {
  if (!scene || plot.empty()) return;
  const panels = annotationPanelsInViewport(scene, preview, viewport), before = svgViews.get(plot.node());
  if (before?.scene === scene && before.preview === preview && sameView(before.panels, panels)) return;
  renderSvgAnnotations(plot, scene, { preview, panels });
}

export function renderSvgAnnotations(plot, scene, { preview = null, transition = null, animate = false,
  viewport = null, panels: projected = null } = {}) {
  const view = projected || annotationPanelsInViewport(scene, preview, animate ? null : viewport);
  if (animate) svgViews.delete(plot.node());
  else svgViews.set(plot.node(), { scene, preview, panels: view });
  if (!scene.annotationPanels?.length) {
    plot.selectAll("g.annotationPanels").remove();
    return;
  }
  const moving = (selection) => animate ? selection.transition(transition) : selection.interrupt();
  const panels = plot.selectAll("g.annotationPanels").data([null]).join("g")
    .attr("class", "annotationPanels").attr("pointer-events", "none")
    .selectAll("g.annotationPanel").data(view, (panel) => panel.uid)
    .join("g").attr("class", "annotationPanel")
    .attr("font-family", (panel) => panel.fontFamily);
  moving(panels).attr("transform", (panel) => `translate(${panel.x},0)`);
  panels.each(function (panel) {
    const group = select(this);
    const rows = group.selectAll("g.annotationRow").data(panel.rows, (row) => row.uid).join("g")
      .attr("class", "annotationRow");
    moving(rows).attr("transform", (row) => `translate(0,${row.y})`);
    const cells = rows.selectAll("rect").data((row) =>
      row.cells.slice(row.firstCell ?? 0, row.lastCell ?? row.cells.length).flatMap((cell) => cell.rects)).join("rect");
    const key = group.selectAll("g.annotationKey").data([null]).join("g")
      .attr("class", "annotationKey").selectAll("rect").data(panel.rects).join("rect");
    for (const rects of [cells, key]) moving(rects)
      .attr("x", (item) => item.x).attr("y", (item) => item.y)
      .attr("width", (item) => item.width).attr("height", (item) => item.height).attr("fill", (item) => item.fill);
    const texts = group.selectAll("text").data(panel.texts).join("text")
      .text((item) => item.text).attr("text-anchor", (item) => item.anchor)
      .attr("font-size", (item) => item.fontSize)
      .attr("font-weight", (item) => item.weight || 400).attr("fill", panel.textColour);
    moving(texts).attr("transform", (item) => `translate(${item.x},${item.y}) rotate(${item.rotation || 0})`);
  });
}

export function drawCanvasAnnotations(context, scene, preview = null, { showGeometry = true, showLabels = true, viewport = null } = {}) {
  for (const panel of annotationPanelsInViewport(scene, preview, viewport, { geometry: showGeometry, labels: showLabels })) {
    context.save();
    context.translate(panel.x, 0);
    const rect = (item) => {
      context.fillStyle = item.fill;
      context.fillRect(item.x, item.y, item.width, item.height);
    };
    if (showGeometry) {
      for (const row of panel.rows) {
        context.save(); context.translate(0, row.y);
        for (let i = row.firstCell ?? 0; i < (row.lastCell ?? row.cells.length); i++) {
          for (const part of row.cells[i].rects) rect(part);
        }
        context.restore();
      }
      for (const item of panel.rects) rect(item);
    }
    for (const item of showLabels ? panel.texts : []) {
      context.save();
      context.translate(item.x, item.y);
      context.rotate((item.rotation || 0) * Math.PI / 180);
      context.font = `${item.weight || 400} ${item.fontSize}px ${panel.fontFamily}`;
      context.fillStyle = panel.textColour;
      context.textAlign = item.anchor === "end" ? "right" : item.anchor === "middle" ? "center" : "left";
      context.textBaseline = "alphabetic";
      context.fillText(item.text, 0, 0);
      context.restore();
    }
    context.restore();
  }
}
