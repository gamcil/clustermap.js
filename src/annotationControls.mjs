import { createControls, createActionRunner, colourHex as hex } from "./uiControls.mjs";

/** Quick styling stays in the plot; data and membership editing live in the data editor. */
export function createAnnotationControls({ getData, patch, document, panelUid, annotationApi, onEditData }) {
  const { ANNOTATION_DEFAULTS: defaults, ANNOTATION_PALETTES: palettes, resolveAnnotationScale } = annotationApi;
  const node = document.createElement("fieldset"); node.className = "cm-annotation-controls";
  let applying = false;
  const run = createActionRunner((message) => { node.querySelector("[data-annotation-error]").textContent = message; });
  const current = () => (getData()?.annotationPanels || []).find((panel) => panel.uid === panelUid);
  const ui = createControls(document), { el, row } = ui;
  const input = (parent, label, field, value, type = "text", options = {}) => {
    const control = ui.input(row(parent, label), label, value, type, options);
    control.dataset.annotationField = field; return control;
  };
  const select = (parent, label, field, value, entries) => {
    const control = ui.select(row(parent, label), label, value, entries);
    control.dataset.annotationField = field; return control;
  };
  const paletteSelect = (parent, resolved) => {
    const name = Object.entries(palettes).find(([, colours]) => colours.length === resolved.colours.length &&
      colours.every((value, i) => hex(value) === hex(resolved.colours[i])))?.[0] || "custom";
    select(parent, "Palette", "palette", name, [["custom", "Custom"], ...Object.keys(palettes).map((key) => [key, key])]);
  };
  const gradient = () => {
    const preview = node.querySelector("[data-colour-preview]");
    if (preview) preview.style.background = `linear-gradient(to right, ${resolveAnnotationScale(current()).colours.join(",")})`;
  };
  function render() {
    const open = node.querySelector("details")?.open || false, panel = current();
    node.replaceChildren(); if (!panel) return;
    const groups = panel.type === "groups", bar = panel.type === "bar";
    input(node, "Title", "title", panel.title ?? panel.uid);
    const resolved = groups ? null : resolveAnnotationScale(panel);
    if (groups) panel.groups.forEach((group, i) => input(node, group.label || group.uid, `group:${i}:colour`,
      group.colour ?? panel.colour ?? defaults.colour, "color"));
    else if (bar) input(node, "Colour", "colour", panel.colour ?? defaults.colour, "color");
    else if (resolved.type === "categorical") resolved.domain.forEach((name, i) => input(node, name, `colour:${i}`, resolved.colour(name), "color"));
    else {
      paletteSelect(node, resolved);
      const preview = el("div", undefined, node); preview.dataset.colourPreview = ""; preview.className = "cm-annotation-gradient";
      preview.setAttribute("role", "img"); preview.setAttribute("aria-label", "Colour gradient"); gradient();
    }
    if (resolved?.type === "continuous") {
      const range = el("div", undefined, node); range.className = "cm-annotation-range";
      select(range, "Range", "autoDomain", panel.scale?.domain ? "custom" : "auto", [["auto", "Auto"], ["custom", "Custom"]]);
      if (panel.scale?.domain) {
        input(range, "Minimum", "domainMin", resolved.domain[0], "number");
        input(range, "Maximum", "domainMax", resolved.domain[1], "number");
      }
    }
    if (!groups) input(node, bar ? "Show axis" : "Show legend", "showKey", panel.showKey !== false, "checkbox");
    const data = el("button", "Edit data…", node); data.type = "button"; data.onclick = () => onEditData?.();
    const advanced = el("details", undefined, node); el("summary", "Advanced", advanced); advanced.open = open;
    const sizes = groups ? [["markerWidth", "Bar thickness", 3], ["laneGap", "Lane gap", 12]]
      : bar ? [["width", "Panel width", defaults.width], ["cellHeight", "Bar height", defaults.cellHeight]]
        : [["cellWidth", "Cell width", defaults.cellWidth], ["cellHeight", "Cell height", defaults.cellHeight], ["cellGap", "Cell gap", defaults.cellGap]];
    for (const [field, label, fallback] of [...sizes, ["gap", "Panel gap", defaults.gap], ["fontSize", "Font size", defaults.fontSize]]) {
      input(advanced, label, field, panel[field] ?? fallback, "number", { min: ["gap", "cellGap"].includes(field) ? "0" : "0.1" });
    }
    if (!groups) {
      input(advanced, "Border width", "cellBorderWidth", panel.cellBorderWidth ?? defaults.cellBorderWidth, "number", { min: "0" });
      input(advanced, "Border colour", "cellBorderColour", panel.cellBorderColour ?? defaults.cellBorderColour, "color");
      input(advanced, "Missing colour", "missingColour", panel.missingColour ?? defaults.missingColour, "color");
      if (!bar && resolved.type === "continuous") resolved.colours.forEach((value, i) => input(advanced, `Colour stop ${i + 1}`, `colour:${i}`, value, "color"));
      else if (!bar) paletteSelect(advanced, resolved);
      input(advanced, "Show column labels", "showColumnLabels", panel.showColumnLabels !== false, "checkbox");
      input(advanced, "Heading angle", "headingRotation", panel.headingRotation ?? (bar ? 0 : defaults.headingRotation), "number", { min: "-90", max: "0" });
    }
    const error = el("div", undefined, node); error.dataset.annotationError = ""; error.setAttribute("role", "alert");
  }
  const edit = (event) => {
    const control = event.target, field = control.dataset.annotationField;
    if (!field || (control.type === "text") !== (event.type === "change")) return;
    control.setCustomValidity("");
    if (!control.checkValidity() || control.type === "number" && control.value === "") return;
    const panel = current(), resolved = panel.type === "groups" ? null : resolveAnnotationScale(panel);
    const value = control.type === "checkbox" ? control.checked : control.type === "number" ? control.valueAsNumber : control.value;
    let changes, refresh = false;
    const scale = { ...panel.scale };
    if (field.startsWith("group:")) {
      const index = Number(field.split(":")[1]);
      changes = { groups: panel.groups.map((group, i) => i === index ? { ...group, colour: value } : group) };
    } else if (field === "autoDomain") {
      if (value === "auto") delete scale.domain; else scale.domain = resolved.domain;
      changes = { scale }; refresh = true;
    } else if (field === "domainMin" || field === "domainMax") {
      const domain = [...resolved.domain]; domain[field === "domainMin" ? 0 : 1] = value;
      changes = { scale: { ...scale, domain } };
    } else if (field === "palette") {
      if (value === "custom") return;
      changes = { scale: { ...scale, colours: [...palettes[value]] } }; refresh = true;
    } else if (field.startsWith("colour:")) {
      const colours = resolved.type === "categorical" ? resolved.domain.map(resolved.colour) : [...resolved.colours];
      colours[Number(field.split(":")[1])] = value; changes = { scale: { ...scale, colours } };
    } else changes = { [field]: value };
    applying = true;
    try { run(() => {
      patch([{ type: "annotationPanels.update", ids: [panel.uid], changes }]);
      node.querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      if (refresh) render();
      else { gradient(); if (field.startsWith("colour:")) { const palette = node.querySelector('[data-annotation-field="palette"]'); if (palette) palette.value = "custom"; } }
    }, control); } finally { applying = false; }
  };
  node.addEventListener("input", edit); node.addEventListener("change", edit);
  render();
  return { node, update() { if (!applying) render(); } };
}
