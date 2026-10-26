import { color } from "d3-color";
import { controlStyles } from "./controlStyles.mjs";

const controlClasses = { BUTTON: "cm-button", INPUT: "cm-field", SELECT: "cm-field", TEXTAREA: "cm-field", FIELDSET: "cm-section", SUMMARY: "cm-disclosure" };
export const classifyControl = (node) => {
  const name = controlClasses[node.tagName];
  if (name) node.classList.add(name);
  if (node.tagName === "BUTTON" && node.closest("clinker-action-menu")) node.classList.add("cm-menu-item");
};

/** Classify only library-owned markup, including controls built dynamically. */
export function prepareUi(root) {
  root.querySelectorAll("button,input,select,textarea,fieldset,summary").forEach(classifyControl);
  root.querySelectorAll("template").forEach((template) => prepareUi(template.content));
}

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
      prepareUi(template.content);
      templates.set(document, template);
    }
    return document.importNode(template.content, true);
  };
}

export function mountComponent(element, template, css) {
  const root = element.attachShadow({ mode: "open" });
  const style = element.ownerDocument.createElement("style"); style.textContent = controlStyles + css;
  root.append(style, template(element.ownerDocument));
  return root;
}

const selectOptions = new WeakMap();
export function updateSelectOptions(control, entries) {
  const options = entries.map((entry) => Array.isArray(entry) ? entry : [entry, entry]);
  const key = JSON.stringify(options);
  if (selectOptions.get(control) === key) return;
  const value = control.value;
  control.replaceChildren(...options.map(([value, label]) => {
    const option = control.ownerDocument.createElement("option");
    option.value = value; option.textContent = label; return option;
  }));
  control.value = value; selectOptions.set(control, key);
}

/** Native controls for in-plot popovers. */
export function createControls(document) {
  const el = (tag, text, parent, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    classifyControl(node);
    parent?.append(node); return node;
  };
  const row = (parent, label) => {
    const node = el("label", undefined, parent);
    el("span", label, node); return node;
  };
  const button = (parent, label, action, className) => {
    const node = el("button", label, parent, className); node.type = "button"; node.onclick = action; return node;
  };
  const input = (parent, label, value, type = "text", options = {}) => {
    const node = el("input", undefined, parent); Object.assign(node, { type, ...options });
    node.setAttribute("aria-label", label);
    if (type === "checkbox") node.checked = Boolean(value);
    else node.value = type === "color" ? colourHex(value) : value ?? "";
    if (type === "number" && options.step === undefined) node.step = "any";
    return node;
  };
  const select = (parent, label, value, entries) => {
    const node = el("select", undefined, parent); node.setAttribute("aria-label", label);
    updateSelectOptions(node, entries);
    node.value = value;
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
