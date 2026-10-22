import { createTreeControls } from "../treeControls.mjs";
import { defineAppearancePanel } from "./components/appearance-panel/appearance-panel.js";

export function createAppearanceControls({ document, patch, preview, rotate }) {
  defineAppearancePanel();
  const node = document.createElement("clinker-appearance-panel");
  const treeHost = document.createElement("div"); treeHost.slot = "tree"; node.append(treeHost);
  let treeState = null;
  return { node, update({ config, tree }) {
    node.state = { config, hasTree: Boolean(tree) };
    const treeKey = JSON.stringify(config.tree);
    if (treeState?.tree === tree && treeState?.config === treeKey) return;
    treeHost.replaceChildren(...(tree ? [createTreeControls({ tree, config: config.tree, patch, preview, rotate, document })] : []));
    treeState = { tree, config: treeKey };
  } };
}
