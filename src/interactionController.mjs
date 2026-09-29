// Translates renderer-independent pointer coordinates into chart-state actions.
// Renderers only need to forward pointer events in chart-world coordinates.
export function createInteractionController({
  clusterRows,
  getClusterOrder,
  getClusterPosition,
  getLocusOffset,
  selectedLocusIds = () => [],
  setDragging,
  previewClusterDrag,
  commitClusterOrder,
  previewLocusOffset,
  previewLocusOffsets = null,
  commitLocusOffset,
  previewLocusTrim,
  commitLocusTrim,
  flipLocus,
}) {
  let clusterDrag = null;
  let locusDrag = null;

  const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

  return {
    beginClusterDrag(uid, pointerY) {
      clusterDrag = {
        uid,
        order: [...getClusterOrder()],
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
        clusterDrag.order.splice(currentIndex, 1);
        clusterDrag.order.splice(targetIndex, 0, clusterDrag.uid);
        order = clusterDrag.order;
      }
      previewClusterDrag(clusterDrag.uid, y, order);
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
    },

    beginLocusDrag(uid, pointerX) {
      const selected = [...selectedLocusIds()];
      const locusUids = selected.includes(uid) ? selected : [uid];
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
    },

    flipLocus,
  };
}
