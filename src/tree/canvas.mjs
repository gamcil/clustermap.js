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
  if (layout.cutLine) {
    const cut = layout.cutLine;
    context.strokeStyle = cut.colour;
    context.lineWidth = cut.width;
    context.setLineDash([4, 3]);
    traceLines(context, [cut]);
    context.setLineDash([]);
    context.fillStyle = cut.colour;
    context.font = `${cut.label.fontSize}px ${cut.label.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(cut.label.text, cut.label.x, cut.label.y);
  }
  const groups = new Map();
  for (const mark of [layout.rootBranch, ...layout.stems, ...layout.branches]) {
    const key = `${mark.style.colour}:${mark.style.width}:${mark.lineCap || "butt"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mark);
  }
  for (const lines of groups.values()) {
    context.strokeStyle = lines[0].style.colour;
    context.lineWidth = lines[0].style.width;
    context.lineCap = lines[0].lineCap || "butt";
    traceLines(context, lines);
  }
  context.lineCap = "butt";
  context.strokeStyle = layout.branch.colour;
  context.lineWidth = layout.branch.width;
  context.fillStyle = layout.background;
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
  for (const label of layout.annotations) {
    context.fillStyle = label.colour;
    context.textAlign = "left";
    context.textBaseline = "top";
    context.font = `${label.fontStyle} ${label.fontWeight} ${label.fontSize}px ${label.fontFamily}`;
    context.fillText(label.text, label.x, label.y);
  }
  if (layout.scaleBar) {
    const bar = layout.scaleBar;
    context.strokeStyle = bar.colour;
    context.lineWidth = bar.strokeWidth;
    traceLines(context, bar.lines);
    context.fillStyle = layout.foreground;
    context.font = `${bar.fontSize}px ${bar.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(bar.label.text, bar.label.x, bar.label.y);
  }
  context.restore();
}
