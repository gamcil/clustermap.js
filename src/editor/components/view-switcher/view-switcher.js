import { createTemplate } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./view-switcher.html", import.meta.url)),
  textAsset(new URL("./view-switcher.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class ViewSwitcher extends HTMLElementBase {
  static observedAttributes = ["value", "label"];
  #group;
  #template;
  #buttons = [];
  #observer;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css;
    root.append(style, template(this.ownerDocument));
    this.#group = root.querySelector("div"); this.#template = root.querySelector("template");
    this.#group.onclick = (event) => this.#choose(event.target.closest("button"));
    this.#group.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const buttons = this.#buttons.filter((button) => !button.disabled);
      if (!buttons.length) return;
      const index = buttons.indexOf(event.target);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowLeft" ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault(); buttons[next].focus(); this.#choose(buttons[next]);
    };
    this.#observer = new this.ownerDocument.defaultView.MutationObserver((records) => {
      if (records.some((record) => record.target !== this || record.type === "childList")) this.#renderOptions();
    });
  }

  get value() { return this.getAttribute("value") || ""; }
  set value(value) { if (this.value !== String(value)) this.setAttribute("value", String(value)); }
  attributeChangedCallback() { this.#sync(); }
  connectedCallback() {
    this.#renderOptions();
    this.#observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["value", "label", "disabled"] });
  }
  disconnectedCallback() { this.#observer.disconnect(); }

  #renderOptions() {
    this.#buttons = [...this.querySelectorAll("option")].map((option) => {
      const button = this.ownerDocument.importNode(this.#template.content, true).firstElementChild;
      button.value = option.value; button.textContent = option.label; button.disabled = option.disabled;
      return button;
    });
    this.#group.replaceChildren(...this.#buttons);
    if (!this.hasAttribute("value")) this.value = this.#buttons.find((button) => !button.disabled)?.value || "";
    this.#sync();
  }

  #sync() {
    this.#group.setAttribute("aria-label", this.getAttribute("label") || "View");
    const active = this.#buttons.find((button) => !button.disabled && button.value === this.value)
      || this.#buttons.find((button) => !button.disabled);
    for (const button of this.#buttons) {
      button.setAttribute("aria-pressed", String(button.value === this.value));
      button.tabIndex = button === active ? 0 : -1;
    }
  }

  #choose(button) {
    if (!button || button.disabled || button.value === this.value) return;
    this.value = button.value;
    this.dispatchEvent(new CustomEvent("value-change", { detail: { value: this.value }, bubbles: true, composed: true }));
  }
}

export function defineViewSwitcher() {
  if (!customElements.get("clinker-view-switcher")) customElements.define("clinker-view-switcher", ViewSwitcher);
}
