import { createTemplate } from "../../../uiControls.mjs";
import { installDataEditorStyle, installStyle } from "../../shared/styles.mjs";
import { textAsset } from "../../shared/textAsset.js";
import { defineDataTable } from "../data-table/data-table.js";
import { defineEditableField } from "../editable-field/editable-field.js";
import { createEditorRow } from "./rows.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./record-table.html", import.meta.url)),
  textAsset(new URL("./record-table.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class RecordTable extends HTMLElementBase {
  #table;
  #head;
  #list;
  #state;
  #kind = null;
  #records = new WeakMap();
  #dragged = null;
  #hoverRow = null;
  #hoveredRow = null;
  #hoverTimer = null;
  #hoverFrame = null;
  error = "";

  constructor() {
    super();
    this.addEventListener("click", (event) => this.#click(event));
    this.addEventListener("change", (event) => {
      const input = event.target, node = input.closest(".cm-data-row"), row = this.#records.get(node)?.data;
      if (!row) return;
      if (input.matches('[type="checkbox"]')) {
        const checked = row.selectIds ? row.selectIds.every((id) => this.#state.selection.has(id)) : this.#state.selection.has(row.id);
        if (checked !== input.checked) this.#select(row, input.checked, false);
      } else if (input.matches("[data-colour]")) this.#emit({ action: "update", type: this.#kind, id: row.id, changes: { colour: input.value } });
    });
    this.addEventListener("value-commit", (event) => {
      if (event.defaultPrevented) return;
      const { type, field } = event.target.dataset, row = this.#records.get(event.target.closest(".cm-data-row"))?.data;
      if (!row || !type || !field) return;
      const id = type === "clusters" ? row.cluster.uid : type === "loci" ? row.locus.uid : row.id;
      event.stopPropagation();
      const value = field === "identity" ? Number(event.detail.value) / 100 : event.detail.value.trim();
      if (!this.#emit({ action: "update", type, id, changes: { [field]: value } }, event.target)) event.preventDefault();
    });
    this.addEventListener("keydown", (event) => {
      const grip = event.target.closest("[data-reorder]");
      if (!grip || event.defaultPrevented || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      this.#emit({ action: "reorder", id: this.#records.get(grip.closest(".cm-data-row")).data.id, direction: event.key === "ArrowUp" ? -1 : 1 });
    });
    this.addEventListener("dragstart", (event) => {
      const grip = event.target.closest("[data-reorder]");
      if (!grip) return;
      this.#dragged = this.#records.get(grip.closest(".cm-data-row")).data.id;
      event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(this.#dragged));
    });
    this.addEventListener("dragover", (event) => {
      const target = event.target.closest(".cm-editor__row--groups");
      if (this.#dragged === null || !target || this.#records.get(target).data.id === this.#dragged) return;
      event.preventDefault(); this.#clearDropTarget(); target.classList.add("cm-editor__drop-target");
    });
    this.addEventListener("drop", (event) => {
      const target = event.target.closest(".cm-editor__row--groups");
      if (this.#dragged !== null && target) {
        event.preventDefault(); const bounds = target.getBoundingClientRect();
        this.#emit({ action: "place", id: this.#dragged, targetId: this.#records.get(target).data.id, after: event.clientY > bounds.top + bounds.height / 2 });
      }
      this.#dragged = null; this.#clearDropTarget();
    });
    this.addEventListener("dragend", () => { this.#dragged = null; this.#clearDropTarget(); });
    for (const type of ["pointerover", "pointerout"]) this.addEventListener(type, (event) => {
      const row = event.target.closest(".cm-data-row");
      if (row && !row.contains(event.relatedTarget)) this.#queueHover(type === "pointerover" ? row : null);
    });
  }

  connectedCallback() {
    const root = this.getRootNode();
    installDataEditorStyle(root);
    this.classList.add("cm-data-ui");
    installStyle(root, "clinker-record-table-style", css);
    if (!this.#table) {
      this.append(template(this.ownerDocument));
      this.#table = this.querySelector("clinker-data-table"); this.#head = this.querySelector("[data-head]"); this.#list = this.querySelector("[data-rows]");
    }
    this.#render();
  }
  disconnectedCallback() { this.cancelHover(); this.#dragged = null; this.#clearDropTarget(); }
  set state(value) { this.#state = value; this.#render(); }
  reset() { this.cancelHover(); if (this.#table) this.#table.renderer = null; this.#kind = null; this.#dragged = null; this.#clearDropTarget(); }
  get scrollTop() { return this.#table?.scrollTop || 0; }
  set scrollTop(value) { if (this.#table) this.#table.scrollTop = value; }
  get scrollHeight() { return this.#table?.scrollHeight || 0; }
  scrollTo(...args) { this.#table?.scrollTo(...args); }

  #emit(detail, control) {
    this.error = "";
    const accepted = this.dispatchEvent(new CustomEvent("record-action", { detail, bubbles: true, composed: true, cancelable: true }));
    if (!accepted && control) control.setCustomValidity(this.error);
    return accepted;
  }
  #select(row, checked, range) { this.#emit({ action: "select", id: row.key ?? row.id, checked, range }); }
  #click(event) {
    if (event.target.closest("clinker-editable-field")) return;
    const node = event.target.closest(".cm-data-row"), row = this.#records.get(node)?.data;
    if (row && event.target.matches('[type="checkbox"]')) { this.#select(row, event.target.checked, event.shiftKey); return; }
    const sort = event.target.closest("[data-sort]");
    if (sort) { this.#emit({ action: "sort", key: sort.dataset.sort }); return; }
    if (!row) return;
    if (event.target.closest("[data-tree-toggle]")) this.#emit({ action: "toggle", key: row.key });
    else if (event.target.closest("[data-visible]")) this.#emit({ action: "update", type: this.#kind, id: row.id, changes: { hidden: !row.hidden } });
    else if (event.target.closest("[data-remove-record]")) {
      const cluster = row.type === "cluster" || row.type === "cluster-locus";
      this.#emit({ action: "remove", type: cluster ? "clusters" : "loci", id: row[cluster ? "cluster" : "locus"].uid });
    } else if (!event.target.closest("input, select, button")) this.#select(row, !node.querySelector('[type="checkbox"]').checked, event.shiftKey);
  }
  #render() {
    if (!this.#table || !this.#state) return;
    const { kind, geneView, rows, sort, attached = true } = this.#state;
    if (!attached) {
      this.reset(); this.#table.header = { columns: [], sort: null };
      this.#list.textContent = "Set the chart property to edit a ClusterMap chart."; return;
    }
    const tree = kind === "genes" && geneView !== "list", layout = tree ? "tree" : kind;
    const columns = tree ? [{ label: "" }, { label: "" }, { label: geneView === "groups" ? "Group / gene" : "Cluster / locus / gene" }, { label: "Group" }, { label: "Colour" }]
      : kind === "groups" ? [{ label: "" }, { label: "↕" }, { label: "Group" }, { label: "Legend label" }, { label: "Genes" }, { label: "" }, { label: "Colour" }]
      : kind === "links" ? [{ label: "" }, { label: "Source", sort: "source" }, { label: "Target", sort: "target" }, { label: "Identity", sort: "identity" }, { label: "Endpoint groups", sort: "groups" }, { label: "Link label", sort: "label" }, { label: "" }, { label: "Colour" }]
        : [{ label: "" }, { label: "Gene", sort: "label" }, { label: "Locus", sort: "locus" }, { label: "Cluster", sort: "cluster" }, { label: "Group", sort: "group" }, { label: "Colour" }];
    this.#head.className = `cm-data-head cm-editor__head cm-editor__head--${layout}`;
    this.#table.header = { columns, sort }; this.#list.className = `cm-editor__rows cm-editor__rows--${layout}`;
    if (this.#kind !== kind) {
      this.reset(); this.#kind = kind; this.#list.replaceChildren();
      const updateRow = (node, data) => { const row = this.#records.get(node); row.data = data; return row.view.update(data, this.#state.selection); };
      this.#table.renderer = { container: this.#list, key: (row) => `${kind}:${row.type || "row"}:${row.key ?? row.id}`,
        headerHeight: () => this.#head.offsetHeight,
        createRow: (data) => { const view = createEditorRow(this.ownerDocument, kind, data.type); this.#records.set(view.node, { view, data }); return updateRow(view.node, data); },
        updateRow, disposeRow: (node) => this.#records.get(node).view.destroy() };
    }
    this.#table.rows = rows;
  }

  #clearDropTarget() { for (const node of this.querySelectorAll(".cm-editor__drop-target")) node.classList.remove("cm-editor__drop-target"); }
  #queueHover(row) {
    this.#hoverRow = row;
    if (this.#hoverTimer !== null) globalThis.clearTimeout(this.#hoverTimer);
    this.#hoverTimer = globalThis.setTimeout(() => {
      this.#hoverTimer = null;
      if (this.#hoverFrame !== null) return;
      const frame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
      this.#hoverFrame = frame(() => {
        this.#hoverFrame = null;
        const hovered = this.#hoverRow;
        if (hovered === this.#hoveredRow) return;
        this.#hoveredRow = hovered;
        this.#emit({ action: "hover", row: hovered?.isConnected ? this.#records.get(hovered).data : null });
      });
    }, 36);
  }
  cancelHover() {
    if (this.#hoverTimer !== null) globalThis.clearTimeout(this.#hoverTimer);
    if (this.#hoverFrame !== null) (globalThis.cancelAnimationFrame || globalThis.clearTimeout)(this.#hoverFrame);
    this.#hoverTimer = this.#hoverFrame = this.#hoverRow = this.#hoveredRow = null;
  }
}

export function defineRecordTable() {
  defineDataTable(); defineEditableField();
  if (!customElements.get("clinker-record-table")) customElements.define("clinker-record-table", RecordTable);
}
