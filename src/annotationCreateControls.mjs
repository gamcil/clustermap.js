import { createControls, createActionRunner } from "./uiControls.mjs";
import { csvFormatRows } from "d3-dsv";
import { parseAnnotationTable } from "./annotationData.mjs";

/** Small data-entry form; panel validation and history remain in the patch API. */
export function createAnnotationCreateControls({ document, getClusters, getPanels, getTree, patch, onCreate, annotationApi }) {
  const { validateAnnotationPanels } = annotationApi;
  const node = document.createElement("form");
  const ui = createControls(document);
  const type = ui.select(ui.row(node, "Type"), "Type", "heatmap", [["heatmap", "Heatmap"], ["bar", "Bar chart"], ["groups", "Group markers"]]);
  const title = ui.input(ui.row(node, "Title"), "Title", "");
  const scale = ui.select(ui.row(node, "Values"), "Values", "continuous", [["continuous", "Numeric"], ["categorical", "Categories"]]);
  type.onchange = () => {
    const groups = type.value === "groups";
    scale.parentElement.hidden = groups;
    scale.disabled = type.value === "bar";
    if (scale.disabled) scale.value = "continuous";
    help.textContent = groups ? "Define groups as JSON. Each needs a uid, a label, and either clusterIds or a tree nodeUid. Colours are optional."
      : tableHelp;
    data.value = groups ? JSON.stringify({ groups: [{ uid: "group-1", label: "Example group",
      clusterIds: getClusters().slice(0, 2).map((cluster) => cluster.uid) }] }, null, 2) : tableTemplate;
  };
  const help = document.createElement("p");
  const tableHelp = "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
  help.textContent = tableHelp;
  node.append(help);
  const data = ui.el("textarea", undefined, ui.row(node, "Data")); data.setAttribute("aria-label", "Data"); data.rows = 8; data.spellcheck = false;
  data.parentElement.className = "cm-annotation-data";
  const tableTemplate = csvFormatRows([["cluster", "Value"], ...getClusters().map((cluster) => [cluster.uid, ""])]);
  data.value = tableTemplate;
  const error = document.createElement("p"); error.dataset.annotationError = ""; error.setAttribute("role", "alert"); node.append(error);
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Add panel"; node.append(submit);
  const run = createActionRunner((message) => { error.textContent = message; });
  node.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    run(() => {
      const raw = data.value.trim();
      let columns, values, groups;
      if (type.value === "groups") ({ groups } = JSON.parse(raw));
      else ({ columns, values } = parseAnnotationTable(raw, scale.value === "categorical"));
      const ids = new Set(getPanels().map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type.value}-${serial}`)) serial++;
      const panel = { uid: `${type.value}-${serial}`, type: type.value,
        title: title.value.trim() || (type.value === "groups" ? "Groups" : type.value === "bar" ? "Bar chart" : "Heatmap"),
        ...(type.value === "groups" ? { groups } : { columns, values, scale: { type: scale.value } }) };
      validateAnnotationPanels([panel], getClusters(), { tree: getTree?.() });
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    });
  };
  return { node };
}
