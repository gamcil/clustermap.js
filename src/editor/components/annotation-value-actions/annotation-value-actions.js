import { createTemplate, updateSelectOptions } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";

const [markup, controls, css] = await Promise.all([
  textAsset(new URL("./annotation-value-actions.html", import.meta.url)),
  textAsset(new URL("../../shared/controls.css", import.meta.url)),
  textAsset(new URL("./annotation-value-actions.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AnnotationValueActions extends HTMLElementBase {
  #columns;
  #numeric;
  #categories;
  #domain = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controls + css;
    root.append(style, template(this.ownerDocument));
    this.#columns = root.querySelector("[data-columns]"); this.#numeric = root.querySelector("input"); this.#categories = root.querySelector("[data-categories]");
    root.addEventListener("change", () => this.#draftChanged());
    root.querySelector("[data-set]").onclick = () => this.#submit(false);
    root.querySelector("[data-clear]").onclick = () => this.#submit(true);
  }

  set state({ columns, domain = null, draft = { column: "0", value: "" } }) {
    this.#domain = domain;
    this.#numeric.hidden = domain !== null; this.#categories.hidden = domain === null;
    updateSelectOptions(this.#columns, [["all", "All columns"], ...columns.map((name, index) => [String(index), name])]);
    if (domain !== null) updateSelectOptions(this.#categories, [["", "Missing"], ...domain.map((name, index) => [String(index), name])]);
    this.#columns.value = draft.column; this.#input.value = draft.value;
  }

  get #input() { return this.#domain === null ? this.#numeric : this.#categories; }
  #draftChanged() {
    this.dispatchEvent(new CustomEvent("draft-change", { detail: { column: this.#columns.value, value: this.#input.value }, bubbles: true, composed: true }));
  }
  #submit(clear) {
    const input = this.#input;
    if (!clear && !input.reportValidity()) return;
    this.#draftChanged();
    const value = clear || input.value === "" ? null : this.#domain === null ? Number(input.value) : this.#domain[Number(input.value)];
    const column = this.#columns.value === "all" ? "all" : Number(this.#columns.value);
    this.dispatchEvent(new CustomEvent("values-commit", { detail: { column, value }, bubbles: true, composed: true, cancelable: true }));
  }
}

export function defineAnnotationValueActions() {
  if (!customElements.get("clinker-annotation-value-actions")) customElements.define("clinker-annotation-value-actions", AnnotationValueActions);
}
