import { installDataEditorStyle } from "../../shared/styles.mjs";
import { defineSearchField } from "../search-field/search-field.js";
import { defineCategoryEditor } from "../category-editor/category-editor.js";
import { defineAnnotationToolbar } from "../annotation-toolbar/annotation-toolbar.js";
import { defineAnnotationDataForm } from "../annotation-data-form/annotation-data-form.js";
import { defineAnnotationGroupEditor } from "../annotation-group-editor/annotation-group-editor.js";
import { defineAnnotationTable } from "../annotation-table/annotation-table.js";
import { createTemplate, createActionRunner } from "../../../ui/controls.mjs";
import { createAnnotationPanel, parseAnnotationTable, annotationTableText, mapAnnotationValues } from "../../../annotations/io.mjs";
import { textAsset, installStyle } from "../../../ui/assets.mjs";

const [markup, css] = await Promise.all([
  textAsset(new URL("./annotation-editor.html", import.meta.url)),
  textAsset(new URL("./annotation-editor.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AnnotationEditor extends HTMLElementBase {
  #state = { data: null, clusters: [], patch: () => {} };
  #templates;
  #toolbar;
  #body;
  #search;
  #status;
  #applying = false;
  #selected = null;
  #creating = false;
  #view;
  #viewKey;
  #categories;
  #form;
  #run = createActionRunner((message) => { this.#status.textContent = message; });

  connectedCallback() {
    const root = this.getRootNode();
    installDataEditorStyle(root);
    this.classList.add("cm-data-ui", "cm-annotation-data-editor");
    installStyle(root, "clinker-annotation-editor-style", css);
    if (!this.#body) this.#mount();
    this.#render();
  }
  disconnectedCallback() { this.#cancelEdit(); }
  set state(value) { this.#state = value; if (this.#body && !this.#applying) this.#render(); }
  get value() { return this.#selected; }
  select(uid) { this.#selected = uid; this.#creating = false; if (this.#body) this.#render(); }
  clearSelection() { this.#view?.clearSelection?.(); }
  reset() {
    this.#cancelEdit(); this.#selected = this.#viewKey = null;
    this.#state = { data: null, clusters: [], patch: () => {} };
    this.#creating = false;
    if (this.#search) this.#search.value = "";
    if (this.#body) this.#render();
  }
  get #palette() { return this.#state.annotationApi.ANNOTATION_PALETTES.Qualitative; }
  #scale(panel) { return this.#state.annotationApi.resolveAnnotationScale(panel); }
  #panels() { return this.#state.data?.annotationPanels || []; }
  #current() { return this.#panels().find((panel) => panel.uid === this.#selected); }
  #element(name) { return this.ownerDocument.importNode(this.#templates.getElementById(name).content, true).firstElementChild; }
  #cancelEdit() { this.#view?.cancelEdit(); this.#categories?.cancelEdit(); }
  #commit(operations) {
    this.#applying = true;
    try { return this.#run(() => { this.#state.patch(operations); this.#render(); }); }
    finally { this.#applying = false; }
  }
  #update(changes) { return this.#commit([{ type: "annotationPanels.update", ids: [this.#selected], changes }]); }
  #categoryScale(panel, domain, colours) {
    return { ...panel.scale, type: "categorical", domain, colours: colours.length ? colours : [...this.#palette] };
  }
  #mount() {
    this.#templates = template(this.ownerDocument);
    this.append(this.#element("editor"));
    this.#toolbar = this.querySelector("clinker-annotation-toolbar");
    this.#body = this.querySelector(".cm-annotation-data-body");
    this.#status = this.querySelector("[data-data-error]");
    this.#search = this.querySelector("clinker-search-field");
    this.#search.addEventListener("input", () => this.#syncView());
    this.#toolbar.addEventListener("panel-change", (event) => this.select(event.detail.value));
    this.#toolbar.addEventListener("panel-action", (event) => this.#action(event.detail.action));
    this.#body.addEventListener("columns-change", (event) => { if (this.#update(event.detail) === false) event.preventDefault(); });
    this.#body.addEventListener("rows-change", (event) => {
      const panel = this.#current(), categorical = panel.scale?.type === "categorical", scale = this.#scale(panel);
      if (this.#commit([
        ...(categorical && !panel.scale?.domain ? [{ type: "annotationPanels.update", ids: [this.#selected],
          changes: { scale: this.#categoryScale(panel, scale.domain, scale.domain.map(scale.colour)) } }] : []),
        { type: "annotationPanels.updateRows", uid: this.#selected, values: event.detail.values },
      ]) === false) event.preventDefault();
    });
    this.#body.addEventListener("value-commit", (event) => {
      let changes;
      if (event.target === this.#categories) {
        const { value, replacements } = event.detail, mapping = new Map(replacements);
        changes = { scale: this.#categoryScale(this.#current(), value.map(({ name }) => name), value.map(({ colour }) => colour)) };
        if (mapping.size) changes.values = mapAnnotationValues(this.#current().values, (item) => mapping.has(item) ? mapping.get(item) : item);
      } else if (event.target === this.#view && this.#current()?.type === "groups") changes = { groups: event.detail.value };
      else return;
      if (this.#update(changes) === false) event.preventDefault();
    });
    this.#body.addEventListener("data-submit", (event) => { if (event.target === this.#form) this.#submit(event.detail); });
    this.#body.addEventListener("data-cancel", (event) => { if (event.target === this.#form) this.#form.hidden = true; });
  }
  #action(action) {
    if (action === "add") { this.#creating = !this.#creating; this.#render(); }
    else if (action === "replace" && this.#form) {
      this.#form.hidden = !this.#form.hidden;
      if (!this.#form.hidden) {
        this.#form.value = { data: annotationTableText(this.#current(), this.#state.clusters) };
        this.#form.error = ""; this.#form.focus();
      }
    } else if (action === "show") this.#update({ show: this.#current().show === false });
    else if (action === "remove") this.#commit([{ type: "annotationPanels.delete", ids: [this.#selected] }]);
    else if (action === "left" || action === "right") {
      const ids = this.#panels().map((panel) => panel.uid), index = ids.indexOf(this.#selected), next = index + (action === "left" ? -1 : 1);
      if (index < 0 || next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      this.#commit([{ type: "annotationPanels.reorder", ids }]);
    }
  }
  #submit(detail) {
    try {
      if (this.#creating) {
        const panel = createAnnotationPanel(detail, this.#panels());
        this.#state.patch([{ type: "annotationPanels.create", panel }]); this.select(panel.uid); return;
      }
      const source = this.#current(), categorical = source.scale?.type === "categorical", changes = parseAnnotationTable(detail.data, categorical);
      if (categorical) {
        const scale = this.#scale(source), domain = new Set(scale.domain);
        for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
        const names = [...domain]; changes.scale = this.#categoryScale(source, names, names.map((value, i) =>
          scale.domain.includes(value) ? scale.colour(value) : this.#palette[i % this.#palette.length]));
      }
      if (this.#update(changes)) this.#form.hidden = true;
    } catch (exception) { this.#form.error = exception.message; }
  }
  #syncView() {
    if (!this.#view) return;
    const panel = this.#current(), clusters = this.#state.clusters;
    this.#view.state = panel.type === "groups" ? { groups: panel.groups, colour: panel.colour, clusters, tree: this.#state.data.tree }
      : { panel, clusters, filter: this.#search.value, domain: panel.scale?.type === "categorical" ? this.#scale(panel).domain : null };
  }
  #render() {
    const panels = this.#panels();
    if (!panels.some((panel) => panel.uid === this.#selected)) this.#selected = panels[0]?.uid ?? null;
    const panel = this.#current();
    this.#toolbar.state = { panels, value: this.#selected, creating: this.#creating };
    this.#search.hidden = !panel || this.#creating || panel.type === "groups";
    const categorical = panel?.scale?.type === "categorical";
    const key = this.#creating ? "create" : panel ? JSON.stringify([panel.uid, panel.type]) : "empty";
    if (key !== this.#viewKey) {
      this.#cancelEdit(); this.#body.replaceChildren(); this.#view = this.#categories = this.#form = null; this.#viewKey = key;
      if (this.#creating) {
        this.#form = this.#element("creation"); this.#form.clusters = this.#state.clusters; this.#body.append(this.#form);
      } else if (!panel) this.#body.append(this.#element("empty"));
      else if (panel.type === "groups") {
        const region = this.#element("groups"); this.#body.append(region); this.#view = region.firstElementChild;
      } else {
        this.#view = this.#element("matrix"); this.#body.append(this.#view);
        this.#form = this.#element("replacement"); this.#view.append(this.#form);
      }
    }
    this.#syncView();
    if (this.#view && panel.type !== "groups" && categorical && !this.#categories) {
      this.#categories = this.#element("categories"); this.#view.prepend(this.#categories);
      this.#categories.palette = this.#palette;
    } else if (!categorical && this.#categories) {
      this.#categories.cancelEdit(); this.#categories.remove(); this.#categories = null;
    }
    if (this.#categories) {
      const { domain, colour } = this.#scale(panel);
      this.#categories.value = domain.map((name) => ({ name, colour: colour(name) }));
    }
  }
}

export function defineAnnotationEditor() {
  defineSearchField(); defineCategoryEditor(); defineAnnotationToolbar(); defineAnnotationDataForm(); defineAnnotationGroupEditor(); defineAnnotationTable();
  if (!customElements.get("clinker-annotation-editor")) customElements.define("clinker-annotation-editor", AnnotationEditor);
}
