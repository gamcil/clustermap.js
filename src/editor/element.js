import { createDataPanel, createSelectionControls, installDataEditorStyle } from "../dataEditorUi.mjs";
import { RowSelection } from "../rowSelection.mjs";
import { createVirtualRows, DATA_ROW_HEIGHT } from "../virtualRows.mjs";
import { createAnnotationDataControls } from "../annotationDataControls.mjs";
import { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale, validateAnnotationPanels } from "../annotations.mjs";
import { createActionRunner, createTemplate } from "../uiControls.mjs";
import { applyTheme, resolveTheme, figureConfig } from "../theme.mjs";
import { createDataHeader } from "./dataTableControls.mjs";
import { createEditorRow } from "./dataRows.mjs";
import { createAppearanceControls } from "./appearanceControls.mjs";
import { defineEditableField } from "./components/editable-field/editable-field.js";
import { defineSelectionBar } from "./components/selection-bar/selection-bar.js";
import { defineActionMenu } from "./components/action-menu/action-menu.js";
import { defineViewSwitcher } from "./components/view-switcher/view-switcher.js";
import { defineSearchField } from "./components/search-field/search-field.js";
import { defineTabs } from "./components/tabs/tabs.js";
import { defineRecordActions } from "./components/record-actions/record-actions.js";
import { textAsset } from "./shared/textAsset.js";

const shellTemplate = createTemplate(await textAsset(new URL("./element.html", import.meta.url)));

const memberFilterTemplate = createTemplate(`<div class="cm-editor__member-filter" data-member-filter hidden>
  <span>Group: <strong data-member-label></strong></span><button type="button" data-command="clear-member-filter" aria-label="Clear group member filter" title="Clear group member filter">×</button>
</div>`);
const tableTemplate = createTemplate('<div data-head class="cm-editor__head"></div><div data-rows></div>');
const emptyTemplate = createTemplate('<p class="cm-editor__empty">No records match the filter.</p>');

const tagName = "clinker-editor";
const HTMLElementBase = globalThis.HTMLElement || class {};

const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;
const groupMap = (data) => new Map((data?.groups || []).flatMap((group) =>
  (group.genes || []).flatMap((id) => [[id, group], [String(id), group]])
));
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
  #updateHeader = null;
  #actions = null;
  #selectionControls = null;
  #rowsCache = null;
  #selectionData = null;
  #filter = "";
  #memberGroupId = null;
  #expanded = new Set();
  #draggedGroupId = null;
  #resizeStart = null;
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
    defineEditableField(); defineSelectionBar(); defineActionMenu(); defineViewSwitcher(); defineSearchField(); defineTabs(); defineRecordActions();
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
    this.#disposeRows();
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
    this.querySelector("[data-editor-tabs]")?.setAttribute("value", "data");
    this.#renderData();
    if (panelUid) this.#annotationEditor?.select(panelUid);
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true }));
    return this;
  }

  /** Reveal the plot's selected loci or clusters in the gene hierarchy. */
  editSelection({ kind, ids }) {
    this.hidden = false;
    this.#kind = "genes"; this.#geneView = "tree";
    this.#filter = ""; this.#memberGroupId = null;
    const selected = new Set(ids), genes = [];
    for (const cluster of this.#data()?.clusters || []) {
      const loci = cluster.loci.filter((locus) => selected.has(kind === "clusters" ? cluster.uid : locus.uid));
      if (!loci.length) continue;
      this.#expanded.add(`cluster:${cluster.uid}`);
      this.#expanded.add(`cluster-locus:${cluster.uid}:${cluster.loci[0]?.uid}`);
      for (const locus of loci) {
        this.#expanded.add(`locus:${locus.uid}`);
        genes.push(...locus.genes.map((gene) => gene.uid));
      }
    }
    this.#selected.clear(); this.#selected.setMany(genes); this.#rowsCache = null;
    this.querySelector("[data-editor-tabs]")?.setAttribute("value", "data");
    this.#renderData(); this.#syncHighlight();
    const first = this.#rows().findIndex((row) => row.selectIds?.some((id) => this.#selected.has(id)));
    this.querySelector(".cm-editor__table").scrollTop = Math.max(0, first) * DATA_ROW_HEIGHT;
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true }));
    return this;
  }

  /** Replace any declarative fallback content with the packaged editor UI. */
  reset() {
    this.#appearanceView = null;
    this.#disposeRows();
    this.#annotationEditor?.destroy();
    this.#annotationEditor = null;
    this.replaceChildren();
    this.#renderShell();
    this.#render();
    return this;
  }

  #renderShell() {
    this.replaceChildren(shellTemplate(this.ownerDocument));
    const panel = createDataPanel(this.ownerDocument);
    panel.node.dataset.recordEditor = "";
    panel.tools.dataset.recordTools = "";
    panel.tools.append(memberFilterTemplate(this.ownerDocument));
    this.#selectionControls = createSelectionControls(panel, { selection: this.#selected,
      onChange: () => { this.#renderData(); this.#syncHighlight(); } });
    this.#selectionControls.actions.dataset.actions = "";
    this.#actions = this.ownerDocument.createElement("clinker-record-actions");
    this.#actions.addEventListener("selection-action", (event) => this.#command(event.detail.command, event.detail.value));
    this.#selectionControls.actions.append(this.#actions);
    panel.viewport.classList.add("cm-editor__table");
    panel.viewport.append(tableTemplate(this.ownerDocument));
    this.#updateHeader = createDataHeader(this.ownerDocument, panel.viewport.querySelector("[data-head]"));
    this.querySelector("[data-record-editor]").replaceWith(panel.node);
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
    this.addEventListener("value-change", (event) => {
      if (event.target.matches("[data-editor-tabs]")) {
        if (event.detail.value === "appearance") this.#renderAppearance(); else this.#renderData();
        return;
      }
      if (event.target.matches("[data-kind-picker]")) {
        this.#kind = event.detail.value;
        if (this.#kind !== "genes") this.#memberGroupId = null;
        this.#selected.clear();
      } else if (event.target.matches("[data-gene-view]")) this.#geneView = event.detail.value;
      else return;
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.#renderData();
    });
    this.addEventListener("pointerdown", (event) => {
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
    });
    this.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") this.#clearDataSelection();
      const grip = event.target.closest("[data-reorder]");
      if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const uid = this.#id(grip.dataset.reorder);
        const index = this.#data().groups.findIndex((group) => group.uid === uid);
        this.#moveGroup(uid, index + (event.key === "ArrowUp" ? -1 : 1));
      }
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
    if (event.target.closest("clinker-editable-field")) return;
    const checkbox = event.target.closest("[data-select], [data-select-row]");
    if (checkbox) {
      this.#selectRow(checkbox.dataset.selectRow ?? this.#id(checkbox.dataset.select), checkbox.checked, event.shiftKey);
      this.#renderData(); this.#syncHighlight(); return;
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
    if (button.dataset.removeRecord) {
      this.#removeRecords(button.dataset.removeRecord, [this.#id(button.dataset.id)]);
      return;
    }
    this.#command(button.dataset.command);
  }

  #command(command, value) {
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
      if (value) this.#apply({ type: "groups.assignGenes", groupId: this.#groupId(value), geneIds: [...this.#selected] });
    } else if (command === "unassign") {
      this.#apply({ type: "groups.unassignGenes", geneIds: [...this.#selected] });
    } else if (command === "focus") {
      this.#focusSelected();
    } else if (command === "batch-label") {
      if (value?.trim()) {
        this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { label: value.trim() } });
      }
    } else if (command === "batch-identity") {
      const identity = Number(value);
      if (Number.isFinite(identity) && identity >= 0 && identity <= 100) {
        this.#apply({ type: "links.update", ids: [...this.#selected], changes: { identity: identity / 100 } });
      }
    } else if (command === "merge") {
      const targetId = this.#groupId(value);
      if (targetId !== undefined) {
        const sourceIds = this.#selectedGroups().map((group) => group.uid);
        this.#selected.clear();
        this.#apply({ type: "groups.merge", targetId, sourceIds });
      }
    } else if (command === "batch-colour" || command === "batch-visibility") {
      const changes = command === "batch-colour" ? { colour: value } : { hidden: value === "hide" };
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes });
    } else if (command === "group-position") {
      this.#moveGroup(this.#selectedGroups()[0]?.uid, value);
    } else if (command === "view-members") {
      const groupId = this.#selectedGroups()[0]?.uid;
      if (groupId !== undefined) this.#viewGroupMembers(groupId);
    } else if (command === "undo") {
      this.#chart?.undo?.();
    } else if (command === "redo") {
      this.#chart?.redo?.();
    } else if (command === "toggle-tree") {
      this.#toggleTree();
    } else if (command === "clear-member-filter") {
      this.#memberGroupId = null;
      this.#renderData();
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
  }

  #apply(operation, control) {
    if (!this.#chart?.patch) return false;
    return this.#runEdit(() => this.#chart.patch([operation]), control);
  }

  #setConfig({ path, value }) {
    if (!this.#chart?.config) return false;
    const keys = path.split(".");
    let config = value;
    for (const key of keys.slice().reverse()) config = { [key]: config };
    return this.#runEdit(() => this.#chart.config(config));
  }

  #disposeRows() {
    const view = this.#rowView; this.#rowView = null;
    view?.destroy();
  }

  #invalidateData({ replace = false } = {}) {
    // Patches can mutate data in place; invalidate all derived state together.
    this.#dataCache = null;
    this.#rowsCache = null;
    this.#selectionData = null;
    this.#annotationEditor?.invalidate({ replace });
    if (replace) {
      this.#disposeRows();
      this.#selected.clear(); this.#expanded.clear(); this.#memberGroupId = null;
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
    this.querySelector("[data-kind-picker]").value = this.#kind;
    this.querySelector("[data-gene-view]").value = this.#geneView;
    annotationHost.hidden = !annotations;
    this.querySelector("[data-annotation-toolbar]").hidden = !annotations;
    const search = this.querySelector("[data-filter]");
    search.value = annotations ? this.#annotationEditor?.filter || "" : this.#filter;
    search.setAttribute("placeholder", annotations ? "Find a cluster" : "Search names, labels, loci, or clusters");
    this.querySelector("[data-record-editor]").hidden = annotations;
    if (annotations) {
      this.#disposeRows();
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
      return;
    }
    const data = this.#data();
    const head = this.querySelector("[data-head]");
    const list = this.querySelector("[data-rows]");
    if (!data) {
      this.#disposeRows();
      this.#updateHeader([], null); list.textContent = "Set the chart property to edit a ClusterMap chart.";
      this.#selectionControls.update({ ids: [], summary: "No chart attached.", noun: this.#kind.slice(0, -1) });
      this.#actions.state = { kind: this.#kind, count: 0, groups: [], allGroups: [], loci: [], clusters: [] };
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
    this.#updateHeader(columns, sort);
    list.className = `cm-editor__rows cm-editor__rows--${isTree ? "tree" : this.#kind}`;
    const table = this.querySelector(".cm-editor__table");
    if (this.#rowView?.kind !== this.#kind) this.#disposeRows();
    if (!this.#rowView) {
      const kind = this.#kind;
      list.replaceChildren();
      const components = new WeakMap();
      const updateRow = (node, row) => components.get(node).update(row, this.#selected);
      this.#rowView = { kind, ...createVirtualRows({ viewport: table, container: list,
        key: (row) => `${kind}:${row.type || "row"}:${row.key ?? row.id}`,
        headerHeight: () => head.offsetHeight,
        createRow: (row) => {
          const component = createEditorRow(this.ownerDocument, kind, row.type,
            (type, id, changes, control) => this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes }, control));
          components.set(component.node, component); return updateRow(component.node, row);
        },
        createEmpty: () => emptyTemplate(this.ownerDocument).firstElementChild,
        disposeRow: (node) => components.get(node).destroy(), updateRow }) };
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
    const parentRemoval = this.#kind === "genes" && this.#geneView === "tree" && this.#chart?.remove;
    this.#actions.state = { kind: this.#kind, count: this.#selected.size, groups: this.#selectedGroups(), allGroups: data.groups,
      loci: parentRemoval ? this.#selectedParents("loci") : [], clusters: parentRemoval ? this.#selectedParents("clusters") : [] };
  }

  #selectedGroups() {
    if (this.#kind === "groups") return (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid));
    if (this.#kind !== "genes" || this.#geneView !== "groups") return [];
    return this.#rows().filter((row) => row.type === "gene-group" && row.group?.genes?.length &&
      row.group.genes.every((id) => this.#selected.has(this.#id(id)))).map((row) => row.group);
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
    if (!this.#appearanceView) {
      this.#appearanceView = createAppearanceControls({ document: this.ownerDocument,
        patch: (ops) => this.#chart.patch(ops), preview: (ops) => this.#chart.previewTreePresentation(ops),
        rotate: (uid) => this.#chart.rotateTreeNode(uid) });
      this.#appearanceView.node.addEventListener("config-change", (event) => {
        if (this.#setConfig(event.detail) === false) event.preventDefault();
      });
      container.append(this.#appearanceView.node);
    }
    this.#appearanceView.update({ config, tree: this.#chart.data()?.tree });
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
