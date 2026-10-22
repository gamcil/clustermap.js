import { csvFormatRows } from "d3-dsv";
import { createTemplate, mountComponent } from "../../../ui/controls.mjs";
import { textAsset } from "../../shared/textAsset.js";
import { controlStyles } from "../../shared/controls.mjs";

const [markup, css] = await Promise.all([
  textAsset(new URL("./annotation-data-form.html", import.meta.url)),
  textAsset(new URL("./annotation-data-form.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AnnotationDataForm extends HTMLElementBase {
  static observedAttributes = ["mode"];
  #form;
  #clusters = [];

  constructor() {
    super();
    const root = mountComponent(this, template, controlStyles + css);
    this.#form = root.querySelector("form");
    this.#field("type").onchange = () => { this.#sync(); this.#example(); };
    this.#form.onsubmit = (event) => { event.preventDefault(); this.error = ""; this.#emit("data-submit", this.value); };
    root.querySelector("[data-cancel]").onclick = () => this.#emit("data-cancel");
    this.#sync();
  }

  set clusters(value) { this.#clusters = value; this.#example(); }
  get value() { return Object.fromEntries(["type", "title", "scale", "data"].map((name) => [name, this.#field(name).value])); }
  set value(value) { for (const [name, text] of Object.entries(value)) this.#field(name).value = text; this.#sync(); }
  set error(message) {
    const error = this.shadowRoot.querySelector("[data-error]"); error.textContent = message; error.hidden = !message;
  }
  focus(options) { this.#field(this.getAttribute("mode") === "replace" ? "data" : "type").focus(options); }
  attributeChangedCallback() { this.#sync(); }

  #field(name) { return this.#form.elements.namedItem(name); }
  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
  #sync() {
    const root = this.shadowRoot, replace = this.getAttribute("mode") === "replace", type = this.#field("type").value;
    root.querySelector("[data-create]").hidden = replace;
    root.querySelector("[data-scale]").hidden = type === "groups";
    this.#field("scale").disabled = type === "bar";
    if (type === "bar") this.#field("scale").value = "continuous";
    root.querySelector("[data-help]").textContent = type === "groups"
      ? "Define groups as JSON. Each needs a uid, a label, and either clusterIds or a tree nodeUid. Colours are optional."
      : "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
    this.#field("data").rows = replace ? 5 : 8;
    this.#field("data").setAttribute("aria-label", replace ? "Replacement annotation data (CSV, TSV or JSON)" : "Data");
    root.querySelector('[type="submit"]').textContent = replace ? "Replace data" : "Add panel";
    root.querySelector("[data-cancel]").hidden = !replace;
  }
  #example() {
    if (this.getAttribute("mode") === "replace") return;
    this.#field("data").value = this.#field("type").value === "groups"
      ? JSON.stringify({ groups: [{ uid: "group-1", label: "Example group", clusterIds: this.#clusters.slice(0, 2).map(({ uid }) => uid) }] }, null, 2)
      : csvFormatRows([["cluster", "Value"], ...this.#clusters.map(({ uid }) => [uid, ""])]);
  }
}

export function defineAnnotationDataForm() {
  if (!customElements.get("clinker-annotation-data-form")) customElements.define("clinker-annotation-data-form", AnnotationDataForm);
}
