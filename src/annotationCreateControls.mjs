import { createActionRunner } from "./uiControls.mjs";
import { parseAnnotationTable } from "./annotationData.mjs";
import { defineAnnotationDataForm } from "./editor/components/annotation-data-form/annotation-data-form.js";

export function createAnnotationCreateControls({ document, getData, patch, onCreate, annotationApi }) {
  defineAnnotationDataForm();
  const node = document.createElement("clinker-annotation-data-form");
  node.clusters = getData().clusters;
  const run = createActionRunner((message) => { node.error = message; });
  node.addEventListener("data-submit", (event) => {
    run(() => {
      const { type, title, scale, data } = event.detail;
      const raw = data.trim();
      const contents = type === "groups" ? { groups: JSON.parse(raw).groups } : parseAnnotationTable(raw, scale === "categorical");
      const ids = new Set((getData()?.annotationPanels || []).map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type}-${serial}`)) serial++;
      const panel = { uid: `${type}-${serial}`, type,
        title: title.trim() || (type === "groups" ? "Groups" : type === "bar" ? "Bar chart" : "Heatmap"),
        ...contents, ...(type === "groups" ? {} : { scale: { type: scale } }) };
      annotationApi.validateAnnotationPanels([panel], getData().clusters, { tree: getData().tree });
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    });
  });
  return { node };
}
