import { m as mountComponent, c as createTemplate, a as controlStyles, u as upgradeProperty } from './editor/search-field-1d7e270f.mjs';
import { e as editorThemeStyles, a as applyEditorTheme } from './editor/theme-4b8fbd52.mjs';
import { d as defineAppearancePanel } from './editor/appearance-panel-37902b60.mjs';
export { C as ClinkerAppearancePanelElement, d as defineAppearancePanel } from './editor/appearance-panel-37902b60.mjs';
import { b as bindOptionButtons, d as defineDataPanel } from './editor/data-panel-a477e801.mjs';
export { C as ClinkerDataPanelElement, d as defineDataPanel } from './editor/data-panel-a477e801.mjs';
import { d as defineActionMenu, i as installDataEditorStyle, a as installStyle } from './editor/annotation-editor-78c3fb84.mjs';

const [markup$1, css$2] = await Promise.all([
  "<div part=\"tab-list\" role=\"tablist\">\n  <template><button type=\"button\" role=\"tab\"></button></template>\n</div>\n<slot name=\"status\"></slot>\n<div part=\"panels\">\n  <template><div role=\"tabpanel\" tabindex=\"0\"><slot></slot></div></template>\n</div>\n",
  ":host { display: flex; flex: 1; flex-direction: column; min-height: 0; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\n[role=tablist] { display: flex; flex-shrink: 0; gap: 4px; margin-bottom: 10px; border-bottom: 1px solid var(--cm-border, #e1e5ea); }\nbutton {\n  box-sizing: border-box;\n  min-height: 30px;\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 0;\n  border-bottom: 2px solid transparent;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n}\nbutton[aria-selected=true] { border-bottom-color: var(--cm-accent, #1677ff); font-weight: 600; }\nbutton:hover:not(:disabled) { background: var(--cm-hover, #e3ecf8); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\n[part=panels], [role=tabpanel] { display: flex; flex: 1; flex-direction: column; min-height: 0; }\n[role=tabpanel]:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\nslot { display: contents; }\n",
]);
const template = createTemplate(markup$1);
const HTMLElementBase$1 = globalThis.HTMLElement || class {};
let nextId = 0;

class Tabs extends HTMLElementBase$1 {
  static observedAttributes = ["value", "label"];
  #prefix = `clinker-tabs-${++nextId}`;
  #list;
  #content;
  #buttonTemplate;
  #panelTemplate;
  #tabs = [];
  #observer;

  constructor() {
    super();
    const root = mountComponent(this, template, css$2);
    this.#list = root.querySelector("[role=tablist]"); this.#content = root.querySelector("[part=panels]");
    this.#buttonTemplate = this.#list.querySelector("template"); this.#panelTemplate = this.#content.querySelector("template");
    bindOptionButtons(this.#list, (button) => {
      if (!button || button.disabled || button.value === this.value) return;
      this.value = button.value;
      this.dispatchEvent(new CustomEvent("value-change", { detail: { value: this.value }, bubbles: true, composed: true }));
    });
    this.#observer = new this.ownerDocument.defaultView.MutationObserver((records) => {
      if (records.some((record) => record.type === "childList" ? record.target === this : record.target.parentElement === this)) this.#mountPanels();
    });
  }

  get value() { return this.getAttribute("value") || ""; }
  set value(value) { if (this.value !== String(value)) this.setAttribute("value", String(value)); }
  attributeChangedCallback() { this.#sync(); }
  connectedCallback() {
    this.#mountPanels();
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["name", "label", "disabled"] });
  }
  disconnectedCallback() { this.#observer.disconnect(); }

  #mountPanels() {
    this.#tabs = [...this.children].filter((panel) => panel.hasAttribute("name")).map((panel, index) => {
      const button = this.ownerDocument.importNode(this.#buttonTemplate.content, true).firstElementChild;
      const wrapper = this.ownerDocument.importNode(this.#panelTemplate.content, true).firstElementChild;
      const id = `${this.#prefix}-${index}`, name = panel.getAttribute("name");
      panel.slot = id; wrapper.id = id; wrapper.querySelector("slot").name = id;
      button.id = `${id}-tab`; button.value = name; button.textContent = panel.getAttribute("label") || name;
      button.disabled = panel.hasAttribute("disabled"); button.setAttribute("aria-controls", id); wrapper.setAttribute("aria-labelledby", button.id);
      return { name, panel, button, wrapper };
    });
    this.#list.replaceChildren(this.#buttonTemplate, ...this.#tabs.map(({ button }) => button));
    this.#content.replaceChildren(this.#panelTemplate, ...this.#tabs.map(({ wrapper }) => wrapper));
    this.#sync();
  }

  #sync() {
    this.#list.setAttribute("aria-label", this.getAttribute("label") || "Sections");
    const active = this.#tabs.find((tab) => tab.name === this.value && !tab.button.disabled) || this.#tabs.find((tab) => !tab.button.disabled);
    if (active && active.name !== this.value) { this.value = active.name; return; }
    for (const tab of this.#tabs) {
      const selected = tab === active;
      tab.button.setAttribute("aria-selected", String(selected)); tab.button.tabIndex = selected ? 0 : -1;
      tab.panel.hidden = tab.wrapper.hidden = !selected;
    }
  }
}

function defineTabs() {
  if (!customElements.get("clinker-tabs")) customElements.define("clinker-tabs", Tabs);
}

const [markup, css$1] = await Promise.all([
  "<div data-editor-shell>\n<div class=\"cm-editor__resize-handle\" data-resize role=\"separator\" aria-label=\"Resize plot editor\" aria-orientation=\"horizontal\"></div>\n<header part=\"header\" class=\"cm-editor__header\">\n  <h2 class=\"cm-editor__title\">Plot editor</h2>\n  <div>\n    <button type=\"button\" data-command=\"undo\" disabled>Undo</button>\n    <button type=\"button\" data-command=\"redo\" disabled>Redo</button>\n  </div>\n</header>\n<clinker-tabs part=\"tabs\" data-editor-tabs label=\"Plot editor sections\" value=\"data\">\n  <clinker-data-panel part=\"data\" name=\"data\" label=\"Data\"></clinker-data-panel>\n  <clinker-appearance-panel part=\"appearance\" name=\"appearance\" label=\"Appearance\" hidden></clinker-appearance-panel>\n</clinker-tabs>\n</div>\n",
  "@layer clinker-editor {\n  :host { display: flex; min-height: 180px; box-sizing: border-box; flex-direction: column; padding: 10px; border: 1px solid var(--cm-border,#d7dce3); border-radius: 10px; }\n  :host([resizable]) { overflow: hidden; }\n  .cm-editor__resize-handle { height: 10px; flex: 0 0 10px; margin: -10px -10px 0; cursor: ns-resize; touch-action: none; }\n  .cm-editor__resize-handle::after { display: block; width: 36px; height: 3px; margin: 4px auto; border-radius: 3px; background: var(--cm-muted,#aaa); content: \"\"; }\n  .cm-editor__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }\n  .cm-editor__title { margin: 0; font-size: 17px; letter-spacing: -.01em; }\n  [data-editor-shell] { display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; }\n}\n",
]);
const shellTemplate = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

/** Optional editor for an already rendered chart; edits use its public API. */
class ClinkerEditorElement extends HTMLElementBase {
  #chart = null;
  #dataPanel = null;
  #appearancePanel = null;
  #unsubscribe = null;
  #resizeStart = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controlStyles + editorThemeStyles + css$1;
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

function defineClinkerEditor() {
  if (!globalThis.customElements) throw new Error("Custom elements are unavailable in this environment.");
  defineDataPanel();
  if (!customElements.get("clinker-editor")) customElements.define("clinker-editor", ClinkerEditorElement);
  return customElements.get("clinker-editor");
}

const toolbarTemplate = createTemplate(await "<strong></strong>\n<button type=\"button\" data-action=\"focus\">Focus</button>\n<button type=\"button\" data-action=\"flip\">Flip</button>\n<button type=\"button\" data-action=\"trim\">Trim</button>\n<clinker-action-menu label=\"Loci…\" data-loci-menu hidden>\n  <button type=\"button\" data-action=\"restore\">Restore full loci</button>\n</clinker-action-menu>\n<clinker-action-menu label=\"More…\" data-more-menu>\n  <button type=\"button\" data-action=\"edit\">Edit data…</button>\n  <button type=\"button\" data-action=\"remove\"></button>\n</clinker-action-menu>\n<button type=\"button\" data-action=\"clear\">Clear</button>\n");
const css = await "@layer clinker-editor {\n  .cm-plot-selection-toolbar { position: absolute; z-index: 2; top: 12px; left: 12px; display: flex; align-items: center; gap: 6px; padding: 7px 8px; border: 1px solid var(--cm-border,#c7d9f1); border-radius: 8px; background: var(--cm-surface,rgba(255,255,255,.94)); box-shadow: 0 3px 12px rgba(23,36,54,.12); color: var(--cm-foreground,#273444); font: 13px/1.4 system-ui, sans-serif; }\n  .cm-plot-selection-toolbar[hidden] { display: none; }\n  .cm-plot-selection-toolbar strong { padding: 4px 6px; border-radius: 5px; background: var(--cm-hover,#e7f0ff); color: var(--cm-accent,#184a86); }\n  .cm-plot-selection-toolbar button { min-height: 28px; box-sizing: border-box; border: 1px solid var(--cm-border,#cbd3de); border-radius: 6px; padding: 3px 7px; background: var(--cm-surface,#fff); color: inherit; font: inherit; cursor: pointer; }\n  .cm-plot-selection-toolbar button:hover { border-color: var(--cm-accent,#78a9ed); background: var(--cm-hover,#f4f8ff); }\n}\n";

let activeToolbar = null;

/** Mount contextual plot actions without requiring the full data editor. */
function mountPlotSelectionToolbar(chart, container, { editor = null } = {}) {
  if (!chart?.selection || !chart?.flipLoci || !chart?.trimLoci || !chart?.restoreLoci) throw new TypeError("A mounted ClusterMap chart is required.");
  if (!(container instanceof Element)) throw new TypeError("A plot container element is required.");
  const document = container.ownerDocument;
  const scope = container.getRootNode();
  defineActionMenu(); installDataEditorStyle(scope); installStyle(scope, "clinker-plot-selection-style", css);
  const root = document.createElement("div");
  root.className = "cm-data-ui cm-plot-selection-toolbar";
  root.hidden = true;
  root.append(toolbarTemplate(document));
  const button = (action) => root.querySelector(`[data-action="${action}"]`);
  const flip = button("flip"), trim = button("trim"), restore = button("restore");
  const lociMenu = root.querySelector("[data-loci-menu]"), moreMenu = root.querySelector("[data-more-menu]");
  let clusterActions;
  const lociFor = ({ kind, ids }) => kind === "loci" ? ids :
    (chart.visibleData()?.clusters || []).filter((cluster) => ids.includes(cluster.uid)).flatMap((cluster) => cluster.loci.map((locus) => locus.uid));
  const sync = () => {
    const { kind, ids } = chart.selection(), clusters = kind === "clusters";
    root.hidden = !ids.length;
    const noun = ids.length === 1 ? (clusters ? "cluster" : "locus") : kind;
    root.querySelector("strong").textContent = `${ids.length} ${noun} selected`;
    flip.textContent = clusters ? "Flip each locus" : "Flip"; trim.textContent = clusters ? "Trim each locus" : "Trim";
    button("edit").hidden = !editor; button("remove").textContent = `Remove selected ${kind}`;
    if (clusterActions !== clusters) {
      if (clusters) lociMenu.prepend(flip, trim, restore);
      else { root.insertBefore(flip, lociMenu); root.insertBefore(trim, lociMenu); moreMenu.prepend(restore); }
      lociMenu.open = moreMenu.open = false;
      lociMenu.hidden = !clusters; clusterActions = clusters;
    }
    if (root.hidden) lociMenu.open = moreMenu.open = false;
  };
  const clear = () => chart.selection({ kind: chart.selection().kind, ids: [] });
  const activate = () => { activeToolbar = root; };
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const selection = chart.selection(), loci = lociFor(selection);
    if (action === "flip") chart.flipLoci(loci);
    else if (action === "trim") chart.trimLoci(loci);
    else if (action === "restore") chart.restoreLoci(loci);
    else if (action === "clear") clear();
    else if (action === "edit") editor?.editSelection(selection);
    else if (action === "focus") chart.focus({ [selection.kind]: selection.ids });
    else if (action === "remove" && document.defaultView.confirm(`Remove ${selection.ids.length} ${selection.kind} and their contents from the plot? This can be undone.`)) {
      chart.remove({ [selection.kind]: selection.ids });
    }
    for (const menu of root.querySelectorAll("clinker-action-menu[open]")) menu.open = false;
  });
  const onKeyDown = (event) => {
    if (activeToolbar !== root || event.key !== "Escape" || event.defaultPrevented || !chart.selection().ids.length) return;
    if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault(); clear();
  };
  container.addEventListener("pointerdown", activate);
  container.addEventListener("focusin", activate);
  document.addEventListener("keydown", onKeyDown);
  const unsubscribe = chart.on("change", (change) => {
    if (["selection.change", "state.replace", "data.apply", "data.replace"].includes(change.type)) sync();
  });
  container.append(root);
  sync();
  return () => {
    unsubscribe();
    if (activeToolbar === root) activeToolbar = null;
    container.removeEventListener("pointerdown", activate);
    container.removeEventListener("focusin", activate);
    document.removeEventListener("keydown", onKeyDown);
    root.remove();
  };
}

if (globalThis.customElements) defineClinkerEditor();

export { ClinkerEditorElement, defineClinkerEditor, mountPlotSelectionToolbar };
