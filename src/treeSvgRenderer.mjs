import { layoutTree, interpolateTreeLayout } from "./treeLayout.mjs";

function positionLines(selection, lines) {
  selection.data(lines, (line) => line.uid)
    .attr("x1", (line) => line.x1).attr("y1", (line) => line.y1)
    .attr("x2", (line) => line.x2).attr("y2", (line) => line.y2);
}

function positionBranches(selection, lines) {
  selection.data(lines, (line) => line.uid)
    .attr("d", (line) => `M${line.x1},${line.y1}H${line.x2}`);
}

/** SVG owns DOM joins and transitions; the shared layout supplies every frame. */
export function renderSvgTree(plot, tree, scene, config, interactions, transition, animate, motion = {}) {
  const labelWidths = new Map();
  if (tree && config.tree?.show) {
    for (const clusterGroup of plot.selectAll("g.cluster").nodes()) {
      let width = 0;
      for (const selector of ["text.clusterText", "text.locusText"]) {
        try { width = Math.max(width, clusterGroup.querySelector(selector)?.getBBox().width || 0); }
        catch { /* SVG text must be attached for measurement. */ }
      }
      labelWidths.set(clusterGroup.__data__.uid, width);
    }
  }
  const layout = layoutTree({
    tree, scene, config,
    measureLabel: (cluster) => labelWidths.get(cluster.source.uid) || 0,
    previousTree: motion.previousTree,
    previousScene: motion.previousScene,
    dragging: interactions.isDragging?.() || false,
  });
  const group = plot.selectAll("g.phylogenetic-tree").data(layout ? [layout] : []).join("g")
    .attr("class", "phylogenetic-tree").interrupt();
  if (!layout) return;
  const branchMarks = (tag, className, records) => group.selectAll(`${tag}.${className}`)
    .data(records, (mark) => mark.uid).join(tag).attr("class", className)
    .attr("fill", "none").attr("stroke", layout.branch.colour).attr("stroke-width", layout.branch.width);
  const root = branchMarks("path", "tree-root-stub", [layout.rootBranch]);
  const branches = branchMarks("path", "tree-branch", layout.branches);
  const stems = branchMarks("line", "tree-stem", layout.stems);
  const guides = group.selectAll("line.tree-leaf-guide").data(layout.guides, (guide) => guide.uid).join("line")
    .attr("class", "tree-leaf-guide")
    .attr("stroke", layout.guide.colour).attr("stroke-width", layout.guide.width)
    .attr("stroke-dasharray", layout.guide.dash.join(" ")).attr("pointer-events", "none");
  const nodes = group.selectAll("circle.tree-node").data(layout.nodes, (node) => node.uid).join("circle")
    .attr("class", "tree-node").attr("r", (node) => node.radius)
    .attr("fill", "white").attr("stroke", layout.branch.colour).attr("stroke-width", layout.branch.width)
    .attr("cursor", "pointer")
    .on("click", (event, node) => { event.stopPropagation(); interactions.rotateTreeNode?.(node.uid); });
  const supports = group.selectAll("text.tree-support").data(layout.supports, (label) => label.uid).join("text")
    .attr("class", "tree-support").attr("fill", layout.support.colour)
    .attr("font-size", `${layout.support.fontSize}px`).style("font-family", layout.support.fontFamily)
    .attr("text-anchor", "end").attr("dominant-baseline", "text-after-edge")
    .text((label) => label.text);
  const scale = group.selectAll("g.tree-scale-bar").data(layout.scaleBar ? [layout.scaleBar] : []).join("g")
    .attr("class", "tree-scale-bar");
  scale.selectAll("line").data((bar) => bar.lines).join("line")
    .attr("x1", (line) => line.x1).attr("y1", (line) => line.y1)
    .attr("x2", (line) => line.x2).attr("y2", (line) => line.y2)
    .attr("stroke", layout.scaleBar?.colour).attr("stroke-width", layout.scaleBar?.strokeWidth);
  scale.selectAll("text").data((bar) => [bar.label]).join("text")
    .attr("x", (label) => label.x).attr("y", (label) => label.y)
    .attr("text-anchor", "middle").attr("dominant-baseline", "hanging")
    // Match the existing SVG clustermap scale bar, whose font size uses pt.
    .attr("font-size", `${layout.scaleBar?.fontSize}pt`).attr("font-family", layout.scaleBar?.fontFamily)
    .attr("fill", "black").text((label) => label.text);
  const paintFrame = (frame) => {
    positionBranches(root, [frame.rootBranch]);
    positionBranches(branches, frame.branches);
    positionLines(stems, frame.stems);
    positionLines(guides, frame.guides);
    nodes.data(frame.nodes, (node) => node.uid).attr("cx", (node) => node.x).attr("cy", (node) => node.y);
    supports.data(frame.supports, (label) => label.uid).attr("x", (label) => label.x).attr("y", (label) => label.y);
  };
  paintFrame(interpolateTreeLayout(layout, animate ? 0 : 1));
  if (animate && layout.previousYs) {
    // One shared frame per tick keeps stems, labels, and nodes on the same clock.
    group.transition(transition).tween("tree.geometry", () =>
      (amount) => paintFrame(interpolateTreeLayout(layout, amount)));
  }
}
