import { createTemplate, mountComponent, colourHex, createActionRunner, upgradeProperty } from "../../../ui/controls.mjs";
import { textAsset } from "../../../ui/assets.mjs";
import { defineSearchField } from "../search-field/search-field.js";
import { defineTreeAppearance } from "../tree-appearance/tree-appearance.js";
import { figureConfig } from "../../../ui/theme.mjs";
import { applyEditorTheme, editorThemeStyles } from "../../shared/theme.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./appearance-panel.html", import.meta.url)),
  textAsset(new URL("./appearance-panel.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

export class ClinkerAppearancePanelElement extends HTMLElementBase {
  static observedAttributes = ["hidden"];
  #chart = null;
  #unsubscribe = null;
  #config;
  #tree;
  #runEdit;
  #hasTree = false;
  #filter = "";
  #expanded = new Set();
  #sections;
  #navigation = 0;

  constructor() {
    super();
    const root = mountComponent(this, template, editorThemeStyles + css);
    this.#tree = root.querySelector("clinker-tree-appearance");
    this.#runEdit = createActionRunner((message) => {
      const status = root.querySelector(".error"); status.textContent = message; status.hidden = !message;
    });
    const runTreeEdit = createActionRunner((message) => { this.#tree.error = message; });
    const runPreview = createActionRunner((message) => { if (message) this.#tree.error = message; });
    const colouring = (changes) => [{ type: "tree.presentation.update", scope: "tree", changes: { colouring: changes } }];
    this.#tree.addEventListener("colouring-change", (event) => { if (!runTreeEdit(() => this.#chart.patch(colouring(event.detail)))) event.preventDefault(); });
    this.#tree.addEventListener("colouring-preview", (event) => { if (!runPreview(() => this.#chart?.previewTreePresentation(event.detail ? colouring(event.detail) : null))) event.preventDefault(); });
    this.#tree.addEventListener("reset-styles", (event) => { if (!runTreeEdit(() => this.#chart.patch([{ type: "tree.presentation.reset", scope: "manual" }]))) event.preventDefault(); });
    this.#sections = [...root.querySelectorAll("fieldset")].map((box) => ({ box, key: box.dataset.appearanceSection, details: box.querySelector("details"),
      fields: [...box.querySelectorAll("[data-config]")].map((control) => ({ control, row: control.closest("label"), advanced: Boolean(control.closest("details")),
        search: `${box.querySelector("legend").textContent} ${control.getAttribute("aria-label")} ${control.dataset.config}`.toLowerCase() })) }));
    const search = root.querySelector("clinker-search-field");
    search.addEventListener("input", () => { this.#filter = search.value.trim().toLowerCase(); this.#sync(); });
    root.addEventListener("click", (event) => {
      const details = event.target.closest("summary")?.parentElement;
      if (!details || event.defaultPrevented || this.#filter) return;
      const key = details.dataset.appearanceSection;
      if (details.open) this.#expanded.delete(key); else this.#expanded.add(key);
    });
    root.addEventListener("change", (event) => {
      const input = event.target;
      if (!input.matches("[data-config]")) return;
      if (!input.reportValidity()) return;
      const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
      const config = input.dataset.config.split(".").reduceRight((value, key) => ({ [key]: value }), value);
      if (!this.#runEdit(() => this.#chart.config(config))) this.#syncField(input, true);
    });
    upgradeProperty(this, "chart");
  }

  get chart() { return this.#chart; }
  get sections() { return this.#sections.map(({ key }) => key); }

  async openSection(section = null, { focus = true } = {}) {
    const target = section === null ? this.#sections[0] : this.#sections.find(({ key }) => key === section);
    if (!target || !this.isConnected || !this.#chart) return false;
    const navigation = ++this.#navigation;
    this.hidden = false;
    this.#filter = "";
    this.shadowRoot.querySelector("clinker-search-field").value = "";
    if (target.details) this.#expanded.add(target.details.dataset.appearanceSection);
    this.#render();
    await new Promise((resolve) => this.ownerDocument.defaultView.requestAnimationFrame(resolve));
    // A later navigation, close or tab switch must not steal focus back.
    if (navigation !== this.#navigation || !this.isConnected || !target.box.getClientRects().length) return false;
    const control = target.fields.find(({ control }) => !control.disabled)?.control;
    (control || target.box).scrollIntoView({ block: "nearest" });
    if (focus) control?.focus({ preventScroll: true });
    return true;
  }
  set chart(value) {
    if (value === this.#chart) return;
    this.#navigation++;
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.#chart = value || null;
    applyEditorTheme(this, this.#chart);
    this.#subscribe(); this.#render();
  }
  connectedCallback() {
    this.classList.add("cm-ui", "cm-data-ui");
    applyEditorTheme(this, this.#chart);
    this.#subscribe(); this.#render();
  }
  disconnectedCallback() {
    this.#navigation++;
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.(); this.#unsubscribe = null;
  }
  attributeChangedCallback() { if (this.isConnected && !this.hidden) this.#render(); }
  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (change.type === "theme.change") applyEditorTheme(this, this.#chart);
      else if (["config.change", "data.replace"].includes(change.type) ||
          (change.type === "data.apply" && change.operations?.some((op) => op.type.startsWith("tree.")))) this.#render();
    });
  }
  #render() {
    if (!this.isConnected) return;
    const config = this.#chart?.config?.();
    this.shadowRoot.querySelector(".toolbar").hidden = !config;
    this.shadowRoot.querySelector(".settings").hidden = !config;
    if (!config) { this.#config = null; this.#hasTree = false; this.#tree.state = { tree: null }; return; }
    if (this.hidden) return;
    this.#config = figureConfig(config);
    const tree = this.#chart.data()?.tree;
    this.#hasTree = Boolean(tree); this.#tree.state = { tree, config: this.#config.tree };
    this.#sync();
  }

  #syncField(control, force = false) {
    const path = control.dataset.config, value = path.split(".").reduce((current, key) => current?.[key], this.#config);
    if (control.type === "checkbox") control.checked = Boolean(value);
    else if (force || control !== this.shadowRoot.activeElement) control.value = control.type === "color" ? colourHex(value) : value ?? "";
    const bound = path === "colourBar.domain.min" ? "min" : path === "colourBar.domain.max" ? "max" : null;
    control.disabled = Boolean(bound && this.#config?.colourBar?.domain?.[`${bound}Mode`] === "data");
  }

  #sync() {
    let visible = 0;
    for (const { box, details, fields } of this.#sections) {
      for (const { control, row, search } of fields) {
        this.#syncField(control); row.hidden = Boolean(this.#filter && !search.includes(this.#filter));
      }
      box.hidden = fields.every(({ row }) => row.hidden);
      if (!box.hidden) visible++;
      if (details) {
        details.hidden = !fields.some(({ advanced, row }) => advanced && !row.hidden);
        details.open = Boolean(this.#filter) || this.#expanded.has(details.dataset.appearanceSection);
      }
    }
    const empty = this.shadowRoot.querySelector(".empty");
    empty.hidden = visible > 0; empty.textContent = `No appearance settings match “${this.#filter}”.`;
    this.#tree.hidden = !this.#hasTree || Boolean(this.#filter && !/tree|clade|colour|color|annotation|branch|cut|palette/.test(this.#filter));
  }
}

export function defineAppearancePanel() {
  defineSearchField(); defineTreeAppearance();
  if (!customElements.get("clinker-appearance-panel")) customElements.define("clinker-appearance-panel", ClinkerAppearancePanelElement);
}
