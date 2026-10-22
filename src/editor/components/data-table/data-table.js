import { createTemplate, mountComponent } from "../../../ui/controls.mjs";
import { createVirtualRows } from "../../../ui/virtualRows.mjs";
import { textAsset } from "../../shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./data-table.html", import.meta.url)),
  textAsset(new URL("./data-table.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class DataTable extends HTMLElementBase {
  #viewport;
  #renderer = null;
  #rows = [];
  #view = null;
  #header = null;
  #columnsKey;

  constructor() {
    super();
    const root = mountComponent(this, template, css);
    this.#viewport = root.querySelector("div");
    this.addEventListener("mousedown", (event) => {
      if (event.button === 0 && event.shiftKey && event.target.closest(".cm-data-row") &&
          !event.target.closest('input:not([type="checkbox"]), textarea, select, [contenteditable], clinker-editable-field')) event.preventDefault();
    });
  }

  connectedCallback() { this.#mount(); }
  disconnectedCallback() { this.#dispose(); }

  // Row adapters provide their container, key and create/update/dispose callbacks.
  set renderer(value) {
    if (value === this.#renderer) return;
    this.#dispose(); this.#renderer = value; this.#rows = []; this.#syncEmpty(); this.#mount();
  }
  set rows(value) { this.#rows = value; this.#syncEmpty(); this.#view?.setRows(value); }
  set header({ columns, sort }) {
    const node = this.querySelector('[slot="header"]');
    if (!node) return;
    const key = JSON.stringify(columns);
    if (this.#header !== node || this.#columnsKey !== key) {
      this.#header = node; this.#columnsKey = key;
      node.replaceChildren(...columns.map(({ label, sort }, index) => {
        const template = this.shadowRoot.getElementById(sort ? "sort" : "heading");
        const cell = this.ownerDocument.importNode(template.content, true).firstElementChild;
        if (sort) { cell.dataset.sort = sort; cell.querySelector("[data-label]").textContent = label; cell.title = `Sort by ${label}`; }
        else cell.textContent = label;
        cell.classList.toggle("cm-data-cell--select", index === 0); return cell;
      }));
    }
    for (const button of node.querySelectorAll("[data-sort]")) {
      const label = button.querySelector("[data-label]").textContent, active = sort?.key === button.dataset.sort;
      button.setAttribute("aria-label", `Sort by ${label}, ${active && sort.direction < 0 ? "descending" : "ascending"}`);
      button.lastElementChild.textContent = active ? sort.direction < 0 ? "↓" : "↑" : "↕";
    }
  }
  get scrollTop() { return this.#viewport.scrollTop; }
  set scrollTop(value) { this.#viewport.scrollTop = value; }
  get scrollHeight() { return this.#viewport.scrollHeight; }
  scrollTo(...args) { this.#viewport.scrollTo(...args); }

  #mount() {
    if (!this.isConnected || !this.#renderer || this.#view) return;
    this.#view = createVirtualRows({ ...this.#renderer, viewport: this.#viewport });
    this.#view.setRows(this.#rows);
  }
  #dispose() { this.#view?.destroy(); this.#view = null; }
  #syncEmpty() { this.shadowRoot.querySelector("[part=empty]").hidden = !this.#renderer || this.#rows.length > 0; }
}

export function defineDataTable() {
  if (!customElements.get("clinker-data-table")) customElements.define("clinker-data-table", DataTable);
}
