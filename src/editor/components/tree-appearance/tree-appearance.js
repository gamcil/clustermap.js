import { createTemplate, mountComponent } from "../../../ui/controls.mjs";
import { TREE_COLOURING_DEFAULTS, resolveTreePresentation, validateTreePresentation } from "../../../tree/presentation.mjs";
import { textAsset } from "../../shared/textAsset.js";
import { controlStyles } from "../../shared/controls.mjs";

const [markup, css] = await Promise.all([
  textAsset(new URL("./tree-appearance.html", import.meta.url)),
  textAsset(new URL("./tree-appearance.css", import.meta.url)),
]);
const template = createTemplate(markup);
const palettes = { muted: TREE_COLOURING_DEFAULTS.palette, accessible: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#56b4e9"] };
const HTMLElementBase = globalThis.HTMLElement || class {};

class TreeAppearance extends HTMLElementBase {
  #state;
  #height;
  #slider;
  #previewing = false;
  #cancelled = false;

  constructor() {
    super();
    const root = mountComponent(this, template, controlStyles + css);
    this.#height = root.querySelector("[data-height]"); this.#slider = root.querySelector('[type="range"]');
    root.querySelector("[data-enabled]").onchange = (event) => this.#change({ mode: event.target.checked ? "cutHeight" : "none" });
    this.#height.onchange = () => { if (this.#height.reportValidity()) this.#change({ cutHeight: Number(this.#height.value) }); };
    root.querySelector("[data-auto]").onclick = () => this.#change({ cutHeight: "auto" });
    root.querySelector("select").onchange = (event) => this.#change({ palette: palettes[event.target.value] || this.#state.policy.palette });
    root.querySelector("[data-line]").onchange = (event) => this.#change({ showCutLine: event.target.checked });
    root.querySelector("[data-reset]").onclick = () => this.#emit("reset-styles");
    this.#slider.oninput = () => {
      this.#cancelled = false; this.#previewing = true; this.#height.value = this.#slider.value;
      if (!this.#emit("colouring-preview", { cutHeight: Number(this.#slider.value) })) this.#cancelPreview();
    };
    this.#slider.onchange = () => { if (!this.#cancelled) this.#change({ cutHeight: Number(this.#slider.value) }); };
    this.#slider.onkeydown = (event) => { if (event.key === "Escape") { this.#cancelPreview(); event.preventDefault(); } };
    this.#slider.onpointercancel = () => this.#cancelPreview();
  }

  set state({ tree, config }) {
    if (!tree) { if (this.#previewing) this.#cancelPreview(); this.#state = null; return; }
    const { policy, height } = resolveTreePresentation(tree, config);
    let compatible = tree.distance?.kind === "mergeHeight";
    try { validateTreePresentation({ ...tree, presentation: { ...tree.presentation, colouring: { ...policy, mode: "cutHeight" } } }, config); }
    catch { compatible = false; }
    this.#state = { policy, height, compatible,
      canReset: Boolean(Object.keys(tree.presentation?.nodes || {}).length || Object.keys(tree.presentation?.subtrees || {}).length) };
    this.#previewing = false; this.#sync();
  }
  set error(message) { const status = this.shadowRoot.querySelector("p"); status.textContent = message; status.hidden = !message; }
  disconnectedCallback() { if (this.#previewing) this.#cancelPreview(); }

  #emit(type, detail) { return this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true })); }
  #change(changes) { if (!this.#emit("colouring-change", changes)) this.#cancelPreview(); }
  #cancelPreview() {
    this.#cancelled = true; this.#previewing = false; this.#emit("colouring-preview", null); this.#sync();
  }
  #sync() {
    if (!this.#state) return;
    const { policy, height, compatible, canReset } = this.#state, root = this.shadowRoot;
    root.querySelector("fieldset").hidden = !compatible;
    root.querySelector("[data-enabled]").checked = policy.mode === "cutHeight";
    root.querySelector("[data-options]").hidden = policy.mode !== "cutHeight";
    const actual = policy.cutHeight === "auto" ? height * 0.7 : policy.cutHeight;
    this.#height.value = actual;
    Object.assign(this.#slider, { max: String(Math.max(height, actual) || 1), step: String(height / 1000 || 0.001), value: actual });
    root.querySelector("[data-auto]").setAttribute("aria-pressed", String(policy.cutHeight === "auto"));
    const palette = Object.keys(palettes).find((key) => JSON.stringify(palettes[key]) === JSON.stringify(policy.palette)) || "custom";
    root.querySelector('[value="custom"]').hidden = palette !== "custom";
    root.querySelector("select").value = palette;
    root.querySelector("[data-line]").checked = policy.showCutLine;
    root.querySelector("[data-reset]").disabled = !canReset;
  }
}

export function defineTreeAppearance() {
  if (!customElements.get("clinker-tree-appearance")) customElements.define("clinker-tree-appearance", TreeAppearance);
}
