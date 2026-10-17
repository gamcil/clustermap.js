import { layoutTree } from "./treeLayout.mjs";

/** Canvas owns text metrics; all tree geometry comes from the shared layout. */
export function layoutCanvasTree(context, tree, scene, config, options = {}) {
  if (!tree || !config.tree?.show || !scene?.clusters.size) return null;
  context.save();
  try {
    return layoutTree({
      ...options,
      tree, scene, config,
      measureLabel: (cluster, locusText) => {
        context.font = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
        const nameWidth = context.measureText(cluster.source.name || "").width;
        context.font = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
        return Math.max(nameWidth, context.measureText(locusText).width);
      },
    });
  } finally {
    context.restore();
  }
}

function traceLines(context, lines) {
  context.beginPath();
  for (const line of lines) {
    context.moveTo(line.x1, line.y1);
    context.lineTo(line.x2, line.y2);
  }
  context.stroke();
}

/** Paint an already positioned tree frame, also used by the WebGPU overlay. */
export function drawCanvasTree(context, layout) {
  if (!layout) return;
  context.save();
  context.strokeStyle = layout.guide.colour;
  context.lineWidth = layout.guide.width;
  context.setLineDash(layout.guide.dash);
  traceLines(context, layout.guides);
  context.setLineDash([]);
  context.strokeStyle = layout.branch.colour;
  context.lineWidth = layout.branch.width;
  traceLines(context, [layout.rootBranch, ...layout.stems, ...layout.branches]);
  context.fillStyle = "white";
  for (const node of layout.nodes) {
    context.beginPath();
    context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.fillStyle = layout.support.colour;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.font = `${layout.support.fontSize}px ${layout.support.fontFamily}`;
  for (const label of layout.supports) context.fillText(label.text, label.x, label.y);
  if (layout.scaleBar) {
    const bar = layout.scaleBar;
    context.strokeStyle = bar.colour;
    context.lineWidth = bar.strokeWidth;
    traceLines(context, bar.lines);
    context.fillStyle = "black";
    context.font = `${bar.fontSize}px ${bar.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(bar.label.text, bar.label.x, bar.label.y);
  }
  context.restore();
}
