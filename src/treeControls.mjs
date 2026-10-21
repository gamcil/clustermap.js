import { color } from "d3-color";
import { installDataEditorStyle } from "./dataEditorUi.mjs";
import { createControls, createActionRunner } from "./uiControls.mjs";
import { resolveTreePresentation, validateTreePresentation } from "./treePresentation.mjs";
import { installTreeControlsStyle } from "./treeControlsStyle.mjs";

/** Policy settings and node popovers share the same compact editing form. */
export function createTreeControls({ tree, config, patch, preview, rotate, clusters = [], nodeUid = null,
  policy = true, onResize, document: doc = globalThis.document }) {
  installDataEditorStyle(doc);
  installTreeControlsStyle(doc);
  const ui = createControls(doc);
  const element = (tag, parent, text, className) => ui.el(tag, text, parent, className);
  const container = element("div", null, undefined, `cm-data-ui cm-tree-controls${policy ? "" : " cm-tree-controls--popover"}`);
  const message = element("p"); message.setAttribute("role", "status");
  const run = createActionRunner((text) => { message.textContent = text; });
  const button = (parent, title, action, className) => ui.button(parent, title, () => run(action), className);
  const section = (title) => { const field = element("fieldset", container); element("legend", field, title); return field; };
  const input = (parent, title, type, value, options = {}) => {
    const row = ui.row(parent, title); row.className = "cm-tree-row";
    return ui.input(row, title, value, type, undefined, options);
  };
  const reset = (scope, uid) => patch([{ type: "tree.presentation.reset", scope, ...(uid ? { ids: [uid] } : {}) }]);
  const resolved = resolveTreePresentation(tree, config);

  let compatible = tree.distance?.kind === "mergeHeight";
  try { validateTreePresentation({ ...tree, presentation: { ...tree.presentation, colouring: { ...resolved.policy, mode: "cutHeight" } } }, config); }
  catch { compatible = false; }
  if (policy && compatible) {
    const field = section("Clade colouring");
    const effective = resolved.policy;
    const change = (changes) => [{ type: "tree.presentation.update", scope: "tree", changes: { colouring: changes } }];
    const enabled = input(field, "Colour clades", "checkbox", effective.mode === "cutHeight");
    enabled.onchange = () => run(() => patch(change({ mode: enabled.checked ? "cutHeight" : "none" })));
    const options = element("div", field); options.hidden = !enabled.checked;
    const actual = effective.cutHeight === "auto" ? resolved.height * 0.7 : effective.cutHeight;
    const number = input(options, "Cut height", "number", actual, { min: "0", step: "any" });
    number.onchange = () => run(() => patch(change({ cutHeight: Number(number.value) })));
    const slider = element("input", options); slider.type = "range";
    Object.assign(slider, { min: "0", max: String(Math.max(resolved.height, actual) || 1), step: String(resolved.height / 1000 || 0.001), value: actual });
    slider.setAttribute("aria-label", "Preview cut height");
    let cancelled = false;
    const cancel = () => { cancelled = true; preview?.(null); slider.value = actual; number.value = actual; };
    slider.oninput = () => run(() => { cancelled = false; number.value = slider.value; preview?.(change({ cutHeight: Number(slider.value) })); });
    slider.onchange = () => { if (!cancelled) run(() => patch(change({ cutHeight: Number(slider.value) }))); };
    slider.onkeydown = (event) => { if (event.key === "Escape") { cancel(); event.preventDefault(); } };
    slider.onpointercancel = cancel;
    const auto = button(number.parentElement, "Auto", () => patch(change({ cutHeight: "auto" })));
    auto.title = "Use automatic cut height (70%)";
    auto.setAttribute("aria-pressed", String(effective.cutHeight === "auto"));
    const palettes = [
      ["Muted", ["#267c9e", "#d7752d", "#5c8f39", "#9963a5", "#c34d61", "#9e8433"]],
      ["Colorblind friendly", ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#56b4e9"]],
    ];
    if (!palettes.some(([, colours]) => JSON.stringify(colours) === JSON.stringify(effective.palette))) palettes.unshift(["Custom", effective.palette]);
    const paletteRow = element("label", options, undefined, "cm-tree-row"); element("span", paletteRow, "Palette");
    const select = element("select", paletteRow); select.setAttribute("aria-label", "Clade palette");
    palettes.forEach(([name, colours], index) => { const option = element("option", select, name); option.value = index; option.selected = JSON.stringify(colours) === JSON.stringify(effective.palette); });
    select.onchange = () => run(() => patch(change({ palette: palettes[Number(select.value)][1] })));
    const line = input(options, "Show cut line", "checkbox", effective.showCutLine);
    line.onchange = () => run(() => patch(change({ showCutLine: line.checked })));
  }

  if (policy) {
    const resetAll = button(container, "Reset all manual styles", () => reset("manual"));
    resetAll.title = "Clear manual tree styles and labels; keep automatic clade colouring.";
    resetAll.disabled = !Object.keys(tree.presentation?.nodes || {}).length && !Object.keys(tree.presentation?.subtrees || {}).length;
    container.append(message);
    return container;
  }

  const nodesById = new Map(tree.nodes.map((node) => [node.uid, node]));
  const clusterNames = new Map(clusters.map((cluster) => [cluster.uid, cluster.name || cluster.label || cluster.uid]));
  const descriptions = new Map();
  const describe = (uid) => {
    if (descriptions.has(uid)) return descriptions.get(uid);
    const node = nodesById.get(uid);
    const children = node.children?.map(describe);
    const info = children ? { count: children.reduce((sum, child) => sum + child.count, 0), labels: children.flatMap((child) => child.labels).slice(0, 2) }
      : { count: 1, labels: [node.label || clusterNames.get(node.cluster) || node.cluster] };
    descriptions.set(uid, info);
    return info;
  };
  const titleFor = (uid) => {
    const node = nodesById.get(uid);
    if (node.label) return node.label;
    const { count, labels } = describe(uid);
    return uid === tree.root ? `All ${count} clusters` : `${labels.join(" + ")}${count > 2 ? ` + ${count - 2} more` : ""}`;
  };
  const uid = nodesById.get(nodeUid)?.children ? nodeUid : nodesById.get(tree.root)?.children ? tree.root : null;
  const host = element("div", container);

  const colourInput = (parent, title, value, fallback, onChange) => {
    const picker = element("input", parent); picker.type = "color";
    const initial = color(value || fallback)?.formatHex() || "#555555";
    let override = value ?? null;
    const refresh = () => {
      picker.value = color(override || fallback)?.formatHex() || initial;
      picker.title = `${title}${override === null ? " (inherited)" : ""}`;
    };
    picker.setAttribute("aria-label", title); refresh();
    picker.oninput = () => {
      if (picker.value === override) return;
      run(() => { onChange(picker.value); override = picker.value; picker.title = title; });
    };
    picker.onchange = picker.oninput;
    return { reset: () => { override = null; refresh(); } };
  };
  const liveNumber = (control, onChange) => {
    let previous = control.value === "" ? null : Number(control.value);
    control.oninput = () => {
      if (!control.validity.valid) return;
      const next = control.value === "" ? null : Number(control.value);
      if (next === previous) return;
      run(() => { onChange(next); previous = next; });
    };
    control.onchange = control.oninput;
    return (value = "") => { control.value = value; previous = value === "" ? null : Number(value); };
  };
  const resetButton = (parent, title, action) => {
    const control = button(parent, "↺", action, "cm-tree-reset");
    control.title = title; control.setAttribute("aria-label", title); return control;
  };
  function renderNode() {
    if (!host || !uid) return;
    host.replaceChildren();
    host.setAttribute("role", "group"); host.setAttribute("aria-label", "Tree node settings");
    const heading = element("div", host, titleFor(uid), "cm-tree-heading"); heading.title = heading.textContent;
    button(host, "Rotate branches", () => rotate(uid));
    const inheritedBranch = (scope) => {
      const collection = scope === "subtree" ? "subtrees" : "nodes";
      const records = tree.presentation?.[collection] || {};
      const record = { ...records[uid] }; delete record.branch;
      const inherited = resolveTreePresentation({ ...tree, presentation: {
        ...tree.presentation, [collection]: { ...records, [uid]: record },
      } }, config);
      return (scope === "subtree" ? inherited.stems : inherited.branches).get(uid) || inherited.base;
    };
    const branchControls = (scope, title, style, fallback) => {
      const row = element("div", host, undefined, "cm-tree-branch-row");
      const name = element("span", row, title);
      name.title = scope === "subtree" ? "Branches within this clade, excluding its incoming branch." : "Only the horizontal branch entering this node.";
      const update = (branch) => patch([{ type: "tree.presentation.update", scope, ids: [uid], changes: { branch } }]);
      const colour = colourInput(row, `${title} colour`, style?.colour, fallback.colour, (colour) => update({ colour }));
      const width = element("input", row); width.type = "number";
      Object.assign(width, { min: "0.1", step: "any", value: style?.width ?? fallback.width });
      width.setAttribute("aria-label", `${title} thickness`); width.title = "Thickness (px); leave blank to inherit";
      const clearWidth = liveNumber(width, (width) => update({ width }));
      width.onblur = () => {
        if (width.value !== "") return;
        const current = resolveTreePresentation(tree, config);
        clearWidth((scope === "subtree" ? current.stems : current.branches).get(uid)?.width ?? current.base.width);
      };
      resetButton(row, `Reset ${title.toLowerCase()} style`, () => { update(null); colour.reset(); clearWidth(fallback.width); });
    };
    branchControls("subtree", "Subtree", tree.presentation?.subtrees?.[uid]?.branch, inheritedBranch("subtree"));
    const record = tree.presentation?.nodes?.[uid] || {};
    if (uid !== tree.root) branchControls("node", "Incoming branch", record.branch, inheritedBranch("node"));
    element("hr", host, undefined, "cm-tree-separator");
    const label = record.label || {};
    const text = input(host, "Label", "text", label.text, { placeholder: "Clade label" });
    text.setAttribute("aria-label", "Annotation text"); text.parentElement.classList.add("cm-tree-wide");
    const updateLabel = (label) => patch([{ type: "tree.presentation.update", scope: "node", ids: [uid], changes: { label } }]);
    let previousText = text.value;
    text.oninput = () => {
      if (text.value === previousText) return;
      run(() => { updateLabel({ text: text.value || null }); previousText = text.value; });
    };
    const formatting = element("div", host, undefined, "cm-tree-format");
    const colour = colourInput(formatting, "Text colour", label.colour, "#333", (colour) => updateLabel({ colour }));
    const size = element("input", formatting); size.type = "number";
    Object.assign(size, { min: "1", step: "any", value: label.fontSize ?? "", placeholder: "10" });
    size.setAttribute("aria-label", "Text size"); size.title = "Text size (px); leave blank to inherit";
    const bold = input(formatting, "Bold", "checkbox", label.fontWeight === 700);
    const italic = input(formatting, "Italic", "checkbox", label.fontStyle === "italic");
    const clearSize = liveNumber(size, (fontSize) => updateLabel({ fontSize }));
    bold.onchange = () => run(() => updateLabel({ fontWeight: bold.checked ? 700 : null }));
    italic.onchange = () => run(() => updateLabel({ fontStyle: italic.checked ? "italic" : null }));
    resetButton(formatting, "Clear label and formatting", () => {
      updateLabel(null);
      text.value = ""; previousText = ""; colour.reset(); clearSize(); bold.checked = false; italic.checked = false;
    });
    const actions = element("div", host, undefined, "cm-tree-actions");
    const resetNode = button(actions, "Reset", () => {
      if (tree.presentation?.subtrees?.[uid] || tree.presentation?.nodes?.[uid]) {
        patch([
          { type: "tree.presentation.reset", scope: "subtree", ids: [uid] },
          { type: "tree.presentation.reset", scope: "node", ids: [uid] },
        ]);
      }
      renderNode();
      host.querySelector(".cm-tree-actions button")?.focus({ preventScroll: true });
    });
    resetNode.title = "Reset this node's subtree style, incoming branch and label; keep descendant overrides and automatic colouring.";
    onResize?.();
  }
  renderNode();
  container.append(message);
  return container;
}
