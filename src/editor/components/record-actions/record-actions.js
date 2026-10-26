import { createTemplate, mountComponent, updateSelectOptions } from "../../../ui/controls.mjs";
import { textAsset } from "../../../ui/assets.mjs";
import { defineActionMenu } from "../action-menu/action-menu.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./record-actions.html", import.meta.url)),
  textAsset(new URL("./record-actions.css", import.meta.url)),
]);
const template = createTemplate(markup);
const groupOptions = (groups) => groups.map(({ uid, label, name }) => [uid, label || name || uid]);
const HTMLElementBase = globalThis.HTMLElement || class {};

class RecordActions extends HTMLElementBase {
  #context;

  constructor() {
    super();
    const root = mountComponent(this, template, css);
    root.addEventListener("click", (event) => {
      const command = event.target.closest("[data-command]")?.dataset.command;
      if (!command) return;
      const field = { assign: "assign-group", merge: "merge-target", "batch-label": "batch-label", "batch-identity": "batch-identity" }[command];
      const input = field && this.#field(field);
      if (input && !input.reportValidity()) return;
      if (input && !input.value.trim()) return;
      const changes = command === "batch-label" ? { label: input.value.trim() }
        : command === "batch-identity" ? { identity: input.valueAsNumber / 100 } : null;
      this.#emit(changes ? "update" : command, changes || input?.value);
    });
    root.addEventListener("change", (event) => {
      const input = event.target;
      if (input.matches("[data-batch-colour]")) this.#emit("update", { colour: input.value });
      else if (input.matches("[data-batch-visibility]") && input.value) { this.#emit("update", { hidden: input.value === "hide" }); input.value = ""; }
      else if (input.matches("[data-group-position]") && input.reportValidity()) this.#emit("group-position", Number(input.value) - 1);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("[data-group-position]")) event.target.blur();
    });
  }

  connectedCallback() {
    if (this.#context === undefined) this.state = { kind: "groups", count: 0, groups: [], allGroups: [], loci: [], clusters: [] };
  }

  set state({ kind, count, groups, allGroups, loci, clusters }) {
    const context = JSON.stringify([kind, count > 0, count > 1, groups.map(({ uid }) => uid)]);
    if (this.#context !== context) {
      this.#context = context;
      for (const menu of this.shadowRoot.querySelectorAll("clinker-action-menu")) menu.open = false;
      this.#field("batch-label").value = this.#field("batch-identity").value = "";
    }
    this.hidden = !count;
    const visible = { assign: kind === "genes", edit: kind !== "genes" && count > 1, merge: groups.length > 1, group: groups.length === 1, remove: true };
    for (const menu of this.shadowRoot.querySelectorAll("[data-menu]")) menu.hidden = !visible[menu.dataset.menu];
    this.#field("batch-identity").hidden = this.#command("batch-identity").hidden = kind !== "links";
    updateSelectOptions(this.#field("assign-group"), [["", "Choose a group…"], ...groupOptions(allGroups)]);
    updateSelectOptions(this.#field("merge-target"), [["", "Choose group to keep…"], ...groupOptions(groups)]);
    const position = this.#field("group-position"); position.max = allGroups.length || 1;
    if (this.shadowRoot.activeElement !== position) position.value = allGroups.findIndex(({ uid }) => uid === groups[0]?.uid) + 1;
    for (const [command, label, show] of [["delete", `Delete selected ${kind}`, true], ["remove-loci", `Entire loci (${loci.length})`, loci.length],
      ["remove-clusters", `Entire clusters (${clusters.length})`, clusters.length], ["delete-groups", `Delete groups (${groups.length})`, kind === "genes" && groups.length]]) {
      const button = this.#command(command); button.textContent = label; button.hidden = !show;
    }
  }

  #field(name) { return this.shadowRoot.querySelector(`[data-${name}]`); }
  #command(name) { return this.shadowRoot.querySelector(`[data-command="${name}"]`); }
  #emit(command, value) { this.dispatchEvent(new CustomEvent("selection-action", { detail: { command, value }, bubbles: true, composed: true })); }
}

export function defineRecordActions() {
  defineActionMenu();
  if (!customElements.get("clinker-record-actions")) customElements.define("clinker-record-actions", RecordActions);
}
