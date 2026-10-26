import { createTemplate, mountComponent, updateSelectOptions } from "../../../ui/controls.mjs";
import { textAsset } from "../../../ui/assets.mjs";

const [markup, css] = await Promise.all([
  textAsset(new URL("./annotation-value-actions.html", import.meta.url)),
  textAsset(new URL("./annotation-value-actions.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AnnotationValueActions extends HTMLElementBase {
  #uid;
  #columns;
  #numeric;
  #categories;
  #domain = null;

  constructor() {
    super();
    const root = mountComponent(this, template, css);
    this.#columns = root.querySelector("[data-columns]"); this.#numeric = root.querySelector("input"); this.#categories = root.querySelector("[data-categories]");
    root.querySelector("[data-set]").onclick = () => this.#submit(false);
    root.querySelector("[data-clear]").onclick = () => this.#submit(true);
  }

  set state({ uid, columns, domain = null }) {
    const changed = this.#uid !== uid, value = changed ? "" : this.#input.value;
    this.#uid = uid; this.#domain = domain;
    this.#numeric.hidden = domain !== null; this.#categories.hidden = domain === null;
    updateSelectOptions(this.#columns, [["all", "All columns"], ...columns.map((name, index) => [String(index), name])]);
    if (domain !== null) updateSelectOptions(this.#categories, [["", "Missing"], ...domain.map((name, index) => [String(index), name])]);
    if (changed || !this.#columns.value) this.#columns.value = "0";
    this.#input.value = value;
    if (domain !== null && this.#categories.selectedIndex < 0) this.#categories.value = "";
  }

  get #input() { return this.#domain === null ? this.#numeric : this.#categories; }
  #submit(clear) {
    const input = this.#input;
    if (!clear && !input.reportValidity()) return;
    const value = clear || input.value === "" ? null : this.#domain === null ? Number(input.value) : this.#domain[Number(input.value)];
    const column = this.#columns.value === "all" ? "all" : Number(this.#columns.value);
    this.dispatchEvent(new CustomEvent("values-commit", { detail: { column, value }, bubbles: true, composed: true, cancelable: true }));
  }
}

export function defineAnnotationValueActions() {
  if (!customElements.get("clinker-annotation-value-actions")) customElements.define("clinker-annotation-value-actions", AnnotationValueActions);
}
