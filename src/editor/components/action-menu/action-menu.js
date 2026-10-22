import { createTemplate, mountComponent } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./action-menu.html", import.meta.url)),
  textAsset(new URL("./action-menu.css", import.meta.url)),
]);
const template = createTemplate(markup);
const activeMenus = new WeakMap();
const HTMLElementBase = globalThis.HTMLElement || class {};

class ActionMenu extends HTMLElementBase {
  static observedAttributes = ["label", "open"];
  #details;
  #trigger;
  #outside = (event) => { if (!event.composedPath().includes(this)) this.open = false; };

  constructor() {
    super();
    const root = mountComponent(this, template, css);
    this.#details = root.querySelector("details");
    this.#trigger = root.querySelector("summary");
    this.#details.ontoggle = () => { this.open = this.#details.open; };
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || !this.open) return;
      this.open = false; this.#trigger.focus(); event.preventDefault(); event.stopPropagation();
    });
  }

  get open() { return this.#details.open; }
  set open(value) {
    this.#details.open = Boolean(value);
    this.toggleAttribute("open", this.#details.open);
  }
  connectedCallback() { this.#syncOpen(); }
  disconnectedCallback() { this.open = false; this.#release(); }

  attributeChangedCallback(name) {
    if (name === "label") this.#trigger.textContent = this.getAttribute("label") || "Actions";
    else { this.#details.open = this.hasAttribute("open"); this.#syncOpen(); }
  }

  #syncOpen() {
    if (!this.open || !this.isConnected) { this.#release(); return; }
    const previous = activeMenus.get(this.ownerDocument);
    if (previous && previous !== this) previous.open = false;
    activeMenus.set(this.ownerDocument, this);
    this.ownerDocument.addEventListener("pointerdown", this.#outside, true);
  }

  #release() {
    this.ownerDocument.removeEventListener("pointerdown", this.#outside, true);
    if (activeMenus.get(this.ownerDocument) === this) activeMenus.delete(this.ownerDocument);
  }
}

export function defineActionMenu() {
  if (!customElements.get("clinker-action-menu")) customElements.define("clinker-action-menu", ActionMenu);
}
