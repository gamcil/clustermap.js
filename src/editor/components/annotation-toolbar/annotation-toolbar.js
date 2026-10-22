import { createTemplate, mountComponent, updateSelectOptions } from "../../../ui/controls.mjs";
import { textAsset } from "../../../ui/assets.mjs";
import { controlStyles } from "../../shared/controls.mjs";

const [markup, css] = await Promise.all([
  textAsset(new URL("./annotation-toolbar.html", import.meta.url)),
  textAsset(new URL("./annotation-toolbar.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class AnnotationToolbar extends HTMLElementBase {
  #select;
  #buttons;

  constructor() {
    super();
    const root = mountComponent(this, template, controlStyles + css);
    this.#select = root.querySelector("select");
    this.#buttons = Object.fromEntries([...root.querySelectorAll("button")].map((button) => [button.dataset.action, button]));
    this.#select.onchange = () => this.#emit("panel-change", { value: this.#select.value });
    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (button && !button.disabled) this.#emit("panel-action", { action: button.dataset.action });
    });
    this.state = {};
  }

  set state({ panels = [], value = null, creating = false }) {
    const panel = panels.find(({ uid }) => uid === value), index = panels.indexOf(panel);
    updateSelectOptions(this.#select, panels.map(({ uid, title }) => [uid, title || uid]));
    this.#select.value = value ?? ""; this.#select.hidden = !panels.length;
    for (const [action, button] of Object.entries(this.#buttons)) {
      button.hidden = action !== "add" && (!panel || creating || action === "replace" && panel.type === "groups");
    }
    this.#buttons.add.textContent = creating ? "Cancel" : "Add panel";
    this.#buttons.show.textContent = panel?.show === false ? "Show" : "Hide";
    this.#buttons.left.disabled = index <= 0;
    this.#buttons.right.disabled = index < 0 || index === panels.length - 1;
  }

  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
}

export function defineAnnotationToolbar() {
  if (!customElements.get("clinker-annotation-toolbar")) customElements.define("clinker-annotation-toolbar", AnnotationToolbar);
}
