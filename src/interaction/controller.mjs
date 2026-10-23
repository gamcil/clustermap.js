import { isTreeOrderCompatible } from "../tree/model.mjs";

export function plotSelectionOptions({ shiftKey, ctrlKey, metaKey, altKey }) {
  return { range: Boolean(shiftKey && (ctrlKey || metaKey || altKey)), subtract: Boolean(shiftKey && altKey) };
}

// Translates renderer-independent pointer coordinates into chart-state actions.
// Renderers only need to forward pointer events in chart-world coordinates.
export function createInteractionController({
  clusterRows,
  getClusterOrder,
  getClusterPosition,
  getTree = () => null,
  getLocusOffset,
  selectedLocusIds = () => [],
  selectedClusterIds = () => [],
  setDragging,
  previewClusterDrag,
  commitClusterOrder,
  previewLocusOffsets,
  commitLocusOffset,
  previewLocusTrim,
  commitLocusTrim,
  cancelInteraction = () => {},
  flipLocus,
}) {
  let clusterDrag = null;
  let locusDrag = null;

  const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

  return {
    beginClusterDrag(uid, pointerY) {
      const order = [...getClusterOrder()];
      const selected = new Set(selectedClusterIds());
      // Dragging a selected cluster moves every selected cluster as one
      // ordered block. A cluster outside the selection keeps the familiar
      // single-row drag behaviour.
      const uids = selected.has(uid)
        ? order.filter((clusterUid) => selected.has(clusterUid))
        : [uid];
      const remaining = order.filter((clusterUid) => !uids.includes(clusterUid));
      const draggedIndex = uids.indexOf(uid);
      const legalInsertions = [];
      for (let insertion = 0; insertion <= remaining.length; insertion += 1) {
        const candidate = [
          ...remaining.slice(0, insertion),
          ...uids,
          ...remaining.slice(insertion),
        ];
        if (isTreeOrderCompatible(getTree(), candidate)) legalInsertions.push(insertion);
      }
      clusterDrag = {
        uid,
        uids,
        draggedIndex,
        legalInsertions,
        remaining,
        positions: new Map(uids.map((clusterUid) => [
          clusterUid,
          getClusterPosition(clusterUid),
        ])),
        pointerOffset: getClusterPosition(uid) - pointerY,
      };
      setDragging(true);
    },

    moveClusterDrag(pointerY) {
      if (!clusterDrag?.legalInsertions.length) return;
      const range = clusterRows();
      const selectedYs = [...clusterDrag.positions.values()];
      const anchorY = clusterDrag.positions.get(clusterDrag.uid);
      const rowMin = Math.min(...range);
      const rowMax = Math.max(...range);
      const extentMin = rowMin + anchorY - Math.min(...selectedYs);
      const extentMax = rowMax - (Math.max(...selectedYs) - anchorY);
      const legalTargets = clusterDrag.legalInsertions.map((insertion) => ({
        insertion,
        y: range[insertion + clusterDrag.draggedIndex],
      })).filter((candidate) => candidate.y >= extentMin && candidate.y <= extentMax);
      if (!legalTargets.length) return;
      const legalMin = Math.min(...legalTargets.map((candidate) => candidate.y));
      const legalMax = Math.max(...legalTargets.map((candidate) => candidate.y));
      // Keep the whole selected set inside the plot and stop at the first or
      // last tree-compatible insertion. Using only the dragged row's range
      // lets a multi-row selection overrun either boundary.
      const allowedY = [Math.max(legalMin, extentMin), Math.min(legalMax, extentMax)];
      const rawY = clamp(pointerY + clusterDrag.pointerOffset, allowedY);
      const target = legalTargets.reduce((closest, candidate) =>
        Math.abs(candidate.y - rawY) < Math.abs(closest.y - rawY) ? candidate : closest
      , legalTargets[0]);
      const previous = legalTargets
        .filter((candidate) => candidate.y < target.y)
        .at(-1);
      const next = legalTargets.find((candidate) => candidate.y > target.y);
      const minY = previous ? (previous.y + target.y) / 2 : legalMin;
      const maxY = next ? (next.y + target.y) / 2 : legalMax;
      const y = clamp(rawY, [
        Math.max(Math.min(minY, maxY), allowedY[0]),
        Math.min(Math.max(minY, maxY), allowedY[1]),
      ]);
      const { remaining } = clusterDrag;
      const order = [
        ...remaining.slice(0, target.insertion),
        ...clusterDrag.uids,
        ...remaining.slice(target.insertion),
      ];
      const delta = y - clusterDrag.positions.get(clusterDrag.uid);
      const positions = new Map(
        [...clusterDrag.positions].map(([uid, position]) => [uid, position + delta])
      );
      previewClusterDrag(clusterDrag.uid, y, order, positions);
    },

    endClusterDrag() {
      if (!clusterDrag) return;
      clusterDrag = null;
      setDragging(false);
      commitClusterOrder();
    },

    cancelClusterDrag() {
      if (!clusterDrag) return;
      clusterDrag = null;
      setDragging(false);
      cancelInteraction();
    },

    beginLocusDrag(uid, pointerX) {
      const selected = new Set(selectedLocusIds());
      const locusUids = selected.has(uid) ? [...selected] : [uid];
      locusDrag = {
        uids: locusUids,
        pointerStart: pointerX,
        initialOffsets: new Map(locusUids.map((locusUid) => [locusUid, getLocusOffset(locusUid)])),
      };
      setDragging(true);
    },

    moveLocusDrag(pointerX) {
      if (!locusDrag) return;
      const delta = pointerX - locusDrag.pointerStart;
      const offsets = new Map(
        locusDrag.uids.map((uid) => [uid, locusDrag.initialOffsets.get(uid) + delta])
      );
      previewLocusOffsets(offsets);
    },

    endLocusDrag() {
      if (!locusDrag) return;
      const { uids } = locusDrag;
      locusDrag = null;
      setDragging(false);
      commitLocusOffset(uids.length === 1 ? uids[0] : uids);
    },

    cancelLocusDrag() {
      if (!locusDrag) return;
      locusDrag = null;
      setDragging(false);
      cancelInteraction();
    },

    beginLocusTrim() {
      setDragging(true);
    },

    moveLocusTrim(locus, edge, pointerX) {
      previewLocusTrim(locus, edge, pointerX);
    },

    endLocusTrim(locus) {
      setDragging(false);
      commitLocusTrim(locus);
    },

    cancelLocusTrim() {
      setDragging(false);
      cancelInteraction();
    },

    flipLocus,
  };
}
