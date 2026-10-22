import { bindDataActionMenus, dataActionMenuMarkup, installDataEditorStyle } from "../dataEditorUi.mjs";
import { setMarkup } from "../uiControls.mjs";

let activeToolbar = null;

/** Mount contextual plot actions without requiring the full data editor. */
export function mountPlotSelectionToolbar(chart, container) {
  if (!chart?.selection || !chart?.flipLoci || !chart?.trimLoci || !chart?.restoreLoci) throw new TypeError("A mounted ClusterMap chart is required.");
  if (!(container instanceof Element)) throw new TypeError("A plot container element is required.");
  const document = container.ownerDocument;
  installDataEditorStyle(document);
  const root = document.createElement("div");
  root.className = "cm-data-ui cm-plot-selection-toolbar";
  root.hidden = true;
  bindDataActionMenus(root);
  const button = (action, text) => `<button type="button" data-action="${action}">${text}</button>`;
  const editor = () => [...document.querySelectorAll("clinker-editor")].find((editor) => editor.chart === chart);
  const lociFor = ({ kind, ids }) => kind === "loci" ? ids :
    (chart.visibleData()?.clusters || []).filter((cluster) => ids.includes(cluster.uid)).flatMap((cluster) => cluster.loci.map((locus) => locus.uid));
  const sync = () => {
    const { kind, ids } = chart.selection(), clusters = kind === "clusters";
    root.hidden = !ids.length;
    const noun = ids.length === 1 ? (clusters ? "cluster" : "locus") : kind;
    const locusActions = button("flip", clusters ? "Flip each locus" : "Flip") + button("trim", clusters ? "Trim each locus" : "Trim");
    setMarkup(root, `<strong>${ids.length} ${noun} selected</strong>` + button("focus", "Focus") +
      (clusters ? dataActionMenuMarkup("Loci…", locusActions + button("restore", "Restore full loci")) : locusActions) +
      dataActionMenuMarkup("More…", (clusters ? "" : button("restore", "Restore full loci")) +
        (editor() ? button("edit", "Edit data…") : "") + button("remove", `Remove selected ${kind}`)) + button("clear", "Clear"));
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
    for (const menu of root.querySelectorAll("details[open]")) menu.open = false;
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
