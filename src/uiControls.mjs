import { color } from "d3-color";

export const colourHex = (value, fallback = "#888888") => color(value)?.formatHex() || fallback;

/** Native controls with consistent labels, values and validity handling. */
export function createControls(document) {
  const el = (tag, text, parent, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent?.append(node); return node;
  };
  const row = (parent, label) => {
    const node = el("label", undefined, parent); el("span", label, node); return node;
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
    for (const entry of entries) {
      const [key, title] = Array.isArray(entry) ? entry : [entry, entry];
      el("option", title, node).value = key;
    }
    node.value = value;
    if (onChange) node.onchange = () => onChange(node.value);
    return node;
  };
  return { el, row, button, input, select };
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
