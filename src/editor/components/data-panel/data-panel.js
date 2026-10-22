import { installDataEditorStyle } from "../../shared/styles.mjs";
import { RowSelection } from "../../../rowSelection.mjs";
import { DATA_ROW_HEIGHT } from "../../../virtualRows.mjs";
import { createAnnotationEditor } from "../../annotations.js";
import { ANNOTATION_PALETTES, resolveAnnotationScale } from "../../../annotations.mjs";
import { createActionRunner, createTemplate } from "../../../uiControls.mjs";
import { applyTheme, resolveTheme, figureConfig } from "../../../theme.mjs";
import { createEditorRow } from "./rows.js";
import { DataPanelModel } from "./model.js";
import { defineEditableField } from "../editable-field/editable-field.js";
import { defineSelectionBar } from "../selection-bar/selection-bar.js";
import { defineActionMenu } from "../action-menu/action-menu.js";
import { defineViewSwitcher } from "../view-switcher/view-switcher.js";
import { defineSearchField } from "../search-field/search-field.js";
import { defineRecordActions } from "../record-actions/record-actions.js";
import { defineDataTable } from "../data-table/data-table.js";
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
    const status = this.querySelector("[data-editor-error]");
    if (status) { status.textContent = message; status.hidden = !message; }
  });
  #annotationEditor = null;
  #unsubscribe = null;
  #kind = "groups";
  #geneView = "tree";
  #selected = new RowSelection();
  #rowKind = null;
  #table = null;
  #actions = null;
  #selectionBar = null;
  #model = new DataPanelModel();
  #filter = "";
  #memberGroupId = null;
  #expanded = new Set();
  #draggedGroupId = null;
  #sort = {
    genes: { key: "label", direction: 1 },
    links: { key: "source", direction: 1 },
  };
  #hoverRow = null;
  #hoveredRow = null;
  #hoverTimer = null;
  #hoverFrame = null;

  constructor() {
    super();
    this.#bind();
  }

  connectedCallback() {
    defineEditableField(); defineSelectionBar(); defineActionMenu(); defineViewSwitcher(); defineSearchField(); defineRecordActions(); defineDataTable();
    this.classList.add("cm-data-ui");
    installDataEditorStyle(this.ownerDocument);
    if (!this.ownerDocument.getElementById("clinker-data-panel-style")) {
      const style = this.ownerDocument.createElement("style"); style.id = "clinker-data-panel-style"; style.textContent = css;
      this.ownerDocument.head.append(style);
    }
    if (!this.#table) this.#renderShell();
    this.#invalidateData();
    this.#subscribe(); this.#syncTheme(); this.#renderData();
  }

  disconnectedCallback() {
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.#cancelHover(); this.#disposeRows();
    this.#annotationEditor?.destroy(); this.#annotationEditor = null;
    this.querySelector("[data-annotation-editor]")?.replaceChildren();
    this.querySelector("[data-annotation-toolbar]")?.replaceChildren();
  }

  get chart() { return this.#chart; }
  set chart(value) {
    if (value === this.#chart) return;
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.#cancelHover(); this.#chart = value || null;
    this.#invalidateData({ replace: true });
    this.#subscribe(); this.#syncTheme(); this.#renderData();
  }

  #syncTheme() {
    const config = this.#chart?.config?.();
    if (config) applyTheme(this, resolveTheme(figureConfig(config).plot.theme));
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (["data.apply", "data.replace", "state.replace"].includes(change.type)) {
        this.#invalidateData({ replace: change.type === "data.replace" });
        if (change.type === "state.replace") this.#syncTheme();
        this.#renderData();
      } else if (change.type === "config.change" || change.type === "theme.change") this.#syncTheme();
    });
  }

  editAnnotations(panelUid) {
    this.#kind = "annotations";
    this.#selected.clear();
    this.#renderData();
    if (panelUid) this.#annotationEditor?.select(panelUid);
    return this;
  }

  editSelection({ kind, ids }) {
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
    this.#selected.clear(); this.#selected.setMany(genes);
    this.#renderData(); this.#syncHighlight();
    const first = this.#view().rows.findIndex((row) => row.selectIds?.some((id) => this.#selected.has(id)));
    this.querySelector(".cm-editor__table").scrollTop = Math.max(0, first) * DATA_ROW_HEIGHT;
    return this;
  }

  #renderShell() {
    this.replaceChildren(template(this.ownerDocument));
    this.#table = this.querySelector("clinker-data-table");
    this.#table.addEventListener("value-commit", (event) => {
      if (event.defaultPrevented) return;
      const { type, id, field } = event.target.dataset;
      if (!type || !field) return;
      const value = field === "identity" ? Number(event.detail.value) / 100 : event.detail.value.trim();
      if (!this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes: { [field]: value } }, event.target)) event.preventDefault();
    });
    this.#selectionBar = this.querySelector("clinker-selection-bar");
    this.#selectionBar.addEventListener("clear-selection", () => this.#clearDataSelection());
    this.#selectionBar.addEventListener("select-all", (event) => {
      this.#selected.setMany(event.detail.ids); this.#renderData(); this.#syncHighlight();
    });
    this.#actions = this.querySelector("clinker-record-actions");
    this.#actions.addEventListener("selection-action", (event) => this.#command(event.detail.command, event.detail.value));
  }

  #bind() {
    this.addEventListener("click", (event) => this.#click(event));
    this.addEventListener("change", (event) => this.#change(event));
    this.addEventListener("value-change", (event) => {
      if (event.target.matches("[data-kind-picker]")) {
        this.#kind = event.detail.value;
        if (this.#kind !== "genes") this.#memberGroupId = null;
        this.#selected.clear();
      } else if (event.target.matches("[data-gene-view]")) this.#geneView = event.detail.value;
      else return;
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.#renderData();
    });
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
      const row = this.#view().byKey.get(target.dataset.selectRow);
      if (!row || row.selectIds.every((id) => this.#selected.has(id)) === target.checked) return;
      this.#selectRow(row.key, target.checked, false);
      return;
    }
    if (target.matches("[data-select]")) {
      const id = this.#id(target.dataset.select);
      if (this.#selected.has(id) === target.checked) return;
      this.#selectRow(id, target.checked, false);
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

  #disposeRows() {
    if (this.#table) this.#table.renderer = null;
    this.#rowKind = null;
  }

  #invalidateData({ replace = false } = {}) {
    // Patches can mutate data in place; invalidate all derived state together.
    this.#data(); this.#model.invalidate();
    this.#annotationEditor?.invalidate({ replace });
    if (replace) {
      this.#disposeRows();
      this.#selected.clear(); this.#expanded.clear(); this.#memberGroupId = null;
      this.#initializeExpanded();
    } else if (this.#selected.size) {
      this.#selected.prune(this.#model.recordIds(this.#kind));
    }
  }

  #data() {
    const data = this.#chart?.visibleData?.() || this.#chart?.data?.() || null;
    this.#model.data = data; return data;
  }

  #initializeExpanded() {
    const data = this.#data();
    const geneCount = data?.clusters?.flatMap((cluster) => cluster.loci).reduce((count, locus) => count + locus.genes.length, 0) || 0;
    if (!geneCount || geneCount > 500) return;
    this.#expandTree("tree"); this.#expandTree("groups");
  }

  #expandTree(view) {
    const data = this.#data();
    if (view === "groups") {
      for (const group of data?.groups || []) this.#expanded.add(`gene-group:${group.uid}`);
      this.#expanded.add("gene-group:ungrouped");
      return;
    }
    for (const cluster of data?.clusters || []) {
      if (cluster.loci.length === 1) this.#expanded.add(`cluster-locus:${cluster.uid}:${cluster.loci[0].uid}`);
      else {
        this.#expanded.add(`cluster:${cluster.uid}`);
        for (const locus of cluster.loci) this.#expanded.add(`locus:${locus.uid}`);
      }
    }
  }

  #id(value) { this.#data(); return this.#model.id(value); }
  #groupId(value) { this.#data(); return this.#model.groupId(value); }

  #nextGroupUid() {
    const used = new Set((this.#data()?.groups || []).map((group) => String(group.uid)));
    let index = used.size + 1;
    while (used.has(`group-${index}`)) index += 1;
    return `group-${index}`;
  }

  #selectRow(id, checked, range) {
    const { byKey } = this.#view();
    this.#selected.select(id, checked, { range, orderedIds: [...byKey.keys()],
      idsFor: (key) => byKey.get(key).selectIds || [byKey.get(key).id] });
    this.#renderData(); this.#syncHighlight();
  }

  #view() {
    this.#data();
    return this.#model.view({ kind: this.#kind, geneView: this.#geneView, filter: this.#filter,
      memberGroupId: this.#memberGroupId, sort: this.#sort[this.#kind], expanded: this.#expanded });
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
    if (!this.isConnected || !this.#table) return;
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
        this.#annotationEditor = createAnnotationEditor({ document: this.ownerDocument,
          embedded: true,
          getData: () => this.#chart?.data?.() || { clusters: [] },
          getClusters: () => this.#data()?.clusters || [], patch: (operations) => this.#chart.patch(operations),
          annotationApi: { ANNOTATION_PALETTES, resolveAnnotationScale },
        });
        annotationHost.append(this.#annotationEditor.node);
        this.querySelector("[data-annotation-toolbar]").append(this.#annotationEditor.toolbar);
      } else this.#annotationEditor.update();
      search.value = this.#annotationEditor.filter;
      return;
    }
    const data = this.#data();
    const table = this.#table;
    const head = this.querySelector("[data-head]");
    const list = this.querySelector("[data-rows]");
    if (!data) {
      this.#disposeRows();
      table.header = { columns: [], sort: null }; list.textContent = "Set the chart property to edit a ClusterMap chart.";
      this.#selectionBar.state = { selection: this.#selected, ids: [], summary: "No chart attached.", noun: this.#kind.slice(0, -1) };
      this.#actions.state = { kind: this.#kind, count: 0, groups: [], allGroups: [], loci: [], clusters: [] };
      return;
    }
    const geneView = this.querySelector("[data-gene-view]");
    const memberFilter = this.querySelector("[data-member-filter]");
    const memberGroup = data.groups.find((group) => group.uid === this.#memberGroupId);
    if (!memberGroup) this.#memberGroupId = null;
    const { rows, ids, parentCount } = this.#view();
    memberFilter.hidden = !memberGroup || this.#kind !== "genes";
    this.querySelector("[data-record-tools]").hidden = memberFilter.hidden;
    if (memberGroup) this.querySelector("[data-member-label]").textContent = memberGroup.label || memberGroup.name || memberGroup.uid;
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
    table.header = { columns, sort };
    list.className = `cm-editor__rows cm-editor__rows--${isTree ? "tree" : this.#kind}`;
    if (this.#rowKind !== this.#kind) this.#disposeRows();
    if (!this.#rowKind) {
      const kind = this.#kind;
      this.#rowKind = kind;
      list.replaceChildren();
      const components = new WeakMap();
      const updateRow = (node, row) => components.get(node).update(row, this.#selected);
      table.renderer = { container: list,
        key: (row) => `${kind}:${row.type || "row"}:${row.key ?? row.id}`,
        headerHeight: () => head.offsetHeight,
        createRow: (row) => {
          const component = createEditorRow(this.ownerDocument, kind, row.type);
          components.set(component.node, component); return updateRow(component.node, row);
        },
        disposeRow: (node) => components.get(node).destroy(), updateRow };
    }
    table.rows = rows;
    const summaryText = isTree
      ? `${parentCount.toLocaleString()} ${this.#geneView === "groups" ? "group" : "cluster/locus"} rows · ${ids.length.toLocaleString()} genes${this.#filter ? " matching search" : ""}.`
      : `${rows.length.toLocaleString()} visible ${this.#kind}${memberGroup && this.#kind === "genes" ? " in selected group" : ""}${this.#filter ? " matching search" : ""}.`;
    this.#selectionBar.state = { selection: this.#selected, ids, summary: summaryText,
      noun: this.#kind.slice(0, -1), selectSuffix: isTree ? " genes" : "" };
    const parentRemoval = this.#kind === "genes" && this.#geneView === "tree" && this.#chart?.remove;
    this.#actions.state = { kind: this.#kind, count: this.#selected.size, groups: this.#selectedGroups(), allGroups: data.groups,
      loci: parentRemoval ? this.#selectedParents("loci") : [], clusters: parentRemoval ? this.#selectedParents("clusters") : [] };
  }

  #selectedGroups() {
    if (this.#kind === "groups") return (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid));
    if (this.#kind !== "genes" || this.#geneView !== "groups") return [];
    return this.#view().rows.filter((row) => row.type === "gene-group" && row.group?.genes?.length &&
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

  #selectionTarget() {
    if (this.#kind === "links") return { links: [...this.#selected] };
    const genes = this.#kind === "groups"
      ? this.#selectedGroups().flatMap((group) => group.genes || []) : [...this.#selected];
    return { genes };
  }

  #focusSelected() {
    if (this.#selected.size) this.#chart?.focus?.(this.#selectionTarget());
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
    const rows = this.#view().rows;
    if (rows.some((row) => row.type !== "gene" && !row.open)) this.#expandTree(this.#geneView);
    else this.#expanded.clear();
    this.#renderData();
  }

  #syncHighlight() {
    this.#cancelHover();
    this.#applySelectionHighlight();
  }

  #applySelectionHighlight() { this.#chart?.highlight?.(this.#selectionTarget()); }

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

}

export function defineDataPanel() {
  if (!customElements.get("clinker-data-panel")) customElements.define("clinker-data-panel", ClinkerDataPanelElement);
}
