// Structural styles and the same neutral controls used by the plot editor.
export function installTreeControlsStyle(doc) {
  if (doc.getElementById("clustermap-tree-controls-style")) return;
  const style = doc.createElement("style");
  style.id = "clustermap-tree-controls-style";
  style.textContent = `
.cm-tree-controls { font:inherit; color:inherit; text-align:left; }
.cm-tree-controls * { box-sizing:border-box; }
.cm-tree-controls [hidden] { display:none!important; }
.cm-tree-controls fieldset { min-width:0; margin:0 0 10px; padding:8px; border:1px solid #ddd; border-radius:4px; }
.cm-tree-controls legend { padding:0 4px; font-weight:600; }
.cm-tree-controls button, .cm-tree-controls input, .cm-tree-controls select { font:inherit; color:inherit; }
.cm-tree-controls button, .cm-tree-controls select, .cm-tree-controls input:not([type=checkbox]):not([type=color]):not([type=range]) { min-height:30px; border:1px solid #cbd3de; border-radius:6px; padding:4px 8px; background:#fff; }
.cm-tree-controls button { cursor:pointer; }
.cm-tree-controls button:hover:not(:disabled) { border-color:#78a9ed; background:#f4f8ff; }
.cm-tree-controls button:disabled { color:#8993a1; background:#f5f6f8; cursor:default; }
.cm-tree-controls button[aria-pressed=true] { font-weight:600; }
.cm-tree-controls .cm-tree-row { display:flex; align-items:center; gap:6px; margin:6px 0; }
.cm-tree-controls .cm-tree-row > span { flex:1; min-width:0; }
.cm-tree-controls input[type=number] { width:64px; min-width:0; }
.cm-tree-controls input[type=range] { width:100%; }
.cm-tree-controls select { width:132px; min-width:0; }
.cm-tree-controls input[type=color] { width:30px; height:24px; padding:0; border:0; background:transparent; cursor:pointer; }
.cm-tree-controls .cm-tree-heading { font-weight:600; margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-tree-controls .cm-tree-branch-row { display:grid; grid-template-columns:minmax(0,1fr) 30px 64px 28px; gap:6px; align-items:center; margin:8px 0; }
.cm-tree-controls .cm-tree-reset { width:28px; padding:2px; min-height:26px; }
.cm-tree-controls .cm-tree-wide { display:block; }
.cm-tree-controls .cm-tree-wide > span { display:block; margin-bottom:4px; }
.cm-tree-controls .cm-tree-wide input, .cm-tree-controls .cm-tree-wide select { width:100%; }
.cm-tree-controls .cm-tree-format { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.cm-tree-controls .cm-tree-format .cm-tree-row { gap:3px; }
.cm-tree-controls .cm-tree-separator { border:0; border-top:1px solid #e5e9ef; margin:10px 0; }
.cm-tree-controls .cm-tree-actions { display:flex; gap:6px; margin-top:10px; }
.cm-tree-controls [role=status]:empty { display:none; }
.cm-tree-controls [role=status] { color:#a13c46; margin:6px 0 0; }
.cm-tree-controls--popover { width:260px; max-width:calc(100vw - 40px); max-height:75vh; overflow:auto; font-size:12px; line-height:1.3; }
.cm-tree-controls--popover .cm-tree-heading { font-size:12px; margin-bottom:6px; }
.cm-tree-controls--popover button, .cm-tree-controls--popover input:not([type=checkbox]):not([type=color]) { min-height:24px; padding:2px 5px; border-radius:4px; }
.cm-tree-controls--popover input[type=number] { width:52px; }
.cm-tree-controls--popover input[type=color] { width:24px; height:20px; }
.cm-tree-controls--popover input[type=checkbox] { width:12px; height:12px; margin:0; }
.cm-tree-controls--popover .cm-tree-branch-row { grid-template-columns:minmax(0,1fr) 24px 52px 22px; gap:5px; margin:5px 0; }
.cm-tree-controls--popover .cm-tree-reset { width:22px; min-height:22px; padding:0; }
.cm-tree-controls--popover .cm-tree-row { margin:4px 0; gap:4px; }
.cm-tree-controls--popover .cm-tree-format { gap:5px; }
.cm-tree-controls--popover .cm-tree-separator { margin:6px 0; }
.cm-tree-controls--popover .cm-tree-actions { margin-top:6px; }
`.replaceAll(".cm-tree-controls", ".cm-tree-controls.cm-tree-controls");
  doc.head.append(style);
}
