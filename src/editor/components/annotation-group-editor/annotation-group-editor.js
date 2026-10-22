import { createTemplate, mountComponent, colourHex, updateSelectOptions } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";
import { controlStyles } from "../../shared/controls.mjs";
import { defineEditableField } from "../editable-field/editable-field.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./annotation-group-editor.html", import.meta.url)),
  textAsset(new URL("./annotation-group-editor.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AnnotationGroupEditor extends HTMLElementBase {
  #state = { groups: [], clusters: [], tree: null };
  #revision = 0;
  #rows = new Map();
  #items;
  #template;
  #add;

  constructor() {
    super();
    const root = mountComponent(this, template, controlStyles + css);
    this.#items = root.querySelector("[data-groups]"); this.#template = this.#items.querySelector("template");
    this.#add = root.querySelector("[data-add]");
    this.#add.onclick = () => {
      const { groups, clusters } = this.#state;
      if (!clusters.length) return;
      let serial = 1; while (groups.some(({ uid }) => uid === `group-${serial}`)) serial++;
      this.#propose([...groups, { uid: `group-${serial}`, label: `Group ${serial}`, clusterIds: [clusters[0].uid] }]);
    };
    this.#render();
  }

  set state(value) { this.#state = value; this.#revision++; this.#render(); }
  cancelEdit() { for (const { label } of this.#rows.values()) label.cancelEdit(); }
  disconnectedCallback() { this.cancelEdit(); }

  #propose(groups) {
    const revision = this.#revision;
    const accepted = this.dispatchEvent(new CustomEvent("value-commit", { detail: { value: groups }, bubbles: true, composed: true, cancelable: true }));
    if (accepted && revision === this.#revision) this.state = { ...this.#state, groups };
    if (!accepted) this.#render();
    return accepted;
  }

  #edit(uid, changes) { return this.#propose(this.#state.groups.map((group) => group.uid === uid ? { ...group, ...changes } : group)); }

  #createRow(uid) {
    const node = this.ownerDocument.importNode(this.#template.content, true).firstElementChild;
    const row = { node, label: node.querySelector("clinker-editable-field"), colour: node.querySelector("input"),
      mode: node.querySelector("[data-mode]"), members: node.querySelector("[data-members]"), remove: node.querySelector("button") };
    row.label.addEventListener("value-commit", (event) => {
      event.stopPropagation(); if (!this.#edit(uid, { label: event.detail.value })) event.preventDefault();
    });
    row.colour.onchange = () => this.#edit(uid, { colour: row.colour.value });
    row.remove.onclick = () => this.#propose(this.#state.groups.filter((group) => group.uid !== uid));
    row.mode.onchange = () => {
      const { tree, clusters } = this.#state;
      if (row.mode.value === "tree" && tree) this.#edit(uid, { clusterIds: undefined, nodeUid: tree.root });
      else if (clusters.length) this.#edit(uid, { nodeUid: undefined, clusterIds: [clusters[0].uid] });
      else this.#render();
    };
    row.members.onchange = () => {
      const { clusters, tree } = this.#state;
      this.#edit(uid, row.members.multiple
        ? { clusterIds: [...row.members.selectedOptions].map((option) => clusters.find(({ uid }) => String(uid) === option.value).uid) }
        : { nodeUid: tree.nodes.find(({ uid }) => String(uid) === row.members.value).uid });
    };
    return row;
  }

  #render() {
    const { groups, clusters, tree, colour } = this.#state;
    this.#add.disabled = !clusters.length;
    for (const [uid, row] of this.#rows) if (!groups.some((group) => group.uid === uid)) {
      row.label.cancelEdit(); row.node.remove(); this.#rows.delete(uid);
    }
    let next = null;
    for (const group of [...groups].reverse()) {
      let row = this.#rows.get(group.uid);
      if (!row) { row = this.#createRow(group.uid); this.#rows.set(group.uid, row); }
      if (row.node.nextSibling !== next || row.node.parentNode !== this.#items) this.#items.insertBefore(row.node, next);
      next = row.node;
      row.node.querySelector("legend").textContent = group.label || group.uid;
      row.label.value = group.label ?? group.uid; row.colour.value = colourHex(group.colour ?? colour ?? "#267c9e");
      row.remove.disabled = groups.length === 1;
      updateSelectOptions(row.mode, [["clusters", "Selected clusters"], ...(tree ? [["tree", "Tree clade"]] : [])]);
      row.mode.value = group.nodeUid === undefined ? "clusters" : "tree";
      row.members.multiple = group.nodeUid === undefined; row.members.size = row.members.multiple ? Math.max(1, Math.min(5, clusters.length)) : 0;
      row.members.setAttribute("aria-label", row.members.multiple ? `Clusters in ${group.label || group.uid}` : "Tree node");
      updateSelectOptions(row.members, row.members.multiple ? clusters.map(({ uid, name }) => [uid, `${name || uid} (${uid})`]) : (tree?.nodes || []).map(({ uid, label }) => [uid, label || uid]));
      for (const option of row.members.options) option.selected = row.members.multiple
        ? (group.clusterIds || []).some((uid) => String(uid) === option.value) : String(group.nodeUid) === option.value;
    }
  }
}

export function defineAnnotationGroupEditor() {
  defineEditableField();
  if (!customElements.get("clinker-annotation-group-editor")) customElements.define("clinker-annotation-group-editor", AnnotationGroupEditor);
}
