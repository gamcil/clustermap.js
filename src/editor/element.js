import { createTemplate } from "../uiControls.mjs";
import { applyTheme, resolveTheme } from "../theme.mjs";
import { defineAppearancePanel } from "./components/appearance-panel/appearance-panel.js";
import { defineTabs } from "./components/tabs/tabs.js";
import { defineDataPanel } from "./components/data-panel/data-panel.js";
import { textAsset } from "./shared/textAsset.js";

const shellTemplate = createTemplate(await textAsset(new URL("./element.html", import.meta.url)));
const HTMLElementBase = globalThis.HTMLElement || class {};

/** Optional editor for an already rendered chart; edits use its public API. */
export class ClinkerEditorElement extends HTMLElementBase {
  #chart = null;
  #dataPanel = null;
  #appearancePanel = null;
  #unsubscribe = null;
  #resizeStart = null;
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
    defineTabs(); defineDataPanel(); defineAppearancePanel();
    this.classList.add("cm-editor", "cm-data-ui");
    if (!this.#dataPanel) this.#renderShell();
    this.ownerDocument.addEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#subscribe(); this.#render();
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#resizeStart = null;
    this.#unsubscribe?.(); this.#unsubscribe = null;
  }

  get chart() { return this.#chart; }
  set chart(value) {
    if (value === this.#chart) return;
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
    this.#renderShell(); this.#render();
    return this;
  }

  #renderShell() {
    this.replaceChildren(shellTemplate(this.ownerDocument));
    this.#dataPanel = this.querySelector("clinker-data-panel");
    this.#appearancePanel = this.querySelector("clinker-appearance-panel");
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (["config.change", "theme.change", "state.replace"].includes(change.type)) this.#syncTheme();
      if (change.type === "history.change") this.#renderHistory();
    });
  }

  #render() {
    if (!this.isConnected) return;
    if (this.#dataPanel) this.#dataPanel.chart = this.#chart;
    if (this.#appearancePanel) this.#appearancePanel.chart = this.#chart;
    this.#syncTheme(); this.#renderHistory();
  }

  #renderHistory() {
    const undo = this.querySelector('[data-command="undo"]');
    const redo = this.querySelector('[data-command="redo"]');
    if (undo) undo.disabled = !this.#chart?.canUndo?.();
    if (redo) redo.disabled = !this.#chart?.canRedo?.();
  }

  #syncTheme() {
    const config = this.#chart?.config?.();
    if (config) applyTheme(this, resolveTheme(config.plot.theme));
  }

}

export function defineClinkerEditor() {
  if (!globalThis.customElements) throw new Error("Custom elements are unavailable in this environment.");
  defineDataPanel();
  if (!customElements.get("clinker-editor")) customElements.define("clinker-editor", ClinkerEditorElement);
  return customElements.get("clinker-editor");
}
