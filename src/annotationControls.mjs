import { color } from "d3-color";

const hex = (value) => color(value)?.formatHex() || "#888888";

/** A compact editor for JSON-backed panel presentation, with no private data copy. */
export function createAnnotationControls({ getPanels, patch, document, panelUid, annotationApi }) {
  const { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale } = annotationApi;
  const node = document.createElement("fieldset");
  node.className = "cm-annotation-controls";
  let applying = false;
  const current = () => getPanels().find((panel) => panel.uid === panelUid);
  const element = (tag, text) => {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const row = (parent, label, control) => {
    const item = element("label"); item.append(element("span", label), control); parent.append(item);
    return control;
  };
  const input = (parent, label, field, value, type = "text", options = {}) => {
    const control = element("input");
    Object.assign(control, { type, ...options });
    control.dataset.annotationField = field;
    if (type === "checkbox") control.checked = value;
    else control.value = type === "color" ? hex(value) : value;
    if (type === "number") control.step = "any";
    return row(parent, label, control);
  };
  const select = (parent, label, field, value, options) => {
    const control = element("select"); control.dataset.annotationField = field;
    for (const [key, title] of options) {
      const option = element("option", title); option.value = key; control.append(option);
    }
    control.value = value;
    return row(parent, label, control);
  };
  const render = () => {
    const panel = current();
    const labelsOpen = node.querySelector("details")?.open || false;
    node.replaceChildren(element("legend", "Appearance"));
    if (!panel) return;
    const isBar = panel.type === "bar";
    input(node, "Show panel", "show", panel.show !== false, "checkbox");
    input(node, "Title", "title", panel.title ?? panel.uid);
    const sizes = isBar ? [["width", "Panel width"], ["cellHeight", "Bar height"]]
      : [["cellWidth", "Cell width"], ["cellHeight", "Cell height"], ["cellGap", "Cell gap"]];
    for (const [field, label] of [...sizes, ["cellBorderWidth", "Border width"], ["gap", "Panel gap"]]) {
      input(node, label, field, panel[field] ?? ANNOTATION_DEFAULTS[field], "number",
        { min: ["cellWidth", "cellHeight", "width"].includes(field) ? "0.1" : "0" });
    }
    node.querySelector('[data-annotation-field="gap"]').title = "Distance from the preceding panel's grid edge (or the cluster area, including scales, for the first panel).";
    input(node, "Border colour", "cellBorderColour", panel.cellBorderColour ?? ANNOTATION_DEFAULTS.cellBorderColour, "color");
    const resolved = resolveAnnotationScale(panel);
    if (resolved.type === "continuous") {
      const auto = !panel.scale?.domain;
      input(node, "Automatic domain", "autoDomain", auto, "checkbox");
      input(node, "Minimum", "domainMin", resolved.domain[0], "number", { disabled: auto });
      input(node, "Maximum", "domainMax", resolved.domain[1], "number", { disabled: auto });
    }
    if (isBar) input(node, "Bar colour", "colour", panel.colour ?? ANNOTATION_DEFAULTS.colour, "color");
    else {
      const paletteName = Object.entries(ANNOTATION_PALETTES).find(([, colours]) =>
        colours.length === resolved.colours.length && colours.every((value, i) => hex(value) === hex(resolved.colours[i])))?.[0] || "custom";
      select(node, "Palette", "palette", paletteName,
        [["custom", "Custom"], ...Object.keys(ANNOTATION_PALETTES).map((name) => [name, name])]);
      const swatches = resolved.type === "categorical" ? resolved.domain.map(resolved.colour) : resolved.colours;
      swatches.forEach((value, i) => input(node,
        resolved.type === "categorical" ? resolved.domain[i] : `Colour ${i + 1}`, `colour:${i}`, value, "color"));
    }
    input(node, "Missing colour", "missingColour", panel.missingColour ?? ANNOTATION_DEFAULTS.missingColour, "color");
    input(node, isBar ? "Show axis" : "Show colour key", "showKey", panel.showKey !== false, "checkbox");
    const advanced = element("details"); advanced.append(element("summary", "Labels")); node.append(advanced);
    advanced.open = labelsOpen;
    input(advanced, "Font size", "fontSize", panel.fontSize ?? ANNOTATION_DEFAULTS.fontSize, "number", { min: "0.1" });
    input(advanced, "Show column labels", "showColumnLabels", panel.showColumnLabels !== false, "checkbox");
    input(advanced, "Heading angle", "headingRotation", panel.headingRotation ?? (isBar ? 0 : ANNOTATION_DEFAULTS.headingRotation), "number", { min: "-90", max: "0" });
    panel.columns.forEach((value, i) => input(advanced, `Column ${i + 1}`, `column:${i}`, value));
    const error = element("div"); error.dataset.annotationError = ""; error.setAttribute("role", "alert"); node.append(error);
  };
  const edit = (event) => {
    const control = event.target, field = control.dataset.annotationField;
    if (!field) return;
    // Text commits on change, consistent with the editor's other label fields.
    if ((control.type === "text") !== (event.type === "change")) return;
    control.setCustomValidity("");
    if (!control.checkValidity() || control.type === "number" && control.value === "") return;
    const panel = current(), resolved = resolveAnnotationScale(panel);
    const value = control.type === "checkbox" ? control.checked : control.type === "number" ? control.valueAsNumber : control.value;
    let changes, refresh = false;
    const scale = { ...panel.scale };
    if (field === "autoDomain") {
      if (value) delete scale.domain;
      else scale.domain = resolved.domain;
      changes = { scale }; refresh = true;
    } else if (field === "domainMin" || field === "domainMax") {
      const min = node.querySelector('[data-annotation-field="domainMin"]').valueAsNumber;
      const max = node.querySelector('[data-annotation-field="domainMax"]').valueAsNumber;
      changes = { scale: { ...scale, domain: [min, max] } };
    } else if (field === "palette") {
      if (value === "custom") return;
      changes = { scale: { ...scale, colours: [...ANNOTATION_PALETTES[value]] } }; refresh = true;
    } else if (field.startsWith("colour:")) {
      const colours = resolved.type === "categorical" ? resolved.domain.map(resolved.colour) : [...resolved.colours];
      colours[Number(field.split(":")[1])] = value;
      changes = { scale: { ...scale, colours } };
    } else if (field.startsWith("column:")) {
      const columns = [...panel.columns]; columns[Number(field.split(":")[1])] = value;
      changes = { columns };
    } else changes = { [field]: value };
    try {
      applying = true;
      patch([{ type: "annotationPanels.update", ids: [panel.uid], changes }]);
      node.querySelector("[data-annotation-error]").textContent = "";
      node.querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      if (refresh) render();
      else if (field.startsWith("colour:")) node.querySelector('[data-annotation-field="palette"]').value = "custom";
    } catch (error) {
      node.querySelector("[data-annotation-error]").textContent = error.message;
      control.setCustomValidity(error.message);
    } finally { applying = false; }
  };
  node.addEventListener("input", edit);
  node.addEventListener("change", edit);
  render();
  return { node, update() { if (!applying) render(); } };
}
