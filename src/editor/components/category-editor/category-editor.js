import { createTemplate, mountComponent, colourHex, updateSelectOptions } from "../../../ui/controls.mjs";
import { textAsset } from "../../../ui/assets.mjs";
import { controlStyles } from "../../shared/controls.mjs";
import { defineEditableField } from "../editable-field/editable-field.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./category-editor.html", import.meta.url)),
  textAsset(new URL("./category-editor.css", import.meta.url)),
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class CategoryEditor extends HTMLElementBase {
  #value = [];
  #palette = ["#888888"];
  #revision = 0;
  #rows = new Map();
  #details;
  #items;
  #template;
  #form;
  #name;
  #colour;
  #removal;
  #replacement;
  #removing = null;

  constructor() {
    super();
    const root = mountComponent(this, template, controlStyles + css);
    this.#details = root.querySelector("details"); this.#items = root.querySelector("[data-items]");
    this.#template = this.#items.querySelector("template"); this.#form = root.querySelector("form");
    this.#name = this.#form.querySelector('[type="text"]'); this.#colour = this.#form.querySelector('[type="color"]');
    this.#removal = root.querySelector("[data-removal]"); this.#replacement = this.#removal.querySelector("select");
    this.#name.oninput = () => this.#name.setCustomValidity("");
    this.#form.onsubmit = (event) => {
      event.preventDefault(); const name = this.#name.value.trim();
      if (this.#validateName(name, this.#name) && this.#propose([...this.#value, { name, colour: this.#colour.value }])) this.#name.value = "";
    };
    root.querySelector("[data-cancel]").onclick = () => this.#cancelRemoval();
    root.querySelector("[data-confirm]").onclick = () => {
      const replacement = this.#replacement.value === "missing" ? null : this.#value[Number(this.#replacement.value)].name;
      if (this.#propose(this.#value.filter(({ name }) => name !== this.#removing), [[this.#removing, replacement]])) {
        this.#removing = null; this.#renderRemoval(); this.#name.focus();
      }
    };
    this.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && this.#removing !== null) {
        event.preventDefault(); event.stopPropagation(); this.#cancelRemoval();
      }
    });
    this.#render();
  }

  get value() { return this.#value; }
  set value(items) {
    if (items.length === this.#value.length && items.every(({ name, colour }, index) =>
      name === this.#value[index].name && colour === this.#value[index].colour)) return;
    this.#value = items.map(({ name, colour }) => ({ name, colour }));
    this.#revision++; this.#render();
  }
  set palette(colours) { this.#palette = colours.length ? colours.map((colour) => colourHex(colour)) : ["#888888"]; this.#suggestColour(); }
  get open() { return this.#details.open; }
  set open(value) { this.#details.open = Boolean(value); }
  disconnectedCallback() { this.cancelEdit(); }
  cancelEdit() { for (const row of this.#rows.values()) row.querySelector("clinker-editable-field").cancelEdit(); }

  #validateName(name, control, previous) {
    control.setCustomValidity(!name ? "Category names cannot be empty." : name !== previous && this.#value.some((item) => item.name === name) ? "Category names must be unique." : "");
    return control.reportValidity();
  }

  #propose(value, replacements = []) {
    const revision = this.#revision;
    if (!this.dispatchEvent(new CustomEvent("value-commit", { detail: { value, replacements }, bubbles: true, composed: true, cancelable: true }))) return false;
    if (this.isConnected && revision === this.#revision) this.value = value;
    return true;
  }

  #createRow(name) {
    const row = this.ownerDocument.importNode(this.#template.content, true).firstElementChild;
    const colour = row.querySelector("input"), label = row.querySelector("clinker-editable-field"), remove = row.querySelector("button");
    colour.onchange = () => {
      if (!this.#propose(this.#value.map((item) => item.name === name ? { ...item, colour: colour.value } : item))) colour.value = colourHex(this.#value.find((item) => item.name === name).colour);
    };
    label.addEventListener("value-commit", (event) => {
      event.stopPropagation(); const next = event.detail.value.trim();
      if (!this.#validateName(next, label, name) || !this.#propose(this.#value.map((item) => item.name === name ? { ...item, name: next } : item), [[name, next]])) event.preventDefault();
      else label.value = next;
    });
    remove.onclick = () => { this.#removing = name; this.#renderRemoval(); this.#replacement.focus(); };
    colour.setAttribute("aria-label", `Colour for ${name}`); label.setAttribute("label", `Rename category ${name}`);
    remove.setAttribute("aria-label", `Remove category ${name}`);
    return row;
  }

  #render() {
    this.shadowRoot.querySelector("summary").textContent = `Categories (${this.#value.length})`;
    for (const [name, row] of this.#rows) if (!this.#value.some((item) => item.name === name)) {
      row.querySelector("clinker-editable-field").cancelEdit(); row.remove(); this.#rows.delete(name);
    }
    let next = this.#form;
    for (const item of [...this.#value].reverse()) {
      let row = this.#rows.get(item.name);
      if (!row) { row = this.#createRow(item.name); this.#rows.set(item.name, row); }
      row.querySelector("input").value = colourHex(item.colour); row.querySelector("clinker-editable-field").value = item.name;
      if (row.nextSibling !== next) this.#items.insertBefore(row, next);
      next = row;
    }
    if (!this.#value.some(({ name }) => name === this.#removing)) this.#removing = null;
    this.#renderRemoval(); this.#suggestColour();
  }

  #suggestColour() {
    const used = new Set(this.#value.map(({ colour }) => colourHex(colour)));
    this.#colour.value = this.#palette.find((colour) => !used.has(colour)) || this.#palette[this.#value.length % this.#palette.length] || "#888888";
  }

  #renderRemoval() {
    this.#removal.hidden = this.#removing === null;
    if (this.#removing === null) return;
    this.#removal.querySelector("span").textContent = `Replace “${this.#removing}” with`;
    updateSelectOptions(this.#replacement, [["missing", "Missing"], ...this.#value.flatMap(({ name }, index) => name === this.#removing ? [] : [[String(index), name]])]);
    this.#replacement.value = "missing";
  }

  #cancelRemoval() {
    const name = this.#removing; this.#removing = null; this.#renderRemoval();
    this.#rows.get(name)?.querySelector("button").focus();
  }
}

export function defineCategoryEditor() {
  defineEditableField();
  if (!customElements.get("clinker-category-editor")) customElements.define("clinker-category-editor", CategoryEditor);
}
