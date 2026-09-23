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
import { createHtmlOverlay } from "./htmlOverlay.js";
import { createInteractionController } from "./interactionController.mjs";
import { canvasWorldPoint, hitTestCanvas, renderCanvas } from "./canvasRenderer.js";
import {
  createClusterDragPreview,
  createLocusFlipPreview,
  createLocusOffsetPreview,
  createLocusTrimPreview,
} from "./layout.mjs";
import { renderSvg } from "./svgRenderer.js";
import { createChartRuntime } from "./chartRuntime.js";

let nextChartInstance = 0;

export default function clusterMap() {
  /* A ClusterMap plot. */

  let container = null;
  let transition = d3.transition();
  let zoom = null;
  let canvasZoom = null;
  let hasInitialView = false;
  let chartState = null;
  let canvasGesture = null;
  let canvasHoverLocusUid = null;
  let canvasPanMode = false;
  let canvasScene = null;
  let canvasAnimation = null;
  let canvasPreview = null;
  let canvasPaintFrame = null;
  let canvasFlipBuildFrame = null;
  let canvasFlipAnimationProgress = null;
  let paintCanvasFrame = null;
  let currentData = null;
  const runtime = createChartRuntime({ idPrefix: `chart-${nextChartInstance++}-` });
  const interactionController = createInteractionController({
    clusterRows: () => runtime.scales.y.range(),
    getClusterOrder: () => getClusterOrder(chartState),
    getClusterPosition: (uid) => runtime.scene.get().clusters.get(uid).y,
    getLocusOffset: (uid) => getLocusOffset(chartState, uid),
    setDragging: (dragging) => setDragging(chartState, dragging),
    previewClusterDrag: (uid, position, order) => {
      setPreviewClusterPosition(chartState, uid, position);
      if (order) setPreviewClusterOrder(chartState, order);
      if (runtime.config.plot.renderer === "canvas" && runtime.scene.get()) {
        canvasPreview = createClusterDragPreview(runtime.scene.get(), {
          clusterUid: uid,
          position,
          order: getClusterOrder(chartState),
          rows: runtime.scales.y.range(),
        });
        scheduleCanvasPreview();
        return;
      }
      runtime.plot.update({ animate: false });
    },
    commitClusterOrder: () => {
      commitPreviewClusterOrder(chartState);
      clearCanvasPreview();
      runtime.plot.update({ animate: false });
    },
    previewLocusOffset: (uid, offset) => {
      setPreviewLocusOffset(chartState, uid, offset);
      if (runtime.config.plot.renderer === "canvas" && runtime.scene.get()) {
        canvasPreview = createLocusOffsetPreview(runtime.scene.get(), uid, offset, {
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleCanvasPreview();
        return;
      }
      runtime.plot.update({ animate: false });
    },
    commitLocusOffset: (uid) => {
      commitPreviewLocusOffset(chartState, uid);
      clearCanvasPreview();
      runtime.plot.update({ animate: false });
    },
    previewLocusTrim: (locus, edge, position) => {
      const result = previewLocusTrim(chartState, locus, {
        edge,
        position,
        coordinateFor: runtime.scales.x,
        scaleGenes: runtime.config.plot.scaleGenes,
      });
      if (runtime.config.plot.renderer === "canvas" && runtime.scene.get()) {
        // Updating scales is inexpensive and gives the sparse projection the
        // packed x offsets for this temporary locus state. Deliberately avoid
        // rebuilding data, indexes, or the complete scene until release.
        runtime.scale.update(currentData);
        canvasPreview = createLocusTrimPreview(runtime.scene.get(), locus.uid, result.state, {
          localXFor: runtime.scales.locus,
          scaleX: runtime.scales.x,
          alignLabels: runtime.config.cluster.alignLabels,
        });
        scheduleCanvasPreview();
        return result;
      }
      runtime.plot.update({ animate: false, synchronize: false });
      return result;
    },
    commitLocusTrim: (locus) => {
      finalizeLocusTrim(chartState, locus);
      commitPreviewLocusState(chartState, locus);
      clearCanvasPreview();
      runtime.plot.update({ animate: false });
    },
    flipLocus: (locus) => {
      flipLocus(chartState, locus);
      if (runtime.config.plot.renderer === "canvas" && runtime.scene.get()) {
        const previewProgress = 0.12;
        canvasPreview = createLocusFlipPreview(runtime.scene.get(), locus.uid, {
          scaleX: runtime.scales.x,
          progress: previewProgress,
        });
        canvasFlipAnimationProgress = previewProgress;
        scheduleCanvasPreview();
        if (canvasFlipBuildFrame !== null) cancelAnimationFrame(canvasFlipBuildFrame);
        // Schedule from an animation frame so the sparse preview is presented
        // before the committed scene build can occupy the main thread.
        canvasFlipBuildFrame = requestAnimationFrame(() => {
          canvasFlipBuildFrame = requestAnimationFrame(() => {
            canvasFlipBuildFrame = null;
            canvasPreview = null;
            runtime.plot.update();
          });
        });
        return;
      }
      runtime.plot.update();
    },
  });

  runtime.plot.update = (options) => container.call(my, options);
  runtime.plot.data = (data) => my.data(data);

  function clearCanvasPreview() {
    if (canvasPaintFrame !== null) cancelAnimationFrame(canvasPaintFrame);
    if (canvasFlipBuildFrame !== null) cancelAnimationFrame(canvasFlipBuildFrame);
    canvasPreview = null;
    canvasPaintFrame = null;
    canvasFlipBuildFrame = null;
    canvasFlipAnimationProgress = null;
  }

  function flushCanvasFlip() {
    if (canvasFlipBuildFrame === null) return;
    cancelAnimationFrame(canvasFlipBuildFrame);
    canvasFlipBuildFrame = null;
    canvasPreview = null;
    canvasFlipAnimationProgress = null;
    // An export is a synchronous view of the current state, not a snapshot of
    // an in-flight Canvas affordance. Build its authoritative scene now.
    runtime.plot.update({ animate: false });
  }

  function scheduleCanvasPaint() {
    if (canvasPaintFrame !== null || !paintCanvasFrame) return;
    canvasPaintFrame = requestAnimationFrame(() => {
      canvasPaintFrame = null;
      paintCanvasFrame();
    });
  }

  const scheduleCanvasPreview = scheduleCanvasPaint;

  function my(selection, options) {
    selection.each(function (data) {
      update.call(this, data, options);
    });
  }

  function update(data, { animate = true, synchronize = true } = {}) {
    data = normalizeChartData(data);
    currentData = data;
    const chartIndex = createChartIndex(data);
    chartState = createChartState(data, chartState);
    runtime.setChartIndex(chartIndex);
    runtime.setChartState(chartState);

    // Save the container for later updates
    container = d3.select(this).attr("width", "100%").attr("height", "100%");

    // Set up the shared transition
    transition = d3.transition().duration(runtime.config.plot.transitionDuration);
    const useCanvas = runtime.config.plot.renderer === "canvas";
    if (!useCanvas) clearCanvasPreview();

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
            .scaleExtent([0, 8])
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
    const canvas = container
      .selectAll("canvas.clusterMapCanvas")
      .data(useCanvas ? [data] : [])
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
          .scaleExtent([0, 8])
          .on("zoom", function (event) {
            setCamera(chartState, event.transform);
            scheduleCanvasPaint();
          })
          .on("start", function () {
            d3.select(this).style("cursor", "grabbing");
          })
          .on("end", function () {
            d3.select(this).style("cursor", "grab");
          });
        surface.call(canvasZoom).on("dblclick.zoom", null);
        return surface;
      });
    svg.style("display", useCanvas ? "none" : null);
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
    const paintCanvas = (canvasNode) =>
      renderCanvas({
        canvas: canvasNode,
        scene: canvasAnimation?.scene || runtime.scene.get(),
        previousScene: canvasAnimation?.previousScene,
        progress: canvasAnimation?.progress,
        camera: getCamera(chartState),
        config: runtime.config,
        scales: runtime.scales,
        hoverLocusUid: canvasHoverLocusUid,
        preview: canvasPreview,
      });
    paintCanvasFrame = useCanvas ? () => paintCanvas(canvas.node()) : null;
    const stopCanvasAnimation = () => {
      if (canvasAnimation?.frame) cancelAnimationFrame(canvasAnimation.frame);
      canvasAnimation = null;
    };
    const animateCanvas = (canvasNode, scene, animate) => {
      stopCanvasAnimation();
      if (!animate || !canvasScene || !runtime.config.plot.transitionDuration) {
        canvasFlipAnimationProgress = null;
        canvasScene = scene;
        paintCanvas(canvasNode);
        return;
      }
      const previousScene = canvasScene;
      const duration = runtime.config.plot.transitionDuration;
      const initialProgress = canvasFlipAnimationProgress ?? 0;
      canvasFlipAnimationProgress = null;
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
        canvasAnimation = { previousScene, scene, progress, frame: null };
        paintCanvas(canvasNode);
        if (elapsed < 1) {
          canvasAnimation.frame = requestAnimationFrame(frame);
        } else {
          canvasAnimation = null;
          canvasScene = scene;
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
    if (useCanvas) {
      const targetForEvent = (canvasNode, event) =>
        hitTestCanvas({
          canvas: canvasNode,
          scene: runtime.scene.get(),
          camera: getCamera(chartState),
          config: runtime.config,
          event,
        });
      const locusForTarget = (target) =>
        target?.locusUid || runtime.get.geneData(target?.geneUid)?.locusUid || null;
      const cursorForTarget = (target) => {
        if (!target) return "grab";
        if (target.action === "move-cluster") return "grab";
        if (target.action === "move-locus") return "move";
        if (target.action.startsWith("trim-locus")) return "ew-resize";
        return "pointer";
      };
      const updateCanvasAffordance = (canvasNode, target) => {
        const locusUid = locusForTarget(target);
        if (canvasHoverLocusUid !== locusUid) {
          canvasHoverLocusUid = locusUid;
          scheduleCanvasPaint();
        }
        d3.select(canvasNode).style("cursor", cursorForTarget(target));
      };
      canvasZoom.filter(function (event) {
        if (canvasPanMode) return event.type === "wheel" || event.button === 0;
        if (event.type === "wheel") return true;
        if (event.ctrlKey || event.button) return false;
        return !targetForEvent(this, event);
      });
      canvas
        .on("pointerenter.canvasKeyboard", function () {
          this.focus({ preventScroll: true });
        })
        .on("keydown.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          canvasPanMode = true;
          event.preventDefault();
          d3.select(this).style("cursor", "grab");
        })
        .on("keyup.canvasKeyboard", function (event) {
          if (event.code !== "Space") return;
          canvasPanMode = false;
          d3.select(this).style("cursor", "grab");
        })
        .on("blur.canvasKeyboard", function () {
          canvasPanMode = false;
        })
        .on("pointerdown.canvasInteraction", function (event) {
          if (canvasPanMode || event.button) return;
          const target = targetForEvent(this, event);
          if (!target) return;
          const point = canvasWorldPoint(this, event, getCamera(chartState));
          this.setPointerCapture(event.pointerId);
          updateCanvasAffordance(this, target);
          if (target.action === "move-cluster") {
            canvasGesture = { action: target.action, clusterUid: target.clusterUid };
            interactionController.beginClusterDrag(target.clusterUid, point.y);
          } else if (target.action === "move-locus") {
            canvasGesture = { action: target.action, locusUid: target.locusUid };
            interactionController.beginLocusDrag(target.locusUid, point.x);
          } else if (target.action.startsWith("trim-locus")) {
            canvasGesture = {
              action: target.action,
              locusUid: target.locusUid,
              edge: target.action.endsWith("left") ? "left" : "right",
            };
            interactionController.beginLocusTrim();
          } else if (target.action === "gene") {
            canvasGesture = { action: target.action, geneUid: target.geneUid };
          } else if (target.action === "legend-colour") {
            if (runtime.config.legend.onClickCircle) {
              runtime.config.legend.onClickCircle(event, target.group);
            } else {
              chooseLegendColour(target.group);
            }
          } else if (target.action === "legend-text") {
            runtime.config.legend.onClickText?.(event, target.group);
          } else if (target.action === "scale-bar") {
            setScaleBarLength();
          }
          event.preventDefault();
        })
        .on("pointermove.canvasInteraction", function (event) {
          if (canvasPanMode) return;
          if (!canvasGesture) {
            updateCanvasAffordance(this, targetForEvent(this, event));
            return;
          }
          const point = canvasWorldPoint(this, event, getCamera(chartState));
          if (canvasGesture.action === "move-cluster") {
            interactionController.moveClusterDrag(point.y);
          } else if (canvasGesture.action === "move-locus") {
            interactionController.moveLocusDrag(point.x);
          } else if (canvasGesture.edge) {
            interactionController.moveLocusTrim(
              runtime.get.locusData(canvasGesture.locusUid),
              canvasGesture.edge,
              point.x
            );
          }
        })
        .on("pointerleave.canvasInteraction", function () {
          if (!canvasGesture && !canvasPanMode) updateCanvasAffordance(this, null);
        })
        .on("pointerup.canvasInteraction pointercancel.canvasInteraction", function (event) {
          if (!canvasGesture) return;
          const gesture = canvasGesture;
          canvasGesture = null;
          if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
          if (gesture.action === "move-cluster") interactionController.endClusterDrag();
          else if (gesture.action === "move-locus") interactionController.endLocusDrag();
          else if (gesture.edge) {
            interactionController.endLocusTrim(runtime.get.locusData(gesture.locusUid));
          } else if (gesture.action === "gene" && runtime.config.gene.shape.onClick) {
            runtime.config.gene.shape.onClick(event, runtime.get.geneData(gesture.geneUid));
          }
          updateCanvasAffordance(this, targetForEvent(this, event));
        })
        .on("dblclick.canvasInteraction", function (event) {
          const target = targetForEvent(this, event);
          const locusUid = target?.locusUid || runtime.get.geneData(target?.geneUid)?.locusUid;
          if (locusUid) interactionController.flipLocus(runtime.get.locusData(locusUid));
        })
        .on("contextmenu.canvasInteraction", function (event) {
          const target = targetForEvent(this, event);
          if (target?.action === "gene") {
            event.preventDefault();
            overlay.showGeneMenu(event, runtime.get.geneData(target.geneUid));
          } else if (target?.action === "legend-text") {
            event.preventDefault();
            const handler = runtime.config.legend.onAltClickText || overlay.showGroupMenu;
            handler(event, target.group);
          }
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

    const scene = runtime.scene.build(data);

    if (useCanvas) {
      if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
      animateCanvas(canvas.node(), scene, hasInitialView && animate);
    } else {
      renderSvg({
        plot,
        data,
        scene,
        transition,
        animate: hasInitialView && animate,
        config: runtime.config,
        scales: runtime.scales,
        ids: runtime.ids,
        lookup: { gene: runtime.get.geneData },
        interactions: {
          isDragging: () => isDragging(chartState),
          beginClusterDrag: interactionController.beginClusterDrag,
          moveClusterDrag: interactionController.moveClusterDrag,
          endClusterDrag: interactionController.endClusterDrag,
          beginLocusDrag: interactionController.beginLocusDrag,
          moveLocusDrag: interactionController.moveLocusDrag,
          endLocusDrag: interactionController.endLocusDrag,
          beginLocusTrim: interactionController.beginLocusTrim,
          moveLocusTrim: interactionController.moveLocusTrim,
          endLocusTrim: interactionController.endLocusTrim,
          flipLocus: interactionController.flipLocus,
          onGeneClick: runtime.config.gene.shape.onClick,
          showGeneMenu: overlay.showGeneMenu,
          showGroupMenu: overlay.showGroupMenu,
          setScaleBarLength,
          chooseLegendColour,
        },
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

    const padding = 20;
    const scale = Math.min(
      1.2,
      (width - padding * 2) / bounds.width,
      (height - padding * 2) / bounds.height
    );
    const x = (width - bounds.width * scale) / 2 - bounds.x * scale;
    const y = (height - bounds.height * scale) / 2 - bounds.y * scale;

    svg.call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    hasInitialView = true;
  }

  function fitInitialCanvasView(canvas, scene) {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height || !scene.bounds) return;

    const context = canvas.getContext("2d");
    const bounds = { ...scene.bounds };
    const include = (x, y) => {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
    };
    const textWidth = (text, font) => {
      context.save();
      context.font = font;
      const measured = context.measureText(text).width;
      context.restore();
      return measured;
    };

    for (const cluster of scene.clusters.values()) {
      const anchorX = cluster.x + cluster.info.x;
      include(
        anchorX - textWidth(
          cluster.source.name,
          `bold ${runtime.config.cluster.nameFontSize}px ${runtime.config.plot.fontFamily}`
        ),
        cluster.y + 8
      );
      include(
        anchorX - textWidth(
          cluster.info.locusText,
          `${runtime.config.cluster.lociFontSize}px ${runtime.config.plot.fontFamily}`
        ),
        cluster.y + 24
      );
    }
    if (scene.chrome?.legend.visible) {
      const { legend } = scene.chrome;
      for (const item of legend.items) {
        include(
          legend.position.x + item.textX + textWidth(item.label, `${legend.fontSize}px ${legend.fontFamily}`),
          legend.position.y + item.y + legend.fontSize
        );
      }
    }
    if (scene.chrome?.scaleBar.visible) {
      const { scaleBar } = scene.chrome;
      include(scaleBar.position.x + scaleBar.length, scaleBar.position.y + scaleBar.height + 20);
    }
    if (scene.chrome?.colourBar.visible) {
      const { colourBar } = scene.chrome;
      include(colourBar.position.x + colourBar.width, colourBar.position.y + colourBar.height + 20);
    }

    const padding = 20;
    const fitScale = Math.min(
      1.2,
      (width - padding * 2) / (bounds.maxX - bounds.minX),
      (height - padding * 2) / (bounds.maxY - bounds.minY)
    );
    // A fit smaller than the default camera scale defeats Canvas culling and
    // leaves an impractically dense interaction surface. Keep a readable
    // scale in that case, showing the top-left of the figure (including the
    // cluster labels). Ordinary figures retain the existing fit-to-view.
    const cropped = fitScale < 1;
    const scale = cropped ? 1 : fitScale;
    const camera = {
      x: cropped
        ? padding - bounds.minX * scale
        : (width - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale,
      y: cropped
        ? padding - bounds.minY * scale
        : (height - (bounds.maxY - bounds.minY) * scale) / 2 - bounds.minY * scale,
      k: scale,
    };
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
    if (!data) return container.select("svg.clusterMap").datum();
    container.datum(data).call(my);
    return my;
  };
  my.exportSvg = ({ padding = 20 } = {}) => {
    flushCanvasFlip();
    const scene = runtime.scene.get();
    if (!scene) throw new Error("Cannot export an SVG before the chart has rendered.");
    const namespace = "http://www.w3.org/2000/svg";
    const svgNode = document.createElementNS(namespace, "svg");
    const defs = d3.select(svgNode).append("defs");
    const filter = defs
      .append("filter")
      .attr("id", "filter_solid")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 1)
      .attr("height", 1);
    filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
    filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "");
    const plot = d3.select(svgNode).append("g").attr("class", "clusterMapG");
    const exportIds = { ...runtime.ids, filter: "filter_solid", colourGradient: "colour-gradient" };
    const noop = () => {};
    renderSvg({
      plot,
      data: currentData,
      scene,
      transition: d3.transition().duration(0),
      animate: false,
      config: runtime.config,
      scales: runtime.scales,
      ids: exportIds,
      lookup: { gene: runtime.get.geneData },
      interactions: {
        isDragging: () => false,
        beginClusterDrag: noop,
        moveClusterDrag: noop,
        endClusterDrag: noop,
        beginLocusDrag: noop,
        moveLocusDrag: noop,
        endLocusDrag: noop,
        beginLocusTrim: noop,
        moveLocusTrim: noop,
        endLocusTrim: noop,
        flipLocus: noop,
        onGeneClick: null,
        showGeneMenu: noop,
        showGroupMenu: noop,
        setScaleBarLength: noop,
        chooseLegendColour: noop,
      },
    });
    // Event listeners are not serialized, and interaction-only hover handles
    // should not be included in a publication figure.
    plot.selectAll("g.hover").remove();

    d3.select(document.body)
      .append(() => svgNode)
      .style("position", "fixed")
      .style("visibility", "hidden")
      .style("pointer-events", "none");
    const bounds = plot.node().getBBox();
    svgNode.remove();
    svgNode.removeAttribute("style");
    svgNode.setAttribute(
      "viewBox",
      `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`
    );
    svgNode.setAttribute("width", bounds.width + padding * 2);
    svgNode.setAttribute("height", bounds.height + padding * 2);
    svgNode.setAttribute("xmlns", namespace);
    return new XMLSerializer().serializeToString(svgNode);
  };

  return my;
}
