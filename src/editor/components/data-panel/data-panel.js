import { installDataEditorStyle } from "../../shared/styles.mjs";
import { RowSelection } from "../../../rowSelection.mjs";
import { DATA_ROW_HEIGHT } from "../../../virtualRows.mjs";
import { ANNOTATION_PALETTES, resolveAnnotationScale } from "../../../annotations.mjs";
import { defineAnnotationEditor } from "../annotation-editor/annotation-editor.js";
import { createActionRunner, createTemplate } from "../../../uiControls.mjs";
import { applyTheme, resolveTheme, figureConfig } from "../../../theme.mjs";
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
    const status = this.querySelector("[data-editor-error]");
    if (status) { status.textContent = message; status.hidden = !message; }
    if (this.#table) this.#table.error = message;
  });
  #annotationEditor = null;
  #unsubscribe = null;
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
    this.#bind();
  }

  connectedCallback() {
    defineSelectionBar(); defineViewSwitcher(); defineSearchField(); defineRecordActions(); defineRecordTable(); defineAnnotationEditor();
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
    this.#table?.reset();
  }

  get chart() { return this.#chart; }
  set chart(value) {
    if (value === this.#chart) return;
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.#chart = value || null;
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
    this.#renderData(); this.#syncHighlight();
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
    this.#annotationEditor = this.querySelector("clinker-annotation-editor");
    this.#table = this.querySelector("clinker-record-table");
    this.#table.addEventListener("record-action", (event) => this.#recordAction(event));
    this.#selectionBar = this.querySelector("clinker-selection-bar");
    this.#selectionBar.addEventListener("clear-selection", () => this.#clearDataSelection());
    this.#selectionBar.addEventListener("select-all", (event) => {
      this.#selected.setMany(event.detail.ids); this.#renderData(); this.#syncHighlight();
    });
    this.#actions = this.querySelector("clinker-record-actions");
    this.#actions.addEventListener("selection-action", (event) => this.#command(event.detail.command, event.detail.value));
  }

  #bind() {
    this.addEventListener("click", (event) => {
      const command = event.target.closest("[data-command]")?.dataset.command;
      if (command) this.#command(command);
    });
    this.addEventListener("value-change", (event) => {
      if (event.target.matches("[data-kind-picker]")) {
        this.#kind = event.detail.value;
        if (this.#kind !== "genes") this.#memberGroupId = null;
        this.#selected.clear();
      } else if (event.target.matches("[data-gene-view]")) this.#geneView = event.detail.value;
      else return;
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.#renderData(); this.#syncHighlight();
    });
    this.addEventListener("input", (event) => {
      if (event.target.matches("[data-filter]")) this.#setDataFilter(event.target.value);
    });
    this.addEventListener("keydown", (event) => {
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
    else if (action === "reorder") this.#moveGroup(id, this.#data().groups.findIndex((group) => group.uid === id) + event.detail.direction);
    else if (action === "place") this.#placeGroup(id, event.detail.targetId, event.detail.after);
    else if (action === "hover") {
      if (row) this.#highlightRow(row); else this.#applySelectionHighlight();
    }
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
    } else if (command === "update") {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: value });
    } else if (command === "merge") {
      const targetId = this.#groupId(value);
      if (targetId !== undefined) {
        const sourceIds = this.#selectedGroups().map((group) => group.uid);
        this.#selected.clear();
        this.#apply({ type: "groups.merge", targetId, sourceIds });
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

  #apply(operation) {
    if (!this.#chart?.patch) return false;
    return this.#runEdit(() => this.#chart.patch([operation]));
  }

  #invalidateData({ replace = false } = {}) {
    // Patches can mutate data in place; invalidate all derived state together.
    this.#data(); this.#model.invalidate();
    if (replace) this.#annotationEditor?.reset();
    if (replace) {
      this.#table?.reset();
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
    this.#filter = text.trim().toLowerCase();
    this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
    this.#renderData();
  }

  #clearDataSelection() {
    if (this.#kind === "annotations") this.#annotationEditor?.clearSelection();
    else { this.#selected.clear(); this.#renderData(); this.#syncHighlight(); }
  }

  #renderData() {
    if (!this.isConnected || !this.#table) return;
    const annotations = this.#kind === "annotations";
    this.querySelector("[data-kind-picker]").value = this.#kind;
    this.querySelector("[data-gene-view]").value = this.#geneView;
    this.#annotationEditor.hidden = !annotations;
    this.querySelector("[data-record-toolbar]").hidden = annotations;
    this.querySelector("[data-filter]").value = this.#filter;
    this.querySelector("[data-record-editor]").hidden = annotations;
    if (annotations) {
      this.#table?.reset();
      this.#annotationEditor.state = { data: this.#chart?.data?.() || { clusters: [] }, annotationApi: { ANNOTATION_PALETTES, resolveAnnotationScale }, clusters: this.#data()?.clusters || [],
        patch: (operations) => this.#chart.patch(operations) };
      return;
    }
    const data = this.#data();

    if (!data) {
      this.#table.state = { attached: false };
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
    this.#table.state = { kind: this.#kind, geneView: this.#geneView, rows, selection: this.#selected, sort: this.#sort[this.#kind] };
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
      row.group.genes.every((id) => this.#selected.has(id))).map((row) => row.group);
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
    this.#memberGroupId = groupId;
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

  #toggleTree() {
    const rows = this.#view().rows;
    if (rows.some((row) => row.type !== "gene" && !row.open)) this.#expandTree(this.#geneView);
    else this.#expanded.clear();
    this.#renderData();
  }

  #syncHighlight() {
    this.#table?.cancelHover();
    this.#applySelectionHighlight();
  }

  #applySelectionHighlight() { this.#chart?.highlight?.(this.#selectionTarget()); }

  #highlightRow(row) {
    if (!this.#chart?.highlight) return;
    if (this.#kind === "links") { this.#chart.highlight({ links: [row.id] }); return; }
    const genes = row.selectIds || (this.#kind === "groups"
      ? this.#data()?.groups.find((group) => group.uid === row.id)?.genes || [] : [row.id]);
    this.#chart.highlight({ genes });
  }

}

export function defineDataPanel() {
  if (!customElements.get("clinker-data-panel")) customElements.define("clinker-data-panel", ClinkerDataPanelElement);
}
