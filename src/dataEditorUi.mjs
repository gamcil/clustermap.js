import { createControls } from "./uiControls.mjs";

/** Shared controls and table primitives for the packaged and inline data editors. */
export function createDataSearch(document, { placeholder = "Search names, labels, loci, or clusters", onInput } = {}) {
  const node = document.createElement("label"); node.className = "cm-data-search";
  const input = document.createElement("input"); input.type = "search";
  input.placeholder = placeholder; input.setAttribute("aria-label", "Filter records");
  if (onInput) input.oninput = () => onInput(input.value);
  node.append(input);
  return { node, input };
}

/** Shared content layout for every data view, including the standalone editor. */
export function createDataPanel(document, { label = "Editable chart data" } = {}) {
  installDataEditorStyle(document);
  const ui = createControls(document), node = ui.el("div", undefined, null, "cm-data-panel");
  const tools = ui.el("div", undefined, node, "cm-data-tools"); tools.hidden = true;
  const meta = ui.el("div", undefined, node, "cm-data-meta");
  const summary = ui.el("span", undefined, meta);
  const selectVisible = ui.button(meta, "Select all visible", null);
  const actions = ui.el("div", undefined, node, "cm-data-actions"); actions.hidden = true;
  const viewport = ui.el("div", undefined, node, "cm-data-table");
  viewport.setAttribute("role", "region"); viewport.setAttribute("aria-label", label);
  return { node, tools, meta, summary, selectVisible, actions, viewport,
    sync() { tools.hidden = ![...tools.children].some((child) => !child.hidden); } };
}

/** Keep selection controls independent of the table's row and action rendering. */
export function createSelectionControls(panel, { selection, onChange, checkbox } = {}) {
  const ui = createControls(panel.node.ownerDocument);
  const count = ui.el("strong", undefined, panel.actions);
  const actions = ui.el("span", undefined, panel.actions, "cm-data-selection-actions");
  const clear = ui.button(panel.actions, "Clear selection", () => { selection.clear(); onChange(); });
  let visibleIds = [];
  panel.selectVisible.onclick = () => { selection.setMany(visibleIds); onChange(); };
  if (checkbox) checkbox.onchange = () => { selection.setMany(visibleIds, checkbox.checked); onChange(); };
  return { actions,
    update({ ids, summary, noun, selectSuffix = "" }) {
      visibleIds = ids;
      const selectedVisible = ids.reduce((total, id) => total + Number(selection.has(id)), 0);
      const all = ids.length > 0 && selectedVisible === ids.length;
      panel.summary.textContent = summary;
      panel.selectVisible.hidden = !ids.length;
      panel.selectVisible.disabled = all;
      panel.selectVisible.textContent = `Select all ${ids.length.toLocaleString()} visible${selectSuffix}`;
      panel.actions.hidden = !selection.size;
      count.textContent = `${selection.size.toLocaleString()} ${noun}${selection.size === 1 ? "" : "s"} selected`;
      clear.disabled = !selection.size;
      if (checkbox) {
        checkbox.checked = all;
        checkbox.indeterminate = selectedVisible > 0 && !all;
        checkbox.disabled = !ids.length;
      }
    },
  };
}

const cellClass = (selection) => `cm-data-cell${selection ? " cm-data-cell--select" : ""}`;
export function createDataCell(document, tag = "td", selection = false) {
  const node = document.createElement(tag); node.className = cellClass(selection); return node;
}
export function dataCell(content, selection = false) {
  return `<span class="${cellClass(selection)}">${content}</span>`;
}

export function installDataEditorStyle(document) {
  if (document.getElementById("cm-data-editor-style")) return;
  const style = document.createElement("style"); style.id = "cm-data-editor-style";
  style.textContent = `
@layer clinker-editor {
.cm-data-ui { color:var(--cm-foreground,#273444); font:13px/1.4 system-ui,sans-serif; }
.cm-data-ui [hidden] { display:none!important; }
.cm-data-ui :is(button,input,select,textarea) { font:inherit; color:inherit; box-sizing:border-box; }
.cm-data-ui :where(button,select,input:not([type=color]):not([type=checkbox]):not([type=range]),textarea) { min-height:var(--cm-control-height,30px); padding:var(--cm-control-padding,4px 8px); border:1px solid var(--cm-border,#cbd3de); border-radius:var(--cm-control-radius,6px); background:var(--cm-surface,#fff); }
.cm-data-ui input[type=checkbox] { cursor:pointer; }
.cm-data-ui input[type=color] { width:30px; height:22px; padding:0; border:0; background:transparent; }
.cm-data-ui button { cursor:pointer; }
.cm-data-ui button:hover:not(:disabled) { border-color:var(--cm-accent,#78a9ed); background:var(--cm-hover,#f4f8ff); }
.cm-data-ui :where(button,summary):focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:2px; }
.cm-data-ui summary { cursor:pointer; }
.cm-data-ui summary:hover { color:var(--cm-accent,#1677ff); }
.cm-data-ui button:disabled { color:var(--cm-muted,#8993a1); opacity:.45; cursor:default; }
.cm-data-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; }
.cm-data-search { display:flex; flex:1; min-width:140px; }
.cm-data-search input { width:100%; }
.cm-data-error { color:var(--cm-danger,#b42318); font-size:12px; margin:6px 0; }
.cm-data-error:empty { display:none; }
.cm-data-panel { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; gap:8px; }
.cm-data-tools { flex-shrink:0; }
.cm-data-meta { display:flex; align-items:center; justify-content:space-between; min-height:30px; flex-shrink:0; color:var(--cm-muted,#687586); font-size:12px; }
.cm-data-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; padding:8px 10px; border:1px solid var(--cm-border,#cbd3de); border-radius:8px; background:var(--cm-subtle,#f3f6fa); }
.cm-data-actions strong { padding:4px 7px; border-radius:5px; background:var(--cm-selection,#d6e6fc); color:var(--cm-foreground,#273444); }
.cm-data-selection-actions { display:contents; }
.cm-data-table { flex:1; min-height:120px; overflow:auto; overflow-anchor:none; }
.cm-data-head { box-sizing:border-box; height:32px; border-bottom:1px solid var(--cm-border,#dbe2eb); background:var(--cm-subtle,#f3f6fa); color:var(--cm-muted,#556274); font-size:11px; font-weight:650; text-align:left; }
.cm-data-row { --cm-row-background:var(--cm-surface,#fff); box-sizing:border-box; height:34px; border-bottom:1px solid var(--cm-border,#eee); background:var(--cm-row-background); font-size:13px; }
.cm-data-row > :is(th,td) { height:34px; box-sizing:border-box; background:var(--cm-row-background); border-bottom:1px solid var(--cm-border,#eee); }
.cm-data-row:is(:hover,:focus-within) { --cm-row-background:var(--cm-hover,#e3ecf8); }
.cm-data-row.is-selected { --cm-row-background:var(--cm-selection,#d6e6fc); }
.cm-data-cell { box-sizing:border-box; padding:0 8px; text-align:left; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-data-cell--select { width:32px; min-width:32px; padding:0; text-align:center; }
span.cm-data-cell--select { display:flex; align-items:center; justify-content:center; }
.cm-data-cell--select input { margin:0; }
.cm-data-ui .cm-data-cell .cm-data-field { padding-inline:0; margin-inline:-1px; }
.cm-data-ui input.cm-data-field.cm-data-cell { padding-inline:7px; }
.cm-data-placeholder { color:var(--cm-muted,#687586); font-style:normal; }
.cm-data-ui .cm-data-field { min-width:0; border-color:transparent!important; background:transparent!important; }
.cm-data-ui .cm-data-row .cm-data-field { height:28px; min-height:28px; padding-block:2px; line-height:20px; }
.cm-data-ui .cm-data-field:is(:hover,:focus) { border-color:var(--cm-accent,#c6d8f0)!important; background:var(--cm-surface,#fff)!important; }
.cm-data-ui .cm-data-field:focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:-2px; }
.cm-data-field::placeholder { color:var(--cm-muted,#7b8796); }
.cm-data-field[type=number]:not(:hover):not(:focus) { appearance:textfield; -moz-appearance:textfield; }
.cm-data-field[type=number]:not(:hover):not(:focus)::-webkit-inner-spin-button { appearance:none; }
select.cm-data-field:not(:hover):not(:focus) { appearance:none; }
}
`;
  document.head.append(style);
}
