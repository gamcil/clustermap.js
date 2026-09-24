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
  previewLocusTrim,
} from "./chartState.mjs";
import { createChartIndex } from "./data/index.mjs";
import { normalizeChartData } from "./data/normalize.mjs";
import { fitCameraForBounds } from "./camera.mjs";
import { createHtmlOverlay } from "./htmlOverlay.js";
import { createInteractionController } from "./interactionController.mjs";
import {
  canvasFigureBounds,
  canvasWorldPoint,
  hitTestCanvas,
  renderCanvas,
} from "./canvasRenderer.js";
import { createRasterMinimap } from "./rasterMinimap.mjs";
import { createRasterInteraction } from "./rasterInteraction.mjs";
import { createRasterMotion } from "./rasterMotion.mjs";
import {
  createClusterDragPreview,
  createLocusFlipPreview,
  createLocusOffsetPreview,
  createLocusTrimPreview,
} from "./scenePreview.mjs";
import { exportChartSvg } from "./svgExport.mjs";
import { createChartRuntime } from "./chartRuntime.js";
import { createCanvasBackend } from "./canvasBackend.mjs";
import { createSvgBackend } from "./svgBackend.mjs";
import { createWebGpuBackend } from "./webgpuBackend.mjs";
import {
  isCanvasRenderer,
  isRasterRenderer,
  isWebGpuRenderer,
} from "./rendererMode.mjs";

let nextChartInstance = 0;

export default function clusterMap() {
  /* A ClusterMap plot. */

  let container = null;
  let transition = d3.transition();
  let zoom = null;
  let canvasZoom = null;
  let hasInitialView = false;
  let chartState = null;
  let canvasHoverLocusUid = null;
  let canvasScene = null;
  let canvasAnimation = null;
  let rasterPreview = null;
  let canvasPreviewScene = null;
  let canvasFlipStaticCanvas = null;
  let canvasFlipLocusCanvas = null;
  let canvasFlipLocusFrame = null;
  let canvasFlipDirtyFrame = null;
  let canvasPreparedFlipBase = null;
  let canvasFlipWarmFrame = null;
  let rasterPaintFrame = null;
  let canvasFlipFrame = null;
  let canvasPendingFlip = null;
  let paintRasterFrame = null;
  let webgpuFlipFrame = null;
  let clusterCommitFrame = null;
  let webgpuClusterCommit = null;
  let webgpuAnchorCommit = null;
  let anchorSceneCommit = null;
  let scheduleMinimapBase = () => {};
  let prepareCanvasFlipBase = () => {};
  let warmCanvasFlipBase = () => {};
  let currentData = null;
  const runtime = createChartRuntime({ idPrefix: `chart-${nextChartInstance++}-` });
  const canvasBackend = createCanvasBackend();
  const svgBackend = createSvgBackend();
  const webgpuBackend = createWebGpuBackend();
  const rasterMinimap = createRasterMinimap();
  const rasterMotion = createRasterMotion({
    schedulePaint: () => scheduleRasterPaint(),
    getCamera: () => getCamera(chartState),
    getRenderer: () => runtime.config.plot.renderer,
  });
  runtime.gene.setBeforeAnchorUpdate(({ changes, flippedLoci }) => {
    const sourceScene = runtime.scene.get();
    // Anchoring changes cluster origins and, when strands disagree, a small
    // set of loci. The scene patch retains everything else for every backend.
    if (!sourceScene || (!changes.length && !flippedLoci.size)) return;
    anchorSceneCommit = { sourceScene, changes, flippedLoci };
    if (!isWebGpuRenderer(runtime.config.plot.renderer)) return;
    const offsets = new Map(
      changes
        .filter(({ offset }) => offset)
        .map(({ clusterUid, offset }) => [clusterUid, offset])
    );
    if (offsets.size || flippedLoci.size) {
      webgpuAnchorCommit = { sourceScene, offsets, flippedLoci };
    }
  });
  const interactionController = createInteractionController({
    clusterRows: () => runtime.scales.y.range(),
    getClusterOrder: () => getClusterOrder(chartState),
    getClusterPosition: (uid) => runtime.scene.get().clusters.get(uid).y,
    getLocusOffset: (uid) => getLocusOffset(chartState, uid),
    setDragging: (dragging) => setDragging(chartState, dragging),
    previewClusterDrag: (uid, position, order) => {
      if (clusterCommitFrame !== null) {
        cancelAnimationFrame(clusterCommitFrame);
        clusterCommitFrame = null;
      }
      setPreviewClusterPosition(chartState, uid, position);
      if (order) setPreviewClusterOrder(chartState, order);
      if (isRasterRenderer(runtime.config.plot.renderer) && runtime.scene.get()) {
        rasterPreview = createClusterDragPreview(runtime.scene.get(), {
          clusterUid: uid,
          position,
          order: getClusterOrder(chartState),
          rows: runtime.scales.y.range(),
        });
        scheduleRasterPreview();
        return;
      }
      runtime.plot.update({ animate: false });
    },
    commitClusterOrder: () => {
      const sourceScene = runtime.scene.get();
      const preview = rasterPreview?.type === "cluster-drag" ? rasterPreview : null;
      const order = [...getClusterOrder(chartState)];
      const rows = runtime.scales.y.range();
      commitPreviewClusterOrder(chartState);
      if (
        preview &&
        sourceScene &&
        isRasterRenderer(runtime.config.plot.renderer)
      ) {
        // Paint the destination row once before the committed projection runs.
        // This avoids a release-time blank/stale frame while a large chart is
        // rebuilding its authoritative scene and indexes.
        rasterPreview = createClusterDragPreview(sourceScene, {
          clusterUid: preview.clusterUid,
          position: rows[order.indexOf(preview.clusterUid)],
          order,
          rows,
        });
        if (isWebGpuRenderer(runtime.config.plot.renderer)) {
          webgpuClusterCommit = { sourceScene, preview: rasterPreview };
        }
        scheduleRasterPreview();
        if (clusterCommitFrame !== null) cancelAnimationFrame(clusterCommitFrame);
        clusterCommitFrame = requestAnimationFrame(() => {
          clusterCommitFrame = requestAnimationFrame(() => {
            clusterCommitFrame = null;
            clearRasterPreview();
            runtime.plot.update({ animate: false });
          });
        });
        return;
      }
      clearRasterPreview();
      runtime.plot.update({ animate: false });
    },
    previewLocusOffset: (uid, offset) => {
      setPreviewLocusOffset(chartState, uid, offset);
      if (isRasterRenderer(runtime.config.plot.renderer) && runtime.scene.get()) {
        rasterPreview = createLocusOffsetPreview(runtime.scene.get(), uid, offset, {
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleRasterPreview();
        return;
      }
      runtime.plot.update({ animate: false });
    },
    commitLocusOffset: (uid) => {
      commitPreviewLocusOffset(chartState, uid);
      clearRasterPreview();
      runtime.plot.update({ animate: false });
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
      if (isRasterRenderer(runtime.config.plot.renderer) && runtime.scene.get()) {
        // Updating scales is inexpensive and gives the sparse projection the
        // packed x offsets for this temporary locus state. Deliberately avoid
        // rebuilding data, indexes, or the complete scene until release.
        runtime.scale.update(currentData);
        rasterPreview = createLocusTrimPreview(runtime.scene.get(), locus.uid, result.state, {
          localXFor: runtime.scales.locus,
          scaleX: runtime.scales.x,
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleRasterPreview();
        return result;
      }
      runtime.plot.update({ animate: false, synchronize: false });
      return result;
    },
    commitLocusTrim: (locus) => {
      finalizeLocusTrim(chartState, locus);
      commitPreviewLocusState(chartState, locus);
      clearRasterPreview();
      runtime.plot.update({ animate: false });
    },
    flipLocus: (locus) => {
      // A second double-click while the GPU preview is in flight must not
      // mutate the source state underneath that preview.
      if (isWebGpuRenderer(runtime.config.plot.renderer) && webgpuFlipFrame !== null) return;
      flipLocus(chartState, locus);
      if (isCanvasRenderer(runtime.config.plot.renderer) && runtime.scene.get()) {
        if (canvasAnimation?.frame) cancelAnimationFrame(canvasAnimation.frame);
        canvasAnimation = null;
        if (canvasFlipFrame !== null) cancelAnimationFrame(canvasFlipFrame);
        const previewProgress = 0.12;
        const sourceScene = canvasScene || runtime.scene.get();
        const pending = createCanvasFlipPending(locus, sourceScene);
        canvasPendingFlip = pending;
        canvasPreviewScene = sourceScene;
        rasterPreview = createLocusFlipPreview(sourceScene, locus.uid, {
          scaleX: runtime.scales.x,
          progress: previewProgress,
        });
        scheduleRasterPreview();
        // The first preview frame is retained-scene geometry plus a reflection
        // patch. Only after it has painted do we project the changed locus and
        // its incident links; the animation never interpolates every record.
        // rAF callbacks all run before the browser presents a frame. Queue the
        // expensive layer preparation from a *second* rAF so the initial
        // retained-scene preview above is actually visible immediately rather
        // than being held behind cache construction.
        canvasFlipFrame = requestAnimationFrame(() => {
          if (canvasPendingFlip !== pending) return;
          canvasFlipFrame = requestAnimationFrame(() => startCanvasFlip(pending, previewProgress));
        });
        return;
      }
      if (isWebGpuRenderer(runtime.config.plot.renderer) && runtime.scene.get()) {
        if (webgpuFlipFrame !== null) return;
        const sourceScene = runtime.scene.get();
        const duration = runtime.config.plot.transitionDuration;
        const finish = () => {
          runtime.synchronizeLocusLayoutState(locus);
          webgpuBackend.setScene(runtime.scene.patchFlippedLocus(sourceScene, locus));
          rasterPreview = null;
          webgpuFlipFrame = null;
          scheduleRasterPaint();
        };
        if (!duration) {
          finish();
          return;
        }
        const startedAt = performance.now();
        const frame = (now) => {
          const elapsed = Math.min(1, (now - startedAt) / duration);
          const eased = elapsed < 0.5
            ? 4 * elapsed * elapsed * elapsed
            : 1 - Math.pow(-2 * elapsed + 2, 3) / 2;
          rasterPreview = createLocusFlipPreview(sourceScene, locus.uid, {
            scaleX: runtime.scales.x,
            progress: eased,
          });
          webgpuBackend.setScene(sourceScene);
          scheduleRasterPaint();
          if (elapsed < 1) {
            webgpuFlipFrame = requestAnimationFrame(frame);
            return;
          }
          finish();
        };
        webgpuFlipFrame = requestAnimationFrame(frame);
        return;
      }
      runtime.plot.update();
    },
  });

  // Internal state actions redraw the retained normalized data. Only an
  // external selection/data call enters the normalization and indexing path.
  runtime.plot.update = (options) => redraw(options);
  runtime.plot.data = (data) => my.data(data);

  function clearRasterPreview() {
    if (rasterPaintFrame !== null) cancelAnimationFrame(rasterPaintFrame);
    if (canvasFlipFrame !== null) cancelAnimationFrame(canvasFlipFrame);
    if (webgpuFlipFrame !== null) cancelAnimationFrame(webgpuFlipFrame);
    if (clusterCommitFrame !== null) cancelAnimationFrame(clusterCommitFrame);
    rasterPreview = null;
    canvasPreviewScene = null;
    clearCanvasFlipBase();
    canvasPreparedFlipBase = null;
    if (canvasFlipWarmFrame !== null) cancelAnimationFrame(canvasFlipWarmFrame);
    canvasFlipWarmFrame = null;
    rasterPaintFrame = null;
    canvasFlipFrame = null;
    canvasPendingFlip = null;
    webgpuFlipFrame = null;
    clusterCommitFrame = null;
  }

  function flushCanvasFlip() {
    const pending = canvasPendingFlip;
    if (!pending) return;
    if (canvasFlipFrame !== null) cancelAnimationFrame(canvasFlipFrame);
    canvasFlipFrame = null;
    if (!pending.targetScene) {
      runtime.synchronizeLocusLayoutState(pending.locus);
      pending.targetScene = runtime.scene.patchFlippedLocus(pending.sourceScene, pending.locus);
    }
    canvasScene = pending.targetScene;
    rasterPreview = null;
    canvasPreviewScene = null;
    canvasPendingFlip = null;
    clearCanvasFlipBase();
    canvasPreparedFlipBase = null;
  }

  function startCanvasFlip(pending, initialProgress) {
    if (canvasPendingFlip !== pending) return;
    canvasFlipFrame = null;
    runtime.synchronizeLocusLayoutState(pending.locus);
    pending.targetScene = runtime.scene.patchFlippedLocus(pending.sourceScene, pending.locus);
    prepareCanvasFlipBase(pending);
    // Restore and repaint the affected canvas region before the browser can
    // present a frame. The base image stays offscreen; the visible plot stays
    // a single canvas throughout the animation.
    paintRasterFrame?.();
    const duration = runtime.config.plot.transitionDuration;
    if (!duration) {
      canvasScene = pending.targetScene;
      rasterPreview = null;
      canvasPreviewScene = null;
      canvasPendingFlip = null;
      paintRasterFrame?.();
      clearCanvasFlipBase();
      canvasPreparedFlipBase = null;
      scheduleRasterPaint();
      scheduleMinimapBase(canvasScene);
      return;
    }
    const startedAt = performance.now();
    const frame = (now) => {
      if (canvasPendingFlip !== pending) return;
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = elapsed < 0.5
        ? 4 * elapsed * elapsed * elapsed
        : 1 - Math.pow(-2 * elapsed + 2, 3) / 2;
      rasterPreview = createLocusFlipPreview(pending.sourceScene, pending.locus.uid, {
        scaleX: runtime.scales.x,
        progress: initialProgress + (1 - initialProgress) * eased,
      });
      // The dirty region is bounded to the affected locus and its incident
      // links, so paint it in this rAF rather than one frame later. Links and
      // genes are drawn together in normal renderer order.
      if (rasterPaintFrame !== null) cancelAnimationFrame(rasterPaintFrame);
      rasterPaintFrame = null;
      paintRasterFrame?.();
      if (elapsed < 1) {
        canvasFlipFrame = requestAnimationFrame(frame);
        return;
      }
      canvasFlipFrame = null;
      rasterPreview = null;
      canvasPreviewScene = null;
      canvasPendingFlip = null;
      canvasScene = pending.targetScene;
      // Replace the final preview with the complete target scene.
      paintRasterFrame?.();
      clearCanvasFlipBase();
      canvasPreparedFlipBase = null;
      scheduleRasterPaint();
      scheduleMinimapBase(canvasScene);
    };
    canvasFlipFrame = requestAnimationFrame(frame);
  }

  function scheduleRasterPaint() {
    if (rasterPaintFrame !== null || !paintRasterFrame) return;
    rasterPaintFrame = requestAnimationFrame(() => {
      rasterPaintFrame = null;
      paintRasterFrame();
    });
  }

  const scheduleRasterPreview = scheduleRasterPaint;

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
      for (const link of runtime.get.linksForGene(gene.uid)) {
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

  function my(selection, options) {
    selection.each(function (data) {
      container = d3.select(this).attr("width", "100%").attr("height", "100%");
      loadData(data);
      redraw(options);
    });
  }

  function loadData(data) {
    currentData = normalizeChartData(data);
    const chartIndex = createChartIndex(currentData);
    chartState = createChartState(currentData, chartState);
    runtime.setChartIndex(chartIndex);
    runtime.setChartState(chartState);
  }

  function redraw({ animate = true, synchronize = true } = {}) {
    if (!currentData || !container) return;
    const data = currentData;
    if (canvasFlipWarmFrame !== null) cancelAnimationFrame(canvasFlipWarmFrame);
    canvasFlipWarmFrame = null;
    canvasPreparedFlipBase = null;

    // Set up the shared transition
    transition = d3.transition().duration(runtime.config.plot.transitionDuration);
    const useCanvas = isCanvasRenderer(runtime.config.plot.renderer);
    const useWebGpu = isWebGpuRenderer(runtime.config.plot.renderer);
    const useRaster = isRasterRenderer(runtime.config.plot.renderer);
    if (!useWebGpu && webgpuBackend.hasResources()) {
      // A renderer owns the WebGPU context for its canvas. Dispose it before
      // the chart changes backend, and invalidate any async setup that might
      // otherwise resolve after that canvas has been removed.
      webgpuBackend.destroy();
      webgpuClusterCommit = null;
      webgpuAnchorCommit = null;
      anchorSceneCommit = null;
    }
    if (!useCanvas) canvasBackend.destroy();
    if (useRaster) svgBackend.destroy();
    const minimapOptions = runtime.config.plot.minimap || {};
    // The overview is a separate 2D canvas, so it works for both raster
    // backends. WebGPU owns only the main plot surface.
    const showMinimap = useRaster && minimapOptions.show;
    if (!useCanvas) clearRasterPreview();
    if (!showMinimap) rasterMinimap.clear();

    // Build the figure
    const svg = container
      .selectAll("svg.clusterMap")
      .data([data])
      .join(
        (enter) => {
          // Add HTML colour picker input
          enter
            .append("input")
            .attr("id", runtime.ids.picker)
            .attr("class", "colourPicker")
            .attr("type", "color")
            .style("position", "absolute")
            .style("opacity", 0);

          // Add tooltip element
          enter
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("z-index", 1)
            .style("box-sizing", "border-box")
            .style("padding", "8px")
            .style("background", "white")
            .style("border", "1px solid #999")
            .style("border-radius", "4px")
            .style("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.2)")
            .style("font-family", runtime.config.plot.fontFamily);

          // Add root SVG element
          let svg = enter
            .append("svg")
            .attr("class", "clusterMap")
            .attr("id", runtime.ids.root)
            .attr("cursor", "grab")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

          let defs = svg.append("defs");
          let filter = defs
            .append("filter")
            .attr("id", runtime.ids.filter)
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 1)
            .attr("height", 1);
          filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
          filter
            .append("feComposite")
            .attr("in", "SourceGraphic")
            .attr("in2", "");

          // Keep the viewport transform separate from the chart content. Layout
          // and fit-to-view measure `clusterMapG` in world coordinates, while
          // zoom/pan only transform this outer viewport group.
          const viewport = svg.append("g").attr("class", "clusterMapViewport");
          const g = viewport.append("g").attr("class", "clusterMapG");

          // Attach pan/zoom behaviour
          zoom = d3
            .zoom()
            .scaleExtent(zoomExtent())
            .on("zoom", (event) => {
              setCamera(chartState, event.transform);
              applyCamera(viewport);
            })
            .on("start", () => svg.attr("cursor", "grabbing"))
            .on("end", () => svg.attr("cursor", "grab"));
          svg.call(zoom).on("dblclick.zoom", null);

          return svg;
        }
      );

    const plot = svg.select("g.clusterMapG");
    if (zoom) zoom.scaleExtent(zoomExtent());
    // A canvas cannot change from a 2D to a WebGPU context in place.
    container
      .selectAll("canvas.clusterMapCanvas")
      .filter(function () { return this.dataset.renderer && this.dataset.renderer !== runtime.config.plot.renderer; })
      .remove();
    const canvas = container
      .selectAll("canvas.clusterMapCanvas")
      .data(useRaster ? [data] : [])
      .join((enter) => {
        const surface = enter
          .append("canvas")
          .attr("class", "clusterMapCanvas")
          .attr("cursor", "grab")
          .attr("tabindex", 0)
          .attr("aria-label", "Cluster map")
          .style("display", "block")
          .style("width", "100%")
          .style("height", "100%")
          .style("outline", "none");
        canvasZoom = d3
          .zoom()
          .scaleExtent(zoomExtent())
          .on("zoom", function (event) {
            setCamera(chartState, event.transform);
            scheduleRasterPaint();
          })
          .on("start", function () {
            rasterMotion.begin();
            d3.select(this).style("cursor", "grabbing");
          })
          .on("end", function () {
            d3.select(this).style("cursor", "grab");
            rasterMotion.end();
          });
        surface.call(canvasZoom).on("dblclick.zoom", null);
        return surface;
      })
      .attr("data-renderer", runtime.config.plot.renderer);
    if (useWebGpu) {
      canvas.attr("data-webgpu", function () { return this.dataset.webgpu || "initializing"; });
    } else {
      canvas.attr("data-webgpu", null);
    }
    if (canvasZoom) canvasZoom.scaleExtent(zoomExtent());
    if (useWebGpu && globalThis.getComputedStyle(container.node()).position === "static") {
      container.style("position", "relative");
    }
    const webgpuOverlay = container
      .selectAll("canvas.clusterMapWebGpuOverlay")
      .data(useWebGpu ? [data] : [])
      .join((enter) =>
        enter
          .append("canvas")
          .attr("class", "clusterMapWebGpuOverlay")
          .style("position", "absolute")
          .style("inset", "0")
          .style("display", "block")
          .style("width", "100%")
          .style("height", "100%")
          .style("pointer-events", "none")
      );
    if (showMinimap && globalThis.getComputedStyle(container.node()).position === "static") {
      container.style("position", "relative");
    }
    const minimap = container
      .selectAll("canvas.clusterMapMinimap")
      .data(showMinimap ? [data] : [])
      .join((enter) =>
        enter
          .append("canvas")
          .attr("class", "clusterMapMinimap")
          .attr("aria-label", "Cluster map overview")
          .style("position", "absolute")
          .style("z-index", 2)
          .style("display", "block")
          .style("box-sizing", "border-box")
          .style("background", "white")
          .style("box-shadow", "0 1px 4px rgba(0, 0, 0, 0.25)")
          .style("cursor", "grab")
          .style("touch-action", "none")
      );
    minimap
      .style("width", showMinimap ? `${minimapOptions.width}px` : null)
      .style("height", showMinimap ? `${minimapOptions.height}px` : null)
      .style("right", showMinimap ? `${minimapOptions.margin}px` : null)
      .style("bottom", showMinimap ? `${minimapOptions.margin}px` : null);
    svg.style("display", useRaster ? "none" : null);
    const overlay = createHtmlOverlay({
      tooltip: container.select("div.tooltip"),
      scales: runtime.scales,
      actions: {
        redraw: (options) => runtime.plot.update(options),
        anchorGene: (gene) => runtime.gene.anchor(null, gene, true),
        getGroups: () => data.groups,
        setGroups: (groups) => {
          data.groups = groups;
          runtime.plot.update();
        },
      },
    });
    container
      .select("div.tooltip")
      .on("mouseenter", overlay.enter)
      .on("mouseleave", overlay.leave);
    const paintCanvas = (canvasNode) => {
      const flipLayer =
        rasterPreview?.type === "locus-flip" &&
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
          camera: getCamera(chartState),
          // Keep the normal filled-ribbon appearance throughout the flip.
          config: {
            ...runtime.config,
            link: {
              ...runtime.config.link,
              asLine: false,
              label: { ...runtime.config.link.label, show: false },
            },
          },
          scales: runtime.scales,
          pixelRatio: rasterMotion.pixelRatio(),
          preview: rasterPreview,
          include: { links: canvasPendingFlip.dynamic.links },
          showLoci: false,
          showGenes: false,
          showClusterLabels: false,
          showChrome: false,
          suppressLocusHover: true,
          clear: false,
        });
        drawCanvasFlipLocus(
          canvasNode,
          canvasFlipLocusCanvas,
          canvasFlipLocusFrame,
          canvasFlipDirtyFrame,
          rasterPreview,
          rasterMotion.pixelRatio()
        );
        const stationaryGenes = new Set(canvasPendingFlip.dynamic.genes);
        for (const uid of canvasPendingFlip.locusRecords.genes) stationaryGenes.delete(uid);
        if (stationaryGenes.size) {
          renderCanvas({
            canvas: canvasNode,
            scene: canvasPreviewScene,
            camera: getCamera(chartState),
            config: runtime.config,
            scales: runtime.scales,
            pixelRatio: rasterMotion.pixelRatio(),
            include: { genes: stationaryGenes },
            showLinks: false,
            showLoci: false,
            showClusterLabels: false,
            showChrome: false,
            suppressLocusHover: true,
            clear: false,
          });
        }
        paintMinimap();
        return canvasFlipDirtyFrame;
      }
      const result = canvasBackend.paint({
        canvas: canvasNode,
        scene:
          canvasAnimation?.scene ||
          canvasPreviewScene ||
          canvasBackend.pendingScene ||
          runtime.scene.get(),
        previousScene: canvasAnimation?.previousScene,
        progress: canvasAnimation?.progress,
        camera: getCamera(chartState),
        config: runtime.config,
        scales: runtime.scales,
        hoverLocusUid: canvasHoverLocusUid,
        suppressLocusHover:
          rasterPreview?.type === "locus-flip" || Boolean(canvasAnimation?.suppressLocusHover),
        pixelRatio: rasterMotion.pixelRatio(),
        preview: rasterPreview,
      });
      paintMinimap();
      return result;
    };
    const paintWebGpu = (canvasNode, scene) => {
      if (!canvasNode || !scene) return;
      const overlayNode = webgpuOverlay.node();
      if (overlayNode) {
        renderCanvas({
          canvas: overlayNode,
          scene,
          camera: getCamera(chartState),
          config: runtime.config,
          scales: runtime.scales,
          hoverLocusUid: canvasHoverLocusUid,
          suppressLocusHover: rasterPreview?.type === "locus-flip",
          pixelRatio: rasterMotion.pixelRatio(),
          preview: rasterPreview,
          showLinks: false,
          showLocusTracks: false,
          showGenes: false,
        });
      }
      const bounds = canvasNode.getBoundingClientRect();
      webgpuBackend.paint({
        canvas: canvasNode,
        scene,
        preview: rasterPreview,
        camera: getCamera(chartState),
        scales: runtime.scales,
        config: runtime.config,
        width: bounds.width,
        height: bounds.height,
        pixelRatio: rasterMotion.pixelRatio(),
        onUnavailable: () => paintCanvas(webgpuOverlay.node()),
      });
      paintMinimap();
    };
    paintRasterFrame = useCanvas
      ? () => paintCanvas(canvas.node())
      : useWebGpu
        ? () => paintWebGpu(canvas.node(), webgpuBackend.pendingScene || runtime.scene.get())
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
        camera: getCamera(chartState),
        config: runtime.config,
        scales: runtime.scales,
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
        showLoci: false,
        showGenes: false,
        showClusterLabels: false,
        showChrome: false,
      });
      renderCanvas({
        canvas: baseCanvas,
        ...renderOptions,
        omit: { loci: pending.dynamic.loci, genes: pending.dynamic.genes },
        showLinks: false,
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
        camera: { ...camera, x: camera.x - frame.x, y: camera.y - frame.y },
        config: {
          ...runtime.config,
          gene: {
            ...runtime.config.gene,
            // A reflected bitmap would mirror glyphs. The normal target scene
            // redraw restores labels at the end of the brief animation.
            label: { ...runtime.config.gene.label, show: false },
          },
        },
        scales: runtime.scales,
        dimensions: frame,
        pixelRatio,
        include: pending.locusRecords,
        showLinks: false,
        showClusterLabels: false,
        showChrome: false,
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
        const locus = runtime.get.locusData(locusUid);
        const sourceScene = canvasScene || runtime.scene.get();
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
    const paintMinimap = () => {
      rasterMinimap.paint({
        minimap: minimap.node(),
        surface: canvas.node(),
        scene: runtime.scene.get(),
        options: minimapOptions,
        camera: getCamera(chartState),
        pixelRatio: globalThis.devicePixelRatio || 1,
      });
    };
    scheduleMinimapBase = (scene) => {
      if (!showMinimap) return;
      rasterMinimap.scheduleBase({
        scene,
        minimap: minimap.node(),
        options: minimapOptions,
        renderBase: ({ canvas: baseCanvas, scene: overviewScene, projection }) => {
          renderCanvas({
            canvas: baseCanvas,
            // A full ribbon overview becomes an opaque field for dense maps.
            // Keep the structured, coloured gene raster by default; callers
            // can opt links back in for sparse figures.
            scene: {
              ...overviewScene,
              chrome: null,
              links: minimapOptions.showLinks ? overviewScene.links : new Map(),
            },
            camera: { x: projection.x, y: projection.y, k: projection.scale },
            config: {
              ...runtime.config,
              gene: {
                ...runtime.config.gene,
                label: { ...runtime.config.gene.label, show: false },
              },
            },
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
      if (canvasAnimation?.frame) cancelAnimationFrame(canvasAnimation.frame);
      canvasAnimation = null;
    };
    const animateCanvas = (canvasNode, scene, animate) => {
      stopCanvasAnimation();
      if (!animate || !canvasScene || !runtime.config.plot.transitionDuration) {
        canvasScene = scene;
        paintCanvas(canvasNode);
        return;
      }
      const previousScene = canvasScene;
      const duration = runtime.config.plot.transitionDuration;
      const initialProgress = 0;
      const suppressLocusHover = false;
      const startedAt = performance.now();
      const frame = (now) => {
        const elapsed = Math.min(1, (now - startedAt) / duration);
        // Matches D3's default cubic-in-out transition closely enough that
        // the two renderers retain the same interaction feel.
        const eased =
          elapsed < 0.5
            ? 4 * elapsed * elapsed * elapsed
            : 1 - Math.pow(-2 * elapsed + 2, 3) / 2;
        const progress = initialProgress + (1 - initialProgress) * eased;
        canvasAnimation = { previousScene, scene, progress, frame: null, suppressLocusHover };
        paintCanvas(canvasNode);
        if (elapsed < 1) {
          canvasAnimation.frame = requestAnimationFrame(frame);
        } else {
          canvasAnimation = null;
          canvasScene = scene;
          // The final animation frame intentionally hid the stale hover
          // affordance. Repaint once with the settled scene so it returns
          // when the pointer is still over the locus.
          paintCanvas(canvasNode);
        }
      };
      canvasAnimation = { previousScene, scene, progress: 0, frame: requestAnimationFrame(frame) };
    };
    const chooseLegendColour = (group) => {
      const picker = container.select("input.colourPicker");
      picker.on("change", () => {
        group.colour = picker.node().value;
        runtime.plot.update();
      });
      picker.node().click();
    };
    const setScaleBarLength = (providedValue) => {
      const value =
        providedValue ?? prompt("Enter new length (bp):", runtime.config.scaleBar.basePair);
      if (!value) return;
      runtime.config.scaleBar.basePair = value;
      runtime.plot.update();
    };
    // Both renderers delegate mutations to the same controller. Raster input
    // adapts stable IDs back to source records at its boundary; SVG already
    // receives those records through its D3 joins.
    const rendererInteractions = {
      isDragging: () => isDragging(chartState),
      beginClusterDrag: interactionController.beginClusterDrag,
      moveClusterDrag: interactionController.moveClusterDrag,
      endClusterDrag: interactionController.endClusterDrag,
      cancelClusterDrag: interactionController.cancelClusterDrag,
      beginLocusDrag: interactionController.beginLocusDrag,
      moveLocusDrag: interactionController.moveLocusDrag,
      endLocusDrag: interactionController.endLocusDrag,
      cancelLocusDrag: interactionController.cancelLocusDrag,
      beginLocusTrim: interactionController.beginLocusTrim,
      moveLocusTrim: interactionController.moveLocusTrim,
      endLocusTrim: interactionController.endLocusTrim,
      cancelLocusTrim: interactionController.cancelLocusTrim,
      flipLocus: interactionController.flipLocus,
      onGeneClick: runtime.config.gene.shape.onClick,
      showGeneMenu: overlay.showGeneMenu,
      showGroupMenu: overlay.showGroupMenu,
      setScaleBarLength,
      chooseLegendColour,
    };
    if (useRaster) {
      const targetForEvent = (canvasNode, event) =>
        hitTestCanvas({
          // A canvas can only have one rendering context. WebGPU owns the
          // visible surface, so use its transparent 2D text/chrome overlay
          // for the metric-dependent portions of hit testing instead.
          canvas: useWebGpu ? webgpuOverlay.node() : canvasNode,
          scene: runtime.scene.get(),
          camera: getCamera(chartState),
          config: runtime.config,
          event,
        });
      const locusForTarget = (target) =>
        target?.locusUid || runtime.get.geneData(target?.geneUid)?.locusUid || null;
      const rasterInteraction = createRasterInteraction({
        targetForEvent,
        worldPoint: (surface, event) =>
          canvasWorldPoint(surface, event, getCamera(chartState)),
        locusForTarget,
        setHoverLocus: (locusUid) => {
          if (canvasHoverLocusUid === locusUid) return false;
          canvasHoverLocusUid = locusUid;
          scheduleRasterPaint();
          return true;
        },
        warmLocus: useCanvas ? warmCanvasFlipBase : () => {},
        beginMotion: rasterMotion.begin,
        endMotion: rasterMotion.end,
        setCursor: (surface, cursor) => d3.select(surface).style("cursor", cursor),
        interactions: {
          beginClusterDrag: rendererInteractions.beginClusterDrag,
          moveClusterDrag: rendererInteractions.moveClusterDrag,
          endClusterDrag: rendererInteractions.endClusterDrag,
          cancelClusterDrag: rendererInteractions.cancelClusterDrag,
          beginLocusDrag: rendererInteractions.beginLocusDrag,
          moveLocusDrag: rendererInteractions.moveLocusDrag,
          endLocusDrag: rendererInteractions.endLocusDrag,
          cancelLocusDrag: rendererInteractions.cancelLocusDrag,
          beginLocusTrim: rendererInteractions.beginLocusTrim,
          moveLocusTrim: (locusUid, edge, x) =>
            rendererInteractions.moveLocusTrim(runtime.get.locusData(locusUid), edge, x),
          endLocusTrim: (locusUid) =>
            rendererInteractions.endLocusTrim(runtime.get.locusData(locusUid)),
          cancelLocusTrim: rendererInteractions.cancelLocusTrim,
        },
        actions: {
          geneClick: (event, geneUid) =>
            rendererInteractions.onGeneClick?.(event, runtime.get.geneData(geneUid)),
          legendColour: (event, group) => {
            if (runtime.config.legend.onClickCircle) {
              runtime.config.legend.onClickCircle(event, group);
            } else {
              rendererInteractions.chooseLegendColour(group);
            }
          },
          legendText: (event, group) => runtime.config.legend.onClickText?.(event, group),
          scaleBar: rendererInteractions.setScaleBarLength,
          flipLocus: (locusUid) => rendererInteractions.flipLocus(runtime.get.locusData(locusUid)),
          geneMenu: (event, geneUid) =>
            rendererInteractions.showGeneMenu(event, runtime.get.geneData(geneUid)),
          legendMenu: (event, group) => {
            const handler = runtime.config.legend.onAltClickText || rendererInteractions.showGroupMenu;
            handler(event, group);
          },
        },
      });
      canvasZoom.filter(function (event) {
        return rasterInteraction.zoomFilter(this, event);
      });
      rasterInteraction.bind(canvas);

      let minimapGesture = false;
      const moveCameraFromMinimap = (minimapNode, event) => {
        const mainCanvas = canvas.node();
        const camera = rasterMinimap.cameraForPointer({
          event,
          minimap: minimapNode,
          surface: mainCanvas,
          scene: runtime.scene.get(),
          options: minimapOptions,
          camera: getCamera(chartState),
        });
        if (!camera || !mainCanvas) return;
        // Go through D3 rather than mutating its private __zoom state. This
        // keeps the next wheel/pan gesture continuous with minimap navigation.
        d3.select(mainCanvas).call(
          canvasZoom.transform,
          d3.zoomIdentity.translate(camera.x, camera.y).scale(camera.k)
        );
        paintMinimap();
      };
      minimap
        .on("pointerdown.minimap", function (event) {
          if (event.button) return;
          minimapGesture = true;
          rasterMotion.begin();
          this.setPointerCapture(event.pointerId);
          d3.select(this).style("cursor", "grabbing");
          moveCameraFromMinimap(this, event);
          event.preventDefault();
        })
        .on("pointermove.minimap", function (event) {
          if (!minimapGesture) return;
          moveCameraFromMinimap(this, event);
          event.preventDefault();
        })
        .on("pointerup.minimap pointercancel.minimap", function (event) {
          if (!minimapGesture) return;
          minimapGesture = false;
          if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
          d3.select(this).style("cursor", "grab");
          rasterMotion.end();
        });
    }
    applyCamera(svg.select("g.clusterMapViewport"));

    runtime.scale.update(data);
    if (synchronize) runtime.synchronizeLocusLayoutStates(data);

    // Only disable grouping if explicitly defined false
    if (data.config && data.config.updateGroups === false) {
      if (!data.groups) data.groups = [];
    } else {
      data.groups = createLinkGroups(data.links, data.groups);
    }

    runtime.link.updateGroups(data.groups);

    const committedAnchor = anchorSceneCommit;
    anchorSceneCommit = null;
    const scene = committedAnchor
      ? runtime.scene.patchGeneAnchor(
          committedAnchor.sourceScene,
          committedAnchor.changes,
          committedAnchor.flippedLoci
        )
      : runtime.scene.build(data);

    if (useCanvas) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      canvasBackend.setScene(scene);
      scheduleMinimapBase(scene);
      animateCanvas(canvas.node(), scene, hasInitialView && animate);
    } else if (useWebGpu) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      if (webgpuClusterCommit) {
        webgpuBackend.adoptClusterOrder(
          scene,
          webgpuClusterCommit.sourceScene,
          webgpuClusterCommit.preview
        );
        webgpuClusterCommit = null;
      }
      if (webgpuAnchorCommit) {
        webgpuBackend.adoptGeneAnchor(
          scene,
          webgpuAnchorCommit.sourceScene,
          webgpuAnchorCommit
        );
        webgpuAnchorCommit = null;
      }
      webgpuBackend.setScene(scene);
      scheduleMinimapBase(scene);
      paintWebGpu(canvas.node(), scene);
    } else {
      svgBackend.setScene(scene);
      svgBackend.paint({
        plot,
        data,
        transition,
        animate: hasInitialView && animate,
        config: runtime.config,
        scales: runtime.scales,
        ids: runtime.ids,
        lookup: { gene: runtime.get.geneData },
        interactions: rendererInteractions,
      });

      if (!hasInitialView) fitInitialView(svg, plot);
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

    svg.call(zoom.transform, d3.zoomIdentity.translate(camera.x, camera.y).scale(camera.k));
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
    const bounds = canvasFigureBounds(measurementCanvas.getContext("2d"), scene, runtime.config);
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
      d3.select(canvas).call(
        canvasZoom.transform,
        d3.zoomIdentity.translate(camera.x, camera.y).scale(camera.k)
      );
    } else {
      setCamera(chartState, camera);
    }
    hasInitialView = true;
  }

  function applyCamera(selection) {
    const { x, y, k } = getCamera(chartState);
    selection.attr("transform", `translate(${x}, ${y}) scale(${k})`);
  }

  my.config = function (_) {
    if (!arguments.length) return runtime.config;
    runtime.plot.updateConfig(_);
    return my;
  };
  my.data = (data) => {
    if (!data) return currentData;
    container.datum(data).call(my);
    return my;
  };
  my.exportSvg = ({ padding = 20 } = {}) => {
    flushCanvasFlip();
    return exportChartSvg({
      data: currentData,
      scene: runtime.scene.get(),
      config: runtime.config,
      scales: runtime.scales,
      ids: runtime.ids,
      lookup: { gene: runtime.get.geneData },
      padding,
    });
  };

  return my;
}
