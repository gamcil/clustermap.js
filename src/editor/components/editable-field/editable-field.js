import { createTemplate } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./editable-field.html", import.meta.url)),
  textAsset(new URL("./editable-field.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

/** A field owns its draft; consumers accept or cancel value-commit events. */
class EditableField extends HTMLElementBase {
  static observedAttributes = ["label", "placeholder", "type", "min", "max", "step", "required", "disabled"];
  #value = "";
  #revision = 0;
  #editing = false;
  #text;
  #button;
  #input;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css;
    root.append(style, template(this.ownerDocument));
    this.#text = root.querySelector("span");
    this.#button = root.querySelector("button");
    this.#input = root.querySelector("input");
    this.#text.onclick = () => this.#beginEdit();
    this.#button.onclick = () => this.#beginEdit();
    this.#input.onblur = () => { if (this.isConnected) this.#commit(); };
    this.#input.oninput = () => this.#input.setCustomValidity("");
    this.#input.onkeydown = (event) => {
      if (event.isComposing) return;
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Escape") this.#finish();
        else this.#commit();
        if (!this.#editing) this.#button.focus({ preventScroll: true });
      }
    };
    this.#render();
  }

  get value() { return this.#value; }
  set value(value) {
    const next = String(value ?? ""); this.#revision++;
    if (next === this.#value) return;
    this.#value = next;
    this.#render();
  }

  attributeChangedCallback(name) {
    if (name === "disabled" && this.hasAttribute("disabled")) this.#finish();
    else this.#render();
  }
  disconnectedCallback() { this.#finish(); }

  cancelEdit() { this.#finish(); }
  setCustomValidity(message) { this.#input.setCustomValidity(message); }
  reportValidity() { return this.#input.reportValidity(); }

  #render() {
    const label = this.getAttribute("label") || "Value", placeholder = this.getAttribute("placeholder") || "";
    this.#text.textContent = this.#value || placeholder; this.#text.title = this.#value || placeholder;
    this.#text.toggleAttribute("data-placeholder", !this.#value);
    this.#button.setAttribute("aria-label", `Edit ${label}`); this.#button.title = `Edit ${label}`;
    this.#input.setAttribute("aria-label", label); this.#input.placeholder = placeholder;
    const type = this.getAttribute("type") || "text";
    if (this.#input.type !== type) this.#input.type = type;
    for (const name of ["min", "max", "step"]) {
      if (this.hasAttribute(name)) this.#input.setAttribute(name, this.getAttribute(name));
      else this.#input.removeAttribute(name);
    }
    this.#input.required = this.hasAttribute("required");
    this.#input.disabled = this.#button.disabled = this.hasAttribute("disabled");
    this.#text.hidden = this.#button.hidden = this.#editing;
    this.#input.hidden = !this.#editing;
    if (!this.#editing) this.#input.value = this.#value;
  }

  #beginEdit() {
    if (this.hasAttribute("disabled")) return;
    if (this.hasAttribute("compact")) this.style.setProperty("--cm-edit-width", `${this.getBoundingClientRect().width}px`);
    this.#editing = true;
    this.#input.value = this.#value; this.#input.setCustomValidity("");
    this.#render(); this.#input.focus({ preventScroll: true }); this.#input.select();
  }

  #finish() {
    this.#editing = false; this.#input.setCustomValidity("");
    this.style.removeProperty("--cm-edit-width"); this.#render();
  }

  #commit() {
    if (!this.#editing) return;
    if (!this.#input.reportValidity()) return;
    const value = this.#input.value, revision = this.#revision;
    if (value !== this.#value) {
      const event = new CustomEvent("value-commit", { detail: { value }, bubbles: true, composed: true, cancelable: true });
      if (!this.dispatchEvent(event)) { this.#input.reportValidity(); return; }
      if (revision === this.#revision) this.#value = value;
    }
    this.#finish();
  }
}

export function defineEditableField() {
  if (!customElements.get("clinker-editable-field")) customElements.define("clinker-editable-field", EditableField);
}
