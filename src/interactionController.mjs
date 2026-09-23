// Translates renderer-independent pointer coordinates into chart-state actions.
// Renderers only need to forward pointer events in chart-world coordinates.
export function createInteractionController({
  clusterRows,
  getClusterOrder,
  getClusterPosition,
  getLocusOffset,
  setDragging,
  previewClusterDrag,
  commitClusterOrder,
  previewLocusOffset,
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

    beginLocusDrag(uid, pointerX) {
      locusDrag = {
        uid,
        pointerStart: pointerX,
        initialOffset: getLocusOffset(uid),
      };
      setDragging(true);
    },

    moveLocusDrag(pointerX) {
      if (!locusDrag) return;
      previewLocusOffset(
        locusDrag.uid,
        locusDrag.initialOffset + pointerX - locusDrag.pointerStart
      );
    },

    endLocusDrag() {
      if (!locusDrag) return;
      const { uid } = locusDrag;
      locusDrag = null;
      setDragging(false);
      commitLocusOffset(uid);
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

    flipLocus,
  };
}
