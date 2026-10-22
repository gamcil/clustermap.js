import { color } from "d3-color";

export const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const colourHex = (value, fallback = "#888888") => color(value)?.formatHex() || fallback;

export function upgradeProperty(element, name) {
  if (!Object.prototype.hasOwnProperty.call(element, name)) return;
  const value = element[name]; delete element[name]; element[name] = value;
}

/** Parse static markup once per document; each mount receives its own nodes. */
export function createTemplate(markup) {
  const templates = new WeakMap();
  return (document) => {
    let template = templates.get(document);
    if (!template) {
      template = document.createElement("template"); template.innerHTML = markup;
      templates.set(document, template);
    }
    return document.importNode(template.content, true);
  };
}

const controlTemplates = Object.fromEntries(["button", "input", "select", "option"].map((tag) =>
  [tag, createTemplate(tag === "input" ? "<input>" : `<${tag}></${tag}>`)]));
const labelTemplate = createTemplate("<label><span></span></label>");
const selectOptions = new WeakMap();
export function updateSelectOptions(control, entries) {
  const options = entries.map((entry) => Array.isArray(entry) ? entry : [entry, entry]);
  const key = JSON.stringify(options);
  if (selectOptions.get(control) === key) return;
  const value = control.value;
  control.replaceChildren(...options.map(([value, label]) => {
    const option = controlTemplates.option(control.ownerDocument).firstElementChild;
    option.value = value; option.textContent = label; return option;
  }));
  control.value = value; selectOptions.set(control, key);
}

/** Native controls with consistent labels, values and validity handling. */
export function createControls(document) {
  const el = (tag, text, parent, className) => {
    const node = controlTemplates[tag]?.(document).firstElementChild || document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent?.append(node); return node;
  };
  const row = (parent, label) => {
    const node = labelTemplate(document).firstElementChild;
    node.firstElementChild.textContent = label; parent?.append(node); return node;
  };
  const button = (parent, label, action, className) => {
    const node = el("button", label, parent, className); node.type = "button"; node.onclick = action; return node;
  };
  const input = (parent, label, value, type = "text", onChange, options = {}) => {
    const node = el("input", undefined, parent); Object.assign(node, { type, ...options });
    node.setAttribute("aria-label", label);
    if (type === "checkbox") node.checked = Boolean(value);
    else node.value = type === "color" ? colourHex(value) : value ?? "";
    if (type === "number" && options.step === undefined) node.step = "any";
    if (onChange) node.onchange = () => { if (node.checkValidity()) onChange(type === "checkbox" ? node.checked : node.value); };
    return node;
  };
  const select = (parent, label, value, entries, onChange) => {
    const node = el("select", undefined, parent); node.setAttribute("aria-label", label);
    updateSelectOptions(node, entries);
    node.value = value;
    if (onChange) node.onchange = () => onChange(node.value);
    return node;
  };
  const field = (parent, label, value, { type = "text", entries, options, commit, cancel } = {}) =>
    bindEditableField(entries ? select(parent, label, value, entries) : input(parent, label, value, type, undefined, options),
      { commit, cancel });
  return { el, row, button, input, select, field };
}

const fieldValues = new WeakMap();
export function updateFieldValue(control, value) {
  if (control === control.ownerDocument.activeElement) return;
  control.value = value ?? "";
  fieldValues.set(control, control.value);
}

/** Shared commit, validation and cancellation for editable fields. */
export function bindEditableField(control, { commit, cancel }) {
  control.classList.add("cm-data-field");
  fieldValues.set(control, control.value);
  control.onchange = () => {
    control.setCustomValidity("");
    if (!control.checkValidity()) { control.reportValidity(); return; }
    if (control.value === fieldValues.get(control)) return;
    if (commit(control.value, control) !== false) fieldValues.set(control, control.value);
    else control.reportValidity();
  };
  control.onkeydown = (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      control.value = fieldValues.get(control); control.setCustomValidity(""); cancel?.();
    } else if (event.key === "Enter" && control.tagName === "INPUT") {
      event.preventDefault(); control.blur();
    }
  };
  return control;
}

/** Report rejected UI edits consistently while leaving validation in the model. */
export function createActionRunner(report) {
  return (action, control) => {
    control?.setCustomValidity("");
    try { action(); report(""); return true; }
    catch (error) { report(error.message); control?.setCustomValidity(error.message); return false; }
  };
}

const lastMarkup = new WeakMap();
/** Preserve focused controls when a header or action bar has not changed. */
export function setMarkup(node, html) {
  if (lastMarkup.get(node) === html) return;
  node.innerHTML = html; lastMarkup.set(node, html);
}
