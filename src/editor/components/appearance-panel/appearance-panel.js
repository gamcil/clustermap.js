import { createTemplate, colourHex } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";
import { controlStyles } from "../../shared/controlStyles.js";
import { defineSearchField } from "../search-field/search-field.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./appearance-panel.html", import.meta.url)),
  textAsset(new URL("./appearance-panel.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AppearancePanel extends HTMLElementBase {
  #config;
  #hasTree = false;
  #filter = "";
  #expanded = new Set();
  #sections;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controlStyles + css;
    root.append(style, template(this.ownerDocument));
    this.#sections = [...root.querySelectorAll("fieldset")].map((box) => ({ box, details: box.querySelector("details"),
      fields: [...box.querySelectorAll("[data-config]")].map((control) => ({ control, row: control.closest("label"), advanced: Boolean(control.closest("details")),
        search: `${box.querySelector("legend").textContent} ${control.getAttribute("aria-label")} ${control.dataset.config}`.toLowerCase() })) }));
    const search = root.querySelector("clinker-search-field");
    search.addEventListener("input", () => { this.#filter = search.value.trim().toLowerCase(); this.#sync(); });
    root.addEventListener("click", (event) => {
      const details = event.target.closest("summary")?.parentElement;
      if (!details || event.defaultPrevented || this.#filter) return;
      const key = details.dataset.appearanceSection;
      if (details.open) this.#expanded.delete(key); else this.#expanded.add(key);
    });
    root.addEventListener("change", (event) => {
      const input = event.target;
      if (!input.matches("[data-config]")) return;
      if (!input.reportValidity()) return;
      const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
      if (!this.dispatchEvent(new CustomEvent("config-change", { detail: { path: input.dataset.config, value }, bubbles: true, composed: true, cancelable: true }))) this.#syncField(input, true);
    });
  }

  set state({ config, hasTree = false }) { this.#config = config; this.#hasTree = hasTree; this.#sync(); }

  #syncField(control, force = false) {
    const path = control.dataset.config, value = path.split(".").reduce((current, key) => current?.[key], this.#config);
    if (control.type === "checkbox") control.checked = Boolean(value);
    else if (force || control !== this.shadowRoot.activeElement) control.value = control.type === "color" ? colourHex(value) : value ?? "";
    const bound = path === "colourBar.domain.min" ? "min" : path === "colourBar.domain.max" ? "max" : null;
    control.disabled = Boolean(bound && this.#config?.colourBar?.domain?.[`${bound}Mode`] === "data");
  }

  #sync() {
    let visible = 0;
    for (const { box, details, fields } of this.#sections) {
      for (const { control, row, search } of fields) {
        this.#syncField(control); row.hidden = Boolean(this.#filter && !search.includes(this.#filter));
      }
      box.hidden = fields.every(({ row }) => row.hidden);
      if (!box.hidden) visible++;
      if (details) {
        details.hidden = !fields.some(({ advanced, row }) => advanced && !row.hidden);
        details.open = Boolean(this.#filter) || this.#expanded.has(details.dataset.appearanceSection);
      }
    }
    const empty = this.shadowRoot.querySelector(".empty");
    empty.hidden = visible > 0; empty.textContent = `No appearance settings match “${this.#filter}”.`;
    this.shadowRoot.querySelector("slot").hidden = !this.#hasTree || Boolean(this.#filter && !/tree|clade|colour|color|annotation|branch|cut|palette/.test(this.#filter));
  }
}

export function defineAppearancePanel() {
  defineSearchField();
  if (!customElements.get("clinker-appearance-panel")) customElements.define("clinker-appearance-panel", AppearancePanel);
}
