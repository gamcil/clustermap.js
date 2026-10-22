import { createTemplate, createActionRunner } from "./uiControls.mjs";
import { csvFormatRows } from "d3-dsv";
import { parseAnnotationTable } from "./annotationData.mjs";

const formTemplate = createTemplate(`<form>
  <label><span>Type</span><select aria-label="Type"><option value="heatmap">Heatmap</option><option value="bar">Bar chart</option><option value="groups">Group markers</option></select></label>
  <label><span>Title</span><input type="text" aria-label="Title"></label>
  <label><span>Values</span><select aria-label="Values"><option value="continuous">Numeric</option><option value="categorical">Categories</option></select></label>
  <p data-help></p>
  <label class="cm-annotation-data"><span>Data</span><textarea aria-label="Data" rows="8" spellcheck="false"></textarea></label>
  <p data-annotation-error role="alert"></p><button type="submit">Add panel</button>
</form>`);

/** Small data-entry form; panel validation and history remain in the patch API. */
export function createAnnotationCreateControls({ document, getData, patch, onCreate, annotationApi }) {
  const { validateAnnotationPanels } = annotationApi;
  const node = formTemplate(document).firstElementChild;
  const type = node.querySelector('[aria-label="Type"]'), title = node.querySelector('[aria-label="Title"]');
  const scale = node.querySelector('[aria-label="Values"]'), help = node.querySelector("[data-help]");
  const data = node.querySelector("textarea"), error = node.querySelector("[data-annotation-error]");
  type.onchange = () => {
    const groups = type.value === "groups";
    scale.parentElement.hidden = groups;
    scale.disabled = type.value === "bar";
    if (scale.disabled) scale.value = "continuous";
    help.textContent = groups ? "Define groups as JSON. Each needs a uid, a label, and either clusterIds or a tree nodeUid. Colours are optional."
      : tableHelp;
    data.value = groups ? JSON.stringify({ groups: [{ uid: "group-1", label: "Example group",
      clusterIds: getData().clusters.slice(0, 2).map((cluster) => cluster.uid) }] }, null, 2) : tableTemplate;
  };
  const tableHelp = "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
  help.textContent = tableHelp;
  const tableTemplate = csvFormatRows([["cluster", "Value"], ...getData().clusters.map((cluster) => [cluster.uid, ""])]);
  data.value = tableTemplate;
  const run = createActionRunner((message) => { error.textContent = message; });
  node.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    run(() => {
      const raw = data.value.trim();
      let columns, values, groups;
      if (type.value === "groups") ({ groups } = JSON.parse(raw));
      else ({ columns, values } = parseAnnotationTable(raw, scale.value === "categorical"));
      const ids = new Set((getData()?.annotationPanels || []).map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type.value}-${serial}`)) serial++;
      const panel = { uid: `${type.value}-${serial}`, type: type.value,
        title: title.value.trim() || (type.value === "groups" ? "Groups" : type.value === "bar" ? "Bar chart" : "Heatmap"),
        ...(type.value === "groups" ? { groups } : { columns, values, scale: { type: scale.value } }) };
      validateAnnotationPanels([panel], getData().clusters, { tree: getData().tree });
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    });
  };
  return { node };
}
