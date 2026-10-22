import { createTemplate, mountComponent } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./search-field.html", import.meta.url)),
  textAsset(new URL("./search-field.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class SearchField extends HTMLElementBase {
  static observedAttributes = ["label", "placeholder"];
  #input;
  #clear;

  constructor() {
    super();
    const root = mountComponent(this, template, css);
    this.#input = root.querySelector("input"); this.#clear = root.querySelector("button");
    this.#input.oninput = () => this.#sync();
    this.#clear.onclick = () => this.#clearValue();
    this.#input.onkeydown = (event) => {
      if (event.key !== "Escape" || !this.value || event.isComposing) return;
      event.preventDefault(); event.stopPropagation(); this.#clearValue();
    };
    this.#sync();
  }

  get value() { return this.#input.value; }
  set value(value) {
    const next = String(value ?? "");
    if (next !== this.value) this.#input.value = next;
    this.#sync();
  }
  focus(options) { this.#input.focus(options); }
  attributeChangedCallback() { this.#sync(); }

  #sync() {
    this.#input.setAttribute("aria-label", this.getAttribute("label") || "Filter records");
    this.#input.placeholder = this.getAttribute("placeholder") || "Search";
    this.#input.toggleAttribute("data-filled", Boolean(this.value));
    this.#clear.hidden = !this.value;
  }

  #clearValue() {
    this.value = ""; this.focus();
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }
}

export function defineSearchField() {
  if (!customElements.get("clinker-search-field")) customElements.define("clinker-search-field", SearchField);
}
