import { color } from "d3";

const tagName = "clinker-editor";
const HTMLElementBase = globalThis.HTMLElement || class {};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;
// Chart palettes are stored as CSS colours (often rgb(...)); colour inputs only
// accept hexadecimal values.  D3's parser is already a peer dependency of the
// chart and keeps editor swatches in sync with the rendered legend.
const colourFor = (value) => color(value || "#888888")?.formatHex() || "#888888";
const groupMap = (data) => new Map((data?.groups || []).flatMap((group) =>
  (group.genes || []).flatMap((id) => [[id, group], [String(id), group]])
));
function editableCell(kind, id, value, placeholder, compact = false, width = null) {
  const length = String(value || placeholder || "").length;
  const fixed = Number.isFinite(width);
  const size = compact && !fixed ? ` size="${Math.max(8, Math.min(30, length + 1))}"` : "";
  const style = Number.isFinite(width) ? ` style="width:${Math.ceil(width)}px;min-width:${Math.ceil(width)}px"` : "";
  return `<input class="cm-editor-inline-input${fixed ? " cm-editor-inline-input--fixed" : ""}" data-edit="${kind}" data-id="${escapeHtml(id)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${size}${style}>`;
}

function editableField(kind, id, value, placeholder, label, editing, compact = false, width = null) {
  if (editing) {
    const fixed = Number.isFinite(width) ? ` style="width:${Math.ceil(width)}px;flex:0 0 ${Math.ceil(width)}px"` : "";
    return `<span class="cm-editor__editable-field is-editing"${fixed}>${editableCell(kind, id, value, placeholder, compact, width)}</span>`;
  }
  const text = value ? escapeHtml(value) : `<span class="cm-editor__editable-placeholder">${escapeHtml(placeholder)}</span>`;
  return `<span class="cm-editor__editable-field"><span class="cm-editor__editable-label" title="${escapeHtml(value || placeholder)}">${text}</span><button type="button" class="cm-editor__edit-icon" data-focus-edit="${kind}" data-id="${escapeHtml(id)}" aria-label="Edit ${escapeHtml(label)}" title="Edit ${escapeHtml(label)}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.1-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"></path><path d="m13.8 7.2 3 3"></path></svg></button></span>`;
}

/**
 * An optional, light-DOM editor for a ClusterMap chart.
 *
 * The component deliberately does not import a stylesheet or own a copy of the
 * chart data.  Set .chart to an already rendered chart, then optionally load
 * `clinker/editor.css` for the package's default presentation.
 */
export class ClinkerEditorElement extends HTMLElementBase {
  #chart = null;
  #unsubscribe = null;
  #kind = "groups";
  #geneView = "tree";
  #selected = new Set();
  #selectionAnchor = null;
  #filter = "";
  #appearanceFilter = "";
  #appearanceAdvanced = new Set();
  #memberGroupId = null;
  #expanded = new Set();
  #draggedGroupId = null;
  #scrollTop = 0;
  #resizeStart = null;
  #editingKey = null;
  #editWidths = new Map();
  #sort = {
    genes: { key: "label", direction: 1 },
    links: { key: "source", direction: 1 },
  };
  #hoverRow = null;
  #hoveredRow = null;
  #hoverTimer = null;
  #hoverFrame = null;
  #dataCache = null;

  constructor() { super(); }

  connectedCallback() {
    this.classList.add("cm-editor");
    if (!this.hasChildNodes()) this.#renderShell();
    this.#bind();
    this.#subscribe();
    this.#render();
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#cancelHover();
  }

  get chart() { return this.#chart; }

  set chart(value) {
    if (value === this.#chart) return;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#chart = value || null;
    this.#dataCache = null;
    this.#subscribe();
    this.#initializeExpanded();
    this.#render();
  }

  get value() { return this.#chart?.data?.(); }

  /** Replace any declarative fallback content with the packaged editor UI. */
  reset() {
    this.replaceChildren();
    this.#renderShell();
    this.#render();
    return this;
  }

  #renderShell() {
    this.innerHTML = `
      <div class="cm-editor__resize-handle" data-resize role="separator" aria-label="Resize plot editor" aria-orientation="horizontal"></div>
      <header class="cm-editor__header">
        <h2 class="cm-editor__title">Plot editor</h2>
        <div class="cm-editor__history">
          <button type="button" data-command="undo" disabled>Undo</button>
          <button type="button" data-command="redo" disabled>Redo</button>
        </div>
      </header>
      <div class="cm-editor__tabs" role="tablist" aria-label="Plot editor sections">
        <button type="button" data-tab="data" role="tab" aria-selected="true">Data</button>
        <button type="button" data-tab="appearance" role="tab" aria-selected="false">Appearance</button>
      </div>
      <section data-panel="data" class="cm-editor__panel">
        <div class="cm-editor__toolbar">
          <div class="cm-editor__segmented" aria-label="Data type">
            <button type="button" data-kind="groups" aria-pressed="true">Groups</button>
            <button type="button" data-kind="genes" aria-pressed="false">Genes</button>
            <button type="button" data-kind="links" aria-pressed="false">Links</button>
          </div>
          <div class="cm-editor__segmented" data-gene-view aria-label="Gene view" hidden>
            <button type="button" data-gene-view-kind="tree" aria-pressed="true">By locus</button>
            <button type="button" data-gene-view-kind="groups" aria-pressed="false">By group</button>
            <button type="button" data-gene-view-kind="list" aria-pressed="false">List</button>
          </div>
          <button type="button" data-command="toggle-tree" hidden>Expand visible</button>
          <button type="button" data-command="new-group">Create group…</button>
          <label class="cm-editor__search"><span class="cm-editor__sr-only">Filter records</span><input type="search" data-filter placeholder="Search names, labels, loci, or clusters"></label>
          <button type="button" data-command="clear-filter" aria-label="Clear filter" title="Clear filter" hidden>×</button>
        </div>
        <div class="cm-editor__member-filter" data-member-filter hidden><span>Group: <strong data-member-label></strong></span><button type="button" data-command="clear-member-filter" aria-label="Clear group member filter" title="Clear group member filter">×</button></div>
        <div class="cm-editor__actions" data-actions hidden></div>
        <div class="cm-editor__meta"><span data-summary></span><button type="button" data-command="select-visible">Select all visible</button></div>
        <div class="cm-editor__table" role="region" aria-label="Editable chart data">
          <div data-head class="cm-editor__head"></div>
          <div data-rows></div>
        </div>
      </section>
      <section data-panel="appearance" class="cm-editor__panel" hidden>
        <div class="cm-editor__appearance-toolbar"><label class="cm-editor__search"><span class="cm-editor__sr-only">Find an appearance setting</span><input type="search" data-appearance-filter placeholder="Find a setting"></label><button type="button" data-command="clear-appearance-filter" aria-label="Clear appearance filter" title="Clear appearance filter" hidden>×</button></div>
        <div class="cm-editor__appearance" data-appearance></div>
      </section>`;
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (change.type === "data.apply" || change.type === "data.replace") this.#dataCache = null;
      if (change.type === "data.replace") {
        this.#selected.clear();
        this.#selectionAnchor = null;
        this.#expanded.clear();
        this.#initializeExpanded();
      }
      if (change.type === "data.apply" || change.type === "data.replace") this.#renderData();
      else if (change.type === "config.change") this.#renderAppearance();
      if (change.type === "history.change") this.#renderHistory();
    });
  }

  #bind() {
    if (this.dataset.bound) return;
    this.dataset.bound = "true";
    this.addEventListener("click", (event) => this.#click(event));
    this.addEventListener("change", (event) => this.#change(event));
    this.addEventListener("toggle", (event) => {
      const details = event.target.closest("details[data-appearance-section]");
      if (!details) return;
      if (details.open) this.#appearanceAdvanced.add(details.dataset.appearanceSection);
      else this.#appearanceAdvanced.delete(details.dataset.appearanceSection);
    }, true);
    this.addEventListener("pointerdown", (event) => {
      if (event.target.closest("[data-focus-edit]")) event.preventDefault();
      if (!event.target.closest("[data-resize]") || !this.hasAttribute("resizable")) return;
      event.preventDefault();
      this.#resizeStart = { pointerY: event.clientY, height: this.getBoundingClientRect().height };
      event.target.setPointerCapture?.(event.pointerId);
    });
    this.addEventListener("pointermove", (event) => {
      if (!this.#resizeStart) return;
      const parentHeight = this.parentElement?.getBoundingClientRect().height || innerHeight;
      const height = Math.max(180, Math.min(parentHeight - 48, this.#resizeStart.height - (event.clientY - this.#resizeStart.pointerY)));
      this.style.height = `${height}px`;
    });
    this.addEventListener("pointerup", () => { this.#resizeStart = null; });
    this.addEventListener("pointercancel", () => { this.#resizeStart = null; });
    this.addEventListener("input", (event) => {
      if (event.target.matches("[data-filter]")) {
        this.#filter = event.target.value.trim().toLowerCase();
        this.#scrollTop = 0;
        this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
        this.#renderData();
      }
      if (event.target.matches("[data-appearance-filter]")) {
        this.#appearanceFilter = event.target.value.trim().toLowerCase();
        this.#renderAppearance();
      }
    });
    this.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && event.target.matches("[data-edit]")) {
        event.preventDefault();
        this.#editWidths.delete(this.#editingKey);
        this.#editingKey = null;
        this.#renderData();
        return;
      }
      if (event.key === "Escape" && this.#selected.size) {
        this.#selected.clear();
        this.#renderData();
      }
      if (event.key === "Enter" && event.target.matches("[data-edit]")) event.target.blur();
      const grip = event.target.closest("[data-reorder]");
      if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        this.#moveGroup(this.#id(grip.dataset.reorder), event.key === "ArrowUp" ? -1 : 1);
      }
    });
    this.addEventListener("focusout", (event) => {
      if (!event.target.matches("[data-edit]")) return;
      const editingKey = this.#editingKey;
      globalThis.setTimeout(() => {
        if (editingKey && this.#editingKey === editingKey && !this.contains(document.activeElement)) {
          this.#editWidths.delete(editingKey);
          this.#editingKey = null;
          this.#renderData();
        }
      }, 0);
    });
    this.addEventListener("dragstart", (event) => {
      const grip = event.target.closest("[data-reorder]");
      if (!grip) return;
      this.#draggedGroupId = this.#id(grip.dataset.reorder);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(this.#draggedGroupId));
    });
    this.addEventListener("dragover", (event) => {
      if (this.#draggedGroupId === null) return;
      const target = event.target.closest(".cm-editor__row--groups");
      if (!target || this.#id(target.dataset.id) === this.#draggedGroupId) return;
      event.preventDefault();
      this.querySelectorAll(".cm-editor__drop-target").forEach((node) => node.classList.remove("cm-editor__drop-target"));
      target.classList.add("cm-editor__drop-target");
    });
    this.addEventListener("drop", (event) => {
      const target = event.target.closest(".cm-editor__row--groups");
      if (this.#draggedGroupId !== null && target) {
        event.preventDefault();
        const targetId = this.#id(target.dataset.id);
        const bounds = target.getBoundingClientRect();
        this.#placeGroup(this.#draggedGroupId, targetId, event.clientY > bounds.top + bounds.height / 2);
      }
      this.#finishGroupDrag();
    });
    this.addEventListener("dragend", () => this.#finishGroupDrag());
    this.addEventListener("pointerover", (event) => {
      const row = event.target.closest(".cm-editor__row, .cm-editor__tree-row");
      if (!row || row.contains(event.relatedTarget) || !this.#chart?.highlight) return;
      this.#queueHover(row);
    });
    this.addEventListener("pointerout", (event) => {
      const row = event.target.closest(".cm-editor__row, .cm-editor__tree-row");
      if (!row || row.contains(event.relatedTarget)) return;
      this.#queueHover(null);
    });
    this.addEventListener("scroll", (event) => {
      const table = event.target.closest(".cm-editor__table");
      if (!table) return;
      this.#scrollTop = table.scrollTop;
      this.#renderData();
    }, true);
  }

  #click(event) {
    const edit = event.target.closest("[data-focus-edit]");
    if (edit) {
      event.preventDefault();
      this.#editingKey = this.#editKey(edit.dataset.focusEdit, edit.dataset.id);
      const label = edit.closest(".cm-editor__editable-field")?.querySelector(".cm-editor__editable-label");
      if (label) this.#editWidths.set(this.#editingKey, label.getBoundingClientRect().width);
      this.#renderData();
      const focusInput = () => {
        const input = [...this.querySelectorAll("[data-edit]")].find((node) => node.dataset.edit === edit.dataset.focusEdit && node.dataset.id === edit.dataset.id);
        if (!input) return null;
        input.focus({ preventScroll: true });
        input.select();
        return input;
      };
      // The pencil has just been replaced synchronously, so focus the new
      // native input directly. WebKit can subsequently apply the old button's
      // default focus at the end of this click, so retry only in that event
      // loop microtask; this is not tied to rendering or animation frames.
      if (focusInput()) {
        (globalThis.queueMicrotask || ((callback) => Promise.resolve().then(callback)))(() => {
          const current = [...this.querySelectorAll("[data-edit]")].find((node) => node.dataset.edit === edit.dataset.focusEdit && node.dataset.id === edit.dataset.id);
          if (current && document.activeElement !== current) focusInput();
        });
      }
      return;
    }
    const sort = event.target.closest("[data-sort]");
    if (sort) {
      const current = this.#sort[this.#kind];
      const key = sort.dataset.sort;
      this.#sort[this.#kind] = { key, direction: current?.key === key ? -current.direction : 1 };
      this.#scrollTop = 0;
      this.#renderData();
      return;
    }
    const treeToggle = event.target.closest("[data-tree-toggle]");
    if (treeToggle) {
      const key = treeToggle.dataset.treeToggle;
      if (this.#expanded.has(key)) this.#expanded.delete(key);
      else this.#expanded.add(key);
      this.#renderData();
      return;
    }
    const row = event.target.closest(".cm-editor__row, .cm-editor__tree-gene");
    if (row && !event.target.closest("input, select, button")) {
      const id = this.#id(row.dataset.id);
      this.#selectRow(id, !this.#selected.has(id), event.shiftKey);
      this.#renderData();
      this.#syncHighlight();
      return;
    }
    const visibility = event.target.closest("[data-visible]");
    if (visibility) {
      const { type, id, hidden } = visibility.dataset;
      this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes: { hidden: hidden !== "true" } });
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    const tab = button.dataset.tab;
    if (tab) {
      this.querySelectorAll("[data-tab]").forEach((node) => node.setAttribute("aria-selected", String(node === button)));
      this.querySelectorAll("[data-panel]").forEach((node) => { node.hidden = node.dataset.panel !== tab; });
      return;
    }
    const kind = button.dataset.kind;
    if (kind) {
      this.#kind = kind;
      if (kind !== "genes") this.#memberGroupId = null;
      this.#selected.clear();
      this.#scrollTop = 0;
      this.querySelectorAll("[data-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      this.#renderData();
      return;
    }
    const geneView = button.dataset.geneViewKind;
    if (geneView) {
      this.#geneView = geneView;
      this.#scrollTop = 0;
      this.querySelectorAll("[data-gene-view-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      this.#renderData();
      return;
    }
    const command = button.dataset.command;
    if (command === "select-visible") {
      this.#selectableIds().forEach((id) => this.#selected.add(id));
      this.#renderData();
    } else if (command === "clear-selection") {
      this.#selected.clear();
      this.#renderData();
    } else if (command === "delete") {
      this.#deleteSelected();
    } else if (command === "new-group") {
      const label = window.prompt("Name for the new homology group");
      if (label?.trim()) this.#apply({ type: "groups.create", group: { uid: this.#nextGroupUid(), label: label.trim() } });
    } else if (command === "assign") {
      const select = this.querySelector("[data-assign-group]");
      if (select?.value) this.#apply({ type: "groups.assignGenes", groupId: this.#groupId(select.value), geneIds: [...this.#selected] });
    } else if (command === "unassign") {
      this.#apply({ type: "groups.unassignGenes", geneIds: [...this.#selected] });
    } else if (command === "new-group-for-selection") {
      const label = window.prompt("Name for the new homology group");
      if (label?.trim()) {
        const geneIds = [...this.#selected];
        this.#selected.clear();
        this.#apply({ type: "groups.create", group: { uid: this.#nextGroupUid(), label: label.trim() }, geneIds });
      }
    } else if (command === "focus") {
      this.#focusSelected();
    } else if (command === "batch-label") {
      const input = this.querySelector("[data-batch-label]");
      if (input?.value.trim()) {
        this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { label: input.value.trim() } });
      }
    } else if (command === "batch-identity") {
      const input = this.querySelector("[data-batch-identity]");
      const identity = Number(input?.value);
      if (Number.isFinite(identity) && identity >= 0 && identity <= 100) {
        this.#apply({ type: "links.update", ids: [...this.#selected], changes: { identity: identity / 100 } });
      }
    } else if (command === "merge") {
      const targetId = this.#groupId(this.querySelector("[data-merge-target]")?.value);
      if (targetId !== undefined) {
        const sourceIds = [...this.#selected];
        this.#selected.clear();
        this.#apply({ type: "groups.merge", targetId, sourceIds });
      }
    } else if (command === "view-members") {
      const groupId = [...this.#selected][0];
      if (groupId !== undefined) this.#viewGroupMembers(groupId);
    } else if (command === "move-first") {
      this.#moveSelectedGroupTo(0);
    } else if (command === "move-last") {
      this.#moveSelectedGroupTo((this.#data()?.groups.length || 1) - 1);
    } else if (command === "move-position") {
      this.#moveSelectedGroupTo(Number(this.querySelector("[data-group-position]")?.value) - 1);
    } else if (command === "undo") {
      this.#undo();
    } else if (command === "redo") {
      this.#redo();
    } else if (command === "toggle-tree") {
      this.#toggleTree();
    } else if (command === "clear-filter") {
      this.#filter = "";
      const input = this.querySelector("[data-filter]");
      if (input) input.value = "";
      this.#scrollTop = 0;
      this.#renderData();
    } else if (command === "clear-member-filter") {
      this.#memberGroupId = null;
      this.#renderData();
    } else if (command === "clear-appearance-filter") {
      this.#appearanceFilter = "";
      const input = this.querySelector("[data-appearance-filter]");
      if (input) input.value = "";
      this.#renderAppearance();
    }
  }

  #change(event) {
    const target = event.target;
    if (target.matches("[data-select-many]")) {
      const ids = JSON.parse(target.dataset.selectMany || "[]").map((id) => this.#id(id));
      ids.forEach((id) => {
        if (target.checked) this.#selected.add(id);
        else this.#selected.delete(id);
      });
      this.#selectionAnchor = null;
      this.#renderData();
      this.#syncHighlight();
      return;
    }
    if (target.matches("[data-select]")) {
      const id = this.#id(target.dataset.select);
      this.#selectRow(id, target.checked, event.shiftKey);
      this.#renderData();
      this.#syncHighlight();
      return;
    }
    if (target.matches("[data-visible]")) {
      const { type, id, hidden } = target.dataset;
      this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes: { hidden: hidden !== "true" } });
      return;
    }
    if (target.matches("[data-colour]")) {
      const { type, id } = target.dataset;
      this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes: { colour: target.value } });
      return;
    }
    if (target.matches("[data-edit]")) {
      this.#edit(target);
      return;
    }
    if (target.matches("[data-batch-colour]")) {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { colour: target.value } });
      return;
    }
    if (target.matches("[data-batch-visibility]") && target.value) {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { hidden: target.value === "hide" } });
      target.value = "";
      return;
    }
    if (target.matches("[data-config]")) this.#setConfig(target);
  }

  #apply(operation) {
    if (!this.#chart?.patch) return;
    this.#chart.patch([operation]);
  }

  #edit(input) {
    const [type, field] = input.dataset.edit.split(":");
    const id = this.#id(input.dataset.id);
    let value = input.value.trim();
    if (field === "identity") {
      value = Number(value) / 100;
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        this.#editingKey = null;
        return this.#renderData();
      }
    }
    const operationType = type === "cluster" ? "clusters.update" : type === "locus" ? "loci.update" : `${type}s.update`;
    const changeField = type === "cluster" || type === "locus" ? "name" : field;
    this.#editWidths.delete(this.#editingKey);
    this.#editingKey = null;
    if (value || field === "subtitle" || field === "label") this.#apply({ type: operationType, ids: [id], changes: { [changeField]: value } });
  }

  #setConfig(input) {
    if (!this.#chart?.config) return;
    const keys = input.dataset.config.split(".");
    const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    let config = value;
    for (const key of keys.slice().reverse()) config = { [key]: config };
    this.#chart.config(config);
  }

  #data() { return this.#chart?.data?.() || null; }

  #cache() {
    const data = this.#data();
    if (!data) return null;
    if (this.#dataCache?.data === data) return this.#dataCache;

    const ids = new Map();
    const remember = (record) => {
      if (record?.uid !== undefined) ids.set(String(record.uid), record.uid);
      return record;
    };
    const groups = groupMap(data);
    const groupById = new Map((data.groups || []).map((group) => [String(group.uid), remember(group)]));
    const genes = [];
    const geneById = new Map();
    const clusterById = new Map();
    const locusById = new Map();
    const linkById = new Map();
    for (const cluster of data.clusters || []) {
      remember(cluster);
      clusterById.set(String(cluster.uid), cluster);
      for (const locus of cluster.loci || []) {
        remember(locus);
        locusById.set(String(locus.uid), locus);
        for (const gene of locus.genes || []) {
          remember(gene);
          geneById.set(String(gene.uid), gene);
          genes.push({ gene, locus, cluster });
        }
      }
    }
    for (const link of data.links || []) {
      remember(link);
      linkById.set(String(link.uid), link);
    }
    this.#dataCache = { data, ids, groups, groupById, genes, geneById, clusterById, locusById, linkById };
    return this.#dataCache;
  }

  #initializeExpanded() {
    const data = this.#data();
    const geneCount = data?.clusters?.flatMap((cluster) => cluster.loci).reduce((count, locus) => count + locus.genes.length, 0) || 0;
    if (!geneCount || geneCount > 500) return;
    data.clusters.forEach((cluster) => {
      if (cluster.loci.length === 1) this.#expanded.add(`cluster-locus:${cluster.uid}:${cluster.loci[0].uid}`);
      else {
        this.#expanded.add(`cluster:${cluster.uid}`);
        cluster.loci.forEach((locus) => this.#expanded.add(`locus:${locus.uid}`));
      }
    });
    (data.groups || []).forEach((group) => this.#expanded.add(`gene-group:${group.uid}`));
    this.#expanded.add("gene-group:ungrouped");
  }
  #id(value) {
    return this.#cache()?.ids.get(String(value)) ?? value;
  }
  #groupId(value) { return this.#cache()?.groupById.get(String(value))?.uid; }

  #nextGroupUid() {
    const used = new Set((this.#data()?.groups || []).map((group) => String(group.uid)));
    let index = used.size + 1;
    while (used.has(`group-${index}`)) index += 1;
    return `group-${index}`;
  }

  #editKey(kind, id) { return `${kind}:${String(id)}`; }

  #isEditing(kind, id) { return this.#editingKey === this.#editKey(kind, id); }

  #selectRow(id, checked, range) {
    const selectable = this.#rows().filter((row) => row.type === "gene" || !row.type).map((row) => row.id);
    const start = selectable.indexOf(this.#selectionAnchor);
    const end = selectable.indexOf(id);
    if (range && start >= 0 && end >= 0) {
      selectable.slice(Math.min(start, end), Math.max(start, end) + 1).forEach((candidate) => {
        if (checked) this.#selected.add(candidate);
        else this.#selected.delete(candidate);
      });
    } else if (checked) this.#selected.add(id);
    else this.#selected.delete(id);
    this.#selectionAnchor = id;
  }

  #selectableIds(rows = this.#rows()) {
    return [...new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" || !row.type ? [row.id] : [])))];
  }

  #sortRows(rows) {
    const sort = this.#sort[this.#kind];
    if (!sort) return rows;
    return [...rows].sort((left, right) => {
      const a = left[sort.key] ?? "";
      const b = right[sort.key] ?? "";
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      return comparison * sort.direction;
    });
  }

  #rows() {
    const data = this.#data();
    if (!data) return [];
    const needle = this.#filter;
    const includes = (...values) => !needle || values.join(" ").toLowerCase().includes(needle);
    const cache = this.#cache();
    const groups = cache.groups;
    if (this.#kind === "groups") return data.groups.filter((group) => includes(labelFor(group, group.uid), group.subtitle)).map((group) => ({
      id: group.uid, label: labelFor(group, group.uid), subtitle: group.subtitle || "", count: group.genes?.length || 0, hidden: Boolean(group.hidden), colour: group.colour,
    }));
    if (this.#kind === "links") {
      const genes = cache.geneById;
      return this.#sortRows(data.links.filter((link) => includes(labelFor(genes.get(link.query.uid), link.query.uid), labelFor(genes.get(link.target.uid), link.target.uid), link.label)).map((link) => ({
        id: link.uid,
        source: labelFor(genes.get(link.query.uid), link.query.uid),
        target: labelFor(genes.get(link.target.uid), link.target.uid),
        identity: Math.round((link.identity || 0) * 1000) / 10,
        groups: `${labelFor(groups.get(link.query.uid), "Ungrouped")} / ${labelFor(groups.get(link.target.uid), "Ungrouped")}`,
        label: link.label || "",
        hidden: Boolean(link.hidden),
        colour: link.colour,
      })));
    }
    const memberGroup = data.groups.find((group) => group.uid === this.#memberGroupId);
    if (this.#memberGroupId !== null && !memberGroup) this.#memberGroupId = null;
    const memberIds = memberGroup && new Set((memberGroup.genes || []).map(String));
    const genes = cache.genes.filter(({ gene, locus, cluster }) =>
      (!memberIds || memberIds.has(String(gene.uid))) && includes(labelFor(gene, gene.uid), labelFor(locus, locus.uid), labelFor(cluster, cluster.uid), labelFor(groups.get(gene.uid), "Ungrouped")));
    if (this.#geneView === "tree") return this.#treeRows(data, groups, genes, needle);
    if (this.#geneView === "groups") return this.#groupTreeRows(data, groups, genes, needle);
    return this.#sortRows(genes.map(({ gene, locus, cluster }) => ({
      id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(gene.uid), "Ungrouped"), colour: gene.colour || groups.get(gene.uid)?.colour,
    })));
  }

  #treeRows(data, groups, visible, needle) {
    const visibleIds = new Set(visible.map(({ gene }) => gene.uid));
    const rows = [];
    for (const cluster of data.clusters) {
      const loci = cluster.loci.map((locus) => ({ locus, genes: locus.genes.filter((gene) => visibleIds.has(gene.uid)) })).filter(({ genes }) => genes.length);
      if (!loci.length) continue;
      if (loci.length === 1) {
        const { locus, genes } = loci[0];
        const key = `cluster-locus:${cluster.uid}:${locus.uid}`;
        const open = Boolean(needle) || this.#expanded.has(key);
        rows.push({ type: "cluster-locus", key, cluster, locus, label: labelFor(cluster, cluster.uid), locusLabel: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open });
        if (open) rows.push(...genes.map((gene) => this.#treeGeneRow(gene, locus, cluster, groups, 1)));
        continue;
      }
      const key = `cluster:${cluster.uid}`;
      const open = Boolean(needle) || this.#expanded.has(key);
      rows.push({ type: "cluster", key, cluster, label: labelFor(cluster, cluster.uid), count: loci.reduce((count, item) => count + item.genes.length, 0), selectIds: loci.flatMap(({ genes }) => genes.map((gene) => gene.uid)), open });
      if (!open) continue;
      for (const { locus, genes } of loci) {
        const locusKey = `locus:${locus.uid}`;
        const locusOpen = Boolean(needle) || this.#expanded.has(locusKey);
        rows.push({ type: "locus", key: locusKey, locus, label: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open: locusOpen, depth: 1 });
        if (locusOpen) rows.push(...genes.map((gene) => this.#treeGeneRow(gene, locus, cluster, groups, 2)));
      }
    }
    return rows;
  }

  #treeGeneRow(gene, locus, cluster, groups, depth) {
    return { type: "gene", id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(gene.uid), "Ungrouped"), colour: gene.colour || groups.get(gene.uid)?.colour, depth };
  }

  #groupTreeRows(data, groups, visible, needle) {
    const entries = new Map(visible.flatMap(({ gene, locus, cluster }) => {
      const entry = { gene, locus, cluster };
      return [[gene.uid, entry], [String(gene.uid), entry]];
    }));
    const buckets = [
      ...(data.groups || []).map((group) => ({ key: `gene-group:${group.uid}`, label: labelFor(group, group.uid), genes: (group.genes || []).map((id) => entries.get(id)).filter(Boolean) })),
      { key: "gene-group:ungrouped", label: "Ungrouped", genes: visible.filter(({ gene }) => !groups.has(gene.uid)) },
    ];
    const rows = [];
    for (const bucket of buckets) {
      if (!bucket.genes.length) continue;
      const open = Boolean(needle) || this.#expanded.has(bucket.key);
      rows.push({ type: "gene-group", key: bucket.key, label: bucket.label, count: bucket.genes.length, selectIds: bucket.genes.map(({ gene }) => gene.uid), open });
      if (open) rows.push(...bucket.genes.map(({ gene, locus, cluster }) => this.#treeGeneRow(gene, locus, cluster, groups, 1)));
    }
    return rows;
  }

  #render() {
    if (!this.isConnected || !this.querySelector("[data-rows]")) return;
    this.#renderData();
    this.#renderAppearance();
    this.#renderHistory();
  }

  #renderHistory() {
    const undo = this.querySelector('[data-command="undo"]');
    const redo = this.querySelector('[data-command="redo"]');
    if (undo) undo.disabled = !this.#chart?.canUndo?.();
    if (redo) redo.disabled = !this.#chart?.canRedo?.();
  }

  #renderData() {
    const rows = this.#rows();
    const data = this.#data();
    const head = this.querySelector("[data-head]");
    const list = this.querySelector("[data-rows]");
    const summary = this.querySelector("[data-summary]");
    const actions = this.querySelector("[data-actions]");
    if (!data) {
      head.replaceChildren(); list.textContent = "Set the chart property to edit a ClusterMap chart."; summary.textContent = "No chart attached."; actions.hidden = true;
      return;
    }
    const geneView = this.querySelector("[data-gene-view]");
    const memberFilter = this.querySelector("[data-member-filter]");
    const memberGroup = data.groups.find((group) => group.uid === this.#memberGroupId);
    if (!memberGroup) this.#memberGroupId = null;
    memberFilter.hidden = !memberGroup || this.#kind !== "genes";
    if (memberGroup) this.querySelector("[data-member-label]").textContent = labelFor(memberGroup, memberGroup.uid);
    geneView.hidden = this.#kind !== "genes";
    this.querySelector('[data-command="new-group"]').hidden = this.#kind !== "groups";
    this.querySelector('[data-command="clear-filter"]').hidden = !this.#filter;
    const isTree = this.#kind === "genes" && this.#geneView !== "list";
    const treeButton = this.querySelector('[data-command="toggle-tree"]');
    treeButton.hidden = !isTree || Boolean(this.#filter);
    if (isTree) {
      const hasCollapsed = rows.some((row) => row.type !== "gene" && !row.open);
      treeButton.textContent = hasCollapsed ? "Expand visible" : "Collapse all";
      treeButton.title = hasCollapsed ? "Expand all currently visible branches" : "Collapse every tree branch";
    }
    // Visibility is a compact icon control with an explicit per-row label;
    // repeating its long text in a 28px heading produces an unreadable merged
    // “VisibleColour” column on narrow editors.
    const columns = this.#kind === "groups" ? [{ label: "" }, { label: "↕" }, { label: "Group" }, { label: "Legend label" }, { label: "Genes" }, { label: "" }, { label: "Colour" }]
      : this.#kind === "links" ? [{ label: "" }, { label: "Source", sort: "source" }, { label: "Target", sort: "target" }, { label: "Identity", sort: "identity" }, { label: "Endpoint groups", sort: "groups" }, { label: "Link label", sort: "label" }, { label: "" }, { label: "Colour" }]
        : [{ label: "" }, { label: "Gene", sort: "label" }, { label: "Locus", sort: "locus" }, { label: "Cluster", sort: "cluster" }, { label: "Group", sort: "group" }, { label: "Colour" }];
    const sort = this.#sort[this.#kind];
    head.hidden = isTree;
    head.className = `cm-editor__head cm-editor__head--${this.#kind}`;
    head.innerHTML = columns.map(({ label, sort: key }) => {
      if (!key) return `<span>${label}</span>`;
      const active = sort?.key === key;
      const direction = active && sort.direction < 0 ? "descending" : "ascending";
      return `<button type="button" class="cm-editor__sort" data-sort="${key}" aria-label="Sort by ${label}, ${direction}" title="Sort by ${label}">${label}<span aria-hidden="true">${active ? (sort.direction < 0 ? "↓" : "↑") : "↕"}</span></button>`;
    }).join("");
    list.className = `cm-editor__rows cm-editor__rows--${isTree ? "tree" : this.#kind}`;
    const table = this.querySelector(".cm-editor__table");
    const rowHeight = 34;
    const virtual = rows.length > 200;
    const viewportRows = Math.ceil((table?.clientHeight || 320) / rowHeight) + 16;
    const first = virtual ? Math.max(0, Math.floor(this.#scrollTop / rowHeight) - 8) : 0;
    const last = virtual ? Math.min(rows.length, first + viewportRows) : rows.length;
    const visibleRows = rows.slice(first, last);
    const renderRow = (row) => isTree ? this.#treeRowMarkup(row) : this.#rowMarkup(row);
    list.innerHTML = rows.length
      ? `${virtual ? `<div style="height:${first * rowHeight}px"></div>` : ""}${visibleRows.map(renderRow).join("")}${virtual ? `<div style="height:${Math.max(0, rows.length - last) * rowHeight}px"></div>` : ""}`
      : `<p class="cm-editor__empty">No ${this.#kind} match the filter.</p>`;
    const visibleGenes = isTree ? new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" ? [row.id] : []))).size : rows.length;
    summary.textContent = isTree
      ? `${rows.filter((row) => row.type !== "gene").length.toLocaleString()} cluster/locus rows · ${visibleGenes.toLocaleString()} genes${this.#filter ? " matching search" : ""}.`
      : `${rows.length.toLocaleString()} visible ${this.#kind}${memberGroup && this.#kind === "genes" ? " in selected group" : ""}${this.#filter ? " matching search" : ""}.`;
    const selectable = this.#selectableIds(rows);
    const selectVisible = this.querySelector('[data-command="select-visible"]');
    selectVisible.hidden = !selectable.length;
    selectVisible.disabled = selectable.length > 0 && selectable.every((id) => this.#selected.has(id));
    selectVisible.textContent = isTree ? `Select all ${selectable.length.toLocaleString()} visible genes` : `Select all ${selectable.length.toLocaleString()} visible`;
    const selected = [...this.#selected];
    actions.hidden = !selected.length;
    actions.innerHTML = selected.length ? this.#actionsMarkup(selected.length) : "";
  }

  #rowMarkup(row) {
    const selected = this.#selected.has(row.id);
    const box = `<input type="checkbox" data-select="${escapeHtml(row.id)}" ${selected ? "checked" : ""} aria-label="Select ${escapeHtml(row.label || row.source)}">`;
    const visible = (type) => `<button type="button" class="cm-editor__visibility" data-visible data-type="${type}" data-id="${escapeHtml(row.id)}" data-hidden="${row.hidden}" aria-label="${row.hidden ? "Show" : "Hide"}" title="${row.hidden ? "Show" : "Hide"}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle>${row.hidden ? '<path d="m4 4 16 16"></path>' : ""}</svg></button>`;
    const colour = (type) => `<input type="color" data-colour data-type="${type}" data-id="${escapeHtml(row.id)}" value="${colourFor(row.colour)}" aria-label="Colour">`;
    if (this.#kind === "groups") return `<div data-id="${escapeHtml(row.id)}" class="cm-editor__row cm-editor__row--groups ${selected ? "is-selected" : ""}">${box}<button type="button" class="cm-editor__reorder" draggable="true" data-reorder="${escapeHtml(row.id)}" aria-label="Reorder ${escapeHtml(row.label)}; use Arrow Up or Arrow Down to move it" title="Drag to reorder; Arrow Up or Arrow Down moves one place">⠿</button>${editableField("group:label", row.id, row.label, "Group name", row.label || "group", this.#isEditing("group:label", row.id))}${editableField("group:subtitle", row.id, row.subtitle, "Add subtitle…", `${row.label || "group"} subtitle`, this.#isEditing("group:subtitle", row.id))}<span class="cm-editor__context">${row.count.toLocaleString()} genes</span>${visible("groups")}${colour("groups")}</div>`;
    if (this.#kind === "links") return `<div data-id="${escapeHtml(row.id)}" class="cm-editor__row cm-editor__row--links ${selected ? "is-selected" : ""}">${box}<span class="cm-editor__context" title="${escapeHtml(row.source)}">${escapeHtml(row.source)}</span><span class="cm-editor__context" title="${escapeHtml(row.target)}">${escapeHtml(row.target)}</span>${editableCell("link:identity", row.id, row.identity, "Identity")}<span class="cm-editor__context" title="${escapeHtml(row.groups)}">${escapeHtml(row.groups)}</span>${editableField("link:label", row.id, row.label, "Add label…", "link label", this.#isEditing("link:label", row.id))}<span>${visible("links")}</span>${colour("links")}</div>`;
    return `<div data-id="${escapeHtml(row.id)}" class="cm-editor__row cm-editor__row--genes ${selected ? "is-selected" : ""}">${box}${editableField("gene:label", row.id, row.label, "Gene label", row.label || "gene", this.#isEditing("gene:label", row.id))}<span class="cm-editor__context" title="${escapeHtml(row.locus)}">${escapeHtml(row.locus)}</span><span class="cm-editor__context" title="${escapeHtml(row.cluster)}">${escapeHtml(row.cluster)}</span><span class="cm-editor__context" title="${escapeHtml(row.group)}">${escapeHtml(row.group)}</span>${colour("genes")}</div>`;
  }

  #treeRowMarkup(row) {
    if (row.type === "gene") {
      const selected = this.#selected.has(row.id);
      return `<div data-id="${escapeHtml(row.id)}" class="cm-editor__tree-row cm-editor__tree-gene ${selected ? "is-selected" : ""}" style="--depth:${row.depth}"><input type="checkbox" data-select="${escapeHtml(row.id)}" ${selected ? "checked" : ""} aria-label="Select ${escapeHtml(row.label)}">${editableField("gene:label", row.id, row.label, "Gene label", row.label || "gene", this.#isEditing("gene:label", row.id))}<span class="cm-editor__context" title="${escapeHtml(row.group)}">${escapeHtml(row.group)}</span><input type="color" data-colour data-type="genes" data-id="${escapeHtml(row.id)}" value="${colourFor(row.colour)}" aria-label="Colour"></div>`;
    }
    const arrow = `<button type="button" class="cm-editor__tree-toggle" data-tree-toggle="${escapeHtml(row.key)}" aria-label="${row.open ? "Collapse" : "Expand"}">${row.open ? "▾" : "▸"}</button>`;
    const selected = row.selectIds?.length && row.selectIds.every((id) => this.#selected.has(id));
    const select = `<input type="checkbox" data-select-many="${escapeHtml(JSON.stringify(row.selectIds || []))}" ${selected ? "checked" : ""} aria-label="Select ${row.count.toLocaleString()} genes in ${escapeHtml(row.label)}">`;
    const count = `<span class="cm-editor__tree-count">(${row.count.toLocaleString()})</span>`;
    const selectedIds = escapeHtml(JSON.stringify(row.selectIds || []));
    if (row.type === "cluster-locus") {
      const clusterEditing = this.#isEditing("cluster:label", row.cluster.uid);
      const locusEditing = this.#isEditing("locus:label", row.locus.uid);
      return `<div data-select-ids="${selectedIds}" class="cm-editor__tree-row cm-editor__tree-parent">${arrow}${select}<div class="cm-editor__tree-combined ${clusterEditing || locusEditing ? "is-editing" : ""}">${editableField("cluster:label", row.cluster.uid, row.label, "Cluster name", row.label || "cluster", clusterEditing, true, this.#editWidths.get(this.#editKey("cluster:label", row.cluster.uid)))}<span class="cm-editor__tree-separator">·</span>${editableField("locus:label", row.locus.uid, row.locusLabel, "Locus name", row.locusLabel || "locus", locusEditing, true, this.#editWidths.get(this.#editKey("locus:label", row.locus.uid)))}${count}</div></div>`;
    }
    if (row.type === "gene-group") return `<div data-select-ids="${selectedIds}" class="cm-editor__tree-row cm-editor__tree-parent">${arrow}${select}<span class="cm-editor__tree-group-label">${escapeHtml(row.label)} ${count}</span></div>`;
    const type = row.type === "cluster" ? "cluster" : "locus";
    const record = row[type];
    return `<div data-select-ids="${selectedIds}" class="cm-editor__tree-row cm-editor__tree-parent" style="--depth:${row.depth || 0}">${arrow}${select}<span class="cm-editor__tree-name-with-count">${editableField(`${type}:label`, record.uid, row.label, `${type} name`, row.label || type, this.#isEditing(`${type}:label`, record.uid), true)}${count}</span></div>`;
  }

  #actionsMarkup(count) {
    const noun = this.#kind.slice(0, -1);
    const summary = `<strong>${count} ${noun}${count === 1 ? "" : "s"} selected</strong>`;
    const focus = `<span class="cm-editor__action-group"><button type="button" data-command="focus">Focus in plot</button></span>`;
    const clear = `<button type="button" data-command="clear-selection">Clear selection</button>`;
    if (this.#kind === "genes") {
      const options = (this.#data()?.groups || []).map((group) => `<option value="${escapeHtml(group.uid)}">${escapeHtml(labelFor(group, group.uid))}</option>`).join("");
      return `${summary}${focus}<span class="cm-editor__action-group"><label>Move to <select data-assign-group><option value="">Choose a group…</option>${options}</select></label><button type="button" data-command="assign">Move</button><button type="button" data-command="unassign">Remove from groups</button><button type="button" data-command="new-group-for-selection">New group…</button></span><span class="cm-editor__action-group"><button type="button" data-command="delete" class="cm-editor__danger">Delete selected genes</button>${clear}</span>`;
    }
    // Individual records are edited inline. Keep this bar for explicitly
    // shared presentation changes, as in the original editor.
    const presentation = count > 1 ? `<span class="cm-editor__action-group"><input data-batch-label placeholder="Set label"><button type="button" data-command="batch-label">Set label</button><label title="Set colour"><span class="cm-editor__sr-only">Set colour</span><input type="color" data-batch-colour value="#888888"></label>${this.#kind === "links" ? `<input type="number" data-batch-identity min="0" max="100" step=".1" placeholder="Set identity (%)"><button type="button" data-command="batch-identity">Set identity</button>` : ""}<select data-batch-visibility aria-label="Set visibility"><option value="">Visibility…</option><option value="show">Show</option><option value="hide">Hide</option></select></span>` : "";
    const groupActions = this.#kind !== "groups" ? "" : count > 1
      ? `<span class="cm-editor__action-group"><select data-merge-target><option value="">Choose group to keep…</option>${(this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid)).map((group) => `<option value="${escapeHtml(group.uid)}">${escapeHtml(labelFor(group, group.uid))}</option>`).join("")}</select><button type="button" data-command="merge">Merge groups</button></span>`
      : `<span class="cm-editor__action-group"><button type="button" data-command="view-members">View member genes</button><button type="button" data-command="move-first">First</button><label>Position <input type="number" data-group-position min="1" max="${this.#data()?.groups.length || 1}" value="${Math.max(1, (this.#data()?.groups || []).findIndex((group) => this.#selected.has(group.uid)) + 1)}"></label><button type="button" data-command="move-position">Move</button><button type="button" data-command="move-last">Last</button></span>`;
    return `${summary}${focus}${presentation}${groupActions}<span class="cm-editor__action-group"><button type="button" data-command="delete" class="cm-editor__danger">Delete selected ${this.#kind}</button>${clear}</span>`;
  }

  #deleteSelected() {
    const ids = [...this.#selected];
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected ${this.#kind}?`)) return;
    const type = this.#kind === "groups" ? "groups.delete" : `${this.#kind}.delete`;
    this.#selected.clear();
    this.#apply({ type, ids });
  }

  #moveGroup(uid, delta) {
    const ids = (this.#data()?.groups || []).map((group) => group.uid);
    const from = ids.indexOf(uid);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, uid);
    this.#apply({ type: "groups.reorder", ids });
  }

  #moveSelectedGroupTo(index) {
    const ids = (this.#data()?.groups || []).map((group) => group.uid);
    const selected = [...this.#selected][0];
    const from = ids.indexOf(selected);
    if (from < 0 || !Number.isFinite(index)) return;
    ids.splice(from, 1);
    ids.splice(Math.max(0, Math.min(ids.length, Math.trunc(index))), 0, selected);
    this.#apply({ type: "groups.reorder", ids });
  }

  #viewGroupMembers(groupId) {
    this.#memberGroupId = this.#id(groupId);
    this.#kind = "genes";
    this.#geneView = "list";
    this.#selected.clear();
    this.#selectionAnchor = null;
    this.#scrollTop = 0;
    this.querySelectorAll("[data-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.kind === "genes")));
    this.querySelectorAll("[data-gene-view-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.geneViewKind === "list")));
    this.#syncHighlight();
    this.#renderData();
  }

  #focusSelected() {
    if (!this.#chart?.focus || !this.#selected.size) return;
    if (this.#kind === "groups") {
      const genes = (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid)).flatMap((group) => group.genes || []);
      this.#chart.focus({ genes });
    } else if (this.#kind === "links") this.#chart.focus({ links: [...this.#selected] });
    else this.#chart.focus({ genes: [...this.#selected] });
  }

  #placeGroup(uid, targetUid, after) {
    const ids = (this.#data()?.groups || []).map((group) => group.uid);
    const from = ids.indexOf(uid);
    if (from < 0 || uid === targetUid) return;
    ids.splice(from, 1);
    let target = ids.indexOf(targetUid);
    if (target < 0) return;
    if (after) target += 1;
    ids.splice(target, 0, uid);
    this.#apply({ type: "groups.reorder", ids });
  }

  #finishGroupDrag() {
    this.#draggedGroupId = null;
    this.querySelectorAll(".cm-editor__drop-target").forEach((node) => node.classList.remove("cm-editor__drop-target"));
  }

  #undo() {
    this.#chart?.undo?.();
  }

  #redo() {
    this.#chart?.redo?.();
  }

  #toggleTree() {
    const rows = this.#rows();
    if (rows.some((row) => row.type !== "gene" && !row.open)) {
      const data = this.#data();
      if (this.#geneView === "groups") {
        (data?.groups || []).forEach((group) => this.#expanded.add(`gene-group:${group.uid}`));
        this.#expanded.add("gene-group:ungrouped");
      } else {
        (data?.clusters || []).forEach((cluster) => {
          if (cluster.loci.length === 1) this.#expanded.add(`cluster-locus:${cluster.uid}:${cluster.loci[0].uid}`);
          else {
            this.#expanded.add(`cluster:${cluster.uid}`);
            cluster.loci.forEach((locus) => this.#expanded.add(`locus:${locus.uid}`));
          }
        });
      }
    } else this.#expanded.clear();
    this.#renderData();
  }

  #syncHighlight() {
    this.#cancelHover();
    this.#applySelectionHighlight();
  }

  #applySelectionHighlight() {
    if (!this.#chart?.highlight) return;
    if (this.#kind === "links") this.#chart.highlight({ links: this.#selected });
    else if (this.#kind === "groups") {
      const genes = (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid)).flatMap((group) => group.genes || []);
      this.#chart.highlight({ genes });
    } else this.#chart.highlight({ genes: this.#selected });
  }

  #queueHover(row) {
    this.#hoverRow = row;
    if (this.#hoverTimer !== null) globalThis.clearTimeout(this.#hoverTimer);
    this.#hoverTimer = globalThis.setTimeout(() => {
      this.#hoverTimer = null;
      if (this.#hoverFrame !== null) return;
      const requestFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
      this.#hoverFrame = requestFrame(() => {
        this.#hoverFrame = null;
        const hovered = this.#hoverRow;
        if (hovered === this.#hoveredRow) return;
        this.#hoveredRow = hovered;
        if (hovered?.isConnected) this.#highlightRow(hovered);
        else this.#applySelectionHighlight();
      });
    }, 36);
  }

  #cancelHover() {
    if (this.#hoverTimer !== null) globalThis.clearTimeout(this.#hoverTimer);
    if (this.#hoverFrame !== null) {
      const cancelFrame = globalThis.cancelAnimationFrame || globalThis.clearTimeout;
      cancelFrame(this.#hoverFrame);
    }
    this.#hoverTimer = null;
    this.#hoverFrame = null;
    this.#hoverRow = null;
    this.#hoveredRow = null;
  }

  #highlightRow(row) {
    if (!this.#chart?.highlight) return;
    if (row.classList.contains("cm-editor__row--links")) {
      this.#chart.highlight({ links: [this.#id(row.dataset.id)] });
      return;
    }
    let genes = [];
    if (row.dataset.selectIds) {
      try { genes = JSON.parse(row.dataset.selectIds); } catch { genes = []; }
    } else if (row.classList.contains("cm-editor__row--groups")) {
      genes = this.#data()?.groups.find((group) => group.uid === this.#id(row.dataset.id))?.genes || [];
    } else if (row.dataset.id !== undefined) {
      genes = [this.#id(row.dataset.id)];
    }
    this.#chart.highlight({ genes: genes.map((id) => this.#id(id)) });
  }

  #renderAppearance() {
    const container = this.querySelector("[data-appearance]");
    const config = this.#chart?.config?.();
    if (!container || !config) return;
    const clear = this.querySelector('[data-command="clear-appearance-filter"]');
    if (clear) clear.hidden = !this.#appearanceFilter;
    const fields = [
      ["Legend", "legend.show", "Show legend", "checkbox"], ["Legend", "legend.position", "Position", "select", ["right", "bottom"]], ["Legend", "legend.columns", "Columns", "number"], ["Legend", "legend.columnWidth", "Column width", "number", undefined, true], ["Legend", "legend.entryHeight", "Entry height", "number", undefined, true], ["Legend", "legend.fontSize", "Font size", "number", undefined, true], ["Legend", "legend.subtitleFontSize", "Subtitle size", "number", undefined, true], ["Legend", "legend.marginLeft", "Left margin", "number", undefined, true], ["Legend", "legend.marginTop", "Top margin", "number", undefined, true],
      ["Links", "link.show", "Show links", "checkbox"], ["Links", "link.asLine", "Draw as lines", "checkbox"], ["Links", "link.bestOnly", "Best match only", "checkbox"], ["Links", "link.threshold", "Minimum identity", "number"], ["Links", "link.straight", "Straight links", "checkbox", undefined, true], ["Links", "link.groupColour", "Use group colour", "checkbox", undefined, true], ["Links", "link.strokeWidth", "Stroke width", "number", undefined, true],
      ["Link labels", "link.label.show", "Show link labels", "checkbox"], ["Link labels", "link.label.background", "Label background", "checkbox", undefined, true], ["Link labels", "link.label.fontSize", "Font size", "number", undefined, true], ["Link labels", "link.label.position", "Position", "number", undefined, true],
      ["Clusters & loci", "cluster.alignLabels", "Align cluster labels", "checkbox"], ["Clusters & loci", "cluster.hideLocusCoordinates", "Hide locus coordinates", "checkbox"], ["Clusters & loci", "cluster.spacing", "Cluster spacing", "number"], ["Clusters & loci", "locus.spacing", "Locus spacing", "number"], ["Clusters & loci", "cluster.nameFontSize", "Cluster name size", "number", undefined, true], ["Clusters & loci", "cluster.lociFontSize", "Locus label size", "number", undefined, true], ["Clusters & loci", "locus.trackBar.colour", "Track colour", "colour", undefined, true], ["Clusters & loci", "locus.trackBar.stroke", "Track stroke", "number", undefined, true],
      ["Genes", "gene.label.show", "Show gene labels", "checkbox"], ["Genes", "gene.label.name", "Label field", "select", ["uid", "name", "label"]], ["Genes", "gene.label.position", "Label position", "select", ["top", "bottom"]], ["Genes", "gene.label.anchor", "Label anchor", "select", ["start", "middle", "end"], true], ["Genes", "gene.label.fontSize", "Label size", "number", undefined, true], ["Genes", "gene.label.rotation", "Label rotation", "number", undefined, true], ["Genes", "gene.label.spacing", "Label spacing", "number", undefined, true], ["Genes", "gene.label.start", "Label start", "number", undefined, true], ["Genes", "gene.shape.bodyHeight", "Body height", "number", undefined, true], ["Genes", "gene.shape.tipHeight", "Tip height", "number", undefined, true], ["Genes", "gene.shape.tipLength", "Tip length", "number", undefined, true], ["Genes", "gene.shape.stroke", "Stroke colour", "colour", undefined, true], ["Genes", "gene.shape.strokeWidth", "Stroke width", "number", undefined, true],
      ["Scale bars", "scaleBar.show", "Show scale bar", "checkbox"], ["Scale bars", "scaleBar.basePair", "Base pairs", "number"], ["Scale bars", "colourBar.show", "Show identity bar", "checkbox"], ["Scale bars", "colourBar.domain.minMode", "Minimum source", "select", [["fixed", "Custom value"], ["data", "Lowest identity in data"]]], ["Scale bars", "colourBar.domain.min", "Minimum identity", "number"], ["Scale bars", "colourBar.domain.maxMode", "Maximum source", "select", [["fixed", "Custom value"], ["data", "Highest identity in data"]]], ["Scale bars", "colourBar.domain.max", "Maximum identity", "number"], ["Scale bars", "scaleBar.height", "Height", "number", undefined, true], ["Scale bars", "scaleBar.fontSize", "Font size", "number", undefined, true], ["Scale bars", "scaleBar.stroke", "Stroke", "number", undefined, true], ["Scale bars", "scaleBar.colour", "Colour", "colour", undefined, true], ["Scale bars", "scaleBar.marginTop", "Scale margin", "number", undefined, true], ["Scale bars", "colourBar.width", "Identity width", "number", undefined, true], ["Scale bars", "colourBar.height", "Identity height", "number", undefined, true], ["Scale bars", "colourBar.fontSize", "Identity font size", "number", undefined, true], ["Scale bars", "colourBar.marginTop", "Identity margin", "number", undefined, true],
      ["Plot & navigation", "plot.renderer", "Renderer", "select", ["svg", "canvas", "webgpu"]], ["Plot & navigation", "plot.minimap.show", "Show minimap", "checkbox"], ["Plot & navigation", "plot.minZoom", "Minimum zoom", "number"], ["Plot & navigation", "plot.maxZoom", "Maximum zoom", "number"], ["Plot & navigation", "plot.transitionDuration", "Transition (ms)", "number", undefined, true], ["Plot & navigation", "plot.scaleFactor", "Scale factor", "number", undefined, true], ["Plot & navigation", "plot.scaleGenes", "Scale genes", "checkbox", undefined, true], ["Plot & navigation", "plot.fontFamily", "Font family", "text", undefined, true], ["Plot & navigation", "plot.minimap.showLinks", "Minimap links", "checkbox", undefined, true], ["Plot & navigation", "plot.minimap.width", "Minimap width", "number", undefined, true], ["Plot & navigation", "plot.minimap.height", "Minimap height", "number", undefined, true], ["Plot & navigation", "plot.minimap.margin", "Minimap margin", "number", undefined, true],
    ];
    const valueAt = (path) => path.split(".").reduce((value, key) => value?.[key], config);
    const bySection = fields.reduce((sections, field) => {
      const [section] = field;
      (sections.get(section) || sections.set(section, []).get(section)).push(field);
      return sections;
    }, new Map());
    const matchingSections = [...bySection].map(([section, entries]) => {
      const visible = entries.filter(([, path, label]) => !this.#appearanceFilter || `${section} ${label} ${path}`.toLowerCase().includes(this.#appearanceFilter));
      if (!visible.length) return "";
      const renderField = ([, path, label, type, options]) => {
        const value = valueAt(path);
        const identityBound = path.endsWith(".min") ? "min" : path.endsWith(".max") ? "max" : null;
        const disabled = identityBound && config.colourBar?.domain?.[`${identityBound}Mode`] === "data" ? " disabled" : "";
        const control = type === "checkbox" ? `<input data-config="${path}" type="checkbox" ${value ? "checked" : ""}>`
          : type === "select" ? `<select data-config="${path}">${options.map((option) => {
            const [optionValue, optionLabel] = Array.isArray(option) ? option : [option, option];
            return `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`;
          }).join("")}</select>`
            : `<input data-config="${path}" type="${type === "colour" ? "color" : type}" value="${escapeHtml(type === "colour" ? colourFor(value) : value ?? "")}" step="any"${disabled}>`;
        return `<label><span>${label}</span>${control}</label>`;
      };
      const general = visible.filter((field) => !field[5]);
      const advanced = visible.filter((field) => field[5]);
      const sectionKey = section.toLowerCase().replaceAll(/\W+/g, "-");
      const expandAdvanced = Boolean(this.#appearanceFilter) || this.#appearanceAdvanced.has(sectionKey);
      return `<fieldset><legend>${section}</legend>${general.map(renderField).join("")}${advanced.length ? `<details data-appearance-section="${sectionKey}"${expandAdvanced ? " open" : ""}><summary>Advanced</summary>${advanced.map(renderField).join("")}</details>` : ""}</fieldset>`;
    });
    container.innerHTML = matchingSections.join("") || `<p class="cm-editor__empty">No appearance settings match “${escapeHtml(this.#appearanceFilter)}”.</p>`;
  }
}

/** Register the documented <clinker-editor> element once. */
export function defineClinkerEditor() {
  if (!globalThis.customElements) {
    throw new Error("Custom elements are unavailable in this environment.");
  }
  if (!customElements.get(tagName)) customElements.define(tagName, ClinkerEditorElement);
  return customElements.get(tagName);
}
