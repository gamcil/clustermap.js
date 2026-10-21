import { createDataPanel, createSelectionControls, createDataCell, createDataSearch, installDataEditorStyle } from "./dataEditorUi.mjs";
import { RowSelection } from "./rowSelection.mjs";
import { createVirtualRows } from "./virtualRows.mjs";
import { createControls, createActionRunner, colourHex as hex } from "./uiControls.mjs";
import { parseAnnotationTable, annotationTableText, mapAnnotationValues } from "./annotationData.mjs";
import { createAnnotationCreateControls } from "./annotationCreateControls.mjs";

/** Data editing is optional UI; every change goes through the chart's patch API. */
export function createAnnotationDataControls({ document, getPanels, getClusters, getTree, patch, annotationApi, embedded = false }) {
  installDataEditorStyle(document);
  installStyle(document);
  const { resolveAnnotationScale, ANNOTATION_PALETTES } = annotationApi;
  const toolbar = document.createElement("div"); toolbar.className = "cm-data-toolbar";
  const node = document.createElement("div"); node.className = "cm-data-ui cm-annotation-data-editor"; node.tabIndex = -1;
  let selected = null, applying = false, renderedPanel = null, renderedPanels = null, renderedClusters = null, filter = "", deleting = null, creating = false;
  let disposeView = () => {}, filterRows = () => {}, filterSelection = () => {};
  const selection = new RowSelection();
  let selectionPanel = null, batchColumn = "0", batchValue = "";
  const current = () => getPanels().find((panel) => panel.uid === selected);
  const { el, button, input, select } = createControls(document);
  const error = (message) => { node.querySelector('[data-data-error]').textContent = message; };
  const run = createActionRunner(error);
  const commit = (operations, refresh = true) => {
    applying = true;
    try { run(() => {
      patch(operations);
      if (refresh) render(); else { renderedPanel = current(); renderedPanels = getPanels(); }
    }); } finally { applying = false; }
  };
  const update = (changes, refresh = true) => commit([{ type: "annotationPanels.update", ids: [selected], changes }], refresh);
  const categoryScale = (panel, domain, colours) => ({ ...panel.scale, type: "categorical", domain,
    colours: colours.length ? colours : [...ANNOTATION_PALETTES.Qualitative] });
  const renderCategories = (parent, panel) => {
    const { domain, colour } = resolveAnnotationScale(panel), colours = domain.map(colour);

    domain.forEach((name, index) => {
      const row = el("div", undefined, parent); row.className = "cm-annotation-category";
      input(row, `Colour for ${name}`, colour(name), "color", (value) => {
        const next = [...colours]; next[index] = value; update({ scale: categoryScale(current(), domain, next) });
      });
      input(row, `Rename category ${name}`, name, "text", (value) => {
        if (!value.trim()) { error("Category names cannot be empty."); return; }
        update({ values: mapAnnotationValues(current().values, (item) => item === name ? value : item),
          scale: categoryScale(panel, domain.map((item) => item === name ? value : item), colours) });
      });
      button(row, "×", () => { deleting = name; render(); }).setAttribute("aria-label", `Remove category ${name}`);
      if (deleting === name) {
        const remove = el("div", undefined, parent); remove.className = "cm-annotation-category-remove";
        el("span", `Replace “${name}” with`, remove);
        // Index values keep the missing option distinct from arbitrary category names.
        const replacement = select(remove, "Replacement category", "missing", [["missing", "Missing"],
          ...domain.flatMap((item, i) => item === name ? [] : [[String(i), item]])], () => {});
        button(remove, "Remove", () => {
          const value = replacement.value === "missing" ? null : domain[Number(replacement.value)];
          deleting = null;
          update({ values: mapAnnotationValues(current().values, (item) => item === name ? value : item),
            scale: categoryScale(panel, domain.filter((item) => item !== name), colours.filter((_, i) => i !== index)) });
        });
        button(remove, "Cancel", () => { deleting = null; render(); });
      }
    });
    const row = el("div", undefined, parent); row.className = "cm-annotation-category";
    const used = new Set(colours.map((value) => hex(value)));
    const nextColour = ANNOTATION_PALETTES.Qualitative.find((value) => !used.has(hex(value))) ??
      ANNOTATION_PALETTES.Qualitative[domain.length % ANNOTATION_PALETTES.Qualitative.length];
    const swatch = input(row, "New category colour", nextColour, "color", () => {});
    const name = input(row, "New category name", "", "text", () => {}); name.placeholder = "New category";
    button(row, "+", () => {
      if (!name.value.trim()) { name.focus(); return; }
      update({ scale: categoryScale(panel, [...domain, name.value.trim()], [...colours, swatch.value]) });
    }).setAttribute("aria-label", "Add category");
  };
  const renderMatrix = (layout, panel) => {
    const categorical = panel.scale?.type === "categorical", resolved = resolveAnnotationScale(panel);
    if (categorical && batchValue !== "" && !resolved.domain[Number(batchValue)]) batchValue = "";
    const { viewport: tableArea } = layout;
    const all = input(null, "Select all filtered clusters", "", "checkbox", () => {});
    const selectionControls = createSelectionControls(layout, { selection, checkbox: all, onChange: () => syncSelection() });
    const batch = selectionControls.actions;
    const columns = select(batch, "Columns to edit", batchColumn,
      [["all", "All columns"], ...panel.columns.map((name, index) => [String(index), name])], (value) => { batchColumn = value; });
    const value = categorical
      ? select(batch, "Batch value", batchValue, [["", "Missing"], ...resolved.domain.map((name, index) => [String(index), name])], (value) => { batchValue = value; })
      : input(batch, "Batch value", batchValue, "number", (value) => { batchValue = value; });
    if (!categorical) value.placeholder = "Value";
    const applyValues = (clear) => {
      if (!clear && !value.checkValidity()) { value.reportValidity(); return; }
      const source = current(), values = { ...source.values };
      const next = clear || value.value === "" ? null : categorical ? resolved.domain[Number(value.value)] : Number(value.value);
      for (const uid of selection) {
        const row = [...(values[uid] || source.columns.map(() => null))];
        source.columns.forEach((_, index) => { if (columns.value === "all" || index === Number(columns.value)) row[index] = next; });
        values[uid] = row;
      }
      update({ values, ...(categorical && !source.scale?.domain ? { scale: categoryScale(source, resolved.domain, resolved.domain.map(resolved.colour)) } : {}) });
    };
    button(batch, "Set values", () => applyValues(false));
    button(batch, "Clear values", () => applyValues(true));
    tableArea.classList.add("cm-annotation-matrix");
    const table = el("table", undefined, tableArea), head = el("tr", undefined, el("thead", undefined, table));
    const cell = (tag, parent, selection = false) => { const node = createDataCell(document, tag, selection); parent.append(node); return node; };
    const selectionHead = cell("th", head, true);
    selectionHead.append(all);
    cell("th", head).textContent = "Cluster";
    panel.columns.forEach((column, index) => {
      const heading = cell("th", head), row = el("div", undefined, heading); row.className = "cm-annotation-column";
      input(row, `Column ${index + 1} name`, column, "text", (value) => {
        const columns = [...current().columns]; columns[index] = value; update({ columns });
      }).classList.add("cm-data-field");
      if (panel.type === "heatmap") {
        const remove = button(row, "×", () => update({ columns: panel.columns.filter((_, i) => i !== index),
          values: Object.fromEntries(Object.entries(current().values).map(([uid, values]) => [uid, values.filter((_, i) => i !== index)])) }));
        remove.disabled = panel.columns.length === 1; remove.setAttribute("aria-label", `Remove column ${column}`);
      }
    });
    for (const cell of head.children) cell.classList.add("cm-data-head");
    const extra = panel.type === "heatmap";
    if (extra) {
      const heading = cell("th", head); heading.classList.add("cm-data-head", "cm-annotation-add-column");
      const form = el("form", undefined, heading);
      const add = button(form, "+", () => { add.hidden = true; name.hidden = save.hidden = false; name.focus(); });
      add.setAttribute("aria-label", "Add column");
      const name = input(form, "New column name", "", "text", () => {}); name.placeholder = "Column name"; name.hidden = true;
      const save = button(form, "Add", () => {}); save.type = "submit"; save.hidden = true;
      form.onsubmit = (event) => {
        event.preventDefault();
        if (!name.value.trim()) return;
        update({ columns: [...panel.columns, name.value.trim()], values: Object.fromEntries(
          Object.entries(current().values).map(([uid, values]) => [uid, [...values, null]])) });
      };
      name.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); name.hidden = save.hidden = true; add.hidden = false; add.focus(); } };
    }
    const body = el("tbody", undefined, table);
    let mounted = [];
    const rowIds = new WeakMap();
    const spacer = () => {
      const row = el("tr"), cell = el("td", undefined, row);
      row.className = "cm-annotation-spacer"; row.setAttribute("aria-hidden", "true");
      cell.colSpan = panel.columns.length + 2 + Number(extra); return row;
    };
    let clusters = [];
    const syncSelection = () => {
      selectionControls.update({ ids: clusters.map((cluster) => cluster.uid),
        summary: `${clusters.length.toLocaleString()} visible clusters`, noun: "cluster" });
      for (const row of mounted) {
        const checked = selection.has(rowIds.get(row));
        row.classList.toggle("is-selected", checked); row.setAttribute("aria-selected", String(checked));
        row.querySelector('input[type="checkbox"]').checked = checked;
      }
    };
    filterSelection = syncSelection;
    const toggleRow = (uid, checked, shift) => {
      selection.select(uid, checked, { range: shift, orderedIds: clusters.map((cluster) => cluster.uid) });
      syncSelection();
    };
    const createRow = (cluster) => {
      const row = el("tr"), selectionCell = cell("td", row, true);
      const check = input(selectionCell, `Select ${cluster.name || cluster.uid}`, "", "checkbox", () => {});
      check.onclick = (event) => toggleRow(cluster.uid, check.checked, event.shiftKey);
      const name = cell("th", row); name.textContent = cluster.name || cluster.uid;
      name.onclick = (event) => toggleRow(cluster.uid, !selection.has(cluster.uid), event.shiftKey);
      row.className = "cm-data-row"; rowIds.set(row, cluster.uid);
      name.scope = "row"; name.title = cluster.uid;
      panel.columns.forEach((column, index) => {
        const valueCell = cell("td", row), label = `${cluster.name || cluster.uid}: ${column}`;
        const value = current().values[cluster.uid]?.[index] ?? null;
        const change = (value) => {
          const source = current(), values = [...(source.values[cluster.uid] ?? source.columns.map(() => null))];
          values[index] = value;
          update({ values: { ...source.values, [cluster.uid]: values },
            ...(categorical && !source.scale?.domain ? { scale: categoryScale(source, resolved.domain, resolved.domain.map(resolved.colour)) } : {}),
          }, false);
        };
        if (categorical) select(valueCell, label, value === null ? "missing" : String(resolved.domain.indexOf(value)),
          [["missing", "Missing"], ...resolved.domain.map((item, i) => [String(i), item])],
          (key) => change(key === "missing" ? null : resolved.domain[Number(key)]));
        else {
          const field = input(valueCell, label, value, "number", (value) => change(value === "" ? null : Number(value)));
          field.placeholder = "—";
        }
      });
      for (const field of row.querySelectorAll("input:not([type=checkbox]),select")) field.classList.add("cm-data-field");
      if (extra) cell("td", row);
      return row;
    };
    const list = createVirtualRows({ viewport: tableArea, container: body, key: (cluster) => cluster.uid,
      createRow, createSpacer: spacer, headerHeight: () => head.offsetHeight,
      onRender: (nodes) => { mounted = nodes; table.setAttribute("aria-rowcount", clusters.length + 1); syncSelection(); } });
    disposeView = () => list.destroy();
    filterRows = () => {
      const needle = filter.trim().toLowerCase();
      clusters = getClusters().filter((cluster) => `${cluster.name} ${cluster.uid}`.toLowerCase().includes(needle));
      tableArea.scrollTop = 0; list.setRows(clusters);
    };
    filterRows();
  };
  const renderReplacement = (layout, panel) => {
    const parent = layout.tools;
    const categorical = panel.scale?.type === "categorical";
    const box = el("div", undefined, parent); box.className = "cm-annotation-replacement"; box.hidden = true;
    const data = el("textarea", undefined, box); data.rows = 5;
    data.setAttribute("aria-label", "Replacement annotation data (CSV, TSV or JSON)"); data.spellcheck = false;
    const actions = el("div", undefined, box); actions.className = "cm-data-toolbar";
    button(actions, "Replace data", () => {
      try {
        const changes = parseAnnotationTable(data.value, categorical);
        if (categorical) {
          const source = current(), scale = resolveAnnotationScale(source), domain = new Set(scale.domain);
          for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
          const categories = [...domain];
          changes.scale = categoryScale(source, categories, categories.map((value, i) =>
            scale.domain.includes(value) ? scale.colour(value) : ANNOTATION_PALETTES.Qualitative[i % ANNOTATION_PALETTES.Qualitative.length]));
        }
        update(changes);
      } catch (exception) { error(exception.message); }
    });
    button(actions, "Cancel", () => { box.hidden = true; layout.sync(); });
    return () => {
      box.hidden = !box.hidden; layout.sync();
      if (!box.hidden) { data.value = annotationTableText(current(), getClusters()); data.focus(); }
    };
  };
  const renderGroups = (parent, panel) => {
    const editGroup = (index, changes) => update({ groups: current().groups.map((group, i) => i === index ? { ...group, ...changes } : group) });
    panel.groups.forEach((group, index) => {
      const box = el("fieldset", undefined, parent); el("legend", group.label || group.uid, box);
      const row = el("div", undefined, box); row.className = "cm-data-toolbar cm-annotation-data-toolbar";
      input(row, "Group label", group.label ?? group.uid, "text", (label) => editGroup(index, { label }));
      input(row, "Group colour", group.colour ?? panel.colour ?? "#267c9e", "color", (colour) => editGroup(index, { colour }));
      const remove = button(row, "Remove group", () => update({ groups: panel.groups.filter((_, i) => i !== index) }));
      remove.disabled = panel.groups.length === 1;
      const tree = getTree?.();
      select(row, "Membership", group.nodeUid === undefined ? "clusters" : "tree",
        [["clusters", "Selected clusters"], ...(tree ? [["tree", "Tree clade"]] : [])], (mode) => {
          const groups = [...current().groups];
          const { nodeUid, clusterIds, ...style } = groups[index];
          groups[index] = mode === "tree" ? { ...style, nodeUid: tree.root } : { ...style, clusterIds: [getClusters()[0].uid] };
          update({ groups });
        });
      if (group.nodeUid !== undefined) select(box, "Tree node", group.nodeUid,
        tree.nodes.map((node) => [node.uid, node.label || node.uid]), (nodeUid) => editGroup(index, { nodeUid }));
      else {
        const members = el("select", undefined, box); members.multiple = true; members.size = Math.min(5, getClusters().length);
        members.setAttribute("aria-label", `Clusters in ${group.label || group.uid}`);
        for (const cluster of getClusters()) {
          const option = el("option", `${cluster.name || cluster.uid} (${cluster.uid})`, members);
          option.value = cluster.uid; option.selected = group.clusterIds.includes(cluster.uid);
        }
        members.onchange = () => editGroup(index, { clusterIds: [...members.selectedOptions].map((option) => option.value) });
      }
    });
    button(parent, "Add group", () => {
      let serial = 1; while (panel.groups.some((group) => group.uid === `group-${serial}`)) serial++;
      update({ groups: [...panel.groups, { uid: `group-${serial}`, label: `Group ${serial}`, clusterIds: [getClusters()[0].uid] }] });
    });
  };
  function render() {
    const active = document.activeElement, restoreFocus = node.contains(active) || toolbar.contains(active);
    const samePanel = renderedPanel?.uid === selected;
    const scroll = samePanel ? node.querySelector(".cm-annotation-matrix")?.scrollTop || 0 : 0;
    const categoriesOpen = samePanel && node.querySelector(".cm-annotation-categories")?.open;
    disposeView(); disposeView = () => {}; filterRows = () => {}; filterSelection = () => {};
    node.replaceChildren();
    toolbar.replaceChildren();
    if (!embedded) node.append(toolbar);
    const panels = getPanels(); renderedPanels = panels; renderedClusters = getClusters();
    if (!panels.some((panel) => panel.uid === selected)) selected = panels[0]?.uid ?? null;
    if (panels.length) select(toolbar, "Annotation panel", selected, panels.map((panel) => [panel.uid, panel.title || panel.uid]),
      (uid) => { selected = uid; deleting = null; creating = false; render(); });
    button(toolbar, creating ? "Cancel" : "Add panel", () => { creating = !creating; render(); });
    const status = el("div", undefined, node); status.className = "cm-data-error"; status.dataset.dataError = ""; status.setAttribute("role", "alert");
    const body = el("div", undefined, node); body.className = "cm-annotation-data-body";
    if (creating) {
      const form = createAnnotationCreateControls({ document, getPanels, getClusters, getTree, patch, annotationApi,
        onCreate: (uid) => { selected = uid; creating = false; render(); } });
      body.append(form.node); return;
    }
    const panel = current(); renderedPanel = panel;
    if (selectionPanel !== panel?.uid) {
      selection.clear(); selectionPanel = panel?.uid; batchColumn = "0"; batchValue = "";
    }
    const validRows = new Set(getClusters().map((cluster) => cluster.uid));
    selection.prune(validRows);
    if (batchColumn !== "all" && Number(batchColumn) >= (panel?.columns?.length || 0)) batchColumn = "0";
    if (!panel) { el("p", "No annotation panels. Add a panel to attach data to cluster rows.", body); return; }
    const layout = createDataPanel(document, { label: "Editable annotation data" }); body.append(layout.node);
    if (panel.type !== "groups") button(toolbar, "Replace data…", renderReplacement(layout, panel));
    button(toolbar, panel.show === false ? "Show" : "Hide", () => update({ show: panel.show === false }));
    const index = panels.indexOf(panel);
    for (const [label, symbol, direction] of [["Move left", "←", -1], ["Move right", "→", 1]]) {
      const move = button(toolbar, symbol, () => {
        const ids = panels.map((item) => item.uid); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
        commit([{ type: "annotationPanels.reorder", ids }]);
      });
      move.title = label; move.setAttribute("aria-label", label);
      move.disabled = index + direction < 0 || index + direction >= panels.length;
    }
    button(toolbar, "Remove", () => commit([{ type: "annotationPanels.delete", ids: [selected] }])).setAttribute("aria-label", "Remove panel");
    if (panel.type === "groups") { layout.meta.hidden = true; renderGroups(layout.viewport, panel); }
    else {
      if (panel.scale?.type === "categorical") {
        const categories = el("details", undefined, layout.tools); categories.className = "cm-annotation-categories";
        categories.open = categoriesOpen || deleting !== null;
        const summary = el("summary", "Categories", categories);
        const scale = resolveAnnotationScale(panel);
        for (const category of scale.domain) {
          const chip = el("span", category, summary); chip.className = "cm-annotation-category-chip";
          chip.style.setProperty("--category-colour", scale.colour(category));
        }
        renderCategories(el("div", undefined, categories), panel);
      }
      renderMatrix(layout, panel);
    }
    layout.sync();
    if (!embedded && panel.type !== "groups") {
      const search = createDataSearch(document, { placeholder: "Find a cluster", onInput: (value) => { filter = value; filterRows(); } });
      search.input.value = filter; toolbar.append(search.node);
    }
    const matrix = node.querySelector(".cm-annotation-matrix"); if (matrix) matrix.scrollTop = scroll;
    if (restoreFocus && !active.isConnected) node.focus({ preventScroll: true });
  }
  const clearSelection = () => { selection.clear(); filterSelection(); };
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && selection.size) { event.preventDefault(); clearSelection(); }
  });
  render();
  return { node, toolbar, select(uid) { selected = uid; creating = false; deleting = null; render(); },
    clearSelection,
    get filter() { return filter; },
    setFilter(value) { filter = value; filterRows(); },
    destroy() { disposeView(); toolbar.remove(); },
    update() { if (!applying && (current() !== renderedPanel || getPanels() !== renderedPanels || getClusters() !== renderedClusters || !node.childElementCount)) render(); } };
}

function installStyle(document) {
  if (document.getElementById("cm-annotation-data-style")) return;
  const style = document.createElement("style"); style.id = "cm-annotation-data-style";
  style.textContent = `
@layer clinker-editor {
.cm-annotation-data-editor { --cm-control-height:30px; --cm-control-padding:4px 8px; --cm-control-radius:6px; outline:none; display:flex; flex-direction:column; gap:8px; min-height:0; }
.cm-annotation-data-toolbar { flex-wrap:wrap; }
.cm-annotation-data-toolbar > input { width:140px; }
.cm-annotation-data-editor .cm-data-toolbar > select { max-width:260px; }
.cm-annotation-data-toolbar label { display:flex; gap:4px; align-items:center; }
.cm-annotation-data-body { display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden; }
.cm-annotation-data-editor details { flex-shrink:0; }
.cm-annotation-data-editor summary { cursor:pointer; color:var(--cm-muted,#687586); }
.cm-annotation-categories { padding:0; }
.cm-annotation-categories > div { display:flex; flex-wrap:wrap; gap:6px 16px; padding:8px 0 2px; }
.cm-annotation-category-chip { display:inline-flex; align-items:center; gap:4px; margin-left:12px; font-size:12px; }
.cm-annotation-category-chip::before { content:""; width:9px; height:9px; border-radius:2px; background:var(--category-colour); }
.cm-annotation-category { display:flex; align-items:center; gap:5px; }
.cm-annotation-category input[type=text] { min-width:0; width:140px; }
.cm-annotation-category-remove { display:flex; flex-wrap:wrap; align-items:center; gap:5px; padding:6px; border:1px solid var(--cm-border,#cbd3de); border-radius:4px; }
.cm-annotation-matrix { position:relative; }
.cm-annotation-data-editor .cm-data-actions input[type=number] { width:112px; }
.cm-annotation-matrix table { border-collapse:separate; border-spacing:0; font-size:13px; width:max-content; min-width:100%; }

.cm-annotation-matrix thead th { position:sticky; top:0; z-index:2; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tr > :first-child { position:sticky; left:0; z-index:1; width:32px; min-width:32px; background:var(--cm-row-background,var(--cm-subtle,#f3f6fa)); }
.cm-annotation-matrix tr > :nth-child(2) { position:sticky; left:32px; z-index:1; }
.cm-annotation-matrix tbody th { background:var(--cm-row-background); }
.cm-annotation-matrix thead th:nth-child(-n+2) { z-index:3; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tbody th { cursor:pointer; min-width:200px; max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400; }
.cm-annotation-matrix :is(input:not([type=checkbox]),select) { width:140px; }
.cm-annotation-column { display:flex; align-items:center; }
.cm-annotation-column input { font-weight:inherit; }
.cm-annotation-column button { visibility:hidden; border:0; padding:0 4px; min-height:24px; }
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
