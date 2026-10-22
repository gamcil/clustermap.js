import { DATA_EDITOR_CSS } from "../../shared/styles.mjs";
import { RowSelection } from "../../../rowSelection.mjs";
import { DATA_ROW_HEIGHT } from "../../../virtualRows.mjs";
import { ANNOTATION_PALETTES, resolveAnnotationScale } from "../../../annotations.mjs";
import { defineAnnotationEditor } from "../annotation-editor/annotation-editor.js";
import { createActionRunner, createTemplate, upgradeProperty } from "../../../uiControls.mjs";
import { applyEditorTheme, editorThemeStyles } from "../../shared/theme.js";
import { defineRecordTable } from "../record-table/record-table.js";
import { DataPanelModel } from "./model.js";
import { defineSelectionBar } from "../selection-bar/selection-bar.js";
import { defineViewSwitcher } from "../view-switcher/view-switcher.js";
import { defineSearchField } from "../search-field/search-field.js";
import { defineRecordActions } from "../record-actions/record-actions.js";
import { textAsset } from "../../shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./data-panel.html", import.meta.url)),
  textAsset(new URL("./data-panel.css", import.meta.url)),
]);
const template = createTemplate(markup);

const HTMLElementBase = globalThis.HTMLElement || class {};

export class ClinkerDataPanelElement extends HTMLElementBase {
  #chart = null;
  #runEdit = createActionRunner((message) => {
    const status = this.shadowRoot.querySelector("[data-editor-error]");
    if (status) { status.textContent = message; status.hidden = !message; }
    if (this.#table) this.#table.error = message;
  });
  #annotationEditor = null;
  #unsubscribe = null;
  #editing = false;
  #pendingEdit = null;
  #kind = "groups";
  #geneView = "tree";
  #selected = new RowSelection();
  #table = null;
  #actions = null;
  #selectionBar = null;
  #model = new DataPanelModel();
  #filter = "";
  #memberGroupId = null;
  #expanded = new Set();
  #sort = {
    genes: { key: "label", direction: 1 },
    links: { key: "source", direction: 1 },
  };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.id = "cm-data-editor-style"; style.textContent = DATA_EDITOR_CSS + editorThemeStyles + css;
    root.append(style);
    this.#bind();
    upgradeProperty(this, "chart");
  }

  connectedCallback() {
    defineSelectionBar(); defineViewSwitcher(); defineSearchField(); defineRecordActions(); defineRecordTable(); defineAnnotationEditor();
    this.classList.add("cm-data-ui");
    if (!this.#table) this.#renderShell();
    this.#subscribe(); this.#syncTheme(); this.#refreshData();
    const edit = this.#pendingEdit; this.#pendingEdit = null; edit?.();
  }

  disconnectedCallback() {
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.#table?.reset();
    this.#chart?.highlight?.([]);
  }

  get chart() { return this.#chart; }
  set chart(value) {
    if (value === this.#chart) return;
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.#table?.cancelHover(); this.#chart?.highlight?.([]);
    this.#chart = value || null;
    this.#subscribe(); this.#syncTheme(); this.#refreshData({ replace: true });
  }

  #syncTheme() {
    applyEditorTheme(this, this.#chart?.config?.());
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (["data.apply", "data.replace", "state.replace"].includes(change.type)) {
        if (this.#editing) return;
        if (change.type === "state.replace") this.#syncTheme();
        this.#refreshData({ replace: change.type === "data.replace" });
      } else if (change.type === "config.change" || change.type === "theme.change") this.#syncTheme();
    });
  }

  editAnnotations(panelUid) {
    if (!this.isConnected) { this.#pendingEdit = () => this.editAnnotations(panelUid); return this; }
    this.#kind = "annotations";
    this.#selected.clear();
    this.#renderData();
    if (panelUid) this.#annotationEditor?.select(panelUid);
    return this;
  }

  editSelection({ kind, ids }) {
    if (!this.isConnected) {
      const selection = { kind, ids: [...ids] };
      this.#pendingEdit = () => this.editSelection(selection); return this;
    }
    this.#kind = "genes"; this.#geneView = "tree";
    this.#filter = ""; this.#memberGroupId = null;
    const selected = new Set(ids), genes = [];
    for (const row of this.#view().branches) {
      if (!selected.has(row[kind === "clusters" ? "cluster" : "locus"]?.uid)) continue;
      this.#expanded.add(row.key);
      if (row.parentKey) this.#expanded.add(row.parentKey);
      if (row.locus) genes.push(...row.selectIds);
    }
    this.#selected.clear(); this.#selected.setMany(genes);
    this.#renderData();
    const first = this.#view().rows.findIndex((row) => row.selectIds?.some((id) => this.#selected.has(id)));
    this.shadowRoot.querySelector(".cm-editor__table").scrollTop = Math.max(0, first) * DATA_ROW_HEIGHT;
    return this;
  }

  #renderShell() {
    this.shadowRoot.append(template(this.ownerDocument));
    this.#annotationEditor = this.shadowRoot.querySelector("clinker-annotation-editor");
    this.#table = this.shadowRoot.querySelector("clinker-record-table");
    this.#table.addEventListener("record-action", (event) => this.#recordAction(event));
    this.#selectionBar = this.shadowRoot.querySelector("clinker-selection-bar");
    this.#selectionBar.addEventListener("clear-selection", () => this.#clearDataSelection());
    this.#selectionBar.addEventListener("select-all", (event) => {
      this.#selected.setMany(event.detail.ids); this.#renderData();
    });
    this.#actions = this.shadowRoot.querySelector("clinker-record-actions");
    this.#actions.addEventListener("selection-action", (event) => this.#command(event.detail.command, event.detail.value));
  }

  #bind() {
    this.shadowRoot.addEventListener("click", (event) => {
      const command = event.target.closest("[data-command]")?.dataset.command;
      if (command) this.#command(command);
    });
    this.shadowRoot.addEventListener("value-change", (event) => {
      if (event.target.matches("[data-kind-picker]")) {
        this.#kind = event.detail.value;
        if (this.#kind !== "genes") this.#memberGroupId = null;
        this.#selected.clear();
      } else if (event.target.matches("[data-gene-view]")) this.#geneView = event.detail.value;
      else return;
      this.shadowRoot.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.#renderData();
    });
    this.shadowRoot.addEventListener("input", (event) => {
      if (event.target.matches("[data-filter]")) this.#setDataFilter(event.target.value);
    });
    this.shadowRoot.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") this.#clearDataSelection();
    });
  }

  #recordAction(event) {
    if (event.defaultPrevented) return;
    const { action, id, key, type, changes, row } = event.detail;
    if (action === "select") this.#selectRow(id, event.detail.checked, event.detail.range);
    else if (action === "sort") {
      const current = this.#sort[this.#kind];
      this.#sort[this.#kind] = { key, direction: current?.key === key ? -current.direction : 1 };
      this.#table.scrollTo({ top: 0 }); this.#renderData();
    } else if (action === "toggle") {
      if (this.#expanded.has(key)) this.#expanded.delete(key); else this.#expanded.add(key);
      this.#renderData();
    } else if (action === "update") {
      if (!this.#apply({ type: `${type}.update`, ids: [id], changes })) event.preventDefault();
    } else if (action === "remove") this.#removeRecords(type, [id]);
    else if (action === "reorder") this.#moveGroup(id, this.#model.data.groups.findIndex((group) => group.uid === id) + event.detail.direction);
    else if (action === "place") this.#placeGroup(id, event.detail.targetId, event.detail.after);
    else if (action === "hover") this.#highlight(row);
  }

  #command(command, value) {
    if (command === "remove-loci" || command === "remove-clusters") {
      const kind = command === "remove-loci" ? "loci" : "clusters";
      this.#removeRecords(kind, this.#model.selectedParents(kind, this.#selected));
      return;
    }
    if (command === "delete" || command === "delete-groups") {
      if (command === "delete-groups") this.#deleteSelected("groups", this.#selectedGroups().map((group) => group.uid));
      else this.#deleteSelected();
    } else if (command === "new-group" || command === "new-group-for-selection") {
      const label = window.prompt("Name for the new homology group");
      if (label?.trim()) {
        const geneIds = command === "new-group-for-selection" ? [...this.#selected] : [];
        this.#apply({ type: "groups.create", group: { uid: this.#nextGroupUid(), label: label.trim() }, geneIds }, geneIds.length > 0);
      }
    } else if (command === "assign") {
      if (value) this.#apply({ type: "groups.assignGenes", groupId: this.#model.groupId(value), geneIds: [...this.#selected] });
    } else if (command === "unassign") {
      this.#apply({ type: "groups.unassignGenes", geneIds: [...this.#selected] });
    } else if (command === "focus") {
      if (this.#selected.size) this.#chart?.focus?.(this.#model.plotTarget(this.#kind, this.#selected));
    } else if (command === "update") {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: value });
    } else if (command === "merge") {
      const targetId = this.#model.groupId(value);
      if (targetId !== undefined) {
        const sourceIds = this.#selectedGroups().map((group) => group.uid);
        this.#apply({ type: "groups.merge", targetId, sourceIds }, true);
      }
    } else if (command === "group-position") {
      this.#moveGroup(this.#selectedGroups()[0]?.uid, value);
    } else if (command === "view-members") {
      const groupId = this.#selectedGroups()[0]?.uid;
      if (groupId !== undefined) this.#viewGroupMembers(groupId);
    } else if (command === "toggle-tree") {
      this.#toggleTree();
    } else if (command === "clear-member-filter") {
      this.#memberGroupId = null;
      this.#renderData();
    }
  }

  #apply(operation, clearSelection = false) {
    if (!this.#chart?.patch) return false;
    return this.#edit(() => this.#chart.patch([operation]), clearSelection);
  }

  #edit(action, clearSelection) {
    this.#editing = true;
    const accepted = this.#runEdit(() => { action(); if (clearSelection) this.#selected.clear(); });
    this.#editing = false;
    if (accepted) this.#refreshData();
    return accepted;
  }

  #refreshData({ replace = false } = {}) {
    const data = this.#chart?.visibleData?.() || this.#chart?.data?.() || null;
    this.#model.data = data;
    if (!data?.groups.some((group) => group.uid === this.#memberGroupId)) this.#memberGroupId = null;
    if (replace) {
      this.#annotationEditor?.reset();
      this.#table?.reset();
      this.#selected.clear(); this.#expanded.clear(); this.#memberGroupId = null;
      this.#initializeExpanded();
    } else this.#selected.prune(this.#model.recordIds(this.#kind), this.#view().byKey.keys());
    this.#renderData();
  }

  #initializeExpanded() {
    const geneCount = this.#model.recordIds("genes").length;
    if (!geneCount || geneCount > 500) return;
    this.#expandTree("tree"); this.#expandTree("groups");
  }

  #expandTree(view) {
    for (const row of this.#view({ kind: "genes", geneView: view }).branches) this.#expanded.add(row.key);
  }

  #nextGroupUid() {
    const used = new Set((this.#model.data?.groups || []).map((group) => String(group.uid)));
    let index = used.size + 1;
    while (used.has(`group-${index}`)) index += 1;
    return `group-${index}`;
  }

  #selectRow(id, checked, range) {
    const { byKey } = this.#view();
    this.#selected.select(id, checked, { range, orderedIds: [...byKey.keys()],
      idsFor: (key) => byKey.get(key).selectIds || [byKey.get(key).id] });
    this.#renderData();
  }

  #view(options = {}) {
    return this.#model.view({ kind: this.#kind, geneView: this.#geneView, filter: this.#filter,
      memberGroupId: this.#memberGroupId, sort: this.#sort[this.#kind], expanded: this.#expanded, ...options });
  }

  #setDataFilter(text) {
    this.#filter = text.trim().toLowerCase();
    this.shadowRoot.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
    this.#renderData();
  }

  #clearDataSelection() {
    if (this.#kind === "annotations") this.#annotationEditor?.clearSelection();
    else { this.#selected.clear(); this.#renderData(); }
  }

  #renderData() {
    if (!this.isConnected || !this.#table) return;
    this.#table.cancelHover(); this.#highlight();
    const annotations = this.#kind === "annotations";
    this.shadowRoot.querySelector("[data-kind-picker]").value = this.#kind;
    this.shadowRoot.querySelector("[data-gene-view]").value = this.#geneView;
    this.#annotationEditor.hidden = !annotations;
    this.shadowRoot.querySelector("[data-record-toolbar]").hidden = annotations;
    this.shadowRoot.querySelector("[data-filter]").value = this.#filter;
    this.shadowRoot.querySelector("[data-record-editor]").hidden = annotations;
    if (annotations) {
      this.#table?.reset();
      this.#annotationEditor.state = { data: this.#chart?.data?.() || { clusters: [] }, annotationApi: { ANNOTATION_PALETTES, resolveAnnotationScale }, clusters: this.#model.data?.clusters || [],
        patch: (operations) => this.#chart.patch(operations) };
      return;
    }
    const data = this.#model.data;

    if (!data) {
      this.#table.state = { attached: false };
      this.#selectionBar.state = { selection: this.#selected, ids: [], summary: "No chart attached.", noun: this.#kind.slice(0, -1) };
      this.#actions.state = { kind: this.#kind, count: 0, groups: [], allGroups: [], loci: [], clusters: [] };
      return;
    }
    const geneView = this.shadowRoot.querySelector("[data-gene-view]");
    const memberFilter = this.shadowRoot.querySelector("[data-member-filter]");
    const { rows, ids, parentCount, memberGroup, hasCollapsed } = this.#view();
    memberFilter.hidden = !memberGroup || this.#kind !== "genes";
    this.shadowRoot.querySelector("[data-record-tools]").hidden = memberFilter.hidden;
    if (memberGroup) this.shadowRoot.querySelector("[data-member-label]").textContent = memberGroup.label || memberGroup.name || memberGroup.uid;
    geneView.hidden = this.#kind !== "genes";
    this.shadowRoot.querySelector('[data-command="new-group"]').hidden = this.#kind !== "groups";
    const isTree = this.#kind === "genes" && this.#geneView !== "list";
    const treeButton = this.shadowRoot.querySelector('[data-command="toggle-tree"]');
    treeButton.hidden = !isTree || Boolean(this.#filter);
    if (isTree) {
      treeButton.textContent = hasCollapsed ? "Expand visible" : "Collapse all";
      treeButton.title = hasCollapsed ? "Expand all currently visible branches" : "Collapse every tree branch";
    }
    this.#table.state = { kind: this.#kind, geneView: this.#geneView, rows, selection: this.#selected, sort: this.#sort[this.#kind] };
    const summaryText = isTree
      ? `${parentCount.toLocaleString()} ${this.#geneView === "groups" ? "group" : "cluster/locus"} rows · ${ids.length.toLocaleString()} genes${this.#filter ? " matching search" : ""}.`
      : `${rows.length.toLocaleString()} visible ${this.#kind}${memberGroup && this.#kind === "genes" ? " in selected group" : ""}${this.#filter ? " matching search" : ""}.`;
    this.#selectionBar.state = { selection: this.#selected, ids, summary: summaryText,
      noun: this.#kind.slice(0, -1), selectSuffix: isTree ? " genes" : "" };
    const parentRemoval = this.#kind === "genes" && this.#geneView === "tree" && this.#chart?.remove;
    this.#actions.state = { kind: this.#kind, count: this.#selected.size, groups: this.#selectedGroups(), allGroups: data.groups,
      loci: parentRemoval ? this.#model.selectedParents("loci", this.#selected) : [], clusters: parentRemoval ? this.#model.selectedParents("clusters", this.#selected) : [] };
  }

  #selectedGroups() {
    if (this.#kind === "groups") return (this.#model.data?.groups || []).filter((group) => this.#selected.has(group.uid));
    if (this.#kind !== "genes" || this.#geneView !== "groups") return [];
    return this.#view().rows.filter((row) => row.type === "gene-group" && row.group?.genes?.length &&
      row.group.genes.every((id) => this.#selected.has(id))).map((row) => row.group);
  }

  #removeRecords(kind, ids) {
    if (!ids.length || !window.confirm(`Remove ${ids.length} ${kind} and all their genes from the plot? This can be undone.`)) return;
    this.#edit(() => this.#chart.remove({ [kind]: ids }), true);
  }

  #deleteSelected(kind = this.#kind, ids = [...this.#selected]) {
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected ${kind}?${kind === "groups" ? " Their genes will remain in the plot." : ""}`)) return;
    this.#apply({ type: `${kind}.delete`, ids }, true);
  }

  #moveGroup(uid, index) {
    const ids = this.#model.data.groups.map((group) => group.uid), from = ids.indexOf(uid);
    if (from < 0 || !Number.isFinite(index)) return;
    const to = Math.max(0, Math.min(ids.length - 1, Math.trunc(index)));
    if (to === from) return;
    ids.splice(from, 1);
    ids.splice(to, 0, uid);
    this.#apply({ type: "groups.reorder", ids });
  }

  #viewGroupMembers(groupId) {
    this.#memberGroupId = groupId;
    this.#kind = "genes";
    this.#geneView = "list";
    this.#selected.clear();
    this.shadowRoot.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
    this.#renderData();
  }

  #placeGroup(uid, targetUid, after) {
    const ids = this.#model.data.groups.map((group) => group.uid);
    const from = ids.indexOf(uid), target = ids.indexOf(targetUid);
    if (from < 0 || target < 0 || uid === targetUid) return;
    this.#moveGroup(uid, target + Number(after) - Number(from < target));
  }

  #toggleTree() {
    if (this.#view().hasCollapsed) this.#expandTree(this.#geneView);
    else this.#expanded.clear();
    this.#renderData();
  }

  #highlight(row) {
    this.#chart?.highlight?.(this.#model.plotTarget(this.#kind, row ? row.selectIds || [row.id] : this.#selected));
  }

}

export function defineDataPanel() {
  if (!customElements.get("clinker-data-panel")) customElements.define("clinker-data-panel", ClinkerDataPanelElement);
}
