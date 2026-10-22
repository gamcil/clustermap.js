import { createTemplate, mountComponent } from "../../../ui/controls.mjs";
import { textAsset } from "../../shared/textAsset.js";
import { bindOptionButtons } from "../../shared/optionButtons.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./tabs.html", import.meta.url)),
  textAsset(new URL("./tabs.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};
let nextId = 0;

class Tabs extends HTMLElementBase {
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
    const root = mountComponent(this, template, css);
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

export function defineTabs() {
  if (!customElements.get("clinker-tabs")) customElements.define("clinker-tabs", Tabs);
}
