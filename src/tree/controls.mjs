import { color } from "d3-color";
import { installDataEditorStyle } from "../editor/shared/styles.mjs";
import { createControls, createActionRunner } from "../ui/controls.mjs";
import { resolveTreePresentation, treeMetrics } from "./model.mjs";
import { textAsset, installStyle } from "../ui/assets.mjs";

const css = await textAsset(new URL("./controls.css", import.meta.url));

/** Controls for a single tree node and its subtree. */
export function createTreeControls({ tree, config, patch, rotate, clusters = [], nodeUid = null,
  onResize, document: doc = globalThis.document, styleRoot = doc }) {
  installDataEditorStyle(styleRoot);
  installStyle(styleRoot, "clustermap-tree-controls-style", css);
  const ui = createControls(doc);
  const element = (tag, parent, text, className) => ui.el(tag, text, parent, className);
  const container = element("div", null, undefined, "cm-ui cm-data-ui cm-tree-controls");
  const message = element("p"); message.setAttribute("role", "status");
  const run = createActionRunner((text) => { message.textContent = text; });
  const button = (parent, title, action, className) => ui.button(parent, title, () => run(action), className);
  const input = (parent, title, type, value, options = {}) => {
    const row = ui.row(parent, title); row.className = "cm-tree-row";
    return ui.input(row, title, value, type, options);
  };
  const nodesById = treeMetrics(tree).nodes;
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
  const uid = nodesById.has(nodeUid) ? nodeUid : tree.root;
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
    const root = button(host, "Root here", () => patch([{ type: "tree.reroot", nodeId: uid }]));
    const unaryRoot = !tree.rooting && nodesById.get(tree.root).children?.length === 1;
    root.disabled = uid === tree.root || tree.distance?.kind === "mergeHeight" || unaryRoot;
    root.title = tree.distance?.kind === "mergeHeight" ? "Merge-height trees cannot be rerooted"
      : unaryRoot ? "Trees with a unary display root cannot be rerooted" : "Root on the branch above this node";
    const resetRoot = button(host, "Reset rooting", () => patch([{ type: "tree.reroot.reset" }]));
    resetRoot.disabled = !tree.rooting;
    if (!nodesById.get(uid).children) { onResize?.(); return; }
    button(host, "Rotate branches", () => rotate(uid));
    const collapsed = input(host, "Collapse subtree", "checkbox", tree.presentation?.subtrees?.[uid]?.collapsed);
    collapsed.onchange = () => {
      if (!run(() => patch([{ type: "tree.presentation.update", scope: "subtree", ids: [uid],
        changes: { collapsed: collapsed.checked || null } }]))) collapsed.checked = !collapsed.checked;
    };
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
    resetNode.title = "Reset this node's subtree style, collapse, incoming branch and label; keep descendant overrides and automatic colouring.";
    onResize?.();
  }
  renderNode();
  container.append(message);
  return container;
}
