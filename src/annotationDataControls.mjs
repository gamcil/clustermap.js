import { createDataPanel, createSelectionControls, installDataEditorStyle } from "./dataEditorUi.mjs";
import { defineEditableField } from "./editor/components/editable-field/editable-field.js";
import { defineSelectionBar } from "./editor/components/selection-bar/selection-bar.js";
import { defineActionMenu } from "./editor/components/action-menu/action-menu.js";
import { defineSearchField } from "./editor/components/search-field/search-field.js";
import { defineCategoryEditor } from "./editor/components/category-editor/category-editor.js";
import { defineAnnotationToolbar } from "./editor/components/annotation-toolbar/annotation-toolbar.js";
import { textAsset } from "./editor/shared/textAsset.js";
import { RowSelection } from "./rowSelection.mjs";
import { createVirtualRows } from "./virtualRows.mjs";
import { createTemplate, updateFieldValue, updateSelectOptions, createActionRunner, colourHex as hex } from "./uiControls.mjs";
import { parseAnnotationTable, annotationTableText, mapAnnotationValues } from "./annotationData.mjs";
import { createAnnotationCreateControls } from "./annotationCreateControls.mjs";

const editorTemplate = createTemplate(`<div class="cm-data-ui cm-annotation-data-editor" tabindex="-1">
  <clinker-annotation-toolbar>
    <clinker-search-field label="Filter records" placeholder="Find a cluster"></clinker-search-field>
  </clinker-annotation-toolbar>
  <div class="cm-data-error" data-data-error role="alert"></div><div class="cm-annotation-data-body"></div>
</div>`);
const matrixTemplate = createTemplate(await textAsset(new URL("./editor/components/annotation-table/annotation-table.html", import.meta.url)));
const numericInputTemplate = createTemplate('<input type="number" step="any" placeholder="Value">');
const categoryInputTemplate = createTemplate('<select></select>');
const batchTemplate = createTemplate(`<div class="cm-data-selection-actions">
  <select aria-label="Columns to edit"></select><span data-value></span>
  <button type="button" data-set>Set values</button><button type="button" data-clear>Clear values</button>
</div>`);
const categoriesTemplate = createTemplate('<clinker-category-editor class="cm-annotation-categories"></clinker-category-editor>');
const replacementTemplate = createTemplate(`<div class="cm-annotation-replacement" hidden>
  <textarea rows="5" spellcheck="false" aria-label="Replacement annotation data (CSV, TSV or JSON)"></textarea>
  <div class="cm-data-toolbar"><button type="button" data-replace>Replace data</button><button type="button" data-cancel>Cancel</button></div>
</div>`);
const groupTemplate = createTemplate(`<fieldset><legend></legend><div class="cm-data-toolbar cm-annotation-data-toolbar">
  <input type="text" aria-label="Group label"><input type="color" aria-label="Group colour">
  <button type="button">Remove group</button><select aria-label="Membership"></select>
</div><select data-members></select></fieldset>`);
const addGroupTemplate = createTemplate('<button type="button">Add group</button>');
const emptyTemplate = createTemplate('<p>No annotation panels. Add a panel to attach data to cluster rows.</p>');

/** Data editing is optional UI; every change goes through the chart's patch API. */
export function createAnnotationDataControls({ document, getData, getClusters = () => getData().clusters, patch, annotationApi, embedded = false }) {
  defineEditableField(); defineSelectionBar(); defineActionMenu(); defineSearchField(); defineCategoryEditor(); defineAnnotationToolbar();
  installDataEditorStyle(document); installStyle(document);
  const { resolveAnnotationScale, ANNOTATION_PALETTES } = annotationApi;
  const node = editorTemplate(document).firstElementChild, toolbar = node.querySelector("clinker-annotation-toolbar");
  const body = node.querySelector(".cm-annotation-data-body"), status = node.querySelector("[data-data-error]");
  if (embedded) { toolbar.setAttribute("embedded", ""); toolbar.querySelector("clinker-search-field").remove(); toolbar.remove(); }
  let selected = null, applying = false, renderedPanel = null, renderedPanels = null, renderedClusters = null;
  let filter = "", creating = false, view = null, viewKey = null;
  const selection = new RowSelection();
  let selectionPanel = null, batchColumn = "0", batchValue = "";
  const getPanels = () => getData()?.annotationPanels || [];
  const current = () => getPanels().find((panel) => panel.uid === selected);
  const error = (message) => { status.textContent = message; };
  const run = createActionRunner(error);
  const commit = (operations, refresh = true, control) => {
    applying = true;
    try { return run(() => {
      patch(operations);
      if (refresh) {
        for (const menu of node.querySelectorAll("clinker-action-menu")) menu.open = false;
        render();
      } else { renderedPanel = current(); renderedPanels = getPanels(); }
    }, control); } finally { applying = false; }
  };
  const update = (changes, refresh = true, control) => commit([{ type: "annotationPanels.update", ids: [selected], changes }], refresh, control);
  const categoryScale = (panel, domain, colours) => ({ ...panel.scale, type: "categorical", domain,
    colours: colours.length ? colours : [...ANNOTATION_PALETTES.Qualitative] });
  const clearSelection = () => { selection.clear(); view?.syncSelection?.(); };
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
  if (search) search.addEventListener("input", () => { filter = search.value; view?.filterRows?.(); });
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && selection.size) { event.preventDefault(); clearSelection(); }
  });

  const disposeView = () => { view?.categories?.cancelEdit(); view?.destroy?.(); };

  function createMatrix(layout) {
    const panel = current(), categorical = panel.scale?.type === "categorical", resolved = resolveAnnotationScale(panel), extra = panel.type === "heatmap";
    const templates = matrixTemplate(document);
    const element = (name) => document.importNode(templates.getElementById(name).content, true).firstElementChild;
    const tableArea = layout.viewport; tableArea.classList.add("cm-annotation-matrix");
    const table = element("table"), head = table.querySelector("tr"), all = head.querySelector("input");
    tableArea.append(table);
    let clusters = [], mounted = [];
    const rowIds = new WeakMap();
    const syncSelection = () => {
      selectionControls.update({ ids: clusters.map((cluster) => cluster.uid), summary: `${clusters.length.toLocaleString()} visible clusters`, noun: "cluster" });
      for (const row of mounted) {
        const checked = selection.has(rowIds.get(row)); row.classList.toggle("is-selected", checked); row.setAttribute("aria-selected", String(checked));
        row.querySelector('[type="checkbox"]').checked = checked;
      }
    };
    const selectionControls = createSelectionControls(layout, { selection, checkbox: all, menuLabel: "Edit values…", onChange: syncSelection });
    const batch = batchTemplate(document).firstElementChild, columns = batch.querySelector("select");
    selectionControls.actions.append(batch);
    updateSelectOptions(columns, [["all", "All columns"], ...panel.columns.map((name, index) => [String(index), name])]); columns.value = batchColumn;
    columns.onchange = () => { batchColumn = columns.value; };
    const value = (categorical ? categoryInputTemplate : numericInputTemplate)(document).firstElementChild;
    value.setAttribute("aria-label", "Batch value"); value.placeholder = "Value";
    if (categorical) updateSelectOptions(value, [["", "Missing"], ...resolved.domain.map((name, index) => [String(index), name])]);
    value.value = batchValue; value.onchange = () => { batchValue = value.value; }; batch.querySelector("[data-value]").replaceWith(value);
    const updateRows = (values, refresh = true, control) => {
      const source = current();
      return commit([
        ...(categorical && !source.scale?.domain ? [{ type: "annotationPanels.update", ids: [selected],
          changes: { scale: categoryScale(source, resolved.domain, resolved.domain.map(resolved.colour)) } }] : []),
        { type: "annotationPanels.updateRows", uid: selected, values },
      ], refresh, control);
    };
    const applyValues = (clear) => {
      if (!clear && !value.checkValidity()) { value.reportValidity(); return; }
      const source = current(), values = {};
      const next = clear || value.value === "" ? null : categorical ? resolved.domain[Number(value.value)] : Number(value.value);
      for (const uid of selection) {
        const row = [...(source.values[uid] || source.columns.map(() => null))];
        source.columns.forEach((_, index) => { if (columns.value === "all" || index === Number(columns.value)) row[index] = next; }); values[uid] = row;
      }
      updateRows(values);
    };
    batch.querySelector("[data-set]").onclick = () => applyValues(false); batch.querySelector("[data-clear]").onclick = () => applyValues(true);
    panel.columns.forEach((column, index) => {
      const heading = element("column"), field = heading.querySelector("clinker-editable-field"), remove = heading.querySelector("button");
      field.value = column; field.setAttribute("label", `Column ${index + 1} name`);
      field.addEventListener("value-commit", (event) => {
        const columns = [...current().columns]; columns[index] = event.detail.value.trim();
        if (update({ columns }, true, field) === false) event.preventDefault();
      });
      if (extra) {
        remove.setAttribute("aria-label", `Remove column ${column}`); remove.disabled = panel.columns.length === 1;
        remove.onclick = () => update({ columns: current().columns.filter((_, i) => i !== index),
          values: Object.fromEntries(Object.entries(current().values).map(([uid, values]) => [uid, values.filter((_, i) => i !== index)])) });
      } else remove.remove();
      head.append(heading);
    });
    if (extra) {
      const heading = element("add-column"), form = heading.querySelector("form");
      const [add, save] = form.querySelectorAll("button"), name = form.querySelector("input");
      add.onclick = () => { add.hidden = true; name.hidden = save.hidden = false; name.focus(); };
      form.onsubmit = (event) => {
        event.preventDefault(); if (!name.value.trim()) return;
        update({ columns: [...current().columns, name.value.trim()], values: Object.fromEntries(Object.entries(current().values).map(([uid, values]) => [uid, [...values, null]])) });
      };
      name.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); name.hidden = save.hidden = true; add.hidden = false; add.focus(); } };
      head.append(heading);
    }
    const toggleRow = (cluster, checked, shift) => {
      selection.select(cluster.uid, checked, { range: shift, orderedIds: clusters.map((cluster) => cluster.uid) }); syncSelection();
    };
    const createRow = (cluster) => {
      const row = element("row"), check = row.querySelector("input"), name = row.querySelector("th");
      rowIds.set(row, cluster.uid); check.onclick = (event) => toggleRow(cluster, check.checked, event.shiftKey);
      name.onclick = (event) => toggleRow(cluster, !selection.has(cluster.uid), event.shiftKey);
      panel.columns.forEach((column, index) => {
        const cell = element("cell"), field = cell.firstElementChild;
        if (categorical) field.options = [["", "Missing"], ...resolved.domain.map((name, i) => [String(i), name])];
        else field.setAttribute("type", "number");
        field.addEventListener("value-commit", (event) => {
          const source = current(), values = [...(source.values[cluster.uid] ?? source.columns.map(() => null))];
          const value = event.detail.value;
          values[index] = value === "" ? null : categorical ? resolved.domain[Number(value)] : Number(value);
          if (updateRows({ [cluster.uid]: values }, false, field) === false) event.preventDefault();
        });
        row.append(cell);
      });
      if (extra) row.append(element("empty-cell"));
      return updateRow(row, cluster);
    };
    const updateRow = (row, cluster) => {
      const name = row.querySelector("th"), label = cluster.name || cluster.uid;
      name.textContent = label; name.title = cluster.uid; row.querySelector("input").setAttribute("aria-label", `Select ${label}`);
      [...row.querySelectorAll("clinker-editable-field")].forEach((field, index) => {
        const value = current().values[cluster.uid]?.[index] ?? null;
        field.setAttribute("label", `${label}: ${panel.columns[index]}`);
        field.value = categorical ? value === null ? "" : String(resolved.domain.indexOf(value)) : value;
      });
      return row;
    };
    const cancelFields = (root) => { for (const field of root.querySelectorAll("clinker-editable-field")) field.cancelEdit(); };
    const list = createVirtualRows({ viewport: tableArea, container: table.querySelector("tbody"), key: (cluster) => cluster.uid, createRow, updateRow, disposeRow: cancelFields,
      createSpacer: () => { const row = element("spacer"); row.firstElementChild.colSpan = panel.columns.length + 2 + Number(extra); return row; },
      headerHeight: () => head.offsetHeight, onRender: (nodes) => { mounted = nodes; table.setAttribute("aria-rowcount", clusters.length + 1); syncSelection(); } });
    const filterRows = () => {
      const needle = filter.trim().toLowerCase(); clusters = getClusters().filter((cluster) => `${cluster.name} ${cluster.uid}`.toLowerCase().includes(needle)); list.setRows(clusters);
    };
    return { update: filterRows, filterRows() { tableArea.scrollTop = 0; filterRows(); }, syncSelection, destroy() { cancelFields(table); list.destroy(); } };
  }

  function createReplacement(layout) {
    const box = replacementTemplate(document).firstElementChild, data = box.querySelector("textarea"); layout.tools.append(box);
    box.querySelector("[data-replace]").onclick = () => { try {
      const source = current(), categorical = source.scale?.type === "categorical", changes = parseAnnotationTable(data.value, categorical);
      if (categorical) {
        const scale = resolveAnnotationScale(source), domain = new Set(scale.domain);
        for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
        const categories = [...domain]; changes.scale = categoryScale(source, categories, categories.map((value, i) =>
          scale.domain.includes(value) ? scale.colour(value) : ANNOTATION_PALETTES.Qualitative[i % ANNOTATION_PALETTES.Qualitative.length]));
      }
      if (update(changes)) { box.hidden = true; layout.sync(); }
    } catch (exception) { error(exception.message); } };
    box.querySelector("[data-cancel]").onclick = () => { box.hidden = true; layout.sync(); };
    return () => {
      box.hidden = !box.hidden; layout.sync();
      if (!box.hidden) { data.value = annotationTableText(current(), getClusters()); data.focus(); }
    };
  }

  function createGroups(parent) {
    const groups = new Map(), add = addGroupTemplate(document).firstElementChild; parent.append(add);
    const editGroup = (uid, changes) => update({ groups: current().groups.map((group) => group.uid === uid ? { ...group, ...changes } : group) });
    add.onclick = () => {
      if (!getClusters().length) return;
      const panel = current(); let serial = 1; while (panel.groups.some((group) => group.uid === `group-${serial}`)) serial++;
      update({ groups: [...panel.groups, { uid: `group-${serial}`, label: `Group ${serial}`, clusterIds: [getClusters()[0].uid] }] });
    };
    return { update() {
      const panel = current(), tree = getData().tree;
      for (const [uid, box] of groups) if (!panel.groups.some((group) => group.uid === uid)) { box.remove(); groups.delete(uid); }
      for (const group of panel.groups) {
        let box = groups.get(group.uid);
        if (!box) { box = groupTemplate(document).firstElementChild; groups.set(group.uid, box); }
        parent.insertBefore(box, add);
        const label = box.querySelector('[type="text"]'), colour = box.querySelector('[type="color"]');
        box.querySelector("legend").textContent = group.label || group.uid; updateFieldValue(label, group.label ?? group.uid);
        colour.value = hex(group.colour ?? panel.colour ?? "#267c9e");
        label.onchange = () => editGroup(group.uid, { label: label.value }); colour.onchange = () => editGroup(group.uid, { colour: colour.value });
        const remove = box.querySelector("button"), mode = box.querySelector("select"), members = box.querySelector("[data-members]");
        remove.disabled = panel.groups.length === 1; remove.onclick = () => update({ groups: current().groups.filter((item) => item.uid !== group.uid) });
        updateSelectOptions(mode, [["clusters", "Selected clusters"], ...(tree ? [["tree", "Tree clade"]] : [])]); mode.value = group.nodeUid === undefined ? "clusters" : "tree";
        mode.onchange = () => {
          const { nodeUid, clusterIds, ...style } = group;
          if (mode.value !== "tree" && !getClusters().length) return;
          editGroup(group.uid, mode.value === "tree" ? { ...style, clusterIds: undefined, nodeUid: tree.root } : { ...style, nodeUid: undefined, clusterIds: [getClusters()[0].uid] });
        };
        members.multiple = group.nodeUid === undefined; members.size = members.multiple ? Math.min(5, getClusters().length) : 0;
        members.setAttribute("aria-label", members.multiple ? `Clusters in ${group.label || group.uid}` : "Tree node");
        updateSelectOptions(members, members.multiple ? getClusters().map((cluster) => [cluster.uid, `${cluster.name || cluster.uid} (${cluster.uid})`]) : tree.nodes.map((node) => [node.uid, node.label || node.uid]));
        for (const option of members.options) option.selected = members.multiple ? group.clusterIds.some((uid) => String(uid) === option.value) : String(group.nodeUid) === option.value;
        members.onchange = () => editGroup(group.uid, members.multiple ? { clusterIds: [...members.selectedOptions].map((option) => option.value) } : { nodeUid: members.value });
      }
    } };
  }

  function render() {
    const panels = getPanels();
    if (!panels.some((panel) => panel.uid === selected)) selected = panels[0]?.uid ?? null;
    const panel = current(); renderedPanel = panel; renderedPanels = panels; renderedClusters = getClusters();
    toolbar.state = { panels, value: selected, creating };
    if (search) { search.hidden = !panel || creating || panel.type === "groups"; search.value = filter; }
    if (selectionPanel !== panel?.uid) { selection.clear(); selectionPanel = panel?.uid; batchColumn = "0"; batchValue = ""; }
    selection.prune(new Set(getClusters().map((cluster) => cluster.uid)));
    if (batchColumn !== "all" && Number(batchColumn) >= (panel?.columns?.length || 0)) batchColumn = "0";
    const categorical = panel?.scale?.type === "categorical";
    if (categorical && batchValue !== "" && !resolveAnnotationScale(panel).domain[Number(batchValue)]) batchValue = "";
    const key = creating ? "create" : panel ? JSON.stringify([panel.uid, panel.type, panel.columns, categorical && resolveAnnotationScale(panel).domain]) : "empty";
    if (key !== viewKey) {
      const scroll = viewKey && panel?.uid === view?.uid ? view.layout.viewport.scrollTop : 0;
      const categoriesOpen = panel?.uid === view?.uid && view?.categories?.open;
      disposeView(); body.replaceChildren(); view = null; viewKey = key;
      if (creating) body.append(createAnnotationCreateControls({ document, getData, patch, annotationApi,
        onCreate: (uid) => { selected = uid; creating = false; render(); } }).node);
      else if (!panel) body.append(emptyTemplate(document));
      else {
        const layout = createDataPanel(document, { label: "Editable annotation data" }); body.append(layout.node);
        if (panel.type === "groups") { layout.meta.hidden = true; view = createGroups(layout.viewport); }
        else {
          view = createMatrix(layout);
          view.replace = createReplacement(layout);
          if (categorical) {
            view.categories = categoriesTemplate(document).firstElementChild; layout.tools.prepend(view.categories);
            view.categories.open = Boolean(categoriesOpen);
            view.categories.palette = ANNOTATION_PALETTES.Qualitative;
            view.categories.addEventListener("value-commit", (event) => {
              const { value, replacements } = event.detail, mapping = new Map(replacements);
              const changes = { scale: categoryScale(current(), value.map(({ name }) => name), value.map(({ colour }) => colour)) };
              if (mapping.size) changes.values = mapAnnotationValues(current().values, (item) => mapping.has(item) ? mapping.get(item) : item);
              if (update(changes) === false) event.preventDefault();
            });
          }
        }
        Object.assign(view, { uid: panel.uid, layout }); view.update(); layout.viewport.scrollTop = scroll;
      }
    } else view?.update();
    if (view?.categories) {
      const key = JSON.stringify(panel.scale);
      if (key !== view.categoryKey) {
        const { domain, colour } = resolveAnnotationScale(panel);
        view.categories.value = domain.map((name) => ({ name, colour: colour(name) })); view.categoryKey = key;
      }
    }
    view?.layout.sync();
  }
  render();
  return { node, toolbar, select(uid) { selected = uid; creating = false; render(); }, clearSelection,
    get filter() { return filter; }, setFilter(value) { filter = value; view?.filterRows?.(); },
    invalidate({ replace = false } = {}) {
      renderedPanel = renderedPanels = renderedClusters = null;
      if (replace) { disposeView(); view = null; viewKey = null; selection.clear(); selected = selectionPanel = null; }
    },
    destroy() { disposeView(); toolbar.remove(); },
    update() { if (!applying && (current() !== renderedPanel || getPanels() !== renderedPanels || getClusters() !== renderedClusters)) render(); } };
}
function installStyle(document) {
  if (document.getElementById("cm-annotation-data-style")) return;
  const style = document.createElement("style"); style.id = "cm-annotation-data-style";
  style.textContent = `
@layer clinker-editor {
.cm-annotation-data-editor { --cm-control-height:30px; --cm-control-padding:4px 8px; --cm-control-radius:6px; outline:none; display:flex; flex-direction:column; gap:8px; min-height:0; }
.cm-annotation-data-toolbar { flex-wrap:wrap; }
.cm-annotation-data-toolbar > input { width:140px; }
.cm-annotation-data-toolbar label { display:flex; gap:4px; align-items:center; }
.cm-annotation-data-body { display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden; }
.cm-annotation-data-editor details { flex-shrink:0; }
.cm-annotation-data-editor summary { cursor:pointer; color:var(--cm-muted,#687586); }
.cm-annotation-matrix { position:relative; }
.cm-annotation-data-editor .cm-data-actions input[type=number] { width:112px; }
.cm-annotation-matrix table { border-collapse:separate; border-spacing:0; font:inherit; color:inherit; width:max-content; min-width:100%; }

.cm-annotation-matrix thead th { position:sticky; top:0; z-index:2; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tr > :first-child { position:sticky; left:0; z-index:1; width:32px; min-width:32px; background:var(--cm-row-background,var(--cm-subtle,#f3f6fa)); }
.cm-annotation-matrix tr > :nth-child(2) { position:sticky; left:32px; z-index:1; }
.cm-annotation-matrix tbody th { background:var(--cm-row-background); }
.cm-annotation-matrix thead th:nth-child(-n+2) { z-index:3; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tbody th { cursor:pointer; min-width:200px; max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400; }
.cm-annotation-matrix :is(input:not([type=checkbox]),clinker-editable-field) { width:140px; }
.cm-annotation-column { display:flex; align-items:center; }
.cm-annotation-column button { --cm-icon-size:24px; visibility:hidden; }
.cm-annotation-column:is(:hover,:focus-within) button { visibility:visible; }
.cm-annotation-add-column { width:36px; }
.cm-annotation-add-column form { display:flex; gap:4px; }
.cm-annotation-spacer > td { height:0; border:0; padding:0; }
.cm-annotation-data-editor fieldset { flex-shrink:0; border:1px solid var(--cm-border,#cbd3de); border-radius:4px; padding:8px; margin:0 0 8px; }
.cm-annotation-data-editor fieldset > select { margin-top:6px; max-width:100%; }
.cm-annotation-replacement { flex-shrink:0; }
.cm-annotation-data-editor textarea { display:block; width:100%; margin:6px 0; resize:vertical; }
.cm-annotation-data-editor [data-data-error] { color:var(--cm-danger,#b42318); }
.cm-annotation-data-editor [data-data-error]:empty { display:none; }

}
`;
  document.head.append(style);
}
