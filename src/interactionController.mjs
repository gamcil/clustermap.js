// Translates renderer-independent pointer coordinates into chart-state actions.
// Renderers only need to forward pointer events in chart-world coordinates.
export function createInteractionController({
  clusterRows,
  getClusterOrder,
  getClusterPosition,
  getLocusOffset,
  selectedLocusIds = () => [],
  selectedClusterIds = () => [],
  setDragging,
  previewClusterDrag,
  commitClusterOrder,
  previewLocusOffset,
  previewLocusOffsets = null,
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
      clusterDrag = {
        uid,
        uids,
        selected: new Set(uids),
        order,
        positions: new Map(uids.map((clusterUid) => [
          clusterUid,
          getClusterPosition(clusterUid),
        ])),
        pointerOffset: getClusterPosition(uid) - pointerY,
      };
      setDragging(true);
    },

    moveClusterDrag(pointerY) {
      if (!clusterDrag) return;
      const range = clusterRows();
      const y = clamp(pointerY + clusterDrag.pointerOffset, [range[0], range.at(-1)]);
      const targetIndex = range.reduce(
        (closest, position, index) =>
          Math.abs(position - y) < Math.abs(range[closest] - y) ? index : closest,
        0
      );
      const currentIndex = clusterDrag.order.indexOf(clusterDrag.uid);
      let order = null;
      if (targetIndex !== currentIndex) {
        const selectedIndex = clusterDrag.uids.indexOf(clusterDrag.uid);
        const remaining = clusterDrag.order.filter((uid) => !clusterDrag.selected.has(uid));
        const insertionIndex = clamp(targetIndex - selectedIndex, [0, remaining.length]);
        order = [
          ...remaining.slice(0, insertionIndex),
          ...clusterDrag.uids,
          ...remaining.slice(insertionIndex),
        ];
        clusterDrag.order = order;
      }
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
      if (locusDrag.uids.length > 1 && previewLocusOffsets) {
        previewLocusOffsets(offsets);
        return;
      }
      previewLocusOffset(locusDrag.uids[0], offsets.get(locusDrag.uids[0]));
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
