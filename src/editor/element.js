import { createDataPanel, createSelectionControls, dataCell, createDataSearch, installDataEditorStyle, segmentedControlMarkup, updateSegmentedControl, dataCheckboxMarkup, dataColourMarkup, dataIconButtonMarkup, dataActionMenuMarkup } from "../dataEditorUi.mjs";
import { RowSelection } from "../rowSelection.mjs";
import { createVirtualRows } from "../virtualRows.mjs";
import { createAnnotationDataControls } from "../annotationDataControls.mjs";
import { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale, validateAnnotationPanels } from "../annotations.mjs";
import { createActionRunner, setMarkup, bindEditableField, escapeHtml } from "../uiControls.mjs";
import { applyTheme, resolveTheme, figureConfig } from "../theme.mjs";
import { createAppearanceControls } from "./appearanceControls.mjs";

const tagName = "clinker-editor";
const HTMLElementBase = globalThis.HTMLElement || class {};

const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;
// Chart palettes are stored as CSS colours (often rgb(...)); colour inputs only
// accept hexadecimal values. D3's parser is bundled with the chart and keeps
// editor swatches in sync with the rendered legend.
const groupMap = (data) => new Map((data?.groups || []).flatMap((group) =>
  (group.genes || []).flatMap((id) => [[id, group], [String(id), group]])
));
function editableCell(kind, id, value, placeholder, compact = false, width = null) {
  const length = String(value || placeholder || "").length;
  const fixed = Number.isFinite(width);
  const size = compact && !fixed ? ` size="${Math.max(8, Math.min(30, length + 1))}"` : "";
  const style = Number.isFinite(width) ? ` style="width:${Math.ceil(width) + 2}px;min-width:${Math.ceil(width) + 2}px"` : "";
  const constraints = kind === "link:identity" ? ' type="number" min="0" max="100" step="any" required' : ' type="text"';
  return `<input${constraints} aria-label="${escapeHtml(placeholder)}: ${escapeHtml(id)}" class="cm-data-cell cm-data-field cm-editor-inline-input${fixed ? " cm-editor-inline-input--fixed" : ""}" data-edit="${kind}" data-id="${escapeHtml(id)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${size}${style}>`;
}

function editableField(kind, id, value, placeholder, label, editing, compact = false, width = null) {
  if (editing) {
    const fixed = Number.isFinite(width) ? ` style="width:${Math.ceil(width) + 16}px;flex:0 0 ${Math.ceil(width) + 16}px"` : "";
    return `<span class="cm-data-cell cm-editor__editable-field is-editing"${fixed}>${editableCell(kind, id, value, placeholder, compact, width)}</span>`;
  }
  const text = value ? escapeHtml(value) : `<span class="cm-data-placeholder">${escapeHtml(placeholder)}</span>`;
  return `<span class="cm-data-cell cm-editor__editable-field"><span class="cm-editor__editable-label" title="${escapeHtml(value || placeholder)}">${text}</span><button type="button" class="cm-data-icon-button cm-data-icon-button--edit" data-focus-edit="${kind}" data-id="${escapeHtml(id)}" aria-label="Edit ${escapeHtml(label)}" title="Edit ${escapeHtml(label)}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.1-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"></path><path d="m13.8 7.2 3 3"></path></svg></button></span>`;
}

/**
 * An optional, light-DOM editor for a ClusterMap chart.
 *
 * Shared native-control styles are installed on mount; `clinker/editor.css`
 * supplies the optional panel layout. Set .chart to an already rendered chart.
 * Edits use its public API; the component owns no copy of the chart data.
 */
export class ClinkerEditorElement extends HTMLElementBase {
  #chart = null;
  #runEdit = createActionRunner((message) => {
    const status = this.querySelector("[data-editor-error]");
    if (status) { status.textContent = message; status.hidden = !message; }
  });
  #annotationEditor = null;
  #appearanceView = null;
  #editAnnotation = (event) => {
    if (event.defaultPrevented || event.detail?.chart !== this.#chart) return;
    event.preventDefault(); this.editAnnotations(event.detail.panelUid);
  };
  #unsubscribe = null;
  #kind = "groups";
  #geneView = "tree";
  #selected = new RowSelection();
  #rowView = null;
  #selectionControls = null;
  #rowsCache = null;
  #selectionData = null;
  #filter = "";
  #appearanceFilter = "";
  #appearanceAdvanced = new Set();
  #memberGroupId = null;
  #expanded = new Set();
  #draggedGroupId = null;
  #resizeStart = null;
  #editingKey = null;
  #editWidth = null;
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
    this.classList.add("cm-editor", "cm-data-ui");
    installDataEditorStyle(this.ownerDocument);
    if (!this.hasChildNodes()) this.#renderShell();
    this.#bind();
    this.ownerDocument.addEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#subscribe();
    this.#render();
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#cancelHover();
    this.#rowView?.destroy(); this.#rowView = null;
    this.#annotationEditor?.destroy();
    this.#annotationEditor = null;
    this.querySelector("[data-annotation-editor]")?.replaceChildren();
  }

  get chart() { return this.#chart; }

  set chart(value) {
    if (value === this.#chart) return;
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#chart = value || null;
    this.#invalidateData({ replace: true });
    this.#subscribe();
    this.#render();
  }

  get value() { return this.#chart?.data?.(); }

  /** Open a panel's annotation data from the plot or a host application. */
  editAnnotations(panelUid) {
    this.hidden = false;
    this.#kind = "annotations";
    this.#selected.clear();
    this.querySelectorAll("[data-tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.tab === "data")));
    this.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== "data"; });
    updateSegmentedControl(this, "data-kind", "annotations");
    this.#renderData();
    if (panelUid) this.#annotationEditor?.select(panelUid);
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true }));
    return this;
  }

  /** Replace any declarative fallback content with the packaged editor UI. */
  reset() {
    this.#appearanceView = null;
    this.#rowView?.destroy(); this.#rowView = null;
    this.#annotationEditor?.destroy();
    this.#annotationEditor = null;
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
      <div data-editor-error class="cm-data-error" role="alert" hidden></div>
      <section data-panel="data" class="cm-editor__panel">
        <div class="cm-editor__toolbar cm-data-toolbar">
          ${segmentedControlMarkup({ label: "Data type", attribute: "data-kind", value: this.#kind,
            items: [["groups", "Groups"], ["genes", "Genes"], ["links", "Links"], ["annotations", "Annotations"]] })}
          ${segmentedControlMarkup({ label: "Gene view", attribute: "data-gene-view-kind", value: this.#geneView,
            items: [["tree", "By locus"], ["groups", "By group"], ["list", "List"]], attributes: { "data-gene-view": true, hidden: true } })}
          <button type="button" data-command="toggle-tree" hidden>Expand visible</button>
          <button type="button" data-command="new-group">Create group…</button>
          <div data-annotation-toolbar class="cm-editor__annotation-toolbar" hidden></div>
          <span data-search-slot></span>
          <button type="button" data-command="clear-filter" aria-label="Clear filter" title="Clear filter" hidden>×</button>
        </div>
        <div data-annotation-editor class="cm-editor__annotation-editor" hidden></div>
        <div data-record-editor></div>
      </section>
      <section data-panel="appearance" class="cm-editor__panel" hidden>
        <div class="cm-editor__appearance-toolbar"><label class="cm-editor__search"><span class="cm-editor__sr-only">Find an appearance setting</span><input type="search" data-appearance-filter placeholder="Find a setting"></label><button type="button" data-command="clear-appearance-filter" aria-label="Clear appearance filter" title="Clear appearance filter" hidden>×</button></div>
        <div class="cm-editor__appearance" data-appearance></div>
      </section>`;
    const panel = createDataPanel(this.ownerDocument);
    panel.node.dataset.recordEditor = "";
    panel.tools.dataset.recordTools = "";
    panel.tools.innerHTML = `<div class="cm-editor__member-filter" data-member-filter hidden><span>Group: <strong data-member-label></strong></span><button type="button" data-command="clear-member-filter" aria-label="Clear group member filter" title="Clear group member filter">×</button></div>`;
    this.#selectionControls = createSelectionControls(panel, { selection: this.#selected,
      onChange: () => { this.#renderData(); this.#syncHighlight(); } });
    this.#selectionControls.actions.dataset.actions = "";
    panel.viewport.classList.add("cm-editor__table");
    panel.viewport.innerHTML = `<div data-head class="cm-editor__head"></div><div data-rows></div>`;
    this.querySelector("[data-record-editor]").replaceWith(panel.node);
    const search = createDataSearch(this.ownerDocument);
    search.input.dataset.filter = "";
    this.querySelector("[data-search-slot]").replaceWith(search.node);
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (change.type === "data.apply" || change.type === "data.replace" || change.type === "state.replace") {
        this.#invalidateData({ replace: change.type === "data.replace" });
      }
      if (change.type === "data.apply" || change.type === "data.replace" || change.type === "state.replace") this.#renderData();
      else if (change.type === "config.change" || change.type === "theme.change") this.#renderAppearance();
      if (change.type === "data.replace" || change.type === "state.replace" || (change.type === "data.apply" && change.operations?.some((op) => op.type.startsWith("tree.presentation.")))) this.#renderAppearance();
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
      if (event.target.matches("[data-filter]")) this.#setDataFilter(event.target.value);
      if (event.target.matches("[data-appearance-filter]")) {
        this.#appearanceFilter = event.target.value.trim().toLowerCase();
        this.#renderAppearance();
      }
    });
    this.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") this.#clearDataSelection();
      if (event.key === "Enter" && event.target.matches("[data-group-position]")) event.target.blur();
      const grip = event.target.closest("[data-reorder]");
      if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const uid = this.#id(grip.dataset.reorder);
        const index = this.#data().groups.findIndex((group) => group.uid === uid);
        this.#moveGroup(uid, index + (event.key === "ArrowUp" ? -1 : 1));
      }
    });
    this.addEventListener("focusout", (event) => {
      if (!event.target.matches("[data-edit]")) return;
      const editingKey = this.#editingKey;
      globalThis.setTimeout(() => {
        if (editingKey && this.#editingKey === editingKey && !this.contains(document.activeElement)) {
          this.#editWidth = null;
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

  }

  #click(event) {
    const checkbox = event.target.closest("[data-select], [data-select-row]");
    if (checkbox) {
      this.#selectRow(checkbox.dataset.selectRow ?? this.#id(checkbox.dataset.select), checkbox.checked, event.shiftKey);
      this.#renderData(); this.#syncHighlight(); return;
    }
    const edit = event.target.closest("[data-focus-edit]");
    if (edit) {
      event.preventDefault();
      this.#editingKey = this.#editKey(edit.dataset.focusEdit, edit.dataset.id);
      const label = edit.closest(".cm-editor__editable-field")?.querySelector(".cm-editor__editable-label");
      this.#editWidth = label?.getBoundingClientRect().width ?? null;
      this.#renderData();
      const input = [...this.querySelectorAll("[data-edit]")].find((node) => node.dataset.edit === edit.dataset.focusEdit && node.dataset.id === edit.dataset.id);
      if (input) {
        const focus = () => { input.focus({ preventScroll: true }); input.select(); };
        focus();
        // WebKit can restore the removed button's focus at the end of the click.
        queueMicrotask(() => { if (input.isConnected && this.ownerDocument.activeElement !== input) focus(); });
      }
      return;
    }
    const sort = event.target.closest("[data-sort]");
    if (sort) {
      const current = this.#sort[this.#kind];
      const key = sort.dataset.sort;
      this.#sort[this.#kind] = { key, direction: current?.key === key ? -current.direction : 1 };
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
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
    const row = event.target.closest(".cm-editor__row, .cm-editor__tree-row");
    if (row && !event.target.closest("input, select, button")) {
      const parent = row.querySelector("[data-select-row]");
      const id = parent?.dataset.selectRow ?? this.#id(row.dataset.id);
      this.#selectRow(id, parent ? !parent.checked : !this.#selected.has(id), event.shiftKey);
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
      if (tab === "appearance") this.#renderAppearance(); else this.#renderData();
      return;
    }
    const kind = button.dataset.kind;
    if (kind) {
      this.#kind = kind;
      if (kind !== "genes") this.#memberGroupId = null;
      this.#selected.clear();
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      updateSegmentedControl(this, "data-kind", kind);
      this.#renderData();
      return;
    }
    const geneView = button.dataset.geneViewKind;
    if (geneView) {
      this.#geneView = geneView;
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      updateSegmentedControl(this, "data-gene-view-kind", geneView);
      this.#renderData();
      return;
    }
    if (button.dataset.removeRecord) {
      this.#removeRecords(button.dataset.removeRecord, [this.#id(button.dataset.id)]);
      return;
    }
    const command = button.dataset.command;
    if (command === "remove-loci" || command === "remove-clusters") {
      const kind = command === "remove-loci" ? "loci" : "clusters";
      this.#removeRecords(kind, this.#selectedParents(kind));
      return;
    }
    if (command === "delete" || command === "delete-groups") {
      if (command === "delete-groups") this.#deleteSelected("groups", this.#selectedGroups().map((group) => group.uid));
      else this.#deleteSelected();
    } else if (command === "new-group" || command === "new-group-for-selection") {
      const label = window.prompt("Name for the new homology group");
      if (label?.trim()) {
        const geneIds = command === "new-group-for-selection" ? [...this.#selected] : [];
        if (geneIds.length) this.#selected.clear();
        this.#apply({ type: "groups.create", group: { uid: this.#nextGroupUid(), label: label.trim() }, geneIds });
      }
    } else if (command === "assign") {
      const select = this.querySelector("[data-assign-group]");
      if (select?.value) this.#apply({ type: "groups.assignGenes", groupId: this.#groupId(select.value), geneIds: [...this.#selected] });
    } else if (command === "unassign") {
      this.#apply({ type: "groups.unassignGenes", geneIds: [...this.#selected] });
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
        const sourceIds = this.#selectedGroups().map((group) => group.uid);
        this.#selected.clear();
        this.#apply({ type: "groups.merge", targetId, sourceIds });
      }
    } else if (command === "view-members") {
      const groupId = this.#selectedGroups()[0]?.uid;
      if (groupId !== undefined) this.#viewGroupMembers(groupId);
    } else if (command === "undo") {
      this.#chart?.undo?.();
    } else if (command === "redo") {
      this.#chart?.redo?.();
    } else if (command === "toggle-tree") {
      this.#toggleTree();
    } else if (command === "clear-filter") {
      this.#setDataFilter("");
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
    if (target.matches("[data-select-row]")) {
      const row = this.#rows().find((row) => row.key === target.dataset.selectRow);
      if (!row || row.selectIds.every((id) => this.#selected.has(id)) === target.checked) return;
      this.#selectRow(row.key, target.checked, false);
      this.#renderData(); this.#syncHighlight(); return;
    }
    if (target.matches("[data-select]")) {
      const id = this.#id(target.dataset.select);
      if (this.#selected.has(id) === target.checked) return;
      this.#selectRow(id, target.checked, false);
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
    if (target.matches("[data-batch-colour]")) {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { colour: target.value } });
      return;
    }
    if (target.matches("[data-batch-visibility]") && target.value) {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { hidden: target.value === "hide" } });
      target.value = "";
      return;
    }
    if (target.matches("[data-group-position]") && target.reportValidity()) this.#moveGroup(this.#selectedGroups()[0]?.uid, Number(target.value) - 1);
    if (target.matches("[data-config]")) this.#setConfig(target);
  }

  #apply(operation, control) {
    if (!this.#chart?.patch) return false;
    return this.#runEdit(() => this.#chart.patch([operation]), control);
  }

  #edit(input) {
    const [type, field] = input.dataset.edit.split(":");
    const id = this.#id(input.dataset.id);
    let value = input.value.trim();
    if (field === "identity") value = Number(value) / 100;
    const operationType = type === "cluster" ? "clusters.update" : type === "locus" ? "loci.update" : `${type}s.update`;
    const changeField = type === "cluster" || type === "locus" ? "name" : field;
    this.#editWidth = null;
    this.#editingKey = null;
    if (value || field === "identity" || field === "subtitle" || field === "label") return this.#apply({ type: operationType, ids: [id], changes: { [changeField]: value } }, input);
    this.#renderData();
  }

  #setConfig(input) {
    if (!this.#chart?.config) return;
    const keys = input.dataset.config.split(".");
    const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    let config = value;
    for (const key of keys.slice().reverse()) config = { [key]: config };
    this.#runEdit(() => this.#chart.config(config), input);
  }

  #cancelEdit() {
    this.#editWidth = null;
    this.#editingKey = null;
    this.#renderData();
  }

  #invalidateData({ replace = false } = {}) {
    // Patches can mutate data in place; invalidate all derived state together.
    this.#dataCache = null;
    this.#rowsCache = null;
    this.#selectionData = null;
    this.#annotationEditor?.invalidate({ replace });
    if (replace) {
      this.#selected.clear(); this.#expanded.clear(); this.#editWidth = null;
      this.#editingKey = null; this.#memberGroupId = null;
      this.#initializeExpanded();
    }
  }

  #data() { return this.#chart?.visibleData?.() || this.#chart?.data?.() || null; }

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
    for (const cluster of data.clusters || []) {
      remember(cluster);
      for (const locus of cluster.loci || []) {
        remember(locus);
        for (const gene of locus.genes || []) {
          remember(gene);
          geneById.set(String(gene.uid), gene);
          genes.push({ gene, locus, cluster });
        }
      }
    }
    for (const link of data.links || []) remember(link);
    this.#dataCache = { data, ids, groups, groupById, genes, geneById };
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
    const rows = new Map(this.#rows().map((row) => [row.key ?? row.id, row]));
    this.#selected.select(id, checked, { range, orderedIds: [...rows.keys()],
      idsFor: (key) => rows.get(key).selectIds || [rows.get(key).id] });
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
    const key = JSON.stringify([this.#kind, this.#geneView, this.#filter, this.#memberGroupId, this.#sort, [...this.#expanded]]);
    if (this.#rowsCache?.data === data && this.#rowsCache.key === key) return this.#rowsCache.rows;
    const rows = this.#computeRows();
    this.#rowsCache = { data, key, rows }; return rows;
  }

  #computeRows() {
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
    return this.#sortRows(genes.map(({ gene, locus, cluster }) => this.#geneRow(gene, locus, cluster, groups)));
  }

  #treeRows(data, groups, visible, needle) {
    const visibleIds = new Set(visible.map(({ gene }) => gene.uid));
    const rows = [];
    for (const cluster of data.clusters) {
      const loci = cluster.loci.map((locus) => ({ locus, genes: locus.genes.filter((gene) => visibleIds.has(gene.uid)) }))
        .filter(({ locus, genes }) => genes.length || (!needle && !this.#memberGroupId && !locus.genes.length));
      if (!loci.length && (cluster.loci.length || needle || this.#memberGroupId)) continue;
      if (loci.length === 1) {
        const { locus, genes } = loci[0];
        const key = `cluster-locus:${cluster.uid}:${locus.uid}`;
        const open = Boolean(needle) || this.#expanded.has(key);
        rows.push({ type: "cluster-locus", key, cluster, locus, label: labelFor(cluster, cluster.uid), locusLabel: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open });
        if (open) rows.push(...genes.map((gene) => this.#geneRow(gene, locus, cluster, groups, 1)));
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
        if (locusOpen) rows.push(...genes.map((gene) => this.#geneRow(gene, locus, cluster, groups, 2)));
      }
    }
    return rows;
  }

  #geneRow(gene, locus, cluster, groups, depth = null) {
    return { ...(depth === null ? {} : { type: "gene", depth }), id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(gene.uid), "Ungrouped"), colour: gene.colour || groups.get(gene.uid)?.colour };
  }

  #groupTreeRows(data, groups, visible, needle) {
    const entries = new Map(visible.flatMap(({ gene, locus, cluster }) => {
      const entry = { gene, locus, cluster };
      return [[gene.uid, entry], [String(gene.uid), entry]];
    }));
    const buckets = [
      ...(data.groups || []).map((group) => ({ group, key: `gene-group:${group.uid}`, label: labelFor(group, group.uid), genes: (group.genes || []).map((id) => entries.get(id)).filter(Boolean) })),
      { key: "gene-group:ungrouped", label: "Ungrouped", genes: visible.filter(({ gene }) => !groups.has(gene.uid)) },
    ];
    const rows = [];
    for (const bucket of buckets) {
      if (!bucket.genes.length) continue;
      const open = Boolean(needle) || this.#expanded.has(bucket.key);
      rows.push({ type: "gene-group", group: bucket.group, key: bucket.key, label: bucket.label, count: bucket.genes.length, selectIds: bucket.genes.map(({ gene }) => gene.uid), open });
      if (open) rows.push(...bucket.genes.map(({ gene, locus, cluster }) => this.#geneRow(gene, locus, cluster, groups, 1)));
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

  #setDataFilter(text) {
    if (this.#kind === "annotations") this.#annotationEditor?.setFilter(text);
    else {
      this.#filter = text.trim().toLowerCase();
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
    }
    this.#renderData();
  }

  #clearDataSelection() {
    if (this.#kind === "annotations") this.#annotationEditor?.clearSelection();
    else { this.#selected.clear(); this.#renderData(); this.#syncHighlight(); }
  }

  #renderData() {
    if (this.querySelector('[data-panel="data"]')?.hidden) return;
    const annotations = this.#kind === "annotations";
    const annotationHost = this.querySelector("[data-annotation-editor]");
    if (!annotationHost) return;
    annotationHost.hidden = !annotations;
    this.querySelector("[data-annotation-toolbar]").hidden = !annotations;
    const search = this.querySelector("[data-filter]");
    search.value = annotations ? this.#annotationEditor?.filter || "" : this.#filter;
    search.placeholder = annotations ? "Find a cluster" : "Search names, labels, loci, or clusters";
    this.querySelector("[data-record-editor]").hidden = annotations;
    if (annotations) {
      for (const selector of ["[data-gene-view]", "[data-member-filter]", '[data-command="new-group"]',
        '[data-command="toggle-tree"]']) this.querySelector(selector).hidden = true;
      if (!this.#annotationEditor) {
        this.#annotationEditor = createAnnotationDataControls({ document: this.ownerDocument,
          embedded: true,
          getData: () => this.#chart?.data?.() || { clusters: [] },
          getClusters: () => this.#data()?.clusters || [], patch: (operations) => this.#chart.patch(operations),
          annotationApi: { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale, validateAnnotationPanels },
        });
        annotationHost.append(this.#annotationEditor.node);
        this.querySelector("[data-annotation-toolbar]").append(this.#annotationEditor.toolbar);
      } else this.#annotationEditor.update();
      search.value = this.#annotationEditor.filter;
      this.querySelector('[data-command="clear-filter"]').hidden = !this.#annotationEditor.filter;
      return;
    }
    const data = this.#data();
    const head = this.querySelector("[data-head]");
    const list = this.querySelector("[data-rows]");
    const actions = this.querySelector("[data-actions]");
    if (!data) {
      this.#rowView?.destroy(); this.#rowView = null;
      setMarkup(head, ""); list.textContent = "Set the chart property to edit a ClusterMap chart.";
      this.#selectionControls.update({ ids: [], summary: "No chart attached.", noun: this.#kind.slice(0, -1) });
      setMarkup(actions, "");
      return;
    }
    const geneView = this.querySelector("[data-gene-view]");
    const memberFilter = this.querySelector("[data-member-filter]");
    const memberGroup = data.groups.find((group) => group.uid === this.#memberGroupId);
    if (!memberGroup) this.#memberGroupId = null;
    const rows = this.#rows();
    memberFilter.hidden = !memberGroup || this.#kind !== "genes";
    this.querySelector("[data-record-tools]").hidden = memberFilter.hidden;
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
    const columns = isTree ? [{ label: "" }, { label: "" }, { label: this.#geneView === "groups" ? "Group / gene" : "Cluster / locus / gene" }, { label: "Group" }, { label: "Colour" }]
      : this.#kind === "groups" ? [{ label: "" }, { label: "↕" }, { label: "Group" }, { label: "Legend label" }, { label: "Genes" }, { label: "" }, { label: "Colour" }]
      : this.#kind === "links" ? [{ label: "" }, { label: "Source", sort: "source" }, { label: "Target", sort: "target" }, { label: "Identity", sort: "identity" }, { label: "Endpoint groups", sort: "groups" }, { label: "Link label", sort: "label" }, { label: "" }, { label: "Colour" }]
        : [{ label: "" }, { label: "Gene", sort: "label" }, { label: "Locus", sort: "locus" }, { label: "Cluster", sort: "cluster" }, { label: "Group", sort: "group" }, { label: "Colour" }];
    const sort = this.#sort[this.#kind];
    head.className = `cm-data-head cm-editor__head cm-editor__head--${isTree ? "tree" : this.#kind}`;
    setMarkup(head, columns.map(({ label, sort: key }, index) => {
      if (index === 0) return dataCell("", true);
      if (!key) return `<span class="cm-data-cell">${label}</span>`;
      const active = sort?.key === key;
      const direction = active && sort.direction < 0 ? "descending" : "ascending";
      return `<button type="button" class="cm-data-cell cm-editor__sort" data-sort="${key}" aria-label="Sort by ${label}, ${direction}" title="Sort by ${label}">${label}<span aria-hidden="true">${active ? (sort.direction < 0 ? "↓" : "↑") : "↕"}</span></button>`;
    }).join(""));
    list.className = `cm-editor__rows cm-editor__rows--${isTree ? "tree" : this.#kind}`;
    const table = this.querySelector(".cm-editor__table");
    if (!this.#rowView) {
      list.replaceChildren();
      const markup = new WeakMap();
      const build = (row, html = row.type ? this.#treeRowMarkup(row) : this.#rowMarkup(row)) => {
        const template = this.ownerDocument.createElement("template"); template.innerHTML = html;
        const node = template.content.firstElementChild;
        const parentCheckbox = node.querySelector("[data-select-row]");
        if (parentCheckbox) parentCheckbox.indeterminate = parentCheckbox.getAttribute("aria-checked") === "mixed";
        for (const control of node.querySelectorAll("[data-edit]")) bindEditableField(control, {
          commit: () => this.#edit(control), cancel: () => this.#cancelEdit(),
        });
        markup.set(node, html); return node;
      };
      this.#rowView = createVirtualRows({ viewport: table, container: list,
        key: (row) => `${this.#kind}:${row.type || "row"}:${row.key ?? row.id}`,
        headerHeight: () => head.offsetHeight, createRow: build,
        createEmpty: () => { const message = this.ownerDocument.createElement("p"); message.className = "cm-editor__empty"; message.textContent = "No records match the filter."; return message; },
        updateRow: (node, row) => {
          const html = row.type ? this.#treeRowMarkup(row) : this.#rowMarkup(row);
          return markup.get(node) === html ? node : build(row, html);
        } });
    }
    if (this.#selectionData !== data) {
      const cache = this.#cache();
      const records = this.#kind === "genes" ? cache.geneById.values() : this.#kind === "links" ? data.links : data.groups;
      this.#selected.prune([...records].map((record) => record.uid)); this.#selectionData = data;
    }
    this.#rowView.setRows(rows);
    const visibleGenes = isTree ? new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" ? [row.id] : []))).size : rows.length;
    const summaryText = isTree
      ? `${rows.filter((row) => row.type !== "gene").length.toLocaleString()} ${this.#geneView === "groups" ? "group" : "cluster/locus"} rows · ${visibleGenes.toLocaleString()} genes${this.#filter ? " matching search" : ""}.`
      : `${rows.length.toLocaleString()} visible ${this.#kind}${memberGroup && this.#kind === "genes" ? " in selected group" : ""}${this.#filter ? " matching search" : ""}.`;
    this.#selectionControls.update({ ids: this.#selectableIds(rows), summary: summaryText,
      noun: this.#kind.slice(0, -1), selectSuffix: isTree ? " genes" : "" });
    setMarkup(actions, this.#selected.size ? this.#actionsMarkup(this.#selected.size) : "");
    const position = actions.querySelector("[data-group-position]");
    if (position && position !== this.ownerDocument.activeElement) position.value = data.groups.findIndex((group) => group.uid === this.#selectedGroups()[0]?.uid) + 1;
  }

  #rowMarkup(row) {
    const selected = this.#selected.has(row.id);
    const box = dataCell(dataCheckboxMarkup({ label: `Select ${row.label || row.source}`, checked: selected,
      attributes: { "data-select": row.id } }), true);
    const visible = (type) => dataIconButtonMarkup({ label: row.hidden ? "Show" : "Hide", className: "cm-editor__visibility",
      attributes: { "data-visible": true, "data-type": type, "data-id": row.id, "data-hidden": String(row.hidden) },
      icon: `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle>${row.hidden ? '<path d="m4 4 16 16"></path>' : ""}</svg>` });
    const colour = (type) => dataCell(dataColourMarkup({ value: row.colour,
      attributes: { "data-colour": true, "data-type": type, "data-id": row.id } }));
    if (this.#kind === "groups") return `<div data-id="${escapeHtml(row.id)}" class="cm-data-row cm-editor__row cm-editor__row--groups ${selected ? "is-selected" : ""}">${box}<button type="button" class="cm-data-icon-button cm-editor__reorder" draggable="true" data-reorder="${escapeHtml(row.id)}" aria-label="Reorder ${escapeHtml(row.label)}; use Arrow Up or Arrow Down to move it" title="Drag to reorder; Arrow Up or Arrow Down moves one place">⠿</button>${editableField("group:label", row.id, row.label, "Group name", row.label || "group", this.#isEditing("group:label", row.id))}${editableField("group:subtitle", row.id, row.subtitle, "Add subtitle…", `${row.label || "group"} subtitle`, this.#isEditing("group:subtitle", row.id))}<span class="cm-data-cell">${row.count.toLocaleString()} genes</span>${visible("groups")}${colour("groups")}</div>`;
    if (this.#kind === "links") return `<div data-id="${escapeHtml(row.id)}" class="cm-data-row cm-editor__row cm-editor__row--links ${selected ? "is-selected" : ""}">${box}<span class="cm-data-cell" title="${escapeHtml(row.source)}">${escapeHtml(row.source)}</span><span class="cm-data-cell" title="${escapeHtml(row.target)}">${escapeHtml(row.target)}</span>${editableCell("link:identity", row.id, row.identity, "Identity")}<span class="cm-data-cell" title="${escapeHtml(row.groups)}">${escapeHtml(row.groups)}</span>${editableField("link:label", row.id, row.label, "Add label…", "link label", this.#isEditing("link:label", row.id))}${visible("links")}${colour("links")}</div>`;
    const tree = row.type === "gene";
    const classes = tree ? "cm-editor__tree-row cm-editor__tree-gene" : "cm-editor__row cm-editor__row--genes";
    const location = tree ? "" : `<span class="cm-data-cell" title="${escapeHtml(row.locus)}">${escapeHtml(row.locus)}</span><span class="cm-data-cell" title="${escapeHtml(row.cluster)}">${escapeHtml(row.cluster)}</span>`;
    return `<div data-id="${escapeHtml(row.id)}" class="cm-data-row ${classes} ${selected ? "is-selected" : ""}" style="--depth:${row.depth || 0}">${box}${tree ? '<span aria-hidden="true"></span>' : ""}${editableField("gene:label", row.id, row.label, "Gene label", row.label || "gene", this.#isEditing("gene:label", row.id))}${location}<span class="cm-data-cell" title="${escapeHtml(row.group)}">${escapeHtml(row.group)}</span>${colour("genes")}</div>`;
  }

  #treeRowMarkup(row) {
    if (row.type === "gene") return this.#rowMarkup(row);
    const arrow = dataIconButtonMarkup({ label: row.open ? "Collapse" : "Expand", icon: row.open ? "▾" : "▸",
      className: "cm-editor__tree-toggle", attributes: { "data-tree-toggle": row.key } });
    const selected = row.selectIds?.length && row.selectIds.every((id) => this.#selected.has(id));
    const select = dataCell(dataCheckboxMarkup({ label: `Select ${row.count.toLocaleString()} genes in ${row.label}`, checked: Boolean(selected),
      attributes: { "data-select-row": row.key, "aria-checked": !selected && row.selectIds?.some((id) => this.#selected.has(id)) ? "mixed" : String(Boolean(selected)) } }), true);
    const count = `<span class="cm-editor__tree-count">(${row.count.toLocaleString()})</span>`;
    const selectedIds = escapeHtml(JSON.stringify(row.selectIds || []));
    const remove = (kind, uid) => dataIconButtonMarkup({ label: `Remove ${kind === "loci" ? "locus" : "cluster"} from plot`, icon: "×",
      attributes: { "data-remove-record": kind, "data-id": uid } });
    if (row.type === "cluster-locus") {
      const clusterEditing = this.#isEditing("cluster:label", row.cluster.uid);
      const locusEditing = this.#isEditing("locus:label", row.locus.uid);
      return `<div data-select-ids="${selectedIds}" class="cm-data-row cm-editor__tree-row cm-editor__tree-parent ${selected ? "is-selected" : ""}">${select}${arrow}<div class="cm-editor__tree-combined ${clusterEditing || locusEditing ? "is-editing" : ""}">${editableField("cluster:label", row.cluster.uid, row.label, "Cluster name", row.label || "cluster", clusterEditing, true, this.#editWidth)}<span class="cm-editor__tree-separator">·</span>${editableField("locus:label", row.locus.uid, row.locusLabel, "Locus name", row.locusLabel || "locus", locusEditing, true, this.#editWidth)}${count}${remove("clusters", row.cluster.uid)}</div></div>`;
    }
    if (row.type === "gene-group") return `<div data-select-ids="${selectedIds}" class="cm-data-row cm-editor__tree-row cm-editor__tree-parent ${selected ? "is-selected" : ""}">${select}${arrow}<span class="cm-data-cell cm-editor__tree-group-label">${escapeHtml(row.label)} ${count}</span></div>`;
    const type = row.type === "cluster" ? "cluster" : "locus";
    const record = row[type];
    return `<div data-select-ids="${selectedIds}" class="cm-data-row cm-editor__tree-row cm-editor__tree-parent ${selected ? "is-selected" : ""}" style="--depth:${row.depth || 0}">${select}${arrow}<span class="cm-editor__tree-name-with-count">${editableField(`${type}:label`, record.uid, row.label, `${type} name`, row.label || type, this.#isEditing(`${type}:label`, record.uid), true)}${count}${remove(type === "cluster" ? "clusters" : "loci", record.uid)}</span></div>`;
  }

  #actionsMarkup(count) {
    const menu = dataActionMenuMarkup;
    const selectedGroups = this.#selectedGroups();
    const parentRemoval = this.#kind === "genes" && this.#geneView === "tree" && this.#chart?.remove;
    const loci = parentRemoval ? this.#selectedParents("loci") : [];
    const clusters = parentRemoval ? this.#selectedParents("clusters") : [];
    const focus = `<button type="button" data-command="focus">Focus in plot</button>`;
    const remove = (noun) => menu("Remove…", `<button type="button" data-command="delete" class="cm-editor__danger">Delete selected ${noun}</button>` +
      (loci.length ? `<button type="button" data-command="remove-loci">Entire loci (${loci.length})</button>` : "") +
      (clusters.length ? `<button type="button" data-command="remove-clusters">Entire clusters (${clusters.length})</button>` : "") +
      (this.#kind === "genes" && selectedGroups.length ? `<button type="button" data-command="delete-groups" title="Genes remain in the plot">Delete groups (${selectedGroups.length})</button>` : ""));
    if (this.#kind === "genes") {
      const options = (this.#data()?.groups || []).map((group) => `<option value="${escapeHtml(group.uid)}">${escapeHtml(labelFor(group, group.uid))}</option>`).join("");
      return focus + menu("Assign…", `<label>Move to <select data-assign-group><option value="">Choose a group…</option>${options}</select></label><button type="button" data-command="assign">Move</button><button type="button" data-command="unassign">Remove from groups</button><button type="button" data-command="new-group-for-selection">New group…</button>`) + this.#groupActionsMarkup(selectedGroups) + remove("genes");
    }
    const presentation = count > 1 ? menu("Edit…", `<input data-batch-label placeholder="Set label"><button type="button" data-command="batch-label">Set label</button><label title="Set colour"><span class="cm-editor__sr-only">Set colour</span>${dataColourMarkup({ value: "#888888", label: "Set colour", attributes: { "data-batch-colour": true } })}</label>${this.#kind === "links" ? `<input type="number" data-batch-identity min="0" max="100" step=".1" placeholder="Set identity (%)"><button type="button" data-command="batch-identity">Set identity</button>` : ""}<select data-batch-visibility aria-label="Set visibility"><option value="">Visibility…</option><option value="show">Show</option><option value="hide">Hide</option></select>`) : "";
    return focus + presentation + this.#groupActionsMarkup(selectedGroups) + remove(this.#kind);
  }

  #selectedGroups() {
    if (this.#kind === "groups") return (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid));
    if (this.#kind !== "genes" || this.#geneView !== "groups") return [];
    return this.#rows().filter((row) => row.type === "gene-group" && row.group?.genes?.length &&
      row.group.genes.every((id) => this.#selected.has(this.#id(id)))).map((row) => row.group);
  }

  #groupActionsMarkup(groups) {
    if (!groups.length) return "";
    return groups.length > 1
      ? dataActionMenuMarkup("Merge…", `<select data-merge-target><option value="">Choose group to keep…</option>${groups.map((group) => `<option value="${escapeHtml(group.uid)}">${escapeHtml(labelFor(group, group.uid))}</option>`).join("")}</select><button type="button" data-command="merge">Merge groups</button>`)
      : dataActionMenuMarkup("Group…", `<button type="button" data-command="view-members">View member genes</button><label>Position <input type="number" data-group-position required min="1" max="${this.#data()?.groups.length || 1}"></label>`);
  }

  #selectedParents(kind) {
    const clusters = this.#data()?.clusters || [];
    const records = kind === "loci" ? clusters.flatMap((cluster) => cluster.loci) : clusters;
    return records.filter((record) => {
      const genes = kind === "loci" ? record.genes : record.loci.flatMap((locus) => locus.genes);
      return genes.length && genes.every((gene) => this.#selected.has(gene.uid));
    }).map((record) => record.uid);
  }

  #removeRecords(kind, ids) {
    if (!ids.length || !window.confirm(`Remove ${ids.length} ${kind} and all their genes from the plot? This can be undone.`)) return;
    this.#runEdit(() => {
      this.#chart.remove({ [kind]: ids });
      this.#selected.clear();
      this.#renderData(); this.#syncHighlight();
    });
  }

  #deleteSelected(kind = this.#kind, ids = [...this.#selected]) {
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected ${kind}?${kind === "groups" ? " Their genes will remain in the plot." : ""}`)) return;
    const type = `${kind}.delete`;
    this.#selected.clear();
    this.#apply({ type, ids });
  }

  #moveGroup(uid, index) {
    const ids = this.#data().groups.map((group) => group.uid), from = ids.indexOf(uid);
    if (from < 0 || !Number.isFinite(index)) return;
    const to = Math.max(0, Math.min(ids.length - 1, Math.trunc(index)));
    if (to === from) return;
    ids.splice(from, 1);
    ids.splice(to, 0, uid);
    this.#apply({ type: "groups.reorder", ids });
  }

  #viewGroupMembers(groupId) {
    this.#memberGroupId = this.#id(groupId);
    this.#kind = "genes";
    this.#geneView = "list";
    this.#selected.clear();
    this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
    updateSegmentedControl(this, "data-kind", "genes");
    updateSegmentedControl(this, "data-gene-view-kind", "list");
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
    const ids = this.#data().groups.map((group) => group.uid);
    const from = ids.indexOf(uid), target = ids.indexOf(targetUid);
    if (from < 0 || target < 0 || uid === targetUid) return;
    this.#moveGroup(uid, target + Number(after) - Number(from < target));
  }

  #finishGroupDrag() {
    this.#draggedGroupId = null;
    this.querySelectorAll(".cm-editor__drop-target").forEach((node) => node.classList.remove("cm-editor__drop-target"));
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
    const requestedConfig = this.#chart?.config?.();
    const config = requestedConfig && figureConfig(requestedConfig);
    if (config) applyTheme(this, resolveTheme(config.plot.theme));
    if (!container) return;
    container.hidden = !config;
    if (!config || this.querySelector('[data-panel="appearance"]')?.hidden) return;
    const clear = this.querySelector('[data-command="clear-appearance-filter"]');
    if (clear) clear.hidden = !this.#appearanceFilter;
    if (!this.#appearanceView) {
      this.#appearanceView = createAppearanceControls({ document: this.ownerDocument,
        patch: (ops) => this.#chart.patch(ops), preview: (ops) => this.#chart.previewTreePresentation(ops),
        rotate: (uid) => this.#chart.rotateTreeNode(uid) });
      container.append(this.#appearanceView.node);
    }
    this.#appearanceView.update({ config, tree: this.#chart.data()?.tree, filter: this.#appearanceFilter,
      expanded: this.#appearanceAdvanced });
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
