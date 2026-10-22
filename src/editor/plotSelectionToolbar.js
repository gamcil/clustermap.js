import { installDataEditorStyle } from "../dataEditorUi.mjs";
import { createTemplate } from "../uiControls.mjs";
import { textAsset } from "./shared/textAsset.js";
import { defineActionMenu } from "./components/action-menu/action-menu.js";

const toolbarTemplate = createTemplate(await textAsset(new URL("./components/plot-selection-toolbar/plot-selection-toolbar.html", import.meta.url)));

let activeToolbar = null;

/** Mount contextual plot actions without requiring the full data editor. */
export function mountPlotSelectionToolbar(chart, container) {
  if (!chart?.selection || !chart?.flipLoci || !chart?.trimLoci || !chart?.restoreLoci) throw new TypeError("A mounted ClusterMap chart is required.");
  if (!(container instanceof Element)) throw new TypeError("A plot container element is required.");
  const document = container.ownerDocument;
  defineActionMenu(); installDataEditorStyle(document);
  const root = document.createElement("div");
  root.className = "cm-data-ui cm-plot-selection-toolbar";
  root.hidden = true;
  root.append(toolbarTemplate(document));
  const button = (action) => root.querySelector(`[data-action="${action}"]`);
  const flip = button("flip"), trim = button("trim"), restore = button("restore");
  const lociMenu = root.querySelector("[data-loci-menu]"), moreMenu = root.querySelector("[data-more-menu]");
  let clusterActions;
  const editor = () => [...document.querySelectorAll("clinker-editor")].find((editor) => editor.chart === chart);
  const lociFor = ({ kind, ids }) => kind === "loci" ? ids :
    (chart.visibleData()?.clusters || []).filter((cluster) => ids.includes(cluster.uid)).flatMap((cluster) => cluster.loci.map((locus) => locus.uid));
  const sync = () => {
    const { kind, ids } = chart.selection(), clusters = kind === "clusters";
    root.hidden = !ids.length;
    const noun = ids.length === 1 ? (clusters ? "cluster" : "locus") : kind;
    root.querySelector("strong").textContent = `${ids.length} ${noun} selected`;
    flip.textContent = clusters ? "Flip each locus" : "Flip"; trim.textContent = clusters ? "Trim each locus" : "Trim";
    button("edit").hidden = !editor(); button("remove").textContent = `Remove selected ${kind}`;
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
    else if (action === "edit") editor()?.editSelection(selection);
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
