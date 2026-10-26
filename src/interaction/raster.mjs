import { plotSelectionOptions } from "./controller.mjs";

function cursorForTarget(target) {
  if (!target) return "grab";
  if (target.action === "move-cluster") return "grab";
  if (target.action === "tree-node") return "pointer";
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
  let spaceDown = false;
  let activeSurface = null;
  let boundSurface = null, disposeBinding = () => {};

  const updateAffordance = (surface, target, { warm = false } = {}) => {
    const locusUid = locusForTarget(target);
    if (setHoverLocus(locusUid) || warm) warmLocus(locusUid);
    setCursor(surface, cursorForTarget(target));
  };

  const startGesture = (surface, event, target) => {
    const point = worldPoint(surface, event);
    surface.setPointerCapture(event.pointerId);
    updateAffordance(surface, target, { warm: true });
    if (target.action === "move-cluster" || target.action === "move-locus" || target.action.startsWith("trim-locus")) {
      gesture = {
        action: target.action,
        clusterUid: target.clusterUid,
        locusUid: target.locusUid,
        start: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      if (target.action === "move-cluster") interactions.beginClusterDrag(target.clusterUid, point.y);
      else if (target.action === "move-locus") interactions.beginLocusDrag(target.locusUid, point.x);
      else {
        gesture.edge = target.action.endsWith("left") ? "left" : "right";
        interactions.beginLocusTrim();
      }
    } else if (target.action === "gene") {
      gesture = { action: target.action, geneUid: target.geneUid };
    } else if (target.action === "tree-node") {
      gesture = { action: target.action, nodeUid: target.nodeUid };
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
      // D3 owns camera panning, so it has no record gesture here. Avoid hover
      // hit testing while a button is held, including drags begun elsewhere.
      if (!event.buttons) updateAffordance(surface, targetForEvent(surface, event));
      return;
    }
    if (gesture.start && !gesture.moved) {
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
    } else if (finished.action === "tree-node") {
      actions.rotateTreeNode?.(finished.nodeUid);
    }
    if (finished.moved) endMotion();
    updateAffordance(surface, targetForEvent(surface, event));
  };

  return {
    zoomFilter(surface, event) {
      if (gesture) return false;
      if (panMode) return event.type === "wheel" || event.button === 0;
      if (event.type === "wheel") return true;
      if (event.ctrlKey || event.button) return false;
      return !targetForEvent(surface, event);
    },

    bind(selection) {
      const surface = selection.node();
      if (surface === boundSurface) return disposeBinding;
      disposeBinding();
      boundSurface = surface;
      const windowRef = surface?.ownerDocument?.defaultView;
      const isActive = () =>
        activeSurface === surface || surface?.ownerDocument?.activeElement === surface;
      const keydown = (event) => {
        if (event.code !== "Space") return;
        if (event.target?.closest?.("input, textarea, select, button, [contenteditable='true']")) return;
        spaceDown = true;
        if (!isActive()) return;
        panMode = true;
        event.preventDefault();
        setCursor(surface, "grab");
      };
      const keyup = (event) => {
        if (event.code !== "Space") return;
        spaceDown = false;
        panMode = false;
        if (isActive()) setCursor(surface, "grab");
      };
      windowRef?.addEventListener("keydown", keydown);
      windowRef?.addEventListener("keyup", keyup);
      selection
        .on("pointerenter.canvasKeyboard", function () {
          activeSurface = this;
          this.focus({ preventScroll: true });
          if (spaceDown) {
            panMode = true;
            setCursor(this, "grab");
          }
        })
        .on("keydown.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          spaceDown = true;
          panMode = true;
          event.preventDefault();
          setCursor(this, "grab");
        })
        .on("keyup.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          spaceDown = false;
          panMode = false;
          setCursor(this, "grab");
        })
        .on("blur.canvasKeyboard", function () {
          panMode = false;
        })
        .on("pointerdown.canvasInteraction", function (event) {
          if (panMode) { setHoverLocus(null); return; }
          if (gesture || event.button) return;
          const target = targetForEvent(this, event);
          if (!target) { setHoverLocus(null); return; }
          const locusUid = locusForTarget(target);
          if ((event.shiftKey || event.ctrlKey || event.metaKey) && (target.action === "move-cluster" || locusUid)) {
            const options = plotSelectionOptions(event);
            if (target.action === "move-cluster") actions.toggleClusterSelection(target.clusterUid, options);
            else actions.toggleLocusSelection(locusUid, options);
            event.preventDefault();
            return;
          }
          startGesture(this, event, target);
          event.preventDefault();
        })
        .on("pointermove.canvasInteraction", function (event) {
          if (!panMode) moveGesture(this, event);
        })
        .on("pointerleave.canvasInteraction", function (event) {
          if (activeSurface === this) activeSurface = null;
          if (!gesture && !panMode && !event.buttons) updateAffordance(this, null);
        })
        .on("pointerup.canvasInteraction pointercancel.canvasInteraction", function (event) {
          finishGesture(this, event);
        })
        .on("dblclick.canvasInteraction", function (event) {
          if (gesture || panMode || event.shiftKey || event.ctrlKey || event.metaKey) return;
          const target = targetForEvent(this, event);
          const locusUid = locusForTarget(target);
          if (locusUid) actions.flipLocus(locusUid);
        })
        .on("contextmenu.canvasInteraction", function (event) {
          if (gesture) { event.preventDefault(); return; }
          const target = targetForEvent(this, event);
          if (target?.action === "tree-node") {
            event.preventDefault(); event.stopPropagation();
            actions.treeMenu?.(event, target.nodeUid);
          } else if (target?.action === "gene") {
            event.preventDefault();
            actions.geneMenu(event, target.geneUid);
          } else if (target?.action === "legend-text") {
            event.preventDefault();
            actions.legendMenu(event, target.group);
          }
        });
      const dispose = () => {
        if (disposeBinding !== dispose) return;
        boundSurface = activeSurface = gesture = null;
        disposeBinding = () => {};
        panMode = spaceDown = false;
        windowRef?.removeEventListener("keydown", keydown);
        windowRef?.removeEventListener("keyup", keyup);
        selection.on(".canvasKeyboard", null).on(".canvasInteraction", null);
      };
      return disposeBinding = dispose;
    },
  };
}
