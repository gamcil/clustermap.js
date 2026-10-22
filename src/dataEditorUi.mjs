import { createControls, createTemplate, escapeHtml } from "./uiControls.mjs";
import { DATA_ROW_HEIGHT } from "./virtualRows.mjs";

const searchTemplate = createTemplate(`<label class="cm-data-search"><input type="search" aria-label="Filter records"></label>`);
const panelTemplate = createTemplate(`
  <div class="cm-data-panel">
    <div class="cm-data-tools" hidden></div>
    <div class="cm-data-meta"><span></span><div class="cm-data-actions" hidden></div><button type="button">Select all visible</button></div>
    <div class="cm-data-table" role="region"></div>
  </div>`);
const menuTemplate = createTemplate('<details class="cm-data-action-menu"><summary></summary><div class="cm-data-action-menu-body"></div></details>');
export function createDataActionMenu(document, label, content) {
  const node = menuTemplate(document).firstElementChild;
  node.querySelector("summary").textContent = label;
  const body = node.querySelector("div"); if (content) body.append(content);
  return { node, body };
}
export const updateSegmentedControl = (root, attribute, value) => root.querySelectorAll(`[${attribute}]`)
  .forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === value)));

export const dataActionMenuMarkup = (label, content) =>
  `<details class="cm-data-action-menu"><summary>${escapeHtml(label)}</summary><div class="cm-data-action-menu-body">${content}</div></details>`;

/** Menu behaviour shared by table actions and the plot selection toolbar. */
export function bindDataActionMenus(root) {
  root.addEventListener("toggle", (event) => {
    if (event.target.matches?.(".cm-data-action-menu[open]")) {
      for (const menu of root.querySelectorAll(".cm-data-action-menu[open]")) if (menu !== event.target) menu.open = false;
    }
  }, true);
  root.addEventListener("pointerdown", (event) => {
    for (const menu of root.querySelectorAll(".cm-data-action-menu[open]")) if (!menu.contains(event.target)) menu.open = false;
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const menu = event.target.closest(".cm-data-action-menu[open]");
    if (menu) { menu.open = false; menu.querySelector("summary").focus(); event.preventDefault(); event.stopPropagation(); }
  });
}

/** Shared controls and table primitives for the packaged and inline data editors. */
export function createDataSearch(document, { placeholder = "Search names, labels, loci, or clusters", onInput } = {}) {
  const node = searchTemplate(document).firstElementChild, input = node.querySelector("input");
  input.placeholder = placeholder;
  if (onInput) input.oninput = () => onInput(input.value);
  return { node, input };
}

/** Shared content layout for every data view, including the standalone editor. */
export function createDataPanel(document, { label = "Editable chart data" } = {}) {
  installDataEditorStyle(document);
  const node = panelTemplate(document).firstElementChild;
  const tools = node.querySelector(".cm-data-tools"), meta = node.querySelector(".cm-data-meta");
  const summary = meta.querySelector("span"), selectVisible = meta.querySelector("button"), actions = meta.querySelector(".cm-data-actions");
  bindDataActionMenus(node);
  node.addEventListener("mousedown", (event) => {
    if (event.button === 0 && event.shiftKey && event.target.closest(".cm-data-row") &&
        !event.target.closest('input:not([type="checkbox"]), textarea, select, [contenteditable], clinker-editable-field')) event.preventDefault();
  });
  const viewport = node.querySelector(".cm-data-table"); viewport.setAttribute("aria-label", label);
  return { node, tools, meta, summary, selectVisible, actions, viewport,
    sync() { tools.hidden = ![...tools.children].some((child) => !child.hidden); } };
}

/** Keep selection controls independent of the table's row and action rendering. */
export function createSelectionControls(panel, { selection, onChange, checkbox, menuLabel } = {}) {
  const ui = createControls(panel.node.ownerDocument);
  const menu = menuLabel && createDataActionMenu(panel.node.ownerDocument, menuLabel);
  if (menu) panel.actions.append(menu.node);
  const actions = menu ? menu.body
    : ui.el("span", undefined, panel.actions, "cm-data-selection-actions");
  ui.button(panel.actions, "Clear", () => { selection.clear(); onChange(); }).setAttribute("aria-label", "Clear selection");
  let visibleIds = [];
  panel.selectVisible.onclick = () => { selection.setMany(visibleIds); onChange(); };
  if (checkbox) checkbox.onchange = () => { selection.setMany(visibleIds, checkbox.checked); onChange(); };
  return { actions,
    update({ ids, summary, noun, selectSuffix = "" }) {
      visibleIds = ids;
      const selectedVisible = ids.reduce((total, id) => total + Number(selection.has(id)), 0);
      const all = ids.length > 0 && selectedVisible === ids.length;
      panel.summary.textContent = selection.size
        ? `${selection.size.toLocaleString()} ${noun}${selection.size === 1 ? "" : "s"} selected` : summary;
      panel.summary.classList.toggle("is-selected", selection.size > 0);
      panel.summary.title = summary;
      panel.selectVisible.hidden = !ids.length;
      panel.selectVisible.disabled = all;
      panel.selectVisible.textContent = `Select all ${ids.length.toLocaleString()} visible${selectSuffix}`;
      panel.actions.hidden = !selection.size;
      if (checkbox) {
        checkbox.checked = all;
        checkbox.indeterminate = selectedVisible > 0 && !all;
        checkbox.disabled = !ids.length;
      }
    },
  };
}

export function installDataEditorStyle(document) {
  if (document.getElementById("cm-data-editor-style")) return;
  const style = document.createElement("style"); style.id = "cm-data-editor-style";
  style.textContent = `
@layer clinker-editor {
.cm-data-ui { color:var(--cm-foreground,#273444); font:13px/1.4 system-ui,sans-serif; }
.cm-data-ui [hidden] { display:none!important; }
.cm-data-ui form { margin:0; }
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
.cm-data-segmented { display:flex; padding:3px; border:1px solid var(--cm-border,#e0e5eb); border-radius:7px; background:var(--cm-subtle,#f3f6fa); }
.cm-data-segmented button { min-height:28px; border:0; background:transparent; }
.cm-data-segmented button[aria-pressed=true] { background:var(--cm-surface,#fff); box-shadow:0 1px 2px rgba(29,43,61,.16); font-weight:600; }
.cm-data-segmented button:hover:not(:disabled) { background:var(--cm-hover,#e3ecf8); color:var(--cm-foreground,#273444); }
.cm-data-ui .cm-data-icon-button { display:inline-grid; place-items:center; width:var(--cm-icon-size,28px); min-width:var(--cm-icon-size,28px); min-height:var(--cm-icon-size,28px); padding:0; border:0; background:transparent; color:var(--cm-muted,#64748b); line-height:1; }
.cm-data-ui .cm-data-icon-button:hover:not(:disabled) { background:var(--cm-hover,#e3ecf8); color:var(--cm-accent,#1677ff); }
.cm-data-icon-button svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.cm-data-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; }
.cm-data-search { display:flex; flex:1; min-width:140px; }
.cm-data-search input { width:100%; }
.cm-data-error { color:var(--cm-danger,#b42318); font-size:12px; margin:6px 0; }
.cm-data-error:empty { display:none; }
.cm-data-panel { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; gap:8px; }
.cm-data-tools { flex-shrink:0; }
.cm-data-meta { display:flex; align-items:center; gap:8px; height:32px; flex-shrink:0; color:var(--cm-muted,#687586); font-size:12px; }
.cm-data-meta > span:first-child { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-data-meta > span.is-selected { color:var(--cm-foreground,#273444); font-weight:600; }
.cm-data-meta > button { flex-shrink:0; }
.cm-data-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.cm-data-selection-actions { display:contents; }
.cm-data-action-menu { position:relative; }
.cm-data-action-menu > summary { display:block; min-height:30px; box-sizing:border-box; padding:4px 8px; border:1px solid var(--cm-border,#cbd3de); border-radius:6px; background:var(--cm-surface,#fff); color:var(--cm-foreground,#273444); list-style:none; white-space:nowrap; }
.cm-data-action-menu > summary::-webkit-details-marker { display:none; }
.cm-data-action-menu > summary:hover, .cm-data-action-menu[open] > summary { background:var(--cm-hover,#e3ecf8); border-color:var(--cm-accent,#78a9ed); }
.cm-data-action-menu-body { position:absolute; right:0; top:calc(100% + 4px); z-index:10; display:flex; flex-direction:column; gap:8px; width:max-content; max-width:min(340px,80vw); max-height:50vh; overflow:auto; padding:10px; border:1px solid var(--cm-border,#cbd3de); border-radius:8px; background:var(--cm-surface,#fff); box-shadow:0 4px 16px #0002; color:var(--cm-foreground,#273444); }
.cm-data-action-menu-body > button { text-align:left; }
.cm-data-action-menu-body label { display:flex; align-items:center; gap:6px; }
.cm-data-action-menu-body input[type=number] { width:112px; }
.cm-data-table { flex:1; min-height:120px; overflow:auto; overflow-anchor:none; }
.cm-data-head { box-sizing:border-box; height:32px; border-bottom:1px solid var(--cm-border,#dbe2eb); background:var(--cm-subtle,#f3f6fa); color:var(--cm-muted,#556274); font-size:11px; line-height:20px; font-weight:650; text-align:left; }
.cm-data-row { --cm-row-background:var(--cm-surface,#fff); box-sizing:border-box; height:${DATA_ROW_HEIGHT}px; border-bottom:1px solid var(--cm-border,#eee); background:var(--cm-row-background); font-size:13px; line-height:20px; }
.cm-data-row > :is(th,td) { height:${DATA_ROW_HEIGHT}px; box-sizing:border-box; background:var(--cm-row-background); border-bottom:1px solid var(--cm-border,#eee); }
.cm-data-row:is(:hover,:focus-within) { --cm-row-background:var(--cm-hover,#e3ecf8); }
.cm-data-row.is-selected { --cm-row-background:var(--cm-selection,#d6e6fc); }
.cm-data-row:is(:hover,:focus-within,.is-selected) { --cm-edit-affordance-opacity:1; }
.cm-data-cell { box-sizing:border-box; padding:0 8px; text-align:left; vertical-align:middle; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-data-cell--select { width:32px; min-width:32px; padding:0; text-align:center; }
span.cm-data-cell--select { display:flex; align-items:center; justify-content:center; }
.cm-data-cell--select input { display:block; margin:auto; }
.cm-data-cell > input[type=color] { display:block; }
.cm-data-ui .cm-data-cell .cm-data-field { padding-inline:0; margin-inline:-1px; }
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
