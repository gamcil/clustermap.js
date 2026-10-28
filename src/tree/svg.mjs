import { measureTreeLayout } from "../scene/measure.mjs";
import { interpolateTreeLayout } from "./layout.mjs";

const measurementContexts = new WeakMap();

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
  let context = measurementContexts.get(plot.node());
  if (!context) {
    context = plot.node().ownerDocument.createElement("canvas").getContext("2d");
    measurementContexts.set(plot.node(), context);
  }
  const layout = measureTreeLayout(context, tree, scene, config, {
    preview: motion.preview, previousTree: motion.previousTree, previousScene: motion.previousScene,
    dragging: motion.preview ? motion.preview.type === "cluster-drag" : interactions.isDragging?.() || false,
  });
  const group = plot.selectAll("g.phylogenetic-tree").data(layout ? [layout] : []).join("g")
    .attr("class", "phylogenetic-tree").interrupt();
  if (!layout) return;
  const branchMarks = (tag, className, records) => group.selectAll(`${tag}.${className}`)
    .data(records, (mark) => mark.uid).join(tag).attr("class", className)
    .attr("fill", "none").attr("stroke", (mark) => mark.style.colour).attr("stroke-width", (mark) => mark.style.width)
    .attr("stroke-linecap", (mark) => mark.lineCap || "butt");
  const cut = group.selectAll("g.tree-cut").data(layout.cutLine ? [layout.cutLine] : []).join("g")
    .attr("class", "tree-cut").attr("pointer-events", "none");
  cut.selectAll("line").data((line) => [line]).join("line")
    .attr("x1", (line) => line.x1).attr("x2", (line) => line.x2)
    .attr("y1", (line) => line.y1).attr("y2", (line) => line.y2)
    .attr("stroke", (line) => line.colour).attr("stroke-width", (line) => line.width).attr("stroke-dasharray", "4 3");
  cut.selectAll("text").data((line) => [line]).join("text")
    .attr("x", (line) => line.label.x).attr("y", (line) => line.label.y)
    .attr("font-size", (line) => `${line.label.fontSize}px`).attr("font-family", (line) => line.label.fontFamily)
    .attr("text-anchor", "middle").attr("fill", (line) => line.colour).text((line) => line.label.text);
  const root = branchMarks("path", "tree-root-stub", [layout.rootBranch]);
  const branches = branchMarks("path", "tree-branch", layout.branches);
  const stems = branchMarks("line", "tree-stem", layout.stems);
  const guides = group.selectAll("line.tree-leaf-guide").data(layout.guides, (guide) => guide.uid).join("line")
    .attr("class", "tree-leaf-guide")
    .attr("stroke", layout.guide.colour).attr("stroke-width", layout.guide.width)
    .attr("stroke-dasharray", layout.guide.dash.join(" ")).attr("pointer-events", "none");
  const nodes = group.selectAll("circle.tree-node").data(layout.nodes, (node) => node.uid).join("circle")
    .attr("class", "tree-node").attr("r", (node) => node.radius)
    .attr("fill", layout.background).attr("stroke", layout.branch.colour).attr("stroke-width", layout.branch.width)
    .attr("cursor", "pointer")
    .attr("tabindex", 0).attr("role", "button").attr("aria-label", (node) => `Tree node ${node.uid}: rotate children or open context menu`)
    .on("contextmenu", (event, node) => interactions.showTreeMenu?.(event, node.uid))
    .on("keydown", (event, node) => {
      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) interactions.showTreeMenu?.(event, node.uid);
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); interactions.rotateTreeNode?.(node.uid); }
    })
    .on("click", (event, node) => { event.stopPropagation(); interactions.rotateTreeNode?.(node.uid); });
  const supports = group.selectAll("text.tree-support").data(layout.supports, (label) => label.uid).join("text")
    .attr("class", "tree-support").attr("fill", layout.support.colour)
    .attr("font-size", `${layout.support.fontSize}px`).style("font-family", layout.support.fontFamily)
    .attr("text-anchor", "end").attr("dominant-baseline", "text-after-edge")
    .text((label) => label.text);
  const annotations = group.selectAll("text.tree-annotation").data(layout.annotations, (label) => label.uid).join("text")
    .attr("class", "tree-annotation").attr("dominant-baseline", "hanging")
    .attr("font-family", (label) => label.fontFamily).attr("font-size", (label) => label.fontSize)
    .attr("font-weight", (label) => label.fontWeight).attr("font-style", (label) => label.fontStyle)
    .attr("fill", (label) => label.colour).text((label) => label.text);
  const scale = group.selectAll("g.tree-scale-bar").data(layout.scaleBar ? [layout.scaleBar] : []).join("g")
    .attr("class", "tree-scale-bar");
  scale.selectAll("line").data((bar) => bar.lines).join("line")
    .attr("x1", (line) => line.x1).attr("y1", (line) => line.y1)
    .attr("x2", (line) => line.x2).attr("y2", (line) => line.y2)
    .attr("stroke", layout.scaleBar?.colour).attr("stroke-width", layout.scaleBar?.strokeWidth);
  scale.selectAll("text").data((bar) => [bar.label]).join("text")
    .attr("x", (label) => label.x).attr("y", (label) => label.y)
    .attr("text-anchor", "middle").attr("dominant-baseline", "hanging")
    .attr("font-size", `${layout.scaleBar?.fontSize}px`).attr("font-family", layout.scaleBar?.fontFamily)
    .attr("fill", layout.foreground).text((label) => label.text);
  const paintFrame = (frame) => {
    positionBranches(root, [frame.rootBranch]);
    positionBranches(branches, frame.branches);
    positionLines(stems, frame.stems);
    positionLines(guides, frame.guides);
    nodes.data(frame.nodes, (node) => node.uid).attr("cx", (node) => node.x).attr("cy", (node) => node.y);
    annotations.data(frame.annotations, (label) => label.uid).attr("x", (label) => label.x).attr("y", (label) => label.y);
    supports.data(frame.supports, (label) => label.uid).attr("x", (label) => label.x).attr("y", (label) => label.y);
  };
  paintFrame(interpolateTreeLayout(layout, animate ? 0 : 1));
  if (animate && layout.previousYs) {
    // One shared frame per tick keeps stems, labels, and nodes on the same clock.
    group.transition(transition).tween("tree.geometry", () =>
      (amount) => paintFrame(interpolateTreeLayout(layout, amount)));
  }
}
