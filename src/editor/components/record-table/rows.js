import { createTemplate, colourHex } from "../../../ui/controls.mjs";
import { textAsset } from "../../shared/textAsset.js";

const rowTemplates = createTemplate(await textAsset(new URL("./rows.html", import.meta.url)));
const definitions = new WeakMap();

/** Stable rows assembled from HTML templates; fields own their editing behavior. */
export function createEditorRow(document, kind, type) {
  if (!definitions.has(document)) definitions.set(document, rowTemplates(document));
  const template = definitions.get(document).getElementById(type || kind);
  const node = document.importNode(template.content, true).firstElementChild;
  const parent = type && type !== "gene";
  const check = node.querySelector('[type="checkbox"]'), swatch = node.querySelector('[type="color"]');
  const visible = node.querySelector("[data-visible]"), arrow = node.querySelector("[data-tree-toggle]");
  const count = node.querySelector("[data-count], .cm-editor__tree-count");
  const reorder = node.querySelector("[data-reorder]"), fields = [...node.querySelectorAll("clinker-editable-field")];
  const texts = [...node.querySelectorAll("[data-text]")];
  return { node, update(row, selection) {
    const selected = parent ? row.selectIds.length > 0 && row.selectIds.every((id) => selection.has(id)) : selection.has(row.id);
    node.classList.toggle("is-selected", selected);
    node.style.setProperty("--depth", row.depth || 0);
    check.checked = selected;
    check.setAttribute("aria-label", parent ? `Select ${row.count.toLocaleString()} genes in ${row.label}` : `Select ${row.label || row.source}`);
    if (parent) {
      check.indeterminate = !selected && row.selectIds.some((id) => selection.has(id));
      arrow.textContent = row.open ? "▾" : "▸";
      arrow.setAttribute("aria-label", row.open ? "Collapse" : "Expand"); arrow.title = row.open ? "Collapse" : "Expand";
    }
    for (const field of fields) {
      const record = field.dataset.type === "clusters" ? row.cluster : field.dataset.type === "loci" ? row.locus : null;
      field.dataset.id = record?.uid ?? row.id;
      field.value = field.dataset.field === "name"
        ? type === "cluster-locus" && field.dataset.type === "loci" ? row.locusLabel : row.label
        : row[field.dataset.field];
    }
    for (const text of texts) text.title = text.textContent = row[text.dataset.text] ?? "";
    if (count) count.textContent = parent ? `(${row.count.toLocaleString()})` : `${row.count.toLocaleString()} genes`;
    if (swatch) swatch.value = colourHex(row.colour);
    if (visible) {
      const label = row.hidden ? "Show" : "Hide";
      visible.title = label; visible.setAttribute("aria-label", label); visible.querySelector("[data-slash]").style.display = row.hidden ? "" : "none";
    }
    if (reorder) {
      reorder.setAttribute("aria-label", `Reorder ${row.label}; use Arrow Up or Arrow Down to move it`);
    }
    return node;
  }, destroy() { for (const field of fields) field.cancelEdit(); } };
}
