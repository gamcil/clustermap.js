import { measureFigureBounds } from "../scene/measure.mjs";
import { visibleChartData } from "../data/visibility.mjs";
import { animate as runAnimation, afterPaint } from "../renderers/animation.mjs";
import { select } from "d3-selection";
import { transition as createTransition } from "d3-transition";
import { zoomIdentity } from "d3-zoom";
import { createLinkGroups } from "../links/groups.mjs";
import {
  createChartState,
  commitPreviewClusterOrder,
  commitPreviewLocusOffset,
  commitPreviewLocusState,
  getCamera,
  getClusterOrder,
  getLocusOffset,
  isDragging,
  finalizeLocusTrim,
  flipLocus,
  setCamera,
  setDragging,
  setPreviewLocusOffset,
  setPreviewClusterOrder,
  setPreviewClusterPosition,
  setTreeClusterOrder,
  previewLocusTrim,
  restoreLocusBounds,
  trimLocusToGeneBounds,
} from "./state.mjs";
import { createChartIndex } from "../data/index.mjs";
import { normalizeChartData } from "../data/normalize.mjs";
import { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale,
  annotationPanelsForFrame, annotationPanelBounds, hitTestAnnotationCell } from "../annotations/model.mjs";
import { isAnnotationOperation } from "../annotations/operations.mjs";
import { updateSvgAnnotationViewport } from "../annotations/render.mjs";
import { applyChartOperations } from "../data/operations.mjs";
import { isTreeOperation, inverseTreeOperation, applyTreeOperation } from "../tree/operations.mjs";
import { fitCameraForBounds, worldViewport, worldPoint } from "../scene/camera.mjs";
import { applyTheme, resolveTheme } from "../ui/theme.mjs";
import { createFigureSurface } from "../renderers/figure.mjs";
import { createHtmlOverlay } from "../ui/overlay.js";
import { createInteractionController } from "../interaction/controller.mjs";
import {
  hitTestCanvas,
  renderCanvas,
  CANVAS_LAYERS,
} from "../renderers/canvas.js";
import { renderSvg } from "../renderers/svg.js";
import { createRasterMinimap } from "../renderers/minimap.mjs";
import { createRasterInteraction } from "../interaction/raster.mjs";
import { createRasterMotion } from "../interaction/motion.mjs";
import {
  interpolateScene,
  createClusterDragPreview,
  createLocusFlipPreview,
  createLocusOffsetPreview,
  createLocusOffsetsPreview,
  createLocusTrimPreview,
} from "../scene/preview.mjs";
import { exportChartSvg } from "../renderers/export.mjs";
import { createChartRuntime } from "./runtime.js";
import { createRetainedSceneBackend } from "../renderers/retainedBackend.mjs";
import { createCanvasBackend } from "../renderers/canvasBackend.mjs";
import { createWebGpuBackend } from "../renderers/webgpuBackend.mjs";
import { ensureSvgSurface } from "../renderers/svgSurface.mjs";
import { ensureRasterSurface } from "../renderers/rasterSurface.mjs";
import { syncCameraZoom } from "../interaction/zoom.mjs";
import { createRasterInteractionBindings } from "../interaction/rasterBindings.mjs";
import {
  isCanvasRenderer,
  isRasterRenderer,
  isWebGpuRenderer,
} from "../renderers/mode.mjs";
import { chartStateFromSnapshot, createChartStateSerializer } from "./snapshot.mjs";

let nextChartInstance = 0;
const projectFormat = "clinker-project";
const projectVersion = 1;
const historyLimit = 100;
const isPlainObject = (value) => Boolean(value) && value.constructor === Object;
const copyConfigPatch = (value) => {
  if (Array.isArray(value)) return value.map(copyConfigPatch);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyConfigPatch(child)]));
  // Configuration callbacks are valid leaves. They are immutable by reference
  // and intentionally remain callable when an edit is undone or redone.
  return value;
};
const previousConfigPatch = (config, patch) => Object.fromEntries(
  Object.entries(patch || {})
    .filter(([key]) => Object.hasOwn(config || {}, key))
    .map(([key, value]) => [key,
      isPlainObject(value) && isPlainObject(config[key])
        ? previousConfigPatch(config[key], value)
        : copyConfigPatch(config[key]),
    ])
);
const serializableConfig = (value) => {
  if (typeof value === "function" || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(serializableConfig);
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value)
    .map(([key, child]) => [key, serializableConfig(child)])
    .filter(([, child]) => child !== undefined));
  return value;
};

export default function clusterMap() {
  /* A ClusterMap plot. */

  let container = null;
  const figureSurface = createFigureSurface();
  function updateFigureSurface() {
    if (container) figureSurface.update(container, runtime.getScene(), runtime.renderConfig,
      plotData?.tree, getCamera(chartState), scenePreview);
  }
  let annotationOverlay = null;
  let themeMedia = null;
  function systemThemeChanged() {
    if (runtime.config.plot.theme !== "auto" || !container || !currentData) return;
    applyTheme(container.node(), resolveTheme(runtime.config.plot.theme));
    emitChange({ type: "theme.change", theme: resolveTheme(runtime.config.plot.theme).mode });
  }
  let annotationUiContext = null, annotationUiLoad = null;
  let zoom = null;
  let canvasZoom = null;
  let hasInitialView = false;
  let chartState = null;
  let canvasHoverLocusUid = null;
  let canvasScene = null;
  let canvasAnimation = null;
  let treeAnimation = null;
  let webgpuAnimation = null;
  let scenePreview = null;
  let previewPaintFrame = null;
  let cancelCanvasFlip = null;
  let canvasPendingFlip = null;
  let cancelSceneFlip = null;
  let clusterCommitFrame = null;
  let sceneCommit = null;
  let rasterCanvas = null, overlayCanvas = null, minimapCanvas = null;
  let minimapScene = null, minimapMeasurement = null;
  let currentData = null;
  let plotData = null;
  let plotDataDirty = true;
  const displayClusterOrder = () => {
    const ids = new Set(plotData.clusters.map((cluster) => cluster.uid));
    return getClusterOrder(chartState).filter((uid) => ids.has(uid));
  };
  let figureMeasurementContext = null;
  let chartIndex = null;
  let highlightGeneIds = new Set();
  let highlightLinkIds = new Set();
  let plotSelection = { kind: "loci", ids: new Set() };
  let selectionAnchor = null;
  const noSelection = new Set();
  const selectedLocusIds = () => plotSelection.kind === "loci" ? plotSelection.ids : noSelection;
  const selectedClusterIds = () => plotSelection.kind === "clusters" ? plotSelection.ids : noSelection;
  const selectedLoci = () => plotSelection.kind === "loci" ? plotSelection.ids : new Set(
    [...plotSelection.ids].flatMap((uid) => runtime.lookup.clusterData(uid)?.loci.map((locus) => locus.uid) || [])
  );
  let disposeRasterInteraction = () => {};
  let rasterHitSurface = null;
  let retainedOverlay = null;
  let updatingTreeMenu = false;
  function updateFromTreeMenu(action) {
    const previous = updatingTreeMenu;
    updatingTreeMenu = true;
    try { return action(); }
    finally { updatingTreeMenu = previous; }
  }
  const changeListeners = new Set();
  const history = [];
  const future = [];
  const stateSnapshots = createChartStateSerializer();
  let pendingInteractionState = null;
  const runtime = createChartRuntime({ idPrefix: `chart-${nextChartInstance++}-`,
    measureText: (text, { fontSize, fontFamily, fontWeight = 400 }) => {
      if (!container) return null;
      figureMeasurementContext ||= container.node().ownerDocument.createElement("canvas").getContext("2d");
      const context = figureMeasurementContext;
      context.save();
      context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      context.textAlign = "left"; context.textBaseline = "alphabetic";
      const metrics = context.measureText(text);
      context.restore();
      return metrics;
    },
  });
  const canvasBackend = createCanvasBackend();
  const svgBackend = createRetainedSceneBackend({
    render: renderSvg,
    surface: "plot",
  });
  const webgpuBackend = createWebGpuBackend();
  const rasterMinimap = createRasterMinimap();
  const rasterMotion = createRasterMotion({
    schedulePaint: () => scheduleScenePaint(),
    getCamera: () => getCamera(chartState),
    getRenderer: () => runtime.config.plot.renderer,
    getAdaptiveResolution: () => runtime.config.plot.adaptiveResolution,
  });
  runtime.setBeforeGeneAnchorUpdate(({ changes, flippedLoci }) => {
    const sourceScene = runtime.getScene();
    // Anchoring changes cluster origins and, when strands disagree, a small
    // set of loci. The scene patch retains everything else for every backend.
    if (!sourceScene || (!changes.length && !flippedLoci.size)) return;
    sceneCommit = {
      sourceScene,
      changes: { loci: [...flippedLoci], clusters: changes.map(({ clusterUid }) => clusterUid) },
    };
  });
  const anchorGene = (gene, { flipMismatchedLoci = false } = {}) => {
    beginInteractionState();
    const result = runtime.anchorGene(gene, { flipMismatchedLoci });
    redraw();
    commitInteractionState();
    return result;
  };
  const interactionController = createInteractionController({
    clusterRows: () => runtime.scales.y.range(),
    getClusterOrder: displayClusterOrder,
    getClusterPosition: (uid) => runtime.getScene().clusters.get(uid).y,
    getTree: () => plotData?.tree || null,
    getLocusOffset: (uid) => getLocusOffset(chartState, uid),
    selectedLocusIds: () => [...selectedLocusIds()],
    selectedClusterIds,
    setDragging: (dragging) => {
      if (dragging) beginInteractionState();
      setDragging(chartState, dragging);
    },
    previewClusterDrag: (uid, position, order, positions = new Map([[uid, position]])) => {
      if (clusterCommitFrame !== null) {
        cancelAnimationFrame(clusterCommitFrame);
        clusterCommitFrame = null;
      }
      for (const [clusterUid, clusterPosition] of positions) {
        setPreviewClusterPosition(chartState, clusterUid, clusterPosition);
      }
      if (order) setPreviewClusterOrder(chartState, order);
      if (runtime.getScene()) {
        scenePreview = createClusterDragPreview(runtime.getScene(), {
          clusterUid: uid,
          position,
          positions,
          order: displayClusterOrder(),
          rows: runtime.scales.y.range(),
        });
        scheduleScenePaint();
        return;
      }
      redraw({ animate: false });
    },
    commitClusterOrder: () => {
      const sourceScene = runtime.getScene();
      const preview = scenePreview?.type === "cluster-drag" ? scenePreview : null;
      // A plain label click starts a drag too. Repainting on release can replace
      // the text under the pointer before the browser dispatches its click.
      if (!preview) { commitInteractionState(); return; }
      const order = displayClusterOrder();
      const rows = runtime.scales.y.range();
      if (sourceScene) sceneCommit = { sourceScene, changes: {} };
      commitPreviewClusterOrder(chartState);
      const treeOrder = setTreeClusterOrder(currentData.tree, order, { partial: chartState.excludedClusters.size > 0 });
      if (treeOrder) chartState.clusterOrder = treeOrder;
      plotDataDirty = true;
      if (sourceScene && isRasterRenderer(runtime.config.plot.renderer)) {
        // Paint the destination row once before the committed projection runs.
        // This avoids a release-time blank/stale frame while a large chart is
        // rebuilding its authoritative scene and indexes.
        scenePreview = createClusterDragPreview(sourceScene, {
          clusterUid: preview.clusterUid,
          position: rows[order.indexOf(preview.clusterUid)],
          order,
          rows,
        });
        scheduleScenePaint();
        if (clusterCommitFrame !== null) cancelAnimationFrame(clusterCommitFrame);
        clusterCommitFrame = requestAnimationFrame(() => {
          clusterCommitFrame = requestAnimationFrame(() => {
            clusterCommitFrame = null;
            clearScenePreview();
            redraw({ animate: false });
          });
        });
        commitInteractionState();
        return;
      }
      clearScenePreview();
      redraw({ animate: false });
      commitInteractionState();
    },
    previewLocusOffset: (uid, offset) => {
      setPreviewLocusOffset(chartState, uid, offset);
      if (runtime.getScene()) {
        scenePreview = createLocusOffsetPreview(runtime.getScene(), uid, offset, {
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleScenePaint();
        return;
      }
      redraw({ animate: false });
    },
    previewLocusOffsets: (offsets) => {
      for (const [uid, offset] of offsets) setPreviewLocusOffset(chartState, uid, offset);
      if (runtime.getScene()) {
        scenePreview = createLocusOffsetsPreview(runtime.getScene(), offsets, {
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleScenePaint();
        return;
      }
      redraw({ animate: false });
    },
    commitLocusOffset: (ids) => {
      const loci = Array.isArray(ids) ? ids : [ids];
      commitLocusEdit(loci, () => {
        for (const uid of loci) commitPreviewLocusOffset(chartState, uid);
      });
    },
    previewLocusTrim: (locus, edge, position) => {
      const result = previewLocusTrim(chartState, locus, {
        edge,
        position,
        // Pointer positions are in chart-world space. Gene-state boundaries
        // are locus-local, so project them through the locus and cluster
        // translations as well; otherwise trimming drifts after anchoring or
        // dragging a locus horizontally.
        coordinateFor: (coordinate) =>
          runtime.scales.x(coordinate) +
          runtime.scales.locus(locus.uid) +
          runtime.scales.offset(locus.clusterUid),
        scaleGenes: runtime.config.plot.scaleGenes,
      });
      if (runtime.getScene()) {
        // Updating scales is inexpensive and gives the sparse projection the
        // packed x offsets for this temporary locus state. Deliberately avoid
        // rebuilding data, indexes, or the complete scene until release.
        runtime.updateScales(plotData, { geometryOnly: true });
        scenePreview = createLocusTrimPreview(runtime.getScene(), locus.uid, result.state, {
          localXFor: runtime.scales.locus,
          scaleX: runtime.scales.x,
          alignLabels: runtime.config.cluster.alignLabels,
          shape: runtime.config.gene.shape,
          trimIndicatorStyle: runtime.config.locus.trimIndicators,
          clusterLabelText: runtime.locusTextForCluster(locus.clusterUid),
        });
        scheduleScenePaint();
        return result;
      }
      redraw({ animate: false, synchronize: false });
      return result;
    },
    commitLocusTrim: (locus) => {
      commitLocusEdit([locus.uid], () => {
        finalizeLocusTrim(chartState, locus);
        commitPreviewLocusState(chartState, locus);
      });
    },
    cancelInteraction: () => { pendingInteractionState = null; },
    flipLocus: (locus) => {
      // Do not mutate the retained source underneath an in-flight flip.
      if (cancelSceneFlip !== null) return;
      beginInteractionState();
      flipLocus(chartState, locus);
      if (isCanvasRenderer(runtime.config.plot.renderer) && runtime.getScene()) {
        stopCanvasAnimation();
        cancelCanvasFlip?.();
        const previewProgress = 0.12;
        const sourceScene = canvasScene || runtime.getScene();
        const pending = { locus, sourceScene, targetScene: null,
          clusterLabelText: runtime.locusTextForCluster(locus.clusterUid) };
        canvasPendingFlip = pending;
        scenePreview = createLocusFlipPreview(sourceScene, locus.uid, {
          progress: previewProgress,
          clusterLabelText: pending.clusterLabelText,
        });
        scheduleScenePaint();
        // Show the retained preview before preparing cached flip layers.
        cancelCanvasFlip = afterPaint(() => startCanvasFlip(pending, previewProgress));
        return;
      }
      if (runtime.getScene()) {
        const useGpu = isWebGpuRenderer(runtime.config.plot.renderer);
        const sourceScene = runtime.getScene();
        const duration = runtime.config.plot.transitionDuration;
        const finish = () => {
          runtime.synchronizeLocusLayoutState(locus);
          const targetScene = runtime.patchScene(sourceScene, { loci: [locus.uid] }, plotData);
          if (useGpu) {
            webgpuBackend.adoptScene(targetScene, sourceScene, {
              scales: runtime.scales, config: runtime.renderConfig,
            });
            webgpuBackend.setScene(targetScene);
          } else svgBackend.setScene(targetScene);
          scenePreview = null;
          cancelSceneFlip = null;
          scheduleScenePaint();
          commitInteractionState();
        };
        if (!duration) {
          finish();
          return;
        }
        cancelSceneFlip = runAnimation(duration, (progress) => {
          scenePreview = createLocusFlipPreview(sourceScene, locus.uid, {
            progress,
            clusterLabelText: runtime.locusTextForCluster(locus.clusterUid),
          });
          if (useGpu) webgpuBackend.setScene(sourceScene);
          else svgBackend.setScene(sourceScene);
          scheduleScenePaint();
        }, finish);
        return;
      }
      redraw();
      commitInteractionState();
    },
  });

  function commitLocusEdit(loci, updateState) {
    const sourceScene = runtime.getScene();
    if (sourceScene) sceneCommit = { sourceScene, changes: { loci } };
    updateState();
    clearScenePreview();
    redraw({ animate: false });
    commitInteractionState();
  }

  function clearScenePreview() {
    if (previewPaintFrame !== null) cancelAnimationFrame(previewPaintFrame);
    cancelCanvasFlip?.();
    cancelSceneFlip?.();
    if (clusterCommitFrame !== null) cancelAnimationFrame(clusterCommitFrame);
    scenePreview = null;
    canvasBackend.clearFlip();
    previewPaintFrame = null;
    cancelCanvasFlip = null;
    canvasPendingFlip = null;
    cancelSceneFlip = null;
    clusterCommitFrame = null;
  }

  function flushCanvasFlip() {
    const pending = canvasPendingFlip;
    if (!pending) return;
    cancelCanvasFlip?.();
    cancelCanvasFlip = null;
    if (!pending.targetScene) {
      runtime.synchronizeLocusLayoutState(pending.locus);
      pending.targetScene = runtime.patchScene(pending.sourceScene, { loci: [pending.locus.uid] }, plotData);
      commitInteractionState();
    }
    canvasScene = pending.targetScene;
    canvasBackend.setScene(canvasScene);
    scenePreview = null;
    canvasPendingFlip = null;
    canvasBackend.clearFlip();
  }

  function startCanvasFlip(pending, initialProgress) {
    if (canvasPendingFlip !== pending) return;
    cancelCanvasFlip = null;
    runtime.synchronizeLocusLayoutState(pending.locus);
    pending.targetScene = runtime.patchScene(pending.sourceScene, { loci: [pending.locus.uid] }, plotData);
    commitInteractionState();
    canvasBackend.prepareFlip(pending.locus.uid, pending.sourceScene);
    // Restore and repaint the affected canvas region before the browser can
    // present a frame. The base image stays offscreen; the visible plot stays
    // a single canvas throughout the animation.
    paintScene();
    const finish = () => {
      cancelCanvasFlip = null;
      scenePreview = null;
      canvasPendingFlip = null;
      canvasScene = pending.targetScene;
      canvasBackend.setScene(canvasScene);
      paintScene();
      canvasBackend.clearFlip();
      scheduleScenePaint();
      scheduleMinimapBase(canvasScene);
    };
    const duration = runtime.config.plot.transitionDuration;
    if (!duration) { finish(); return; }
    cancelCanvasFlip = runAnimation(duration, (progress) => {
      if (canvasPendingFlip !== pending) return;
      scenePreview = createLocusFlipPreview(pending.sourceScene, pending.locus.uid, {
        progress: initialProgress + (1 - initialProgress) * progress,
        clusterLabelText: pending.clusterLabelText,
      });
      // Paint the dirty region in this frame rather than one frame later.
      if (previewPaintFrame !== null) cancelAnimationFrame(previewPaintFrame);
      previewPaintFrame = null;
      paintScene();
    }, finish);
  }

  function scheduleScenePaint() {
    if (previewPaintFrame !== null || !container || !runtime.getScene()) return;
    previewPaintFrame = requestAnimationFrame(() => {
      previewPaintFrame = null;
      paintScene();
    });
  }

  function zoomExtent() {
    const minimum = Math.max(0, Number(runtime.config.plot.minZoom) || 0);
    const configuredMaximum = Number(runtime.config.plot.maxZoom);
    const maximum = Math.max(minimum, Number.isFinite(configuredMaximum) ? configuredMaximum : 8);
    return [minimum, maximum];
  }

  function constrainZoom(scale) {
    const [minimum, maximum] = zoomExtent();
    return Math.max(minimum, Math.min(maximum, scale));
  }

  function stopWebGpuAnimation() {
    webgpuAnimation?.cancel();
    webgpuAnimation = null;
  }

  function my(selection, options) {
    selection.each(function (data) {
      container = select(this).attr("width", "100%").attr("height", "100%");
      loadData(data);
      redraw(options);
    });
  }

  function loadData(data) {
    sceneCommit = null;
    stateSnapshots.reset();
    const prepared = normalizeChartData(data, runtime.config.tree);
    cancelTreePresentationPreview();
    currentData = prepared;
    plotDataDirty = true;
    chartIndex = createChartIndex(currentData);
    refreshGroups();
    chartState = createChartState(currentData, chartState);
    runtime.setChartIndex(chartIndex);
    runtime.setChartState(chartState);
    stateSnapshots.reset(currentData);
  }

  function groupsAreAutomatic(data = currentData) {
    return data?.config?.updateGroups !== false;
  }

  function refreshGroups(derive = groupsAreAutomatic()) {
    if (derive) {
      // Deleted genes retain their link records; exclude dangling endpoints.
      const links = currentData.links.filter((link) =>
        chartIndex.geneById.has(link.query.uid) && chartIndex.geneById.has(link.target.uid)
      );
      currentData.groups = createLinkGroups(links, currentData.groups);
    } else currentData.groups ??= [];
    chartIndex.groupById = new Map(currentData.groups.map((group) => [group.uid, group]));
  }

  function emitChange(change) {
    for (const listener of changeListeners) listener({ ...change, data: currentData });
  }

  function historyStatus() {
    return { canUndo: history.length > 0, canRedo: future.length > 0 };
  }

  function emitHistoryChange() {
    emitChange({ type: "history.change", ...historyStatus() });
  }

  function clearHistory(emit = true) {
    history.length = 0;
    future.length = 0;
    pendingInteractionState = null;
    if (emit) emitHistoryChange();
  }

  function remember(change) {
    history.push(change);
    if (history.length > historyLimit) history.splice(0, history.length - historyLimit);
    future.length = 0;
    emitHistoryChange();
  }

  // Pointer interactions update transient preview state continuously, but are
  // one logical edit when released. Keep the compact, exportable state before
  // the gesture and compare it after the committed layout has synchronized.
  function beginInteractionState() {
    if (!pendingInteractionState && chartState && currentData) {
      pendingInteractionState = stateSnapshots.serialize(chartState, currentData);
    }
  }

  function commitInteractionState() {
    const before = pendingInteractionState;
    pendingInteractionState = null;
    if (!before || !chartState || !currentData) return;
    const after = stateSnapshots.serialize(chartState, currentData);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    emitChange({ type: "state.change", state: after });
    remember({ kind: "state", undo: before, redo: after });
  }

  function refreshAfterPatch(effects, { refreshAutomatic = false } = {}) {
    if (effects.reindex === "data") chartIndex = createChartIndex(currentData);
    if (effects.reindex || refreshAutomatic) {
      refreshGroups(groupsAreAutomatic() && (effects.reindex === "data" || refreshAutomatic));
      runtime.setChartIndex(chartIndex);
    }
    if (effects.rebuildState) {
      chartState = createChartState(currentData, chartState);
      runtime.setChartState(chartState);
    }
    stateSnapshots.reset(currentData);
  }

  function applyPatch(operations, { record = true, automaticGroups } = {}) {
    const sourceScene = runtime.getScene();
    const annotationsOnly = Array.isArray(operations) && operations.every(isAnnotationOperation);
    sceneCommit = null;
    // Source edits may mutate currentData in place. Identity alone cannot
    // invalidate the cached biological defaults, including on undo/redo.
    if (!annotationsOnly) stateSnapshots.reset();
    const groupsAutomaticBefore = groupsAreAutomatic();
    const result = applyChartOperations(currentData, chartIndex, operations, runtime.config.tree);
    plotDataDirty = true;
    const restoringAutomatic = automaticGroups !== undefined && automaticGroups !== groupsAreAutomatic();
    if (restoringAutomatic) {
      currentData.config = { ...(currentData.config || {}), updateGroups: automaticGroups };
    }
    const groupsAutomaticAfter = groupsAreAutomatic();
    if (!annotationsOnly || restoringAutomatic) refreshAfterPatch(result.effects, {
      refreshAutomatic: groupsAutomaticAfter && (restoringAutomatic || !groupsAutomaticBefore),
    });
    if (sourceScene && !restoringAutomatic && annotationsOnly) {
      sceneCommit = { sourceScene, changes: { annotationsOnly: true } };
    }
    redraw({ animate: false });
    emitChange({ type: "data.apply", operations: result.operations });
    if (record) {
      remember({
        kind: "patch",
        undo: result.inverse,
        redo: result.operations,
        groupsAutomaticBefore,
        groupsAutomaticAfter,
      });
    }
    return result;
  }

  let treePresentationPreview = null;
  function cancelTreePresentationPreview() {
    if (!treePresentationPreview) return false;
    if (currentData?.tree === treePresentationPreview.tree) applyTreeOperation(currentData.tree, treePresentationPreview.undo);
    plotDataDirty = true;
    treePresentationPreview = null;
    return true;
  }

  function setState(snapshot, { record = true } = {}) {
    sceneCommit = null;
    pendingInteractionState = null;
    const before = chartState ? stateSnapshots.serialize(chartState, currentData) : null;
    chartState = chartStateFromSnapshot(currentData, snapshot);
    plotDataDirty = true;
    runtime.setChartState(chartState);
    hasInitialView = true;
    redraw({ animate: false });
    const after = stateSnapshots.serialize(chartState, currentData);
    emitChange({ type: "state.replace", state: after });
    if (record) remember({ kind: "state", undo: before, redo: after });
  }

  function highlightedGeneIds() {
    if (plotSelection.kind === "clusters") return highlightGeneIds;
    const loci = selectedLoci();
    if (!loci.size) return highlightGeneIds;
    const ids = new Set(highlightGeneIds);
    for (const locusUid of loci) {
      for (const gene of chartIndex?.locusById.get(locusUid)?.genes || []) ids.add(gene.uid);
    }
    return ids;
  }

  function selectionIds(kind, ids) {
    const records = kind === "clusters" ? chartIndex?.clusterById : chartIndex?.locusById;
    if (!records) return new Set(ids);
    return new Set([...ids].map((uid) => records.get(uid) ||
      [...records.values()].find((record) => String(record.uid) === String(uid)))
      .filter((record) => record && !chartState.excludedClusters.has(kind === "clusters" ? record.uid : record.clusterUid) &&
        (kind === "clusters" || !chartState.excludedLoci.has(record.uid))).map((record) => record.uid));
  }

  function selectPlotRecord(kind, uid, { range = false, subtract = false } = {}) {
    const order = kind === "clusters" ? displayClusterOrder() : displayClusterOrder().flatMap((id) =>
      runtime.lookup.clusterData(id).loci.map((locus) => locus.uid));
    const start = kind === plotSelection.kind ? order.indexOf(selectionAnchor) : -1;
    const end = order.indexOf(uid);
    const ids = new Set(plotSelection.kind === kind ? plotSelection.ids : []);
    if (range && start >= 0 && end >= 0) {
      for (const id of order.slice(Math.min(start, end), Math.max(start, end) + 1)) {
        if (subtract) ids.delete(id); else ids.add(id);
      }
    } else if (subtract || ids.has(uid)) ids.delete(uid);
    else ids.add(uid);
    const anchor = range && start >= 0 ? selectionAnchor : uid;
    my.selection({ kind, ids });
    if (ids.size) selectionAnchor = anchor;
  }

  function locusForId(uid) {
    return chartIndex?.locusById.get(uid) || [...(chartIndex?.locusById || [])]
      .find(([key]) => String(key) === String(uid))?.[1];
  }

  const chooseLegendColour = (group) => {
    const picker = container.select("input.colourPicker");
    picker.on("change", () => {
      my.patch([{
        type: "groups.update",
        ids: [group.uid],
        changes: { colour: picker.node().value },
      }]);
    });
    picker.node().click();
  };
  const setScaleBarLength = (providedValue) => {
    const value = Number(
      providedValue ?? prompt("Enter new length (bp):", runtime.config.scaleBar.basePair)
    );
    if (Number.isFinite(value) && value > 0) my.config({ scaleBar: { basePair: value } });
  };
  const renameRecord = (event, type, record) => {
    if (event.defaultPrevented) return;
    const field = type === "clusters" ? "name" : "label";
    const value = prompt("Enter new value:", record[field] || record.uid);
    if (value) my.patch([{ type: `${type}.update`, ids: [record.uid], changes: { [field]: value } }]);
  };
  // Both renderers delegate mutations to the same controller. Raster input
  // adapts stable IDs back to source records at its boundary; SVG already
  // receives those records through its D3 joins.
  const rendererInteractions = {
    ...interactionController,
    renameCluster: (event, cluster) => {
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) renameRecord(event, "clusters", cluster);
    },
    isDragging: () => isDragging(chartState),
    rotateTreeNode: (uid) => {
      if (!container) return;
      const node = currentData.tree?.nodes.find((entry) => entry.uid === uid);
      if (!node?.children) return;
      beginInteractionState();
      treeAnimation = {
        previousTree: {
          ...plotData.tree,
          nodes: plotData.tree.nodes.map((entry) => ({
            ...entry,
            children: entry.children ? [...entry.children] : undefined,
          })),
        },
        previousScene: runtime.getScene(),
        progress: 0,
      };
      sceneCommit = { sourceScene: runtime.getScene(), changes: {} };
      node.children.reverse();
      plotDataDirty = true;
      chartState = createChartState(currentData, chartState);
      runtime.setChartState(chartState);
      redraw();
      commitInteractionState();
    },
    toggleLocusSelection: (locus, options) => selectPlotRecord("loci", locus.uid, options),
    toggleClusterSelection: (uid, options) => selectPlotRecord("clusters", uid, options),
    onGeneClick: (event, gene) => {
      // Selection modifiers belong to the containing locus.
      if (event.shiftKey || event.ctrlKey || event.metaKey) return;
      (runtime.config.gene.shape.onClick || ((_, record) => anchorGene(record)))(event, gene);
    },
    showTreeMenu: (...args) => retainedOverlay?.showTreeMenu(...args),
    showGeneMenu: (...args) => retainedOverlay?.showGeneMenu(...args),
    showGroupMenu: (...args) => retainedOverlay?.showGroupMenu(...args),
    setScaleBarLength,
    chooseLegendColour,
    legendColour: (event, group) => {
      if (runtime.config.legend.onClickCircle) {
        runtime.config.legend.onClickCircle(event, group);
      } else {
        chooseLegendColour(group);
      }
    },
    legendText: (event, group) =>
      runtime.config.legend.onClickText ? runtime.config.legend.onClickText(event, group) : renameRecord(event, "groups", group),
    legendMenu: (event, group) => {
      const handler = runtime.config.legend.onAltClickText || retainedOverlay.showGroupMenu;
      handler(event, group);
    },
  };

  const targetForEvent = (canvasNode, event) =>
    hitTestCanvas({
      // A canvas can only have one rendering context. WebGPU owns the
      // visible surface, so use its transparent 2D text/chrome overlay
      // for the metric-dependent portions of hit testing instead.
      canvas: rasterHitSurface,
      scene: runtime.getScene(),
      camera: getCamera(chartState),
      config: runtime.renderConfig,
      event,
      tree: plotData.tree,
      treeDragging: isDragging(chartState),
    });
  const locusForTarget = (target) =>
    target?.locusUid || runtime.lookup.geneData(target?.geneUid)?.locusUid || null;
  const rasterBindings = createRasterInteractionBindings({
    interactions: rendererInteractions,
    getGene: runtime.lookup.geneData,
    getLocus: runtime.lookup.locusData,
  });
  const rasterInteraction = createRasterInteraction({
    targetForEvent,
    worldPoint: (surface, event) =>
      worldPoint(surface, event, getCamera(chartState)),
    locusForTarget,
    setHoverLocus: (locusUid) => {
      if (canvasHoverLocusUid === locusUid) return false;
      canvasHoverLocusUid = locusUid;
      scheduleScenePaint();
      return true;
    },
    warmLocus: (uid) => { if (isCanvasRenderer(runtime.config.plot.renderer)) canvasBackend.warmLocus(uid); },
    beginMotion: rasterMotion.begin,
    endMotion: rasterMotion.end,
    setCursor: (surface, cursor) => select(surface).style("cursor", cursor),
    ...rasterBindings,
  });

  function sceneFrame(scene) {
    return {
      scene, camera: getCamera(chartState), config: runtime.renderConfig,
      scales: runtime.scales, pixelRatio: rasterMotion.pixelRatio(), tree: plotData.tree,
      preview: scenePreview, hoverLocusUid: canvasHoverLocusUid,
      suppressLocusHover: scenePreview?.type === "locus-flip" || Boolean(canvasAnimation?.suppressLocusHover),
      previousTree: treeAnimation?.previousTree, previousTreeScene: treeAnimation?.previousScene,
      treeTargetScene: treeAnimation?.targetScene, treeProgress: treeAnimation?.progress ?? 1,
      highlightGeneIds: highlightedGeneIds(), highlightLinkIds, highlightLocusIds: selectedLoci(),
      highlightClusterIds: selectedClusterIds(),
    };
  }

  function paintScene() {
    if (!container || !runtime.getScene()) return;
    if (isCanvasRenderer(runtime.config.plot.renderer)) return paintCanvas();
    if (isWebGpuRenderer(runtime.config.plot.renderer)) return paintWebGpu();
    return paintSvg();
  }

  function paintSvg({ annotationsOnly = false, previousScene = null, animate = false } = {}) {
    const svg = container?.select("svg.clusterMap");
    if (!svg || svg.empty()) return;
    updateFigureSurface();
    return svgBackend.paint({ ...sceneFrame(svgBackend.pendingScene || runtime.getScene()),
      plot: svg.select("g.clusterMapG"), data: plotData, annotationsOnly, previousScene, animate,
      annotationViewport: hasInitialView ? worldViewport(getCamera(chartState), svg.node().getBoundingClientRect()) : null,
      transition: animate ? createTransition().duration(runtime.config.plot.transitionDuration) : null,
      ids: runtime.ids, interactions: rendererInteractions });
  }

  function focusCamera({ genes = [], links = [], loci = [], clusters = [] } = {}) {
    const scene = runtime.getScene();
    if (!container || !scene) return false;
    let bounds = null;
    const include = (candidate) => {
      if (!candidate) return;
      if (!bounds) {
        bounds = { ...candidate };
        return;
      }
      bounds.minX = Math.min(bounds.minX, candidate.minX);
      bounds.maxX = Math.max(bounds.maxX, candidate.maxX);
      bounds.minY = Math.min(bounds.minY, candidate.minY);
      bounds.maxY = Math.max(bounds.maxY, candidate.maxY);
    };
    for (const [kind, ids] of Object.entries({ genes, loci, clusters })) {
      for (const uid of ids) include(scene[kind].get(uid)?.bounds);
    }
    for (const uid of links) {
      const rendered = scene.links.get(uid);
      if (rendered?.bounds) {
        include(rendered.bounds);
        continue;
      }
      // The data editor intentionally includes links that are hidden by a
      // threshold or best-match setting. They have no scene ribbon, but
      // their endpoints remain useful, focusable context.
      const link = chartIndex?.linkById.get(uid);
      include(scene.genes.get(link?.query.uid)?.bounds);
      include(scene.genes.get(link?.target.uid)?.bounds);
    }
    const useRaster = isRasterRenderer(runtime.config.plot.renderer);
    const node = useRaster ? rasterCanvas : container.select("svg.clusterMap").node();
    if (!bounds || !node) return false;
    const viewport = node.getBoundingClientRect();
    const camera = fitCameraForBounds({
      bounds,
      viewport,
      padding: 56,
      constrainScale: constrainZoom,
    });
    if (!camera) return false;
    const transform = zoomIdentity.translate(camera.x, camera.y).scale(camera.k);
    if (useRaster && canvasZoom) select(node).call(canvasZoom.transform, transform);
    else if (zoom) select(node).call(zoom.transform, transform);
    else setCamera(chartState, camera);
    return true;
  }

  function paintCanvas(canvas = rasterCanvas, scene = canvasAnimation?.scene || canvasPendingFlip?.sourceScene || canvasBackend.pendingScene || runtime.getScene()) {
    if (!canvas || !scene) return null;
    updateFigureSurface();
    const result = canvasBackend.paint({ ...sceneFrame(scene), canvas,
      previousScene: canvasAnimation?.previousScene, progress: canvasAnimation?.progress });
    paintMinimap();
    return result;
  }

  function paintWebGpu(scene = webgpuBackend.pendingScene || runtime.getScene()) {
    if (!rasterCanvas || !scene) return;
    updateFigureSurface();
    const frame = sceneFrame(scene);
    if (overlayCanvas) renderCanvas({ ...frame, canvas: overlayCanvas,
      layers: ["tree", "trimIndicators", "geneLabels", "linkLabels", "clusterLabels", "annotationLabels", "chrome"] });
    const { width, height } = rasterCanvas.getBoundingClientRect();
    webgpuBackend.paint({ ...frame, canvas: rasterCanvas, width, height, onUnavailable: paintWebGpuFallback });
    paintMinimap();
  }

  function paintWebGpuFallback() {
    paintCanvas(overlayCanvas, webgpuBackend.pendingScene);
  }

  function paintMinimap() {
    if (!minimapCanvas) return;
    rasterMinimap.paint({ minimap: minimapCanvas, surface: rasterCanvas,
      scene: minimapScene || runtime.getScene(), options: runtime.config.plot.minimap,
      camera: getCamera(chartState), pixelRatio: globalThis.devicePixelRatio || 1 });
  }

  function renderMinimapBase({ canvas, scene, projection }) {
    const options = runtime.config.plot.minimap;
    renderCanvas({ canvas, scene, tree: plotData.tree, treeTrackAnchor: false,
      camera: { x: projection.x, y: projection.y, k: projection.scale },
      config: runtime.renderConfig, scales: runtime.scales, dimensions: projection, fullScene: true,
      layers: CANVAS_LAYERS.filter((layer) => layer !== "geneLabels" && layer !== "chrome" &&
        (options.showLinks || layer !== "links" && layer !== "linkLabels")),
      pixelRatio: globalThis.devicePixelRatio || 1 });
  }

  function scheduleMinimapBase(scene) {
    if (!minimapCanvas || !runtime.config.plot.minimap?.show) return;
    if (plotData.tree && runtime.config.tree.show) {
      minimapMeasurement ||= minimapCanvas.ownerDocument.createElement("canvas").getContext("2d");
      scene = { ...scene, figureBounds: measureFigureBounds(minimapMeasurement, scene, runtime.config, plotData.tree) };
    }
    minimapScene = scene;
    rasterMinimap.scheduleBase({ scene, minimap: minimapCanvas, options: runtime.config.plot.minimap,
      renderBase: renderMinimapBase, onPaint: paintMinimap });
  }

  function stopCanvasAnimation() {
    canvasAnimation?.cancel();
    canvasAnimation = null;
  }

  function animateCanvas(scene, animate) {
    stopCanvasAnimation();
    if (!animate || !canvasScene || !runtime.config.plot.transitionDuration) {
      treeAnimation = null;
      canvasScene = scene;
      paintCanvas();
      return;
    }
    const previousScene = canvasScene;
    if (treeAnimation) treeAnimation.targetScene = scene;
    canvasAnimation = { previousScene, scene, progress: 0, cancel: null };
    canvasAnimation.cancel = runAnimation(runtime.config.plot.transitionDuration, (progress) => {
      if (treeAnimation) treeAnimation.progress = progress;
      canvasAnimation.progress = progress;
      paintCanvas();
    }, () => {
      canvasAnimation = null;
      treeAnimation = null;
      canvasScene = scene;
      paintCanvas();
    });
  }

  function animateWebGpu(previousScene, scene, animate) {
    stopWebGpuAnimation();
    const duration = runtime.config.plot.transitionDuration;
    if (!animate || !previousScene || !duration) {
      treeAnimation = null;
      webgpuBackend.setScene(scene);
      paintWebGpu(scene);
      return;
    }
    if (treeAnimation) treeAnimation.targetScene = scene;
    webgpuAnimation = { cancel: runAnimation(duration, (progress) => {
      const displayScene = interpolateScene(previousScene, scene, progress);
      if (treeAnimation) treeAnimation.progress = progress;
      webgpuBackend.setScene(displayScene);
      paintWebGpu(displayScene);
    }, () => {
      webgpuAnimation = null;
      treeAnimation = null;
      webgpuBackend.setScene(scene);
      paintWebGpu(scene);
    }) };
  }

  const minimapInteractions = {
    getSurface: () => rasterCanvas,
    getScene: () => minimapScene || runtime.getScene(),
    getCamera: () => getCamera(chartState),
    getOptions: () => runtime.config.plot.minimap,
    moveCamera: (camera) => {
      const mainCanvas = rasterCanvas;
      if (!camera || !mainCanvas) return;
      // Go through D3 rather than mutating its private __zoom state. This
      // keeps the next wheel/pan gesture continuous with minimap navigation.
      select(mainCanvas).call(
        canvasZoom.transform,
        zoomIdentity.translate(camera.x, camera.y).scale(camera.k)
      );
      paintMinimap();
    },
    beginMotion: rasterMotion.begin,
    endMotion: rasterMotion.end,
    setCursor: (surface, cursor) => select(surface).style("cursor", cursor),
  };

  function redraw({ animate = true, synchronize = true } = {}) {
    if (!currentData || !container) return;
    applyTheme(container.node(), resolveTheme(runtime.config.plot.theme));
    if (globalThis.getComputedStyle(container.node()).position === "static") container.style("position", "relative");
    container.style("isolation", "isolate");
    if (!themeMedia && globalThis.matchMedia) {
      themeMedia = globalThis.matchMedia("(prefers-color-scheme: dark)");
      themeMedia.addEventListener("change", systemThemeChanged);
    }
    const committedScene = sceneCommit;
    sceneCommit = null;
    if (!updatingTreeMenu || !retainedOverlay?.isTreeMenuOpen(currentData.tree)) {
      retainedOverlay?.hide(true);
    }
    if (plotDataDirty) {
      plotData = visibleChartData(currentData, chartState);
      runtime.setChartIndex(plotData === currentData ? chartIndex : createChartIndex(plotData));
      plotDataDirty = false;
    }
    plotSelection.ids = selectionIds(plotSelection.kind, plotSelection.ids);
    if (!plotSelection.ids.size) selectionAnchor = null;
    const data = plotData;

    const useCanvas = isCanvasRenderer(runtime.config.plot.renderer);
    const useWebGpu = isWebGpuRenderer(runtime.config.plot.renderer);
    const useRaster = isRasterRenderer(runtime.config.plot.renderer);
    if (!useWebGpu) stopWebGpuAnimation();
    if (!useWebGpu && webgpuBackend.hasResources()) {
      // A renderer owns the WebGPU context for its canvas. Dispose it before
      // the chart changes backend, and invalidate any async setup that might
      // otherwise resolve after that canvas has been removed.
      webgpuBackend.destroy();
      sceneCommit = null;
    }
    if (!useRaster) { disposeRasterInteraction(); disposeRasterInteraction = () => {}; }
    if (!useCanvas) { stopCanvasAnimation(); canvasBackend.destroy(); }
    if (useRaster) svgBackend.destroy();
    const minimapOptions = runtime.config.plot.minimap || {};
    // The overview is a separate 2D canvas, so it works for both raster
    // backends. WebGPU owns only the main plot surface.
    const showMinimap = useRaster && minimapOptions.show;
    if (!useCanvas) clearScenePreview();
    if (!showMinimap) { rasterMinimap.clear(); minimapScene = null; }

    const svgSurface = ensureSvgSurface({
      container,
      data,
      ids: runtime.ids,
      fontFamily: runtime.config.plot.fontFamily,
      zoom,
      zoomExtent,
      onZoom: (event, viewport) => {
        setCamera(chartState, event.transform);
        applyCamera(viewport);
        const svgNode = viewport.node()?.ownerSVGElement;
        // Raster mode has no SVG plot group. Camera synchronization still
        // dispatches its zoom callback, including while restoring a project.
        if (!isRasterRenderer(runtime.config.plot.renderer) && svgNode) updateSvgAnnotationViewport(viewport.select("g.clusterMapG"), runtime.getScene(), scenePreview,
          worldViewport(getCamera(chartState), svgNode.getBoundingClientRect()));
        annotationOverlay?.refresh();
      },
      onZoomStart: (surface) => surface.attr("cursor", "grabbing"),
      onZoomEnd: (surface) => surface.attr("cursor", "grab"),
    });
    const { svg, plot } = svgSurface;
    zoom = svgSurface.zoom;
    const rasterSurface = ensureRasterSurface({
      container,
      data,
      renderer: runtime.config.plot.renderer,
      showRaster: useRaster,
      showWebGpu: useWebGpu,
      showMinimap,
      minimap: minimapOptions,
      zoom: canvasZoom,
      zoomExtent,
      onZoom: (event) => {
        setCamera(chartState, event.transform);
        annotationOverlay?.refresh();
        scheduleScenePaint();
      },
      onZoomStart: (surface) => {
        rasterMotion.begin();
        select(surface).style("cursor", "grabbing");
      },
      onZoomEnd: (surface) => {
        select(surface).style("cursor", "grab");
        rasterMotion.end();
      },
    });
    const { canvas, webgpuOverlay, minimap } = rasterSurface;
    rasterCanvas = canvas.node(); overlayCanvas = webgpuOverlay.node(); minimapCanvas = minimap.node();
    canvasZoom = rasterSurface.zoom;
    svg.style("display", useRaster ? "none" : null);
    if (retainedOverlay?.node !== svgSurface.tooltip.node()) {
      retainedOverlay?.dispose();
      retainedOverlay = createHtmlOverlay({
        tooltip: svgSurface.tooltip,
        scales: runtime.scales,
        eventNamespace: `.${runtime.ids.root}-tooltip`,
        actions: {
          redraw,
          treeControls: () => ({ tree: plotData.tree, clusters: plotData.clusters, config: runtime.renderConfig.tree,
            patch: (ops) => updateFromTreeMenu(() => my.patch(ops)),
            rotate: (uid) => updateFromTreeMenu(() => rendererInteractions.rotateTreeNode(uid)) }),
          updateGene: (gene, changes) => my.patch([
            { type: "genes.update", ids: [gene.uid], changes },
          ]),
          updateGroup: (group, changes) => my.patch([
            { type: "groups.update", ids: [group.uid], changes },
          ]),
          mergeGroups: (target, sourceIds) => my.patch([{
            type: "groups.merge",
            targetId: target.uid,
            sourceIds,
          }]),
          anchorGene: (gene) => anchorGene(gene, { flipMismatchedLoci: true }),
          get revealGene() { return runtime.config.gene.shape.onReveal; },
          get revealGroup() { return runtime.config.legend.onReveal; },
          getGroups: () => currentData.groups,
        },
      });
      container
        .select("div.tooltip")
        .on("mouseenter", retainedOverlay.enter)
        .on("mouseleave", retainedOverlay.leave);
    }
    rasterHitSurface = useWebGpu ? webgpuOverlay.node() : canvas.node();
    if (useRaster) {
      canvasZoom.filter(function (event) { return rasterInteraction.zoomFilter(this, event); });
      disposeRasterInteraction = rasterInteraction.bind(canvas);

      if (showMinimap) rasterMinimap.bind(minimap, minimapInteractions);
    }
    // The currently displayed renderer can change without changing the chart
    // camera. Keep D3's per-surface gesture state aligned before a newly
    // created SVG or canvas receives its first interaction.
    const camera = getCamera(chartState);
    syncCameraZoom({ surface: svg, zoom, camera });
    syncCameraZoom({ surface: canvas, zoom: canvasZoom, camera });
    applyCamera(svg.select("g.clusterMapViewport"));

    const annotationsOnly = Boolean(committedScene?.changes.annotationsOnly);
    if (!annotationsOnly) {
      runtime.updateScales(data, { geometryOnly: Boolean(committedScene) });
      if (synchronize) runtime.synchronizeLocusLayoutStates(data, committedScene ? committedScene.changes.loci || [] : null);
      if (!committedScene) runtime.updateGroups(data.groups);
    }

    const scene = annotationsOnly ? runtime.patchAnnotations(committedScene.sourceScene, data) : committedScene
      ? runtime.patchScene(committedScene.sourceScene, committedScene.changes, data)
      : runtime.buildScene(data);

    if (useCanvas) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      canvasBackend.setScene(scene);
      scheduleMinimapBase(scene);
      animateCanvas(scene, hasInitialView && animate);
    } else if (useWebGpu) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      if (committedScene && !annotationsOnly) {
        webgpuBackend.adoptScene(scene, committedScene.sourceScene, {
          scales: runtime.scales, config: runtime.renderConfig,
        });
      }
      scheduleMinimapBase(scene);
      const previousScene = webgpuBackend.pendingScene;
      animateWebGpu(previousScene, scene, hasInitialView && animate);
    } else {
      const previousScene = svgBackend.pendingScene;
      svgBackend.setScene(scene);
      paintSvg({ annotationsOnly, previousScene, animate: hasInitialView && animate });

      if (!hasInitialView) fitInitialView(svg, plot);
    }
    updateFigureSurface();
    if (runtime.config.annotations.enabled && plotData.clusters?.length) {
      annotationUiContext = {
        surfaces: [useRaster ? canvas.node() : svg.node()],
        getScene: () => runtime.getScene(), getPreview: () => scenePreview,
        getCamera: () => getCamera(chartState),
        isBusy: () => isDragging(chartState) || Boolean(canvasAnimation || webgpuAnimation),
        fontFamily: runtime.config.plot.fontFamily,
      };
      if (annotationOverlay) annotationOverlay.update(annotationUiContext);
      else if (!annotationUiLoad) {
        annotationUiLoad = import("../annotations/overlay.mjs").then(({ createAnnotationOverlay }) => {
          if (!annotationUiContext) return;
          annotationOverlay = createAnnotationOverlay({ container: container.node(), annotationApi: {
            ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale,
            annotationPanelsForFrame, annotationPanelBounds, hitTestAnnotationCell },
            editData: (panelUid) => !container.node().dispatchEvent(new CustomEvent("clustermap:edit-annotation", {
              bubbles: true, cancelable: true, detail: { chart: my, panelUid },
            })),
            getData: () => currentData,
            patch: (operations) => my.patch(operations) });
          annotationOverlay.update(annotationUiContext);
        }).catch((error) => console.error("Could not load optional annotation controls", error))
          .finally(() => { annotationUiLoad = null; });
      }
    } else {
      annotationUiContext = null;
      annotationOverlay?.dispose(); annotationOverlay = null;
    }
  }

  function fitInitialView(svg, plot) {
    const svgNode = svg.node();
    const plotNode = plot.node();
    if (!zoom || !svgNode || !plotNode) return;

    const { width, height } = svgNode.getBoundingClientRect();
    const bounds = plotNode.getBBox();
    if (!width || !height || !bounds.width || !bounds.height) return;

    const camera = fitCameraForBounds({
      bounds: {
        minX: bounds.x,
        maxX: bounds.x + bounds.width,
        minY: bounds.y,
        maxY: bounds.y + bounds.height,
      },
      viewport: { width, height },
      constrainScale: constrainZoom,
    });
    if (!camera) return;

    svg.call(zoom.transform, zoomIdentity.translate(camera.x, camera.y).scale(camera.k));
    hasInitialView = true;
  }

  function fitInitialCanvasView(canvas, scene) {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height || !scene.bounds) return;

    // Requesting a 2D context would permanently prevent a WebGPU context on
    // the visible canvas. Text measurement has no visual side effect, so use
    // a detached 2D canvas for the WebGPU renderer.
    const measurementCanvas = isWebGpuRenderer(runtime.config.plot.renderer)
      ? document.createElement("canvas")
      : canvas;
    const bounds = measureFigureBounds(measurementCanvas.getContext("2d"), scene, runtime.config, plotData.tree);
    if (!bounds) return;

    const camera = fitCameraForBounds({
      bounds,
      viewport: { width, height },
      // A fit below this scale defeats raster culling and produces an
      // impractically dense interaction surface. The helper then top-aligns
      // the cropped figure, showing the first clusters and their labels.
      minimumReadableScale: 1,
      constrainScale: constrainZoom,
    });
    if (!camera) return;
    if (canvasZoom) {
      select(canvas).call(
        canvasZoom.transform,
        zoomIdentity.translate(camera.x, camera.y).scale(camera.k)
      );
    } else {
      setCamera(chartState, camera);
    }
    hasInitialView = true;
  }

  function applyCamera(selection) {
    const { x, y, k } = getCamera(chartState);
    selection.attr("transform", `translate(${x}, ${y}) scale(${k})`);
    updateFigureSurface();
  }

  my.config = function (_) {
    if (!arguments.length) return runtime.config;
    cancelTreePresentationPreview();
    const before = currentData ? previousConfigPatch(runtime.config, _) : null;
    sceneCommit = null;
    runtime.configure(_, currentData?.tree);
    // Configuration is a live part of the public chart API. Updating it after
    // mounting should have the same immediate effect as updating data, without
    // requiring consumers to re-bind the chart's normalized data themselves.
    if (container && currentData) redraw({ animate: false });
    emitChange({ type: "config.change", config: runtime.config });
    if (before) remember({ kind: "config", undo: before, redo: copyConfigPatch(_) });
    return my;
  };
  my.data = function (data) {
    if (!arguments.length) return currentData;
    if (!container) throw new Error("Cannot replace chart data before the chart is mounted.");
    cancelTreePresentationPreview();
    container.datum(data).call(my);
    emitChange({ type: "data.replace" });
    clearHistory();
    return my;
  };
  my.visibleData = () => plotData;
  my.remove = function ({ clusters = [], loci = [] } = {}) {
    if (!container || !chartState || !chartIndex) throw new Error("Cannot remove records before the chart has rendered.");
    const validate = (ids, records, kind) => {
      if (!Array.isArray(ids) || ids.some((uid) => !records.has(uid))) throw new TypeError(`Unknown ${kind} IDs.`);
    };
    validate(clusters, chartIndex.clusterById, "cluster");
    validate(loci, chartIndex.locusById, "locus");
    flushCanvasFlip();
    cancelTreePresentationPreview();
    const snapshot = stateSnapshots.serialize(chartState, currentData);
    snapshot.excludedClusters = [...new Set([...(snapshot.excludedClusters || []), ...clusters])];
    snapshot.excludedLoci = [...new Set([...(snapshot.excludedLoci || []), ...loci])];
    if (snapshot.excludedClusters.length !== chartState.excludedClusters.size ||
        snapshot.excludedLoci.length !== chartState.excludedLoci.size) setState(snapshot);
    return my;
  };
  /** A serializable layout and camera snapshot for project persistence. */
  my.state = function (snapshot) {
    if (!arguments.length) return chartState ? stateSnapshots.serialize(chartState, currentData) : null;
    if (!container || !currentData) {
      throw new Error("Cannot replace chart state before the chart has rendered.");
    }
    setState(snapshot);
    return my;
  };
  /** A portable data, appearance, and layout snapshot for project persistence. */
  my.project = function (snapshot) {
    if (!arguments.length) {
      const data = structuredClone(currentData);
      if (treePresentationPreview && data?.tree) applyTreeOperation(data.tree, treePresentationPreview.undo);
      return {
        format: projectFormat,
        version: projectVersion,
        data,
        // Projects are portable JSON, not executable application state.
        // Callback hooks are intentionally omitted and can be reattached by
        // the consumer after loading.
        config: serializableConfig(runtime.config),
        state: chartState ? stateSnapshots.serialize(chartState, currentData) : null,
      };
    }
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new TypeError("A project snapshot must be an object.");
    }
    if (snapshot.format !== projectFormat || snapshot.version !== projectVersion) {
      throw new TypeError("Unsupported ClusterMap project snapshot.");
    }
    if (!snapshot.data || !snapshot.config) {
      throw new TypeError("A project snapshot requires data and config.");
    }
    const prepared = normalizeChartData(snapshot.data);
    runtime.validateConfiguration(snapshot.config, prepared.tree);
    if (snapshot.state) chartStateFromSnapshot(prepared, snapshot.state);
    // Validate the incoming pair before changing either live data or settings.
    runtime.configure(snapshot.config, prepared.tree);
    my.data(prepared);
    if (container && currentData) redraw({ animate: false });
    emitChange({ type: "config.change", config: runtime.config });
    if (snapshot.state) setState(snapshot.state, { record: false });
    clearHistory();
    return my;
  };
  // Do not name this `apply`: D3 invokes callable charts through
  // Function.prototype.apply when mounting them.
  my.patch = (operations) => {
    if (!container || !currentData || !chartIndex) {
      throw new Error("Cannot patch chart data before the chart has rendered.");
    }
    cancelTreePresentationPreview();
    applyPatch(operations);
    return my;
  };
  my.rotateTreeNode = (uid) => { cancelTreePresentationPreview(); rendererInteractions.rotateTreeNode(uid); return my; };
  /** Transient tree styles; patch commits once, null cancels the preview. */
  my.previewTreePresentation = (operations) => {
    const tree = currentData?.tree;
    if (!operations && !treePresentationPreview) return my;
    if (!tree) throw new Error("Tree presentation preview requires a loaded tree.");
    if (operations && (!Array.isArray(operations) || operations.some((op) => !isTreeOperation(op)))) {
      throw new TypeError("Only tree presentation operations can be previewed.");
    }
    cancelTreePresentationPreview();
    if (operations) {
      const undo = inverseTreeOperation(tree);
      try { applyChartOperations(currentData, chartIndex, operations, runtime.config.tree); }
      catch (error) { redraw({ animate: false }); throw error; }
      treePresentationPreview = { tree, undo };
      plotDataDirty = true;
    }
    redraw({ animate: false });
    return my;
  };
  my.canUndo = () => history.length > 0;
  my.canRedo = () => future.length > 0;
  my.clearHistory = () => {
    clearHistory();
    return my;
  };
  function replayHistory(source, target, direction) {
    const cancelled = cancelTreePresentationPreview();
    const change = source.pop();
    if (!change) { if (cancelled) redraw({ animate: false }); return my; }
    const value = change[direction];
    if (change.kind === "patch") {
      applyPatch(value, { record: false, automaticGroups: direction === "undo" ? change.groupsAutomaticBefore : change.groupsAutomaticAfter });
    } else if (change.kind === "config") {
      runtime.configure(value, currentData?.tree);
      redraw({ animate: false });
      emitChange({ type: "config.change", config: runtime.config });
    } else if (change.kind === "state" && value) {
      setState(value, { record: false });
    }
    target.push(change);
    emitHistoryChange();
    return my;
  }
  my.undo = () => replayHistory(history, future, "undo");
  my.redo = () => replayHistory(future, history, "redo");
  my.highlight = function (ids) {
    if (!arguments.length) return [...highlightGeneIds];
    const isScopedHighlight = ids && typeof ids === "object" && !Array.isArray(ids) && typeof ids[Symbol.iterator] !== "function";
    const nextGenes = new Set(isScopedHighlight ? ids.genes || [] : ids || []);
    const nextLinks = new Set(isScopedHighlight ? ids.links || [] : []);
    if (
      nextGenes.size === highlightGeneIds.size &&
      [...nextGenes].every((uid) => highlightGeneIds.has(uid)) &&
      nextLinks.size === highlightLinkIds.size &&
      [...nextLinks].every((uid) => highlightLinkIds.has(uid))
    ) return my;
    highlightGeneIds = nextGenes;
    highlightLinkIds = nextLinks;
    if (!container || !currentData) return my;
    if (isRasterRenderer(runtime.config.plot.renderer)) scheduleScenePaint();
    else redraw({ animate: false });
    return my;
  };
  /** Transient plot selection: one record kind at a time. */
  my.selection = function (selection) {
    if (!arguments.length) return { kind: plotSelection.kind, ids: [...plotSelection.ids] };
    const { kind = "loci", ids = [] } = selection || {};
    if (!["loci", "clusters"].includes(kind)) throw new TypeError("Selection kind must be loci or clusters.");
    const next = selectionIds(kind, ids);
    if (kind === plotSelection.kind && next.size === plotSelection.ids.size &&
        [...next].every((uid) => plotSelection.ids.has(uid))) return my;
    if (kind !== plotSelection.kind || !next.size) selectionAnchor = null;
    plotSelection = { kind, ids: next };
    canvasBackend.clearFlip();
    if (container && currentData) {
      if (isRasterRenderer(runtime.config.plot.renderer)) scheduleScenePaint();
      else redraw({ animate: false });
    }
    emitChange({ type: "selection.change", selection: my.selection() });
    emitChange({ type: "loci.select", locusIds: [...selectedLocusIds()] });
    return my;
  };
  my.locusSelection = function (ids) {
    return arguments.length ? my.selection({ kind: "loci", ids }) : [...selectedLocusIds()];
  };
  my.clusterSelection = function (ids) {
    return arguments.length ? my.selection({ kind: "clusters", ids }) : [...selectedClusterIds()];
  };
  /** Flip the supplied loci, or the current locus selection, as one operation. */
  my.flipLoci = function (ids = selectedLoci()) {
    if (!container || !currentData || !chartIndex || !chartState) {
      throw new Error("Cannot flip loci before the chart has rendered.");
    }
    const loci = [...new Set(ids || [])]
      .map(locusForId)
      .filter(Boolean);
    if (!loci.length) return my;
    const before = stateSnapshots.serialize(chartState, currentData);
    flushCanvasFlip();
    clearScenePreview();
    for (const locus of loci) flipLocus(chartState, locus);
    redraw({ animate: true });
    emitChange({ type: "loci.flip", locusIds: loci.map((locus) => locus.uid) });
    remember({ kind: "state", undo: before, redo: stateSnapshots.serialize(chartState, currentData) });
    return my;
  };
  /** Trim selected loci to their displayed outermost genes as one edit. */
  my.trimLoci = function (ids = selectedLoci()) {
    if (!container || !currentData || !chartIndex || !chartState) {
      throw new Error("Cannot trim loci before the chart has rendered.");
    }
    const loci = [...new Set(ids || [])]
      .map(locusForId)
      .filter(Boolean);
    if (!loci.length) return my;
    const before = stateSnapshots.serialize(chartState, currentData);
    flushCanvasFlip();
    clearScenePreview();
    let changed = false;
    for (const locus of loci) changed = trimLocusToGeneBounds(chartState, locus) || changed;
    if (!changed) return my;
    redraw({ animate: false });
    const locusIds = loci.map((locus) => locus.uid);
    emitChange({ type: "loci.trim", locusIds });
    remember({ kind: "state", undo: before, redo: stateSnapshots.serialize(chartState, currentData) });
    return my;
  };
  /** Restore selected loci to their full bounds as one edit. */
  my.restoreLoci = function (ids = selectedLoci()) {
    if (!container || !currentData || !chartIndex || !chartState) {
      throw new Error("Cannot restore loci before the chart has rendered.");
    }
    const loci = [...new Set(ids || [])]
      .map(locusForId)
      .filter(Boolean);
    if (!loci.length) return my;
    const before = stateSnapshots.serialize(chartState, currentData);
    flushCanvasFlip();
    clearScenePreview();
    let changed = false;
    for (const locus of loci) changed = restoreLocusBounds(chartState, locus) || changed;
    if (!changed) return my;
    redraw({ animate: false });
    const locusIds = loci.map((locus) => locus.uid);
    emitChange({ type: "loci.restore", locusIds });
    remember({ kind: "state", undo: before, redo: stateSnapshots.serialize(chartState, currentData) });
    return my;
  };
  /** Frame supplied record IDs without changing their selection. */
  my.focus = function (ids) {
    const isScoped = ids && typeof ids === "object" && !Array.isArray(ids) && typeof ids[Symbol.iterator] !== "function";
    focusCamera(isScoped ? ids : { genes: ids || [] });
    return my;
  };
  my.on = (type, listener) => {
    if (type !== "change") throw new TypeError(`Unsupported chart event: ${type}`);
    if (typeof listener !== "function") throw new TypeError("Chart event listeners must be functions.");
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  };
  /** Latest computed layout, excluding transient animation and drag geometry. */
  my.figureBounds = () => figureSurface.bounds(container?.node(), runtime.getScene(), runtime.renderConfig, plotData?.tree);
  my.exportSvg = ({ padding = 20 } = {}) => {
    flushCanvasFlip();
    return exportChartSvg({
      data: plotData,
      scene: runtime.getScene(),
      config: runtime.renderConfig,
      scales: runtime.scales,
      ids: runtime.ids,
      padding,
    });
  };
  my.destroy = () => {
    figureSurface.clear();
    themeMedia?.removeEventListener("change", systemThemeChanged); themeMedia = null;
    annotationUiContext = null;
    annotationOverlay?.dispose(); annotationOverlay = null;
    stateSnapshots.reset();
    cancelTreePresentationPreview();
    disposeRasterInteraction();
    rasterHitSurface = null;
    disposeRasterInteraction = () => {};
    retainedOverlay?.dispose();
    retainedOverlay = null;
    clearScenePreview();
    stopCanvasAnimation();
    stopWebGpuAnimation();
    rasterMotion.dispose();
    rasterMinimap.clear();
    webgpuBackend.destroy();
    canvasBackend.destroy();
    svgBackend.destroy();
    container
      ?.selectAll([
        "svg.clusterMap",
        "div.clusterMapFigureSurface",
        "div.clusterMapFigureDimensions",
        "input.colourPicker",
        "div.tooltip",
        "canvas.clusterMapCanvas",
        "canvas.clusterMapWebGpuOverlay",
        "canvas.clusterMapMinimap",
      ].join(", "))
      .interrupt()
      .remove();
    container = null;
    plotData = null;
    plotDataDirty = true;
    figureMeasurementContext = null;
    zoom = null;
    canvasZoom = null;
    hasInitialView = false;
    canvasHoverLocusUid = null;
    canvasScene = null;
    rasterCanvas = overlayCanvas = minimapCanvas = minimapScene = minimapMeasurement = null;
    sceneCommit = null;
    chartIndex = null;
    highlightGeneIds.clear();
    highlightLinkIds.clear();
    plotSelection.ids.clear();
    selectionAnchor = null;
    changeListeners.clear();
    return my;
  };

  return my;
}
