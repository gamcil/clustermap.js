import { DATA_EDITOR_CSS } from "../../shared/styles.mjs";
import { RowSelection } from "../../../rowSelection.mjs";
import { createTemplate, mountComponent } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";
import { defineEditableField } from "../editable-field/editable-field.js";
import { defineSelectionBar } from "../selection-bar/selection-bar.js";
import { defineActionMenu } from "../action-menu/action-menu.js";
import { defineDataTable } from "../data-table/data-table.js";
import { defineAnnotationValueActions } from "../annotation-value-actions/annotation-value-actions.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./annotation-table.html", import.meta.url)),
  textAsset(new URL("./annotation-table.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AnnotationTable extends HTMLElementBase {
  #viewport;
  #panel;
  #domain = null;
  #filtered = [];
  #filter = "";
  #schema;
  #table;
  #selection = new RowSelection();
  #rowIds = new WeakMap();
  #selectionBar;
  #batch;

  constructor() {
    super();
    const root = mountComponent(this, template, DATA_EDITOR_CSS + css);
    this.#viewport = root.querySelector("clinker-data-table");
    this.#selectionBar = root.querySelector("clinker-selection-bar");
    this.#selectionBar.addEventListener("clear-selection", () => this.clearSelection());
    this.#selectionBar.addEventListener("select-all", (event) => { this.#selection.setMany(event.detail.ids); this.#syncSelection(); });
    this.#batch = root.querySelector("clinker-annotation-value-actions");
    this.#batch.addEventListener("values-commit", (event) => {
      event.stopPropagation();
      const { column, value } = event.detail;
      if (!this.#setValues(this.#selection, column, value)) event.preventDefault();
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && this.#selection.size) {
        event.preventDefault(); event.stopPropagation(); this.clearSelection();
      }
    });
  }

  set state({ panel, clusters, domain = null, filter = "" }) {
    const changed = this.#panel?.uid !== panel.uid, filtered = this.#filter !== filter;
    if (changed) this.#selection.clear();
    this.#panel = panel; this.#domain = domain; this.#filter = filter;
    this.#selection.prune(new Set(clusters.map(({ uid }) => uid)));
    const scroll = changed || filtered ? 0 : this.#viewport.scrollTop;
    const schema = JSON.stringify([panel.uid, panel.type, panel.columns, domain]);
    if (this.#schema !== schema) { this.#schema = schema; this.#build(); }
    const needle = filter.trim().toLowerCase();
    this.#filtered = clusters.filter(({ uid, name }) => `${name} ${uid}`.toLowerCase().includes(needle));
    this.#viewport.rows = this.#filtered;
    this.#viewport.scrollTop = scroll;
  }

  clearSelection() { this.#selection.clear(); this.#syncSelection(); }
  cancelEdit() { for (const field of this.shadowRoot.querySelectorAll("clinker-editable-field")) field.cancelEdit(); }
  disconnectedCallback() { this.cancelEdit(); }

  #element(name) { return this.ownerDocument.importNode(this.shadowRoot.getElementById(name).content, true).firstElementChild; }
  #emit(type, detail) {
    const accepted = this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true }));
    if (accepted) for (const menu of this.shadowRoot.querySelectorAll("clinker-action-menu")) menu.open = false;
    return accepted;
  }
  #columns(columns, values) { return this.#emit("columns-change", { columns, ...(values ? { values } : {}) }); }
  #setValues(ids, column, value) {
    const values = {};
    for (const uid of ids) {
      const row = this.#panel.values[uid] || this.#panel.columns.map(() => null);
      values[uid] = row.map((current, index) => column === "all" || column === index ? value : current);
    }
    return this.#emit("rows-change", { values });
  }

  #syncSelection() {
    this.#selectionBar.state = { selection: this.#selection, ids: this.#filtered.map(({ uid }) => uid), summary: `${this.#filtered.length.toLocaleString()} visible clusters`, noun: "cluster" };
    if (!this.#table) return;
    const all = this.#table.querySelector("thead input"), selected = this.#filtered.filter(({ uid }) => this.#selection.has(uid)).length;
    all.checked = this.#filtered.length > 0 && selected === this.#filtered.length; all.indeterminate = selected > 0 && !all.checked;
    for (const row of this.#table.querySelectorAll("tbody .cm-data-row")) {
      const checked = this.#selection.has(this.#rowIds.get(row));
      row.classList.toggle("is-selected", checked); row.setAttribute("aria-selected", String(checked)); row.querySelector("input").checked = checked;
    }
  }

  #build() {
    const viewport = this.#viewport, panel = this.#panel, extra = panel.type === "heatmap";
    this.cancelEdit(); viewport.renderer = null;
    this.#table = this.#element("table"); viewport.replaceChildren(this.#table);
    const head = this.#table.querySelector("tr");
    head.querySelector("input").onchange = (event) => { this.#selection.setMany(this.#filtered.map(({ uid }) => uid), event.target.checked); this.#syncSelection(); };
    this.#batch.state = { uid: panel.uid, columns: panel.columns, domain: this.#domain };
    panel.columns.forEach((column, index) => {
      const heading = this.#element("column"), field = heading.querySelector("clinker-editable-field"), remove = heading.querySelector("button");
      field.value = column; field.setAttribute("label", `Column ${index + 1} name`);
      field.addEventListener("value-commit", (event) => {
        event.stopPropagation(); const columns = [...this.#panel.columns]; columns[index] = event.detail.value.trim();
        if (!this.#columns(columns)) event.preventDefault();
      });
      if (extra) {
        remove.setAttribute("aria-label", `Remove column ${column}`); remove.disabled = panel.columns.length === 1;
        remove.onclick = () => this.#columns(this.#panel.columns.filter((_, i) => i !== index),
          Object.fromEntries(Object.entries(this.#panel.values).map(([uid, values]) => [uid, values.filter((_, i) => i !== index)])));
      } else remove.remove();
      head.append(heading);
    });
    if (extra) {
      const heading = this.#element("add-column"), form = heading.querySelector("form"), [add, save] = form.querySelectorAll("button"), name = form.querySelector("input");
      add.onclick = () => { add.hidden = true; name.hidden = save.hidden = false; name.focus(); };
      form.onsubmit = (event) => {
        event.preventDefault(); if (!name.value.trim()) return;
        this.#columns([...this.#panel.columns, name.value.trim()], Object.fromEntries(Object.entries(this.#panel.values).map(([uid, values]) => [uid, [...values, null]])));
      };
      name.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); name.hidden = save.hidden = true; add.hidden = false; add.focus(); } };
      head.append(heading);
    }
    viewport.renderer = { container: this.#table.querySelector("tbody"), key: ({ uid }) => uid,
      createRow: (cluster) => this.#createRow(cluster, extra), updateRow: (row, cluster) => this.#updateRow(row, cluster),
      disposeRow: (row) => { for (const field of row.querySelectorAll("clinker-editable-field")) field.cancelEdit(); },
      createSpacer: () => { const row = this.#element("spacer"); row.firstElementChild.colSpan = panel.columns.length + 2 + Number(extra); return row; },
      headerHeight: () => head.offsetHeight, onRender: () => { this.#table.setAttribute("aria-rowcount", this.#filtered.length + 1); this.#syncSelection(); } };
  }

  #createRow(cluster, extra) {
    const row = this.#element("row"), check = row.querySelector("input"), name = row.querySelector("th"); this.#rowIds.set(row, cluster.uid);
    const select = (checked, range) => { this.#selection.select(cluster.uid, checked, { range, orderedIds: this.#filtered.map(({ uid }) => uid) }); this.#syncSelection(); };
    check.onclick = (event) => select(check.checked, event.shiftKey);
    name.onclick = (event) => select(!this.#selection.has(cluster.uid), event.shiftKey);
    this.#panel.columns.forEach((_, index) => {
      const cell = this.#element("cell"), field = cell.firstElementChild;
      if (this.#domain === null) field.setAttribute("type", "number");
      else field.options = [["", "Missing"], ...this.#domain.map((name, i) => [String(i), name])];
      field.addEventListener("value-commit", (event) => {
        event.stopPropagation(); const value = event.detail.value;
        if (!this.#setValues([cluster.uid], index, value === "" ? null : this.#domain === null ? Number(value) : this.#domain[Number(value)])) event.preventDefault();
      });
      row.append(cell);
    });
    if (extra) row.append(this.#element("empty-cell"));
    return this.#updateRow(row, cluster);
  }

  #updateRow(row, cluster) {
    const label = cluster.name || cluster.uid, name = row.querySelector("th"); name.textContent = label; name.title = cluster.uid;
    row.querySelector("input").setAttribute("aria-label", `Select ${label}`);
    [...row.querySelectorAll("clinker-editable-field")].forEach((field, index) => {
      const value = this.#panel.values[cluster.uid]?.[index] ?? null;
      field.setAttribute("label", `${label}: ${this.#panel.columns[index]}`);
      field.value = this.#domain === null ? value : value === null ? "" : String(this.#domain.indexOf(value));
    });
    return row;
  }
}

export function defineAnnotationTable() {
  defineEditableField(); defineSelectionBar(); defineActionMenu(); defineDataTable(); defineAnnotationValueActions();
  if (!customElements.get("clinker-annotation-table")) customElements.define("clinker-annotation-table", AnnotationTable);
}
