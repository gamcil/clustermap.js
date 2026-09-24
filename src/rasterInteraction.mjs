function cursorForTarget(target) {
  if (!target) return "grab";
  if (target.action === "move-cluster") return "grab";
  if (target.action === "move-locus") return "move";
  if (target.action.startsWith("trim-locus")) return "ew-resize";
  return "pointer";
}

/**
 * Shared pointer and keyboard lifecycle for Canvas and WebGPU surfaces.
 * It owns only gesture state and event interpretation; chart state changes,
 * menus, cursor styling, and painting remain explicit callbacks.
 */
export function createRasterInteraction({
  targetForEvent,
  worldPoint,
  locusForTarget,
  setHoverLocus,
  warmLocus = () => {},
  beginMotion = () => {},
  endMotion = () => {},
  setCursor = () => {},
  interactions,
  actions,
}) {
  let gesture = null;
  let panMode = false;

  const updateAffordance = (surface, target, { warm = false } = {}) => {
    const locusUid = locusForTarget(target);
    if (setHoverLocus(locusUid) || warm) warmLocus(locusUid);
    setCursor(surface, cursorForTarget(target));
  };

  const startGesture = (surface, event, target) => {
    const point = worldPoint(surface, event);
    surface.setPointerCapture(event.pointerId);
    updateAffordance(surface, target, { warm: true });
    if (target.action === "move-cluster") {
      gesture = {
        action: target.action,
        clusterUid: target.clusterUid,
        start: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      interactions.beginClusterDrag(target.clusterUid, point.y);
    } else if (target.action === "move-locus") {
      gesture = {
        action: target.action,
        locusUid: target.locusUid,
        start: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      interactions.beginLocusDrag(target.locusUid, point.x);
    } else if (target.action.startsWith("trim-locus")) {
      gesture = {
        action: target.action,
        locusUid: target.locusUid,
        edge: target.action.endsWith("left") ? "left" : "right",
        start: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      interactions.beginLocusTrim();
    } else if (target.action === "gene") {
      gesture = { action: target.action, geneUid: target.geneUid };
    } else if (target.action === "legend-colour") {
      actions.legendColour(event, target.group);
    } else if (target.action === "legend-text") {
      actions.legendText(event, target.group);
    } else if (target.action === "scale-bar") {
      actions.scaleBar();
    }
  };

  const moveGesture = (surface, event) => {
    if (!gesture) {
      updateAffordance(surface, targetForEvent(surface, event));
      return;
    }
    const draggable =
      gesture.action === "move-cluster" || gesture.action === "move-locus" || gesture.edge;
    if (draggable && !gesture.moved) {
      if (Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) < 2) return;
      gesture.moved = true;
      beginMotion();
    }
    const point = worldPoint(surface, event);
    if (gesture.action === "move-cluster") {
      interactions.moveClusterDrag(point.y);
    } else if (gesture.action === "move-locus") {
      interactions.moveLocusDrag(point.x);
    } else if (gesture.edge) {
      interactions.moveLocusTrim(gesture.locusUid, gesture.edge, point.x);
    }
  };

  const finishGesture = (surface, event) => {
    if (!gesture) return;
    const finished = gesture;
    gesture = null;
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    if (finished.action === "move-cluster") {
      if (finished.moved) interactions.endClusterDrag();
      else interactions.cancelClusterDrag();
    } else if (finished.action === "move-locus") {
      if (finished.moved) interactions.endLocusDrag();
      else interactions.cancelLocusDrag();
    } else if (finished.edge) {
      if (finished.moved) interactions.endLocusTrim(finished.locusUid);
      else interactions.cancelLocusTrim();
    } else if (finished.action === "gene") {
      actions.geneClick(event, finished.geneUid);
    }
    if (finished.moved) endMotion();
    updateAffordance(surface, targetForEvent(surface, event));
  };

  return {
    zoomFilter(surface, event) {
      if (panMode) return event.type === "wheel" || event.button === 0;
      if (event.type === "wheel") return true;
      if (event.ctrlKey || event.button) return false;
      return !targetForEvent(surface, event);
    },

    bind(selection) {
      selection
        .on("pointerenter.canvasKeyboard", function () {
          this.focus({ preventScroll: true });
        })
        .on("keydown.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          panMode = true;
          event.preventDefault();
          setCursor(this, "grab");
        })
        .on("keyup.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          panMode = false;
          setCursor(this, "grab");
        })
        .on("blur.canvasKeyboard", function () {
          panMode = false;
        })
        .on("pointerdown.canvasInteraction", function (event) {
          if (panMode || event.button) return;
          const target = targetForEvent(this, event);
          if (!target) return;
          startGesture(this, event, target);
          event.preventDefault();
        })
        .on("pointermove.canvasInteraction", function (event) {
          if (!panMode) moveGesture(this, event);
        })
        .on("pointerleave.canvasInteraction", function () {
          if (!gesture && !panMode) updateAffordance(this, null);
        })
        .on("pointerup.canvasInteraction pointercancel.canvasInteraction", function (event) {
          finishGesture(this, event);
        })
        .on("dblclick.canvasInteraction", function (event) {
          const target = targetForEvent(this, event);
          const locusUid = locusForTarget(target);
          if (locusUid) actions.flipLocus(locusUid);
        })
        .on("contextmenu.canvasInteraction", function (event) {
          const target = targetForEvent(this, event);
          if (target?.action === "gene") {
            event.preventDefault();
            actions.geneMenu(event, target.geneUid);
          } else if (target?.action === "legend-text") {
            event.preventDefault();
            actions.legendMenu(event, target.group);
          }
        });
    },
  };
}
