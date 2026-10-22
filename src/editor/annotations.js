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
  let filter = "", creating = false, view = null, viewKey = null;
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
  const clearSelection = () => view?.matrix?.clearSelection();
  toolbar.addEventListener("panel-change", (event) => { selected = event.detail.value; creating = false; render(); });
  toolbar.addEventListener("panel-action", (event) => {
    const { action } = event.detail;
    if (action === "add") { creating = !creating; render(); }
    else if (action === "replace") view?.replace?.();
    else if (action === "show") update({ show: current().show === false });
    else if (action === "remove") commit([{ type: "annotationPanels.delete", ids: [selected] }]);
    else if (action === "left" || action === "right") {
      const ids = getPanels().map((panel) => panel.uid), index = ids.indexOf(selected), next = index + (action === "left" ? -1 : 1);
      if (index < 0 || next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      commit([{ type: "annotationPanels.reorder", ids }]);
    }
  });
  const search = !embedded && toolbar.querySelector("clinker-search-field");
  if (search) search.addEventListener("input", () => { filter = search.value; view?.update(); });
  const disposeView = () => { view?.matrix?.cancelEdit(); view?.categories?.cancelEdit(); view?.groups?.cancelEdit(); };

  function createMatrix(parent) {
    const matrix = element("matrix"); parent.append(matrix);
    matrix.addEventListener("columns-change", (event) => { if (update(event.detail) === false) event.preventDefault(); });
    matrix.addEventListener("rows-change", (event) => {
      const panel = current(), categorical = panel.scale?.type === "categorical", scale = resolveAnnotationScale(panel);
      if (commit([
        ...(categorical && !panel.scale?.domain ? [{ type: "annotationPanels.update", ids: [selected],
          changes: { scale: categoryScale(panel, scale.domain, scale.domain.map(scale.colour)) } }] : []),
        { type: "annotationPanels.updateRows", uid: selected, values: event.detail.values },
      ]) === false) event.preventDefault();
    });
    return { matrix, update() {
      const panel = current();
      matrix.state = { panel, clusters: getClusters(), filter, domain: panel.scale?.type === "categorical" ? resolveAnnotationScale(panel).domain : null };
    } };
  }

  function createReplacement(parent) {
    const box = element("replacement"); box.slot = "tools"; parent.append(box);
    box.addEventListener("data-submit", (event) => { try {
      const source = current(), categorical = source.scale?.type === "categorical", changes = parseAnnotationTable(event.detail.data, categorical);
      if (categorical) {
        const scale = resolveAnnotationScale(source), domain = new Set(scale.domain);
        for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
        const categories = [...domain]; changes.scale = categoryScale(source, categories, categories.map((value, i) =>
          scale.domain.includes(value) ? scale.colour(value) : ANNOTATION_PALETTES.Qualitative[i % ANNOTATION_PALETTES.Qualitative.length]));
      }
      if (update(changes)) box.hidden = true;
    } catch (exception) { box.error = exception.message; } });
    box.addEventListener("data-cancel", () => { box.hidden = true; });
    return () => {
      box.hidden = !box.hidden;
      if (!box.hidden) { box.value = { data: annotationTableText(current(), getClusters()) }; box.error = ""; box.focus(); }
    };
  }

  function createGroups(parent) {
    const region = element("groups"); parent.append(region);
    const groups = region.firstElementChild;
    groups.addEventListener("value-commit", (event) => {
      if (update({ groups: event.detail.value }) === false) event.preventDefault();
    });
    return { groups, update() { groups.state = { groups: current().groups, colour: current().colour, clusters: getClusters(), tree: getData().tree }; } };
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
      disposeView(); body.replaceChildren(); view = null; viewKey = key;
      if (creating) body.append(createAnnotationForm({ document, getData, patch,
        onCreate: (uid) => { selected = uid; creating = false; render(); } }));
      else if (!panel) body.append(element("empty"));
      else {
        if (panel.type === "groups") view = createGroups(body);
        else {
          view = createMatrix(body); view.replace = createReplacement(view.matrix);
        }
      }
    }
    view?.update();
    if (view?.matrix && categorical && !view.categories) {
      view.categoryKey = null;
      view.categories = element("categories"); view.categories.slot = "tools"; view.matrix.prepend(view.categories);
      view.categories.palette = ANNOTATION_PALETTES.Qualitative;
      view.categories.addEventListener("value-commit", (event) => {
        const { value, replacements } = event.detail, mapping = new Map(replacements);
        const changes = { scale: categoryScale(current(), value.map(({ name }) => name), value.map(({ colour }) => colour)) };
        if (mapping.size) changes.values = mapAnnotationValues(current().values, (item) => mapping.has(item) ? mapping.get(item) : item);
        if (update(changes) === false) event.preventDefault();
      });
    } else if (!categorical && view?.categories) {
      view.categories.cancelEdit(); view.categories.remove(); view.categories = null;
    }
    if (view?.categories) {
      const key = JSON.stringify(panel.scale);
      if (key !== view.categoryKey) {
        const { domain, colour } = resolveAnnotationScale(panel);
        view.categories.value = domain.map((name) => ({ name, colour: colour(name) })); view.categoryKey = key;
      }
    }
  }
  render();
  return { node, toolbar, select(uid) { selected = uid; creating = false; render(); }, clearSelection,
    get filter() { return filter; }, setFilter(value) { filter = value; view?.update(); },
    invalidate({ replace = false } = {}) {
      renderedPanel = renderedPanels = renderedClusters = null;
      if (replace) { disposeView(); view = null; viewKey = null; selected = null; }
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
