import { clusterLabelOffsetForPreview, clusterLabelTextForPreview, clusterOffsetForPreview } from "../scene/preview.mjs";

import { resolveTreePresentation, treeMetrics } from "./model.mjs";
import { clusterLabelLayout } from "../scene/clusterLabels.mjs";

const leafXAnchors = new WeakMap();
const labelClearance = 16;

/** Keep the tree in its base position until a dragged label reaches a leaf. */
function treeLeafX(tree, proposedX, dragging = false) {
  if (!tree || typeof tree !== "object") return proposedX;
  if (!dragging || !leafXAnchors.has(tree)) leafXAnchors.set(tree, proposedX);
  return Math.min(proposedX, leafXAnchors.get(tree));
}

function niceScaleValue(maxDistance) {
  const target = maxDistance / 4;
  const power = 10 ** Math.floor(Math.log10(target));
  const fraction = target / power;
  const multiplier = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  const value = multiplier * power;
  return { value, label: String(Number(value.toPrecision(2))) };
}

/** Lay out branch x positions using lengths when every edge has one. */
export function treeHorizontalLayout(tree, leafX, width, useBranchLengths = true) {
  const { distances, depths, maxDepth, height: maxDistance, completeLengths } = treeMetrics(tree);
  const proportional = useBranchLengths && completeLengths && maxDistance > 0;
  const leftX = leafX - width;
  const xs = new Map();
  for (const node of tree.nodes) {
    const position = proportional
      ? (distances.get(node.uid) / maxDistance) * width
      : (depths.get(node.uid) / Math.max(1, maxDepth)) * width;
    xs.set(node.uid, leftX + position);
  }
  const scale = proportional ? niceScaleValue(maxDistance) : { value: 1, label: "1 branch" };
  return {
    xs,
    maxDepth,
    maxDistance,
    proportional,
    scaleBarLength: proportional ? (scale.value / maxDistance) * width : width / Math.max(1, maxDepth),
    scaleBarLabel: scale.label,
  };
}

/** Place the tree as far right as possible without leaf tips reaching labels. */
function treeLeafAnchorX(tree, labelStarts, width, relative) {
  if (!tree || !labelStarts?.size) return 0;
  let anchor = Infinity;
  for (const node of tree.nodes) {
    if (node.children?.length) continue;
    const labelStart = labelStarts.get(node.cluster);
    if (!Number.isFinite(labelStart)) continue;
    anchor = Math.min(anchor, labelStart - labelClearance + width - relative.get(node.uid));
  }
  return Number.isFinite(anchor) ? anchor : 0;
}

export function treeNodeYPositions(tree, scene, leafY = (node, sourceScene) =>
  sourceScene.clusters.get(node.cluster)?.y ?? 0
) {
  if (!tree || !scene) return new Map();
  const nodes = treeMetrics(tree).nodes;
  const positions = new Map();
  const yFor = (uid) => {
    if (positions.has(uid)) return positions.get(uid);
    const node = nodes.get(uid);
    const children = (node.children || []).map(yFor);
    const y = children.length
      ? (Math.min(...children) + Math.max(...children)) / 2
      : leafY(node, scene);
    positions.set(uid, y);
    return y;
  };
  yFor(tree.root);
  return positions;
}

/**
 * Build renderer-neutral tree marks after the adapter has measured labels.
 * scene supplies displayed label positions; targetScene supplies final row
 * positions during a retained-scene animation. Keeping these separate prevents
 * an interpolated scene from applying the tree motion a second time.
 */
export function layoutTree({
  tree,
  scene,
  config,
  measureLabel,
  measureText = (text, style) => ({ width: text.length * style.fontSize * 0.6, height: style.fontSize }),
  preview = null,
  previousTree = null,
  previousScene = null,
  targetScene = scene,
  dragging = preview?.type === "cluster-drag",
  trackAnchor = true,
}) {
  if (!tree || !config.tree?.show || !scene?.clusters.size) return null;
  const labelStarts = new Map();
  for (const cluster of scene.clusters.values()) {
    const uid = cluster.source.uid;
    const text = clusterLabelTextForPreview(preview, uid, cluster.info.locusText || "");
    labelStarts.set(uid, cluster.x + cluster.info.x +
      clusterLabelOffsetForPreview(preview, uid) -
      (cluster.info.anchor === "start" ? 0 : measureLabel(cluster, text)));
  }
  const width = Number(config.tree.width) || 100;
  const horizontal = treeHorizontalLayout(tree, width, width, config.tree.useBranchLengths !== false);
  const leafY = (node, sourceScene) =>
    (sourceScene.clusters.get(node.cluster)?.y ?? 0) +
    config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2 +
    clusterOffsetForPreview(preview, node.cluster);
  const ys = treeNodeYPositions(tree, targetScene, leafY);
  const previousYs = previousTree && previousScene
    ? treeNodeYPositions(previousTree, previousScene, leafY)
    : null;
  const presentation = resolveTreePresentation(tree, config.tree);
  const hidden = new Set(), collapsed = new Map();
  const treeNodes = treeMetrics(tree).nodes;
  const collectLeaves = (uid, leaves) => {
    hidden.add(uid);
    const node = treeNodes.get(uid);
    if (node.children) for (const child of node.children) collectLeaves(child, leaves);
    else leaves.push(uid);
  };
  const visit = (uid) => {
    const node = treeNodes.get(uid);
    if (node.children && tree.presentation?.subtrees?.[uid]?.collapsed) {
      const leaves = [];
      for (const child of node.children) collectLeaves(child, leaves);
      collapsed.set(uid, leaves);
    } else for (const child of node.children || []) visit(child);
  };
  visit(tree.root);
  const branch = presentation.base;
  const annotations = [...presentation.annotations].filter(([uid]) => !hidden.has(uid)).map(([uid, style]) => {
    const font = { ...style, fontFamily: config.plot.fontFamily };
    return { uid, ...font, ...measureText(style.text, font), x: horizontal.xs.get(uid) + 6, y: ys.get(uid) + 6 };
  });
  const leafTips = new Map(horizontal.xs);
  for (const leaves of collapsed.values()) {
    const edge = Math.max(...leaves.map((uid) => horizontal.xs.get(uid)));
    for (const uid of leaves) leafTips.set(uid, edge);
  }
  let proposedX = treeLeafAnchorX(tree, labelStarts, width, leafTips);
  const labelLayout = clusterLabelLayout(config);
  const rows = [...scene.clusters.values()].map((cluster) => {
    const y = cluster.y + clusterOffsetForPreview(preview, cluster.source.uid);
    return { top: y + labelLayout.top, bottom: y + labelLayout.bottom, start: labelStarts.get(cluster.source.uid) };
  }).sort((a, b) => a.top - b.top);
  for (const label of annotations) {
    let low = 0, high = rows.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (rows[middle].bottom < label.y) low = middle + 1;
      else high = middle;
    }
    for (let index = low; index < rows.length; index++) {
      const row = rows[index];
      if (row.top > label.y + label.height) break;
      if (row.bottom >= label.y) proposedX = Math.min(proposedX, row.start - labelClearance + width - label.x - label.width);
    }
  }
  const leafX = trackAnchor ? treeLeafX(tree, proposedX, dragging) : proposedX;
  const xs = new Map([...horizontal.xs].map(([uid, x]) => [uid, x + leafX - width]));
  for (const label of annotations) label.x += leafX - width;
  const guide = {
    colour: config.tree.leafGuide?.colour || "#999",
    width: Number(config.tree.leafGuide?.width) || 1,
    dash: String(config.tree.leafGuide?.dash || "4 3").split(/[\s,]+/).map(Number).filter(Number.isFinite),
  };
  const support = {
    fontSize: Number(config.tree.support?.fontSize) || 9,
    fontFamily: config.plot.fontFamily,
    colour: branch.colour,
  };
  const rootX = xs.get(tree.root);
  const branches = [];
  if (config.tree.rootStem?.show) branches.push({ uid: "root-stem", nodeUid: tree.root, x1: rootX - 28, x2: rootX, style: branch });
  const stems = [];
  const nodes = [];
  const guides = [];
  const supports = [];
  const triangles = [];
  for (const node of tree.nodes) {
    if (hidden.has(node.uid)) continue;
    const x = xs.get(node.uid);
    if (node.children?.length) {
      if (config.tree.node?.show !== false) nodes.push({ uid: node.uid, x, radius: 4, hitRadius: 10 });
      const leaves = collapsed.get(node.uid);
      if (leaves) {
        const x2 = Math.max(...leaves.map((uid) => xs.get(uid)));
        triangles.push({ uid: node.uid, x, x2, leaves, style: presentation.stems.get(node.uid) });
        if (config.tree.leafGuide?.show) for (const uid of leaves) {
          const end = labelStarts.get(treeNodes.get(uid).cluster) - labelClearance;
          if (end - x2 > 1e-9) guides.push({ uid, nodeUid: uid, x1: x2, x2: end });
        }
      } else {
        // Square stem caps close corners without extending leaf tips.
        if (node.children.length > 1) stems.push({ uid: node.uid, x1: x, x2: x, children: node.children, style: presentation.stems.get(node.uid), lineCap: "square" });
        for (const child of node.children) {
          branches.push({ uid: `${node.uid}:${child}`, nodeUid: child, x1: x, x2: xs.get(child), style: presentation.branches.get(child) });
        }
      }
    } else if (config.tree.leafGuide?.show && Number.isFinite(labelStarts.get(node.cluster))) {
      const end = labelStarts.get(node.cluster) - labelClearance;
      if (end - x > 1e-9) guides.push({ uid: node.uid, nodeUid: node.uid, x1: x, x2: end });
    }
    if (node.children && node.uid !== tree.root && config.tree.support?.show && node.support) {
      const text = Number(node.support.value).toFixed(config.tree.support.precision ?? 1);
      supports.push({
        uid: node.uid,
        x: x - 4,
        text, ...measureText(text, support),
      });
    }
  }
  let scaleBar = null;
  if (config.tree.scaleBar?.show !== false) {
    const style = scene.chrome?.scaleBar || config.scaleBar || {};
    const height = Number(style.height) || 12;
    const length = horizontal.scaleBarLength;
    const y = scene.chrome?.scaleBar?.position?.y ??
      Math.max(...[...scene.clusters.values()].map((cluster) => cluster.y)) +
        config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight + 20;
    scaleBar = {
      colour: style.colour || "black",
      strokeWidth: Number(style.strokeWidth ?? style.stroke) || 1,
      fontSize: Number(style.fontSize) || 10,
      fontFamily: style.fontFamily || config.plot.fontFamily,
      lines: [
        { x1: rootX, y1: y + height / 2, x2: rootX + length, y2: y + height / 2 },
        { x1: rootX, y1: y, x2: rootX, y2: y + height },
        { x1: rootX + length, y1: y, x2: rootX + length, y2: y + height },
      ],
      label: { x: rootX + length / 2, y: y + height + 5, text: config.tree.scaleBar?.label || horizontal.scaleBarLabel },
    };
    Object.assign(scaleBar.label, measureText(scaleBar.label.text, { ...scaleBar, fontSize: scaleBar.fontSize }));
  }
  let cutLine = null;
  if (presentation.metric && presentation.policy.showCutLine && horizontal.proportional &&
      presentation.threshold <= presentation.height && presentation.height > 0) {
    const x = rootX + width * (1 - presentation.threshold / presentation.height);
    const leafYs = tree.nodes.filter((node) => !node.children).map((node) => ys.get(node.uid));
    cutLine = {
      x1: x, x2: x, y1: Math.min(...leafYs), y2: Math.max(...leafYs),
      colour: branch.colour, width: 1,
      label: { x, y: Math.min(...leafYs) - 8, text: String(Number(presentation.threshold.toPrecision(6))), fontSize: support.fontSize, fontFamily: support.fontFamily },
    };
    Object.assign(cutLine.label, measureText(cutLine.label.text, cutLine.label));
  }
  return positionTreeLayout({
    background: config.figureStyle?.background || "white", foreground: config.figureStyle?.foreground || "black",
    cutLine, annotations, branch, guide, support, branches, stems, nodes, guides, supports, triangles, scaleBar,
    rootX,
    ys, previousYs,
  }, ys);
}

function positionTreeLayout(layout, ys) {
  const line = (mark) => ({ ...mark, y1: ys.get(mark.nodeUid), y2: ys.get(mark.nodeUid) });
  const frame = {
    ...layout,
    branches: layout.branches.map(line),
    stems: layout.stems.map((stem) => ({
      ...stem,
      y1: Math.min(...stem.children.map((uid) => ys.get(uid))),
      y2: Math.max(...stem.children.map((uid) => ys.get(uid))),
    })),
    nodes: layout.nodes.map((node) => ({ ...node, y: ys.get(node.uid) })),
    triangles: layout.triangles.map((triangle) => ({ ...triangle, y: ys.get(triangle.uid),
      y1: Math.min(...triangle.leaves.map((uid) => ys.get(uid))),
      y2: Math.max(...triangle.leaves.map((uid) => ys.get(uid))) })),
    guides: layout.guides.map(line),
    supports: layout.supports.map((label) => ({ ...label, y: ys.get(label.uid) - 4 })),
    annotations: layout.annotations.map((label) => ({ ...label, y: ys.get(label.uid) + 6 })),
  };
  const points = [];
  const includeLine = (mark, width = mark.style?.width || 1) => {
    const half = width / 2;
    const extendX = mark.x1 === mark.x2 || mark.lineCap === "square" ? half : 0;
    const extendY = mark.y1 === mark.y2 || mark.lineCap === "square" ? half : 0;
    points.push([Math.min(mark.x1, mark.x2) - extendX, Math.min(mark.y1, mark.y2) - extendY],
      [Math.max(mark.x1, mark.x2) + extendX, Math.max(mark.y1, mark.y2) + extendY]);
  };
  for (const mark of [...frame.branches, ...frame.stems]) includeLine(mark);
  for (const mark of frame.guides) includeLine(mark, frame.guide.width);
  for (const triangle of frame.triangles) {
    const half = triangle.style.width / 2;
    points.push([triangle.x - half, Math.min(triangle.y, triangle.y1) - half],
      [triangle.x2 + half, Math.max(triangle.y, triangle.y2) + half]);
  }
  for (const node of frame.nodes) {
    const radius = node.radius + frame.branch.width / 2;
    points.push([node.x - radius, node.y - radius], [node.x + radius, node.y + radius]);
  }
  for (const label of frame.annotations) points.push([label.x - (label.overhang || 0), label.y], [label.x + label.width, label.y + label.height]);
  for (const label of frame.supports) points.push([label.x - label.width, label.y - label.height], [label.x + (label.overhang || 0), label.y]);
  if (frame.cutLine) {
    includeLine(frame.cutLine, frame.cutLine.width);
    const label = frame.cutLine.label;
    points.push([label.x - label.width / 2, label.y - label.height], [label.x + label.width / 2, label.y]);
  }
  if (frame.scaleBar) {
    for (const mark of frame.scaleBar.lines) includeLine(mark, frame.scaleBar.strokeWidth);
    const label = frame.scaleBar.label;
    points.push([label.x - label.width / 2, label.y], [label.x + label.width / 2, label.y + label.height]);
  }
  frame.bounds = {
    minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)),
  };
  return frame;
}

/** Interpolate node identities, then rebuild stems so swapped branches fold. */
export function interpolateTreeLayout(layout, progress = 1) {
  if (!layout?.previousYs || progress >= 1) return layout;
  const ys = new Map();
  for (const [uid, target] of layout.ys) {
    const from = layout.previousYs.get(uid) ?? target;
    ys.set(uid, from + (target - from) * progress);
  }
  return positionTreeLayout(layout, ys);
}

export function hitTestTreeNode(layout, point) {
  for (const node of layout?.nodes || []) {
    if (Math.hypot(point.x - node.x, point.y - node.y) <= node.hitRadius) {
      return { action: "tree-node", nodeUid: node.uid };
    }
  }
  for (const triangle of layout?.triangles || []) {
    const ratio = (point.x - triangle.x) / (triangle.x2 - triangle.x);
    if (ratio >= 0 && ratio <= 1 &&
        point.y >= triangle.y + ratio * (triangle.y1 - triangle.y) &&
        point.y <= triangle.y + ratio * (triangle.y2 - triangle.y)) {
      return { action: "tree-node", nodeUid: triangle.uid };
    }
  }
  return null;
}
