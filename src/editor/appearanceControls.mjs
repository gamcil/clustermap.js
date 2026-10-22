import { createActionRunner } from "../uiControls.mjs";
import { resolveTreePresentation, validateTreePresentation } from "../treePresentation.mjs";
import { defineAppearancePanel } from "./components/appearance-panel/appearance-panel.js";
import { defineTreeAppearance } from "./components/tree-appearance/tree-appearance.js";

export function createAppearanceControls({ document, patch, preview }) {
  defineAppearancePanel(); defineTreeAppearance();
  const node = document.createElement("clinker-appearance-panel");
  const controls = document.createElement("clinker-tree-appearance"); controls.slot = "tree"; node.append(controls);
  const run = createActionRunner((message) => { controls.error = message; });
  const runPreview = createActionRunner((message) => { if (message) controls.error = message; });
  const colouring = (changes) => [{ type: "tree.presentation.update", scope: "tree", changes: { colouring: changes } }];
  controls.addEventListener("colouring-change", (event) => { if (!run(() => patch(colouring(event.detail)))) event.preventDefault(); });
  controls.addEventListener("colouring-preview", (event) => { if (!runPreview(() => preview?.(event.detail ? colouring(event.detail) : null))) event.preventDefault(); });
  controls.addEventListener("reset-styles", (event) => { if (!run(() => patch([{ type: "tree.presentation.reset", scope: "manual" }]))) event.preventDefault(); });
  return { node, update({ config, tree }) {
    node.state = { config, hasTree: Boolean(tree) };
    if (!tree) return;
    const { policy, height } = resolveTreePresentation(tree, config.tree);
    let compatible = tree.distance?.kind === "mergeHeight";
    try { validateTreePresentation({ ...tree, presentation: { ...tree.presentation, colouring: { ...policy, mode: "cutHeight" } } }, config.tree); }
    catch { compatible = false; }
    controls.state = { policy, height, compatible,
      canReset: Boolean(Object.keys(tree.presentation?.nodes || {}).length || Object.keys(tree.presentation?.subtrees || {}).length) };
  } };
}
