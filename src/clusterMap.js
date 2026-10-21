import { animate as runAnimation, afterPaint } from "./animation.mjs";
import { select } from "d3-selection";
import { transition as createTransition } from "d3-transition";
import { zoomIdentity } from "d3-zoom";
import { createLinkGroups } from "./links/groups.mjs";
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
} from "./chartState.mjs";
import { createChartIndex } from "./data/index.mjs";
import { normalizeChartData } from "./data/normalize.mjs";
import { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, validateAnnotationPanels, resolveAnnotationScale,
  annotationPanelsForFrame, annotationPanelBounds, hitTestAnnotationCell } from "./annotations.mjs";
import { isAnnotationOperation } from "./annotationOperations.mjs";
import { updateSvgAnnotationViewport } from "./annotationRenderers.mjs";
import { applyChartOperations } from "./data/operations.mjs";
import { isTreeOperation, inverseTreeOperation, applyTreeOperation } from "./treeOperations.mjs";
import { fitCameraForBounds, worldViewport } from "./camera.mjs";
import { applyTheme, resolveTheme } from "./theme.mjs";
import { createFigureSurface } from "./figureSurface.mjs";
import { createHtmlOverlay } from "./htmlOverlay.js";
import { createInteractionController } from "./interactionController.mjs";
import {
  canvasFigureBounds,
  canvasWorldPoint,
  hitTestCanvas,
  interpolateCanvasScene,
  renderCanvas,
  CANVAS_LAYERS,
} from "./canvasRenderer.js";
import { renderSvg } from "./svgRenderer.js";
import { createRasterMinimap } from "./rasterMinimap.mjs";
import { createRasterInteraction } from "./rasterInteraction.mjs";
import { createRasterMotion } from "./rasterMotion.mjs";
import {
  createClusterDragPreview,
  createLocusFlipPreview,
  createLocusOffsetPreview,
  createLocusOffsetsPreview,
  createLocusTrimPreview,
} from "./scenePreview.mjs";
import { exportChartSvg } from "./svgExport.mjs";
import { createChartRuntime } from "./chartRuntime.js";
import { createRetainedSceneBackend } from "./retainedSceneBackend.mjs";
import { createWebGpuBackend } from "./webgpuBackend.mjs";
import { ensureSvgSurface } from "./svgSurface.mjs";
import { ensureRasterSurface } from "./rasterSurface.mjs";
import { syncCameraZoom } from "./cameraZoom.mjs";
import { createRasterInteractionBindings } from "./rasterInteractionBindings.mjs";
import {
  isCanvasRenderer,
  isRasterRenderer,
  isWebGpuRenderer,
} from "./rendererMode.mjs";
import { chartStateFromSnapshot, createChartStateSerializer } from "./chartStateSnapshot.mjs";
import { lociForClusterRange } from "./locusSelection.mjs";

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
      currentData?.tree, getCamera(chartState), scenePreview);
  }
  let annotationOverlay = null;
  let themeMedia = null;
  function systemThemeChanged() {
    if (runtime.config.plot.theme !== "auto" || !container || !currentData) return;
    applyTheme(container.node(), resolveTheme(runtime.config.plot.theme));
    emitChange({ type: "theme.change", theme: resolveTheme(runtime.config.plot.theme).mode });
  }
  let annotationUiContext = null, annotationUiLoad = null;
  let transition = createTransition();
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
  let canvasPreviewScene = null;
  let canvasFlipStaticCanvas = null;
  let canvasFlipLocusCanvas = null;
  let canvasFlipLocusFrame = null;
  let canvasFlipDirtyFrame = null;
  let canvasPreparedFlipBase = null;
  let canvasFlipWarmFrame = null;
  let previewPaintFrame = null;
  let cancelCanvasFlip = null;
  let canvasPendingFlip = null;
  let paintPreviewFrame = null;
  let cancelSceneFlip = null;
  let clusterCommitFrame = null;
  let sceneCommit = null;
  let scheduleMinimapBase = () => {};
  let prepareCanvasFlipBase = () => {};
  let warmCanvasFlipBase = () => {};
  let currentData = null;
  let figureMeasurementContext = null;
  let rotateTreeNode = () => {};
  let chartIndex = null;
  let highlightGeneIds = new Set();
  let highlightLinkIds = new Set();
  let selectedLocusIds = new Set();
  let locusSelectionAnchorUid = null;
  let disposeRasterInteraction = () => {};
  let disposeOverlay = () => {};
  let retainedOverlay = null;
  let updatingTreeMenu = false;
  function updateFromTreeMenu(action) {
    const previous = updatingTreeMenu;
    updatingTreeMenu = true;
    try { return action(); }
    finally { updatingTreeMenu = previous; }
  }
  // Rebound on each redraw so programmatic focusing always targets the
  // currently active renderer surface.
  let focusCamera = () => false;
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
  const canvasBackend = createRetainedSceneBackend({
    render: renderCanvas,
    surface: "canvas",
  });
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
    getClusterOrder: () => getClusterOrder(chartState),
    getClusterPosition: (uid) => runtime.getScene().clusters.get(uid).y,
    getTree: () => currentData?.tree || null,
    getLocusOffset: (uid) => getLocusOffset(chartState, uid),
    selectedLocusIds: () => [...selectedLocusIds],
    selectedClusterIds: () => new Set(
      [...selectedLocusIds]
        .map(locusForId)
        .filter(Boolean)
        .map((locus) => locus.clusterUid)
    ),
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
          order: getClusterOrder(chartState),
          rows: runtime.scales.y.range(),
        });
        scheduleScenePreview();
        return;
      }
      redraw({ animate: false });
    },
    commitClusterOrder: () => {
      const sourceScene = runtime.getScene();
      const preview = scenePreview?.type === "cluster-drag" ? scenePreview : null;
      const order = [...getClusterOrder(chartState)];
      const rows = runtime.scales.y.range();
      if (sourceScene) sceneCommit = { sourceScene, changes: {} };
      commitPreviewClusterOrder(chartState);
      setTreeClusterOrder(currentData.tree, order);
      if (
        preview &&
        sourceScene &&
        isRasterRenderer(runtime.config.plot.renderer)
      ) {
        // Paint the destination row once before the committed projection runs.
        // This avoids a release-time blank/stale frame while a large chart is
        // rebuilding its authoritative scene and indexes.
        scenePreview = createClusterDragPreview(sourceScene, {
          clusterUid: preview.clusterUid,
          position: rows[order.indexOf(preview.clusterUid)],
          order,
          rows,
        });
        scheduleScenePreview();
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
        scheduleScenePreview();
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
        scheduleScenePreview();
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
        runtime.updateScales(currentData, { geometryOnly: true });
        scenePreview = createLocusTrimPreview(runtime.getScene(), locus.uid, result.state, {
          localXFor: runtime.scales.locus,
          scaleX: runtime.scales.x,
          alignLabels: runtime.config.cluster.alignLabels,
          shape: runtime.config.gene.shape,
          trimIndicatorStyle: runtime.config.locus.trimIndicators,
          clusterLabelText: runtime.locusTextForCluster(locus.clusterUid),
        });
        scheduleScenePreview();
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
        canvasAnimation?.cancel();
        canvasAnimation = null;
        cancelCanvasFlip?.();
        const previewProgress = 0.12;
        const sourceScene = canvasScene || runtime.getScene();
        const pending = createCanvasFlipPending(locus, sourceScene);
        canvasPendingFlip = pending;
        canvasPreviewScene = sourceScene;
        scenePreview = createLocusFlipPreview(sourceScene, locus.uid, {
          progress: previewProgress,
          clusterLabelText: pending.clusterLabelText,
        });
        scheduleScenePreview();
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
          const targetScene = runtime.patchScene(sourceScene, { loci: [locus.uid] }, currentData);
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
    canvasPreviewScene = null;
    clearCanvasFlipBase();
    canvasPreparedFlipBase = null;
    if (canvasFlipWarmFrame !== null) cancelAnimationFrame(canvasFlipWarmFrame);
    canvasFlipWarmFrame = null;
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
      pending.targetScene = runtime.patchScene(pending.sourceScene, { loci: [pending.locus.uid] }, currentData);
      commitInteractionState();
    }
    canvasScene = pending.targetScene;
    canvasBackend.setScene(canvasScene);
    scenePreview = null;
    canvasPreviewScene = null;
    canvasPendingFlip = null;
    clearCanvasFlipBase();
    canvasPreparedFlipBase = null;
  }

  function startCanvasFlip(pending, initialProgress) {
    if (canvasPendingFlip !== pending) return;
    cancelCanvasFlip = null;
    runtime.synchronizeLocusLayoutState(pending.locus);
    pending.targetScene = runtime.patchScene(pending.sourceScene, { loci: [pending.locus.uid] }, currentData);
    commitInteractionState();
    prepareCanvasFlipBase(pending);
    // Restore and repaint the affected canvas region before the browser can
    // present a frame. The base image stays offscreen; the visible plot stays
    // a single canvas throughout the animation.
    paintPreviewFrame?.();
    const duration = runtime.config.plot.transitionDuration;
    if (!duration) {
      canvasScene = pending.targetScene;
      canvasBackend.setScene(canvasScene);
      scenePreview = null;
      canvasPreviewScene = null;
      canvasPendingFlip = null;
      paintPreviewFrame?.();
      clearCanvasFlipBase();
      canvasPreparedFlipBase = null;
      scheduleScenePaint();
      scheduleMinimapBase(canvasScene);
      return;
    }
    cancelCanvasFlip = runAnimation(duration, (progress) => {
      if (canvasPendingFlip !== pending) return;
      scenePreview = createLocusFlipPreview(pending.sourceScene, pending.locus.uid, {
        progress: initialProgress + (1 - initialProgress) * progress,
        clusterLabelText: pending.clusterLabelText,
      });
      // Paint the dirty region in this frame rather than one frame later.
      if (previewPaintFrame !== null) cancelAnimationFrame(previewPaintFrame);
      previewPaintFrame = null;
      paintPreviewFrame?.();
    }, () => {
      cancelCanvasFlip = null;
      scenePreview = null;
      canvasPreviewScene = null;
      canvasPendingFlip = null;
      canvasScene = pending.targetScene;
      canvasBackend.setScene(canvasScene);
      paintPreviewFrame?.();
      clearCanvasFlipBase();
      canvasPreparedFlipBase = null;
      scheduleScenePaint();
      scheduleMinimapBase(canvasScene);
    });
  }

  function scheduleScenePaint() {
    if (previewPaintFrame !== null || !paintPreviewFrame) return;
    previewPaintFrame = requestAnimationFrame(() => {
      previewPaintFrame = null;
      paintPreviewFrame();
    });
  }

  const scheduleScenePreview = scheduleScenePaint;

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

  function createCanvasFlipPending(locus, sourceScene) {
    const dynamicLinks = new Set();
    const locusGenes = new Set(locus.genes.map((gene) => gene.uid));
    const dynamicGenes = new Set(locusGenes);
    for (const gene of locus.genes) {
      for (const link of runtime.lookup.linksForGene(gene.uid)) {
        dynamicLinks.add(link.uid);
        // The link must remain below both endpoint gene shapes. Repaint its
        // stationary neighbour in the same dirty canvas region as the
        // reflected locus rather than compositing separate layers.
        dynamicGenes.add(link.query.uid);
        dynamicGenes.add(link.target.uid);
      }
    }
    return {
      locus,
      sourceScene,
      clusterLabelText: runtime.locusTextForCluster(locus.clusterUid),
      targetScene: null,
      locusRecords: {
        loci: new Set([locus.uid]),
        genes: locusGenes,
        links: new Set(),
      },
      dynamic: {
        loci: new Set([locus.uid]),
        genes: dynamicGenes,
        links: dynamicLinks,
      },
    };
  }

  function clearCanvasFlipBase() {
    canvasFlipStaticCanvas = null;
    canvasFlipLocusCanvas = null;
    canvasFlipLocusFrame = null;
    canvasFlipDirtyFrame = null;
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
    chartIndex = createChartIndex(currentData);
    refreshGroups();
    selectedLocusIds = new Set(
      [...selectedLocusIds].map(locusForId).filter(Boolean).map((locus) => locus.uid)
    );
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
    treePresentationPreview = null;
    return true;
  }

  function setState(snapshot, { record = true } = {}) {
    sceneCommit = null;
    pendingInteractionState = null;
    const before = chartState ? stateSnapshots.serialize(chartState, currentData) : null;
    chartState = chartStateFromSnapshot(currentData, snapshot);
    runtime.setChartState(chartState);
    hasInitialView = true;
    redraw({ animate: false });
    const after = stateSnapshots.serialize(chartState, currentData);
    emitChange({ type: "state.replace", state: after });
    if (record) remember({ kind: "state", undo: before, redo: after });
  }

  function highlightedGeneIds() {
    const ids = new Set(highlightGeneIds);
    for (const locusUid of selectedLocusIds) {
      for (const gene of chartIndex?.locusById.get(locusUid)?.genes || []) ids.add(gene.uid);
    }
    return ids;
  }

  function locusForId(uid) {
    return chartIndex?.locusById.get(uid) || [...(chartIndex?.locusById || [])]
      .find(([key]) => String(key) === String(uid))?.[1];
  }

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
    disposeRasterInteraction();
    disposeRasterInteraction = () => {};
    if (!updatingTreeMenu || !retainedOverlay?.isTreeMenuOpen(currentData.tree)) {
      disposeOverlay();
      disposeOverlay = () => {};
      retainedOverlay = null;
    }
    const data = currentData;
    if (canvasFlipWarmFrame !== null) cancelAnimationFrame(canvasFlipWarmFrame);
    canvasFlipWarmFrame = null;
    canvasPreparedFlipBase = null;

    // Set up the shared transition
    transition = createTransition().duration(runtime.config.plot.transitionDuration);
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
    if (!useCanvas) canvasBackend.destroy();
    if (useRaster) svgBackend.destroy();
    const minimapOptions = runtime.config.plot.minimap || {};
    // The overview is a separate 2D canvas, so it works for both raster
    // backends. WebGPU owns only the main plot surface.
    const showMinimap = useRaster && minimapOptions.show;
    if (!useCanvas) clearScenePreview();
    if (!showMinimap) rasterMinimap.clear();

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
        if (!useRaster && svgNode) updateSvgAnnotationViewport(viewport.select("g.clusterMapG"), runtime.getScene(), scenePreview,
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
    canvasZoom = rasterSurface.zoom;
    svg.style("display", useRaster ? "none" : null);
    const overlay = retainedOverlay || createHtmlOverlay({
      tooltip: svgSurface.tooltip,
      scales: runtime.scales,
      eventNamespace: `.${runtime.ids.root}-tooltip`,
      actions: {
        redraw,
        treeControls: () => ({ tree: currentData.tree, clusters: currentData.clusters, config: runtime.renderConfig.tree,
          patch: (ops) => updateFromTreeMenu(() => my.patch(ops)),
          rotate: (uid) => updateFromTreeMenu(() => rotateTreeNode(uid)) }),
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
        revealGene: runtime.config.gene.shape.onReveal,
        revealGroup: runtime.config.legend.onReveal,
        getGroups: () => data.groups,
      },
    });
    retainedOverlay = overlay;
    disposeOverlay = overlay.dispose;
    container
      .select("div.tooltip")
      .on("mouseenter", overlay.enter)
      .on("mouseleave", overlay.leave);
    const canvasFrame = () => ({
      camera: getCamera(chartState), config: runtime.renderConfig,
      scales: runtime.scales, pixelRatio: rasterMotion.pixelRatio(),
    });
    const paintCanvas = (canvasNode) => {
      updateFigureSurface();
      const flipLayer =
        scenePreview?.type === "locus-flip" &&
        canvasPendingFlip &&
        canvasPreviewScene === canvasPendingFlip.sourceScene &&
        canvasFlipStaticCanvas &&
        canvasFlipLocusCanvas &&
        canvasFlipLocusFrame &&
        canvasFlipDirtyFrame;
      if (flipLayer) {
        restoreCanvasFlipRegion(
          canvasNode,
          canvasFlipStaticCanvas,
          canvasFlipDirtyFrame,
          rasterMotion.pixelRatio()
        );
        renderCanvas({
          canvas: canvasNode,
          scene: canvasPreviewScene,
          ...canvasFrame(),
          // Keep the normal filled-ribbon appearance throughout the flip.
          config: {
            ...runtime.renderConfig,
            link: {
              ...runtime.config.link,
              asLine: false,
            },
          },
          preview: scenePreview,
          include: { links: canvasPendingFlip.dynamic.links },
          layers: ["links"],
          suppressLocusHover: true,
          clear: false,
        });
        drawCanvasFlipLocus(
          canvasNode,
          canvasFlipLocusCanvas,
          canvasFlipLocusFrame,
          canvasFlipDirtyFrame,
          scenePreview,
          rasterMotion.pixelRatio()
        );
        const stationaryGenes = new Set(canvasPendingFlip.dynamic.genes);
        for (const uid of canvasPendingFlip.locusRecords.genes) stationaryGenes.delete(uid);
        if (stationaryGenes.size) {
          renderCanvas({
            canvas: canvasNode,
            scene: canvasPreviewScene,
            ...canvasFrame(),
            include: { genes: stationaryGenes },
            layers: ["genes", "geneLabels"],
            suppressLocusHover: true,
            clear: false,
          });
        }
        // The cached base contains the source label. Repaint the affected
        // cluster info from the sparse preview so flipped coordinates become
        // visible immediately rather than at the end of the bitmap animation.
        renderCanvas({
          canvas: canvasNode,
          scene: canvasPreviewScene,
          ...canvasFrame(),
          preview: scenePreview,
          include: { loci: canvasPendingFlip.locusRecords.loci },
          layers: ["trimIndicators", "clusterLabels"],
          suppressLocusHover: true,
          clear: false,
        });
        paintMinimap();
        return canvasFlipDirtyFrame;
      }
      const result = canvasBackend.paint({
        canvas: canvasNode,
        tree: currentData.tree,
        scene:
          canvasAnimation?.scene ||
          canvasPreviewScene ||
          canvasBackend.pendingScene ||
          runtime.getScene(),
        previousScene: canvasAnimation?.previousScene,
        progress: canvasAnimation?.progress,
        previousTree: treeAnimation?.previousTree,
        previousTreeScene: treeAnimation?.previousScene,
        treeProgress: treeAnimation?.progress ?? 1,
        ...canvasFrame(),
        hoverLocusUid: canvasHoverLocusUid,
        suppressLocusHover:
          scenePreview?.type === "locus-flip" || Boolean(canvasAnimation?.suppressLocusHover),
        preview: scenePreview,
        highlightGeneIds: highlightedGeneIds(),
        highlightLinkIds,
        highlightLocusIds: selectedLocusIds,
      });
      paintMinimap();
      return result;
    };
    const paintWebGpu = (canvasNode, scene) => {
      if (!canvasNode || !scene) return;
      updateFigureSurface();
      const overlayNode = webgpuOverlay.node();
      if (overlayNode) {
        renderCanvas({
          canvas: overlayNode,
          scene,
          tree: currentData.tree,
          previousTree: treeAnimation?.previousTree,
          previousTreeScene: treeAnimation?.previousScene,
          treeTargetScene: treeAnimation?.targetScene,
          treeProgress: treeAnimation?.progress ?? 1,
          ...canvasFrame(),
          hoverLocusUid: canvasHoverLocusUid,
          suppressLocusHover: scenePreview?.type === "locus-flip",
          preview: scenePreview,
          layers: ["tree", "trimIndicators", "geneLabels", "linkLabels", "clusterLabels", "annotationLabels", "chrome"],
          highlightGeneIds: highlightedGeneIds(),
          highlightLinkIds,
          highlightLocusIds: selectedLocusIds,
        });
      }
      const bounds = canvasNode.getBoundingClientRect();
      webgpuBackend.paint({
        canvas: canvasNode,
        scene,
        preview: scenePreview,
        ...canvasFrame(),
        width: bounds.width,
        height: bounds.height,
        onUnavailable: () => paintCanvas(webgpuOverlay.node()),
      });
      paintMinimap();
    };
    paintPreviewFrame = useCanvas
      ? () => paintCanvas(canvas.node())
      : useWebGpu
        ? () => paintWebGpu(canvas.node(), webgpuBackend.pendingScene || runtime.getScene())
        : null;
    const flipLayerMatches = (layer, pending, bounds, pixelRatio) => {
      if (!layer || layer.sourceScene !== pending.sourceScene || layer.locusUid !== pending.locus.uid) {
        return false;
      }
      const camera = getCamera(chartState);
      return (
        layer.width === bounds.width &&
        layer.height === bounds.height &&
        layer.pixelRatio === pixelRatio &&
        layer.camera.x === camera.x &&
        layer.camera.y === camera.y &&
        layer.camera.k === camera.k
      );
    };
    const renderFlipStaticBase = (pending, baseCanvas, bounds, pixelRatio) => {
      const renderOptions = {
        scene: pending.sourceScene,
        tree: currentData.tree,
        ...canvasFrame(),
        dimensions: { width: bounds.width, height: bounds.height },
        pixelRatio,
        suppressLocusHover: true,
      };
      renderCanvas({
        canvas: baseCanvas,
        ...renderOptions,
        omit: {
          links: pending.dynamic.links,
          loci: pending.dynamic.loci,
          genes: pending.dynamic.genes,
        },
        layers: ["links", "linkLabels"],
      });
      renderCanvas({
        canvas: baseCanvas,
        ...renderOptions,
        omit: { loci: pending.dynamic.loci, genes: pending.dynamic.genes },
        layers: CANVAS_LAYERS.filter((layer) => layer !== "links" && layer !== "linkLabels"),
        clear: false,
      });
    };
    const renderFlipLocusBitmap = (pending, locusCanvas, bounds, pixelRatio) => {
      const frame = screenFrameForBounds(
        boundsForRecords(pending.sourceScene.loci, pending.locusRecords.loci),
        bounds
      );
      const camera = getCamera(chartState);
      renderCanvas({
        canvas: locusCanvas,
        scene: pending.sourceScene,
        ...canvasFrame(),
        camera: { ...camera, x: camera.x - frame.x, y: camera.y - frame.y },
        dimensions: frame,
        pixelRatio,
        include: pending.locusRecords,
        layers: ["tracks", "trimIndicators", "genes"],
        suppressLocusHover: true,
      });
      return frame;
    };
    const boundsForRecords = (records, ids) => {
      let result = null;
      for (const uid of ids) {
        const bounds = records.get(uid)?.bounds;
        if (!bounds) continue;
        result = result
          ? {
              minX: Math.min(result.minX, bounds.minX),
              maxX: Math.max(result.maxX, bounds.maxX),
              minY: Math.min(result.minY, bounds.minY),
              maxY: Math.max(result.maxY, bounds.maxY),
            }
          : { ...bounds };
      }
      return result;
    };
    const screenFrameForBounds = (worldBounds, canvasBounds, padding = 12) => {
      const camera = getCamera(chartState);
      if (!worldBounds) return { x: 0, y: 0, width: 1, height: 1 };
      const x = Math.max(0, camera.x + worldBounds.minX * camera.k - padding);
      const y = Math.max(0, camera.y + worldBounds.minY * camera.k - padding);
      const right = Math.min(
        canvasBounds.width,
        camera.x + worldBounds.maxX * camera.k + padding
      );
      const bottom = Math.min(
        canvasBounds.height,
        camera.y + worldBounds.maxY * camera.k + padding
      );
      return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
    };
    const flipDirtyBounds = (pending) => {
      const locusBounds = boundsForRecords(pending.sourceScene.loci, pending.dynamic.loci);
      const linkBounds = boundsForRecords(pending.sourceScene.links, pending.dynamic.links);
      const geneBounds = boundsForRecords(pending.sourceScene.genes, pending.dynamic.genes);
      return [locusBounds, linkBounds, geneBounds]
        .filter(Boolean)
        .reduce(
          (result, bounds) =>
            result
              ? {
                  minX: Math.min(result.minX, bounds.minX),
                  maxX: Math.max(result.maxX, bounds.maxX),
                  minY: Math.min(result.minY, bounds.minY),
                  maxY: Math.max(result.maxY, bounds.maxY),
                }
              : { ...bounds },
          null
        );
    };
    const restoreCanvasFlipRegion = (canvasNode, baseCanvas, frame, pixelRatio) => {
      const context = canvasNode.getContext("2d");
      const left = Math.max(0, Math.floor(frame.x * pixelRatio));
      const top = Math.max(0, Math.floor(frame.y * pixelRatio));
      const right = Math.min(baseCanvas.width, Math.ceil((frame.x + frame.width) * pixelRatio));
      const bottom = Math.min(baseCanvas.height, Math.ceil((frame.y + frame.height) * pixelRatio));
      const width = Math.max(1, right - left);
      const height = Math.max(1, bottom - top);
      const x = left / pixelRatio;
      const y = top / pixelRatio;
      const cssWidth = width / pixelRatio;
      const cssHeight = height / pixelRatio;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(x, y, cssWidth, cssHeight);
      context.drawImage(baseCanvas, left, top, width, height, x, y, cssWidth, cssHeight);
    };
    const drawCanvasFlipLocus = (canvasNode, locusCanvas, locusFrame, dirtyFrame, preview, pixelRatio) => {
      const axis = preview.axes?.get(preview.locusUid);
      if (axis === undefined) return;
      const camera = getCamera(chartState);
      const context = canvasNode.getContext("2d");
      const screenAxis = camera.x + axis * camera.k;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.save();
      context.beginPath();
      context.rect(dirtyFrame.x, dirtyFrame.y, dirtyFrame.width, dirtyFrame.height);
      context.clip();
      context.translate(screenAxis, 0);
      context.scale(1 - 2 * preview.progress, 1);
      context.translate(-screenAxis, 0);
      context.drawImage(
        locusCanvas,
        0,
        0,
        locusCanvas.width,
        locusCanvas.height,
        locusFrame.x,
        locusFrame.y,
        locusFrame.width,
        locusFrame.height
      );
      context.restore();
    };
    prepareCanvasFlipBase = (pending) => {
      const canvasNode = canvas.node();
      if (!canvasNode || !pending.sourceScene) return;
      const bounds = canvasNode.getBoundingClientRect();
      const pixelRatio = rasterMotion.pixelRatio();
      if (flipLayerMatches(canvasPreparedFlipBase, pending, bounds, pixelRatio)) {
        canvasFlipStaticCanvas = canvasPreparedFlipBase.baseCanvas;
        canvasFlipLocusCanvas = canvasPreparedFlipBase.locusCanvas;
        canvasFlipLocusFrame = canvasPreparedFlipBase.locusFrame;
      } else {
        if (!canvasFlipStaticCanvas) canvasFlipStaticCanvas = document.createElement("canvas");
        if (!canvasFlipLocusCanvas) canvasFlipLocusCanvas = document.createElement("canvas");
        renderFlipStaticBase(pending, canvasFlipStaticCanvas, bounds, pixelRatio);
        canvasFlipLocusFrame = renderFlipLocusBitmap(
          pending,
          canvasFlipLocusCanvas,
          bounds,
          pixelRatio
        );
      }
      canvasFlipDirtyFrame = screenFrameForBounds(flipDirtyBounds(pending), bounds);
    };
    warmCanvasFlipBase = (locusUid) => {
      if (!locusUid || canvasPendingFlip) return;
      if (canvasFlipWarmFrame !== null) cancelAnimationFrame(canvasFlipWarmFrame);
      canvasFlipWarmFrame = requestAnimationFrame(() => {
        canvasFlipWarmFrame = null;
        const canvasNode = canvas.node();
        const locus = runtime.lookup.locusData(locusUid);
        const sourceScene = canvasScene || runtime.getScene();
        if (!canvasNode || !locus || !sourceScene || canvasPendingFlip) return;
        const bounds = canvasNode.getBoundingClientRect();
        const pixelRatio = rasterMotion.pixelRatio();
        const pending = createCanvasFlipPending(locus, sourceScene);
        if (flipLayerMatches(canvasPreparedFlipBase, pending, bounds, pixelRatio)) return;
        const baseCanvas = document.createElement("canvas");
        const locusCanvas = document.createElement("canvas");
        renderFlipStaticBase(pending, baseCanvas, bounds, pixelRatio);
        const locusFrame = renderFlipLocusBitmap(pending, locusCanvas, bounds, pixelRatio);
        canvasPreparedFlipBase = {
          sourceScene,
          locusUid,
          width: bounds.width,
          height: bounds.height,
          pixelRatio,
          camera: { ...getCamera(chartState) },
          baseCanvas,
          locusCanvas,
          locusFrame,
        };
      });
    };
    let minimapScene = null;
    let minimapMeasurement = null;
    const paintMinimap = () => {
      rasterMinimap.paint({
        minimap: minimap.node(),
        surface: canvas.node(),
        scene: minimapScene || runtime.getScene(),
        options: minimapOptions,
        camera: getCamera(chartState),
        pixelRatio: globalThis.devicePixelRatio || 1,
      });
    };
    scheduleMinimapBase = (scene) => {
      if (!showMinimap) return;
      if (currentData.tree && runtime.config.tree.show) {
        minimapMeasurement ||= document.createElement("canvas").getContext("2d");
        scene = { ...scene, figureBounds: canvasFigureBounds(minimapMeasurement, scene, runtime.config, currentData.tree) };
      }
      minimapScene = scene;
      rasterMinimap.scheduleBase({
        scene,
        minimap: minimap.node(),
        options: minimapOptions,
        renderBase: ({ canvas: baseCanvas, scene: overviewScene, projection }) => {
          renderCanvas({
            canvas: baseCanvas,
            tree: currentData.tree,
            treeTrackAnchor: false,
            scene: overviewScene,
            camera: { x: projection.x, y: projection.y, k: projection.scale },
            config: runtime.renderConfig,
            layers: CANVAS_LAYERS.filter((layer) => layer !== "geneLabels" && layer !== "chrome" &&
              (minimapOptions.showLinks || layer !== "links" && layer !== "linkLabels")),
            scales: runtime.scales,
            dimensions: projection,
            fullScene: true,
            pixelRatio: globalThis.devicePixelRatio || 1,
          });
        },
        onPaint: paintMinimap,
      });
    };
    const stopCanvasAnimation = () => {
      canvasAnimation?.cancel();
      canvasAnimation = null;
    };
    const animateCanvas = (canvasNode, scene, animate) => {
      stopCanvasAnimation();
      if (!animate || !canvasScene || !runtime.config.plot.transitionDuration) {
        treeAnimation = null;
        canvasScene = scene;
        paintCanvas(canvasNode);
        return;
      }
      const previousScene = canvasScene;
      if (treeAnimation) treeAnimation.targetScene = scene;
      canvasAnimation = { previousScene, scene, progress: 0, cancel: null };
      canvasAnimation.cancel = runAnimation(runtime.config.plot.transitionDuration, (progress) => {
        if (treeAnimation) treeAnimation.progress = progress;
        canvasAnimation.progress = progress;
        paintCanvas(canvasNode);
      }, () => {
        canvasAnimation = null;
        treeAnimation = null;
        canvasScene = scene;
        paintCanvas(canvasNode);
      });
    };
    const animateWebGpu = (canvasNode, previousScene, scene, animate) => {
      stopWebGpuAnimation();
      const duration = runtime.config.plot.transitionDuration;
      if (!animate || !previousScene || !duration) {
        treeAnimation = null;
        webgpuBackend.setScene(scene);
        paintWebGpu(canvasNode, scene);
        return;
      }
      if (treeAnimation) treeAnimation.targetScene = scene;
      webgpuAnimation = { cancel: runAnimation(duration, (progress) => {
        const displayScene = interpolateCanvasScene(previousScene, scene, progress);
        if (treeAnimation) treeAnimation.progress = progress;
        webgpuBackend.setScene(displayScene);
        paintWebGpu(canvasNode, displayScene);
      }, () => {
        webgpuAnimation = null;
        treeAnimation = null;
        webgpuBackend.setScene(scene);
        paintWebGpu(canvasNode, scene);
      }) };
    };
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
      renameCluster: (event, cluster) => renameRecord(event, "clusters", cluster),
      isDragging: () => isDragging(chartState),
      beginClusterDrag: interactionController.beginClusterDrag,
      moveClusterDrag: interactionController.moveClusterDrag,
      endClusterDrag: interactionController.endClusterDrag,
      cancelClusterDrag: interactionController.cancelClusterDrag,
      rotateTreeNode: (uid) => {
        const node = currentData.tree?.nodes.find((entry) => entry.uid === uid);
        if (!node?.children) return;
        beginInteractionState();
        treeAnimation = {
          previousTree: {
            ...currentData.tree,
            nodes: currentData.tree.nodes.map((entry) => ({
              ...entry,
              children: entry.children ? [...entry.children] : undefined,
            })),
          },
          previousScene: runtime.getScene(),
          progress: 0,
        };
        sceneCommit = { sourceScene: runtime.getScene(), changes: {} };
        node.children.reverse();
        chartState = createChartState(currentData, chartState);
        runtime.setChartState(chartState);
        redraw();
        commitInteractionState();
      },
      beginLocusDrag: interactionController.beginLocusDrag,
      moveLocusDrag: interactionController.moveLocusDrag,
      endLocusDrag: interactionController.endLocusDrag,
      cancelLocusDrag: interactionController.cancelLocusDrag,
      beginLocusTrim: interactionController.beginLocusTrim,
      moveLocusTrim: interactionController.moveLocusTrim,
      endLocusTrim: interactionController.endLocusTrim,
      cancelLocusTrim: interactionController.cancelLocusTrim,
      flipLocus: interactionController.flipLocus,
      toggleLocusSelection: (locus, { clusterRange = null } = {}) => {
        const ids = new Set(selectedLocusIds);
        const anchor = locusForId(locusSelectionAnchorUid);
        if (clusterRange && anchor) {
          const range = lociForClusterRange(
            getClusterOrder(chartState),
            chartIndex?.clusterById || new Map(),
            anchor.clusterUid,
            locus.clusterUid
          );
          if (range.length) {
            range.forEach((uid) => {
              if (clusterRange === "remove") ids.delete(uid);
              else ids.add(uid);
            });
            my.locusSelection(ids);
            if (ids.size) locusSelectionAnchorUid = locus.uid;
            return;
          }
        }
        if (ids.has(locus.uid)) ids.delete(locus.uid);
        else ids.add(locus.uid);
        my.locusSelection(ids);
        if (ids.size) locusSelectionAnchorUid = locus.uid;
      },
      onGeneClick: (event, gene) => {
        // Shift-click belongs to the containing locus and must not also invoke
        // the established single-gene anchor interaction.
        if (event.shiftKey) return;
        (runtime.config.gene.shape.onClick || ((_, record) => anchorGene(record)))(event, gene);
      },
      showTreeMenu: overlay.showTreeMenu,
      showGeneMenu: overlay.showGeneMenu,
      showGroupMenu: overlay.showGroupMenu,
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
        const handler = runtime.config.legend.onAltClickText || overlay.showGroupMenu;
        handler(event, group);
      },
    };
    rotateTreeNode = rendererInteractions.rotateTreeNode;
    if (useRaster) {
      const targetForEvent = (canvasNode, event) =>
        hitTestCanvas({
          // A canvas can only have one rendering context. WebGPU owns the
          // visible surface, so use its transparent 2D text/chrome overlay
          // for the metric-dependent portions of hit testing instead.
          canvas: useWebGpu ? webgpuOverlay.node() : canvasNode,
          scene: runtime.getScene(),
          camera: getCamera(chartState),
          config: runtime.renderConfig,
          event,
          tree: currentData.tree,
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
          canvasWorldPoint(surface, event, getCamera(chartState)),
        locusForTarget,
        setHoverLocus: (locusUid) => {
          if (canvasHoverLocusUid === locusUid) return false;
          canvasHoverLocusUid = locusUid;
          scheduleScenePaint();
          return true;
        },
        warmLocus: useCanvas ? warmCanvasFlipBase : () => {},
        beginMotion: rasterMotion.begin,
        endMotion: rasterMotion.end,
        setCursor: (surface, cursor) => select(surface).style("cursor", cursor),
        ...rasterBindings,
      });
      canvasZoom.filter(function (event) {
        return rasterInteraction.zoomFilter(this, event);
      });
      disposeRasterInteraction = rasterInteraction.bind(canvas);

      rasterMinimap.bind(minimap, {
        getSurface: () => canvas.node(),
        getScene: () => minimapScene || runtime.getScene(),
        getCamera: () => getCamera(chartState),
        options: minimapOptions,
        moveCamera: (camera) => {
          const mainCanvas = canvas.node();
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
      });
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

    focusCamera = ({ genes = [], links = [] } = {}) => {
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
      for (const uid of genes) include(scene.genes.get(uid)?.bounds);
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
      const surface = useRaster ? canvas : svg;
      const node = surface.node();
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
      else if (zoom) svg.call(zoom.transform, transform);
      else setCamera(chartState, camera);
      return true;
    };

    if (useCanvas) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      canvasBackend.setScene(scene);
      scheduleMinimapBase(scene);
      animateCanvas(canvas.node(), scene, hasInitialView && animate);
    } else if (useWebGpu) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      if (committedScene && !annotationsOnly) {
        webgpuBackend.adoptScene(scene, committedScene.sourceScene, {
          scales: runtime.scales, config: runtime.renderConfig,
        });
      }
      scheduleMinimapBase(scene);
      const previousScene = webgpuBackend.pendingScene;
      animateWebGpu(canvas.node(), previousScene, scene, hasInitialView && animate);
    } else {
      const previousScene = svgBackend.pendingScene;
      svgBackend.setScene(scene);
      const request = {
        annotationsOnly,
        annotationViewport: hasInitialView ? worldViewport(getCamera(chartState), svg.node().getBoundingClientRect()) : null,
        plot,
        data,
        previousScene,
        previousTree: treeAnimation?.previousTree,
        previousTreeScene: treeAnimation?.previousScene,
        transition,
        animate: hasInitialView && animate,
        config: runtime.renderConfig,
        scales: runtime.scales,
        ids: runtime.ids,
        lookup: { gene: runtime.lookup.geneData },
        interactions: rendererInteractions,
        highlightGeneIds: highlightedGeneIds(),
        highlightLinkIds,
        highlightLocusIds: selectedLocusIds,
      };
      paintPreviewFrame = () => {
        updateFigureSurface();
        svgBackend.paint({ ...request, preview: scenePreview, animate: false });
      };
      svgBackend.paint(request);

      if (!hasInitialView) fitInitialView(svg, plot);
    }
    updateFigureSurface();
    if (runtime.config.annotations.enabled && currentData.clusters?.length) {
      annotationUiContext = {
        surfaces: [useRaster ? canvas.node() : svg.node()],
        getScene: () => runtime.getScene(), getPreview: () => scenePreview,
        getCamera: () => getCamera(chartState),
        isBusy: () => isDragging(chartState) || Boolean(canvasAnimation || webgpuAnimation),
        fontFamily: runtime.config.plot.fontFamily,
      };
      if (annotationOverlay) annotationOverlay.update(annotationUiContext);
      else if (!annotationUiLoad) {
        annotationUiLoad = import("./annotationOverlay.mjs").then(({ createAnnotationOverlay }) => {
          if (!annotationUiContext) return;
          annotationOverlay = createAnnotationOverlay({ container: container.node(), annotationApi: {
            ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, validateAnnotationPanels, resolveAnnotationScale,
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
    const bounds = canvasFigureBounds(measurementCanvas.getContext("2d"), scene, runtime.config, currentData.tree);
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
  my.rotateTreeNode = (uid) => { cancelTreePresentationPreview(); rotateTreeNode(uid); return my; };
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
  /** Selected locus IDs used for batch plot operations. */
  my.locusSelection = function (ids) {
    if (!arguments.length) return [...selectedLocusIds];
    const next = chartIndex
      ? new Set([...(ids || [])].map(locusForId).filter(Boolean).map((locus) => locus.uid))
      : new Set(ids || []);
    if (
      next.size === selectedLocusIds.size &&
      [...next].every((uid) => selectedLocusIds.has(uid))
    ) return my;
    selectedLocusIds = next;
    if (!next.size) locusSelectionAnchorUid = null;
    if (container && currentData) {
      if (isRasterRenderer(runtime.config.plot.renderer)) scheduleScenePaint();
      else redraw({ animate: false });
    }
    emitChange({ type: "loci.select", locusIds: [...selectedLocusIds] });
    return my;
  };
  /** Flip the supplied loci, or the current locus selection, as one operation. */
  my.flipLoci = function (ids = selectedLocusIds) {
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
  my.trimLoci = function (ids = selectedLocusIds) {
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
  my.restoreLoci = function (ids = selectedLocusIds) {
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
  /** Frame selected genes and/or links without changing their selection. */
  my.focus = function (ids) {
    const isScoped = ids && typeof ids === "object" && !Array.isArray(ids) && typeof ids[Symbol.iterator] !== "function";
    focusCamera({
      genes: isScoped ? ids.genes || [] : ids || [],
      links: isScoped ? ids.links || [] : [],
    });
    return my;
  };
  my.on = (type, listener) => {
    if (type !== "change") throw new TypeError(`Unsupported chart event: ${type}`);
    if (typeof listener !== "function") throw new TypeError("Chart event listeners must be functions.");
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  };
  /** Latest computed layout, excluding transient animation and drag geometry. */
  my.figureBounds = () => figureSurface.bounds(container?.node(), runtime.getScene(), runtime.renderConfig, currentData?.tree);
  my.exportSvg = ({ padding = 20 } = {}) => {
    flushCanvasFlip();
    return exportChartSvg({
      data: currentData,
      scene: runtime.getScene(),
      config: runtime.renderConfig,
      scales: runtime.scales,
      ids: runtime.ids,
      lookup: { gene: runtime.lookup.geneData },
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
    rotateTreeNode = () => {};
    disposeRasterInteraction();
    disposeRasterInteraction = () => {};
    disposeOverlay();
    disposeOverlay = () => {};
    retainedOverlay = null;
    clearScenePreview();
    canvasAnimation?.cancel();
    canvasAnimation = null;
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
    figureMeasurementContext = null;
    zoom = null;
    canvasZoom = null;
    hasInitialView = false;
    canvasHoverLocusUid = null;
    canvasScene = null;
    paintPreviewFrame = null;
    scheduleMinimapBase = () => {};
    prepareCanvasFlipBase = () => {};
    warmCanvasFlipBase = () => {};
    sceneCommit = null;
    chartIndex = null;
    highlightGeneIds.clear();
    highlightLinkIds.clear();
    selectedLocusIds.clear();
    changeListeners.clear();
    return my;
  };

  return my;
}
