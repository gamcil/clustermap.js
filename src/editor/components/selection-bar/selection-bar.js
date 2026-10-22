import { createTemplate } from "../../../uiControls.mjs";
import { textAsset } from "../../shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./selection-bar.html", import.meta.url)),
  textAsset(new URL("./selection-bar.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class SelectionBar extends HTMLElementBase {
  #summary;
  #actions;
  #all;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css;
    root.append(style, template(this.ownerDocument));
    this.#summary = root.querySelector("span");
    this.#actions = root.querySelector("div");
    this.#all = root.querySelector("[data-all]");
    for (const [selector, name] of [["[data-clear]", "clear-selection"], ["[data-all]", "select-all"]]) {
      root.querySelector(selector).onclick = () => this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    }
  }

  set state({ count, total, all, summary, noun, selectSuffix = "" }) {
    this.#summary.textContent = count ? `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"} selected` : summary;
    this.#summary.classList.toggle("is-selected", count > 0);
    this.#summary.title = summary;
    this.#actions.hidden = !count;
    this.#all.hidden = !total;
    this.#all.disabled = all;
    this.#all.textContent = `Select all ${total.toLocaleString()} visible${selectSuffix}`;
  }
}

export function defineSelectionBar() {
  if (!customElements.get("clinker-selection-bar")) customElements.define("clinker-selection-bar", SelectionBar);
}
