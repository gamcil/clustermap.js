import { treeMetrics } from "../tree/model.mjs";
import { color } from "d3-color";

export function validateGroupPanel(panel, clusterIds, tree, fail) {
  if (!Array.isArray(panel.groups) || !panel.groups.length) fail("group panels require a non-empty groups array.");
  for (const key of ["markerWidth", "laneGap"]) {
    if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] <= 0)) fail(`${key} must be positive.`);
  }
  const ids = new Set(), nodes = tree ? treeMetrics(tree).nodes : new Map();
  for (const group of panel.groups) {
    if (!group || typeof group.uid !== "string" || !group.uid.trim() || ids.has(group.uid)) fail("groups require unique, non-empty uid strings.");
    ids.add(group.uid);
    if (group.label !== undefined && typeof group.label !== "string") fail("group label must be text.");
    if (group.colour !== undefined && (typeof group.colour !== "string" || !color(group.colour))) fail("group colour must be a CSS colour.");
    if ((group.nodeUid !== undefined) === (group.clusterIds !== undefined)) fail("each group requires either nodeUid or clusterIds.");
    if (group.nodeUid !== undefined) {
      if (!nodes.has(group.nodeUid)) fail(`unknown tree node '${group.nodeUid}'.`);
    } else if (!Array.isArray(group.clusterIds) || !group.clusterIds.length ||
        new Set(group.clusterIds).size !== group.clusterIds.length || group.clusterIds.some((uid) => !clusterIds.has(uid))) {
      fail("group clusterIds must contain unique, existing cluster IDs.");
    }
  }
}

/** Resolve membership and allocate lanes once; placement remains independent of tree geometry. */
export function layoutGroupPanel(source, clusters, { tree, measureBounds }) {
  const nodes = tree ? treeMetrics(tree).nodes : new Map();
  const descendants = new Map();
  const collect = (uid) => {
    if (!descendants.has(uid)) {
      const node = nodes.get(uid);
      descendants.set(uid, node?.children?.length ? node.children.flatMap(collect) : node ? [node.cluster] : []);
    }
    return descendants.get(uid);
  };
  const markerWidth = source.markerWidth ?? 3, laneGap = source.laneGap ?? 12;
  const lanes = [];
  const markerGroups = source.groups.map((group) => {
    const clusterIds = group.clusterIds ?? collect(group.nodeUid);
    let laneIndex = lanes.findIndex((lane) => clusterIds.every((uid) => !lane.members.has(uid)));
    if (laneIndex < 0) { laneIndex = lanes.length; lanes.push({ members: new Set(), width: 0 }); }
    const lane = lanes[laneIndex], label = group.label ?? group.uid;
    const labelBounds = measureBounds(label);
    for (const uid of clusterIds) lane.members.add(uid);
    lane.width = Math.max(lane.width, markerWidth + (label ? 6 + labelBounds.maxX - labelBounds.minX : 0));
    return { uid: group.uid, label, clusterIds: new Set(clusterIds), laneIndex, labelBounds,
      colour: group.colour ?? source.colour ?? "#267c9e" };
  });
  let width = 0;
  for (const lane of lanes) { lane.x = width; width += lane.width + laneGap; }
  width -= laneGap;
  for (const group of markerGroups) group.x = lanes[group.laneIndex].x;
  return { width, markerWidth, markerGroups,
    rows: [...clusters.keys()].map((uid) => ({ uid, cells: [] })) };
}

/** Split non-contiguous memberships using the current row order, including drag previews. */
export function groupPanelMarks(panel, rows) {
  const sorted = [...rows].sort((a, b) => a.y - b.y);
  const rects = [], texts = [];
  for (const group of panel.markerGroups) {
    let start = -1;
    const segment = (end) => {
      const top = sorted[start].y - panel.cellHeight / 2, bottom = sorted[end].y + panel.cellHeight / 2;
      const uid = `${group.uid}:${sorted[start].uid}`;
      rects.push({ uid, x: group.x, y: top, width: panel.markerWidth, height: bottom - top,
        fill: group.colour, keyIndex: rects.length });
      if (group.label) texts.push({ uid, text: group.label, x: group.x + panel.markerWidth + 6 - group.labelBounds.minX,
        y: (top + bottom - group.labelBounds.minY - group.labelBounds.maxY) / 2,
        anchor: "start", fontSize: panel.labelFontSize, bounds: group.labelBounds });
    };
    for (let i = 0; i <= sorted.length; i++) {
      const member = i < sorted.length && group.clusterIds.has(sorted[i].uid);
      if (member && start < 0) start = i;
      if (!member && start >= 0) { segment(i - 1); start = -1; }
    }
  }
  return { rects, texts };
}
