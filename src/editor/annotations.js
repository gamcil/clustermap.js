import { installDataEditorStyle } from "./shared/styles.mjs";
import { defineSearchField } from "./components/search-field/search-field.js";
import { defineCategoryEditor } from "./components/category-editor/category-editor.js";
import { defineAnnotationToolbar } from "./components/annotation-toolbar/annotation-toolbar.js";
import { defineAnnotationDataForm } from "./components/annotation-data-form/annotation-data-form.js";
import { defineAnnotationGroupEditor } from "./components/annotation-group-editor/annotation-group-editor.js";
import { defineAnnotationTable } from "./components/annotation-table/annotation-table.js";
import { createTemplate, createActionRunner } from "../uiControls.mjs";
import { parseAnnotationTable, annotationTableText, mapAnnotationValues } from "../annotationData.mjs";
import { createAnnotationForm } from "./components/annotation-data-form/create.js";
import { textAsset } from "./shared/textAsset.js";

const [markup, css] = await Promise.all([
  textAsset(new URL("./annotations.html", import.meta.url)),
  textAsset(new URL("./annotations.css", import.meta.url)),
]);
const template = createTemplate(markup);

/** Data editing is optional UI; every change goes through the chart's patch API. */
export function createAnnotationEditor({ document, getData, getClusters = () => getData().clusters, patch, annotationApi, embedded = false }) {
  defineSearchField(); defineCategoryEditor(); defineAnnotationToolbar(); defineAnnotationDataForm(); defineAnnotationGroupEditor(); defineAnnotationTable();
  installDataEditorStyle(document); installStyle(document);
  const { resolveAnnotationScale, ANNOTATION_PALETTES } = annotationApi;
  const templates = template(document);
  const element = (name) => document.importNode(templates.getElementById(name).content, true).firstElementChild;
  const node = element("editor"), toolbar = node.querySelector("clinker-annotation-toolbar");
  const body = node.querySelector(".cm-annotation-data-body"), status = node.querySelector("[data-data-error]");
  if (embedded) { toolbar.setAttribute("embedded", ""); toolbar.querySelector("clinker-search-field").remove(); toolbar.remove(); }
  let selected = null, applying = false, renderedPanel = null, renderedPanels = null, renderedClusters = null;
  let filter = "", creating = false, view = null, viewKey = null, categories = null, replacement = null;
  const getPanels = () => getData()?.annotationPanels || [];
  const current = () => getPanels().find((panel) => panel.uid === selected);
  const error = (message) => { status.textContent = message; };
  const run = createActionRunner(error);
  const commit = (operations) => {
    applying = true;
    try { return run(() => {
      patch(operations);
      render();
    }); } finally { applying = false; }
  };
  const update = (changes) => commit([{ type: "annotationPanels.update", ids: [selected], changes }]);
  const categoryScale = (panel, domain, colours) => ({ ...panel.scale, type: "categorical", domain,
    colours: colours.length ? colours : [...ANNOTATION_PALETTES.Qualitative] });
  const clearSelection = () => view?.clearSelection?.();
  toolbar.addEventListener("panel-change", (event) => { selected = event.detail.value; creating = false; render(); });
  toolbar.addEventListener("panel-action", (event) => {
    const { action } = event.detail;
    if (action === "add") { creating = !creating; render(); }
    else if (action === "replace" && replacement) {
      replacement.hidden = !replacement.hidden;
      if (!replacement.hidden) {
        replacement.value = { data: annotationTableText(current(), getClusters()) }; replacement.error = ""; replacement.focus();
      }
    } else if (action === "show") update({ show: current().show === false });
    else if (action === "remove") commit([{ type: "annotationPanels.delete", ids: [selected] }]);
    else if (action === "left" || action === "right") {
      const ids = getPanels().map((panel) => panel.uid), index = ids.indexOf(selected), next = index + (action === "left" ? -1 : 1);
      if (index < 0 || next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      commit([{ type: "annotationPanels.reorder", ids }]);
    }
  });
  const search = !embedded && toolbar.querySelector("clinker-search-field");
  if (search) search.addEventListener("input", () => { filter = search.value; syncView(); });
  const disposeView = () => { view?.cancelEdit(); categories?.cancelEdit(); };
  body.addEventListener("columns-change", (event) => { if (update(event.detail) === false) event.preventDefault(); });
  body.addEventListener("rows-change", (event) => {
    const panel = current(), categorical = panel.scale?.type === "categorical", scale = resolveAnnotationScale(panel);
    if (commit([
      ...(categorical && !panel.scale?.domain ? [{ type: "annotationPanels.update", ids: [selected],
        changes: { scale: categoryScale(panel, scale.domain, scale.domain.map(scale.colour)) } }] : []),
      { type: "annotationPanels.updateRows", uid: selected, values: event.detail.values },
    ]) === false) event.preventDefault();
  });
  body.addEventListener("value-commit", (event) => {
    let changes;
    if (event.target === categories) {
      const { value, replacements } = event.detail, mapping = new Map(replacements);
      changes = { scale: categoryScale(current(), value.map(({ name }) => name), value.map(({ colour }) => colour)) };
      if (mapping.size) changes.values = mapAnnotationValues(current().values, (item) => mapping.has(item) ? mapping.get(item) : item);
    } else if (event.target === view && current()?.type === "groups") changes = { groups: event.detail.value };
    else return;
    if (update(changes) === false) event.preventDefault();
  });
  body.addEventListener("data-submit", (event) => {
    if (event.target !== replacement) return;
    try {
      const source = current(), categorical = source.scale?.type === "categorical", changes = parseAnnotationTable(event.detail.data, categorical);
      if (categorical) {
        const scale = resolveAnnotationScale(source), domain = new Set(scale.domain);
        for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
        const names = [...domain]; changes.scale = categoryScale(source, names, names.map((value, i) =>
          scale.domain.includes(value) ? scale.colour(value) : ANNOTATION_PALETTES.Qualitative[i % ANNOTATION_PALETTES.Qualitative.length]));
      }
      if (update(changes)) replacement.hidden = true;
    } catch (exception) { replacement.error = exception.message; }
  });
  body.addEventListener("data-cancel", (event) => { if (event.target === replacement) replacement.hidden = true; });

  function syncView() {
    if (!view) return;
    const panel = current(), clusters = getClusters();
    view.state = panel.type === "groups" ? { groups: panel.groups, colour: panel.colour, clusters, tree: getData().tree }
      : { panel, clusters, filter, domain: panel.scale?.type === "categorical" ? resolveAnnotationScale(panel).domain : null };
  }

  function render() {
    const panels = getPanels();
    if (!panels.some((panel) => panel.uid === selected)) selected = panels[0]?.uid ?? null;
    const panel = current(); renderedPanel = panel; renderedPanels = panels; renderedClusters = getClusters();
    toolbar.state = { panels, value: selected, creating };
    if (search) { search.hidden = !panel || creating || panel.type === "groups"; search.value = filter; }
    const categorical = panel?.scale?.type === "categorical";
    const key = creating ? "create" : panel ? JSON.stringify([panel.uid, panel.type]) : "empty";
    if (key !== viewKey) {
      disposeView(); body.replaceChildren(); view = categories = replacement = null; viewKey = key;
      if (creating) body.append(createAnnotationForm({ document, getData, patch,
        onCreate: (uid) => { selected = uid; creating = false; render(); } }));
      else if (!panel) body.append(element("empty"));
      else if (panel.type === "groups") {
        const region = element("groups"); body.append(region); view = region.firstElementChild;
      } else {
        view = element("matrix"); body.append(view);
        replacement = element("replacement"); view.append(replacement);
      }
    }
    syncView();
    if (view && panel.type !== "groups" && categorical && !categories) {
      categories = element("categories"); view.prepend(categories);
      categories.palette = ANNOTATION_PALETTES.Qualitative;
    } else if (!categorical && categories) {
      categories.cancelEdit(); categories.remove(); categories = null;
    }
    if (categories) {
      const { domain, colour } = resolveAnnotationScale(panel);
      categories.value = domain.map((name) => ({ name, colour: colour(name) }));
    }
  }
  render();
  return { node, toolbar, select(uid) { selected = uid; creating = false; render(); }, clearSelection,
    get filter() { return filter; }, setFilter(value) { filter = value; syncView(); },
    invalidate({ replace = false } = {}) {
      renderedPanel = renderedPanels = renderedClusters = null;
      if (replace) { disposeView(); view = categories = replacement = null; viewKey = null; selected = null; }
    },
    destroy() { disposeView(); toolbar.remove(); },
    update() { if (!applying && (current() !== renderedPanel || getPanels() !== renderedPanels || getClusters() !== renderedClusters)) render(); } };
}
function installStyle(document) {
  if (document.getElementById("cm-annotation-data-style")) return;
  const style = document.createElement("style"); style.id = "cm-annotation-data-style";
  style.textContent = css;
  document.head.append(style);
}
