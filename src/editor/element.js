import { createTemplate, upgradeProperty } from "../uiControls.mjs";
import { applyEditorTheme, editorThemeStyles } from "./shared/theme.js";
import { controlStyles } from "./shared/controlStyles.js";
import { defineAppearancePanel } from "./components/appearance-panel/appearance-panel.js";
import { defineTabs } from "./components/tabs/tabs.js";
import { defineDataPanel } from "./components/data-panel/data-panel.js";
import { textAsset } from "./shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./element.html", import.meta.url)),
  textAsset(new URL("./editor.css", import.meta.url)),
]);
const shellTemplate = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

/** Optional editor for an already rendered chart; edits use its public API. */
export class ClinkerEditorElement extends HTMLElementBase {
  #chart = null;
  #dataPanel = null;
  #appearancePanel = null;
  #unsubscribe = null;
  #resizeStart = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controlStyles + editorThemeStyles + css;
    root.append(style);
    root.addEventListener("click", (event) => {
      const command = event.target.closest("[data-command]")?.dataset.command;
      if (command === "undo") this.#chart?.undo?.();
      else if (command === "redo") this.#chart?.redo?.();
    });
    root.addEventListener("pointerdown", (event) => {
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
    upgradeProperty(this, "chart");
  }

  connectedCallback() {
    this.classList.add("cm-editor", "cm-data-ui");
    if (!this.#dataPanel) this.#renderShell();
    this.#subscribe(); this.#render();
  }

  disconnectedCallback() {
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
    if (!this.#dataPanel) { this.#renderShell(); this.#render(); }
    this.hidden = false;
    this.shadowRoot.querySelector("[data-editor-tabs]")?.setAttribute("value", "data");
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true, composed: true }));
    return this.#dataPanel;
  }

  reset() {
    this.#renderShell(); this.#render();
    return this;
  }

  #renderShell() {
    defineTabs(); defineDataPanel(); defineAppearancePanel();
    this.shadowRoot.querySelector("[data-editor-shell]")?.remove();
    this.shadowRoot.append(shellTemplate(this.ownerDocument));
    this.#dataPanel = this.shadowRoot.querySelector("clinker-data-panel");
    this.#appearancePanel = this.shadowRoot.querySelector("clinker-appearance-panel");
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (["config.change", "theme.change", "state.replace"].includes(change.type)) this.#syncTheme();
      if (change.type === "history.change") this.#renderHistory();
    });
  }

  #render() {
    if (!this.#dataPanel) return;
    this.#dataPanel.chart = this.#chart;
    this.#appearancePanel.chart = this.#chart;
    this.#syncTheme(); this.#renderHistory();
  }

  #renderHistory() {
    const undo = this.shadowRoot.querySelector('[data-command="undo"]');
    const redo = this.shadowRoot.querySelector('[data-command="redo"]');
    if (undo) undo.disabled = !this.#chart?.canUndo?.();
    if (redo) redo.disabled = !this.#chart?.canRedo?.();
  }

  #syncTheme() {
    applyEditorTheme(this, this.#chart?.config?.());
  }

}

export function defineClinkerEditor() {
  if (!globalThis.customElements) throw new Error("Custom elements are unavailable in this environment.");
  defineDataPanel();
  if (!customElements.get("clinker-editor")) customElements.define("clinker-editor", ClinkerEditorElement);
  return customElements.get("clinker-editor");
}
