import { createTemplate, colourHex } from "../uiControls.mjs";
import { textAsset } from "./shared/textAsset.js";

const rowTemplates = createTemplate(await textAsset(new URL("./components/data-table/rows.html", import.meta.url)));
const definitions = new WeakMap();

/** Stable rows assembled from HTML templates; fields own their editing behavior. */
export function createEditorRow(document, kind, type, change) {
  if (!definitions.has(document)) definitions.set(document, rowTemplates(document));
  const template = definitions.get(document).getElementById(type || kind);
  const node = document.importNode(template.content, true).firstElementChild;
  const parent = type && type !== "gene";
  const check = node.querySelector('[type="checkbox"]'), swatch = node.querySelector('[type="color"]');
  const visible = node.querySelector("[data-visible]"), arrow = node.querySelector("[data-tree-toggle]");
  const remove = node.querySelector("[data-remove-record]"), count = node.querySelector("[data-count], .cm-editor__tree-count");
  const reorder = node.querySelector("[data-reorder]"), fields = [...node.querySelectorAll("clinker-editable-field")];
  const texts = [...node.querySelectorAll("[data-text]")];
  for (const field of fields) field.addEventListener("value-commit", (event) => {
    const { type, id, field: name } = field.dataset;
    const value = name === "identity" ? Number(event.detail.value) / 100 : event.detail.value.trim();
    if (change(type, id, { [name]: value }, field) === false) event.preventDefault();
  });
  return { node, update(row, selection) {
    const selected = parent ? row.selectIds.length > 0 && row.selectIds.every((id) => selection.has(id)) : selection.has(row.id);
    node.classList.toggle("is-selected", selected);
    node.style.setProperty("--depth", row.depth || 0);
    check.checked = selected;
    check.setAttribute("aria-label", parent ? `Select ${row.count.toLocaleString()} genes in ${row.label}` : `Select ${row.label || row.source}`);
    if (parent) {
      node.dataset.selectIds = JSON.stringify(row.selectIds);
      check.dataset.selectRow = row.key;
      check.indeterminate = !selected && row.selectIds.some((id) => selection.has(id));
      check.setAttribute("aria-checked", check.indeterminate ? "mixed" : String(selected));
      arrow.dataset.treeToggle = row.key; arrow.textContent = row.open ? "▾" : "▸";
      arrow.setAttribute("aria-label", row.open ? "Collapse" : "Expand"); arrow.title = row.open ? "Collapse" : "Expand";
    } else {
      node.dataset.id = row.id; check.dataset.select = row.id;
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
    if (swatch) { swatch.dataset.type = kind; swatch.dataset.id = row.id; swatch.value = colourHex(row.colour); }
    if (visible) {
      const label = row.hidden ? "Show" : "Hide";
      Object.assign(visible.dataset, { type: kind, id: row.id, hidden: String(row.hidden) });
      visible.title = label; visible.setAttribute("aria-label", label); visible.querySelector("[data-slash]").style.display = row.hidden ? "" : "none";
    }
    if (reorder) {
      reorder.dataset.reorder = row.id;
      reorder.setAttribute("aria-label", `Reorder ${row.label}; use Arrow Up or Arrow Down to move it`);
      reorder.title = "Drag to reorder; Arrow Up or Arrow Down moves one place";
    }
    if (remove) {
      const cluster = type === "cluster" || type === "cluster-locus";
      remove.dataset.removeRecord = cluster ? "clusters" : "loci"; remove.dataset.id = row[cluster ? "cluster" : "locus"].uid;
      remove.title = `Remove ${cluster ? "cluster" : "locus"} from plot`; remove.setAttribute("aria-label", remove.title);
    }
    return node;
  }, destroy() { for (const field of fields) field.cancelEdit(); } };
}
