import { createActionRunner, createTemplate } from "../uiControls.mjs";
import { applyTheme, resolveTheme, figureConfig } from "../theme.mjs";
import { createAppearanceControls } from "./appearanceControls.mjs";
import { defineTabs } from "./components/tabs/tabs.js";
import { defineDataPanel } from "./components/data-panel/data-panel.js";
import { textAsset } from "./shared/textAsset.js";

const shellTemplate = createTemplate(await textAsset(new URL("./element.html", import.meta.url)));
const HTMLElementBase = globalThis.HTMLElement || class {};

/** Optional editor for an already rendered chart; edits use its public API. */
export class ClinkerEditorElement extends HTMLElementBase {
  #chart = null;
  #dataPanel = null;
  #appearanceView = null;
  #unsubscribe = null;
  #resizeStart = null;
  #runEdit = createActionRunner((message) => {
    const status = this.querySelector("[data-editor-error]");
    if (status) { status.textContent = message; status.hidden = !message; }
  });
  #editAnnotation = (event) => {
    if (event.defaultPrevented || event.detail?.chart !== this.#chart) return;
    event.preventDefault(); this.editAnnotations(event.detail.panelUid);
  };

  constructor() {
    super();
    this.addEventListener("click", (event) => {
      const command = event.target.closest("[data-command]")?.dataset.command;
      if (command === "undo") this.#chart?.undo?.();
      else if (command === "redo") this.#chart?.redo?.();
    });
    this.addEventListener("value-change", (event) => {
      if (event.target.matches("[data-editor-tabs]") && event.detail.value === "appearance") this.#renderAppearance();
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
      this.style.height = `${Math.max(180, Math.min(parentHeight - 48, this.#resizeStart.height - (event.clientY - this.#resizeStart.pointerY)))}px`;
    });
    this.addEventListener("pointerup", () => { this.#resizeStart = null; });
    this.addEventListener("pointercancel", () => { this.#resizeStart = null; });
  }

  connectedCallback() {
    defineTabs(); defineDataPanel();
    this.classList.add("cm-editor", "cm-data-ui");
    if (!this.hasChildNodes()) this.#renderShell();
    this.ownerDocument.addEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#subscribe(); this.#render();
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.(); this.#unsubscribe = null;
  }

  get chart() { return this.#chart; }
  set chart(value) {
    if (value === this.#chart) return;
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.(); this.#unsubscribe = null;
    this.#chart = value || null;
    this.#subscribe(); this.#render();
  }
  get value() { return this.#chart?.data?.(); }

  editAnnotations(panelUid) { this.#openData().editAnnotations(panelUid); return this; }
  editSelection(selection) { this.#openData().editSelection(selection); return this; }

  #openData() {
    this.hidden = false;
    this.querySelector("[data-editor-tabs]")?.setAttribute("value", "data");
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true }));
    return this.#dataPanel;
  }

  reset() {
    this.#chart?.previewTreePresentation?.(null);
    this.#appearanceView = null;
    this.#renderShell(); this.#render();
    return this;
  }

  #renderShell() {
    this.replaceChildren(shellTemplate(this.ownerDocument));
    this.#dataPanel = this.querySelector("clinker-data-panel");
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (["config.change", "theme.change", "data.replace", "state.replace"].includes(change.type) ||
          (change.type === "data.apply" && change.operations?.some((op) => op.type.startsWith("tree.presentation.")))) this.#renderAppearance();
      if (change.type === "history.change") this.#renderHistory();
    });
  }

  #render() {
    if (!this.isConnected) return;
    if (this.#dataPanel) this.#dataPanel.chart = this.#chart;
    this.#renderAppearance(); this.#renderHistory();
  }

  #renderHistory() {
    const undo = this.querySelector('[data-command="undo"]');
    const redo = this.querySelector('[data-command="redo"]');
    if (undo) undo.disabled = !this.#chart?.canUndo?.();
    if (redo) redo.disabled = !this.#chart?.canRedo?.();
  }

  #setConfig({ path, value }) {
    if (!this.#chart?.config) return false;
    const keys = path.split(".");
    let config = value;
    for (const key of keys.slice().reverse()) config = { [key]: config };
    return this.#runEdit(() => this.#chart.config(config));
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
        patch: (ops) => this.#chart.patch(ops), preview: (ops) => this.#chart.previewTreePresentation(ops) });
      this.#appearanceView.node.addEventListener("config-change", (event) => {
        if (this.#setConfig(event.detail) === false) event.preventDefault();
      });
      container.append(this.#appearanceView.node);
    }
    this.#appearanceView.update({ config, tree: this.#chart.data()?.tree });
  }

}

export function defineClinkerEditor() {
  if (!globalThis.customElements) throw new Error("Custom elements are unavailable in this environment.");
  defineDataPanel();
  if (!customElements.get("clinker-editor")) customElements.define("clinker-editor", ClinkerEditorElement);
  return customElements.get("clinker-editor");
}
