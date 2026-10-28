import { select } from "d3-selection";
import { drag } from "d3-drag";
import { plotSelectionOptions } from "../interaction/controller.mjs";
import { linkColours } from "../links/style.mjs";
import { getLinkPath, getLinkLabelPosition, interpolateLinkAnchors, interpolateLinkOpacity } from "../links/layout.mjs";
import { renderSvgTree as renderTree } from "../tree/svg.mjs";
import { resolveTrimIndicatorStyle } from "../loci/trimIndicators.mjs";
import { renderSvgAnnotations } from "../annotations/render.mjs";
import { figureConfig } from "../ui/theme.mjs";
import { clusterLabelLayout } from "../scene/clusterLabels.mjs";

import {
  clusterLabelOffsetForPreview, clusterLabelTextForPreview, clusterOffsetForPreview,
  geneGeometryForPreview, genePolygonForPreview, geneVisibleForPreview,
  linkGeometryForPreview, locusGeometryForPreview, recordsForPreview,
} from "../scene/preview.mjs";

const previewStates = new WeakMap();

// Owns the D3 joins for chart-world SVG. The chart controller owns the SVG
// host, camera viewport, and interaction state that causes a redraw.
export function renderSvg({
  plot,
  data,
  scene,
  presentationOnly = false,
  annotationViewport = null,
  preview = null,
  previousScene = null,
  previousTree = null,
  previousTreeScene = null,
  transition,
  animate,
  config,
  scales,
  ids,
  interactions = {},
  highlightGeneIds = new Set(),
  highlightLinkIds = new Set(),
  highlightLocusIds = new Set(),
  highlightClusterIds = new Set(),
}) {
  config = figureConfig(config);
  plot.attr("fill", config.figureStyle.foreground);
  if (preview) return renderPreview({ plot, data, scene, preview, config, scales, ids, interactions,
    highlightGeneIds, highlightLocusIds, highlightClusterIds });
  previewStates.delete(plot.node());
  const renderPresentation = () => {
    renderChrome({ plot, chrome: scene.chrome, ids, interactions });
    renderSvgAnnotations(plot, scene, { transition, animate, viewport: annotationViewport });
    renderTree(plot, data.tree, scene, config, interactions, transition, animate, {
      previousTree, previousScene: previousTreeScene,
    });
  };
  if (presentationOnly) return renderPresentation();
  const linkGroup = plot
    .selectAll("g.links")
    .data([data])
    .join("g")
    .attr("class", "links");
  const clusterGroup = plot
    .selectAll("g.clusters")
    .data([data.clusters])
    .join("g")
    .attr("class", "clusters");
  const clusters = clusterGroup
    .selectAll("g.cluster")
    .data(data.clusters, (d) => d.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.cluster)
          .attr("class", "cluster");
        const info = enter
          .append("g")
          .attr("id", ids.clusterInfo)
          .attr("class", "clusterInfo")
          .attr("transform", "translate(-10, 0)")
          .call(createClusterDrag({ plot, ids, interactions }))
          .on("click", (event, cluster) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) interactions.toggleClusterSelection(cluster.uid, plotSelectionOptions(event));
          })
          .on("mousedown.selection", (event) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) { event.preventDefault(); event.stopPropagation(); }
          });

        info
          .append("text")
          .attr("class", "clusterText")
          .attr("y", 8)
          .attr("cursor", "pointer")
          .style("font-weight", "bold")
          .style("font-size", `${config.cluster.nameFontSize}px`)
          .style("font-family", config.plot.fontFamily)
          .on("click", interactions.renameCluster);
        info
          .append("text")
          .attr("class", "locusText")
          .attr("y", 12)
          .attr("dominant-baseline", "hanging")
          .style("text-rendering", "geometricPrecision")
          .style("font-size", `${config.cluster.lociFontSize}px`)
          .style("font-family", config.plot.fontFamily);
        info.selectAll("text").attr("text-anchor", "end");
        enter.append("g").attr("class", "loci");
        return enter;
      },
      (update) => update
    );

  const label = clusterLabelLayout(config);
  clusters.select("text.clusterText")
    .each(function (cluster) {
      const text = String(cluster.name ?? "");
      if (this.textContent !== text) this.textContent = text;
    })
    .attr("y", label.nameY)
    .attr("dominant-baseline", label.nameBaseline === "middle" ? "central" : null)
    .style("font-size", `${config.cluster.nameFontSize}px`);
  clusters.select("text.locusText")
    .attr("y", 12)
    .attr("dominant-baseline", "hanging")
    .style("font-size", `${config.cluster.lociFontSize}px`);

  // A cluster drag can leave an in-flight transform transition on sibling
  // rows. Cancel it before the scene supplies their snapped final positions.
  const updateRender = (selection) =>
    animate ? selection.interrupt().transition(transition) : selection.interrupt();
  // Cluster labels describe committed locus state. Keep them responsive even
  // when locus geometry is still travelling through an SVG transition.
  updateClusters(clusters.interrupt(), scene, { labelsOnly: true, highlightClusterIds });
  const clusterRender = updateRender(clusters);
  updateClusters(clusterRender, scene, { highlightClusterIds });

  const loci = clusters
    .select("g.loci")
    .selectAll("g.locus")
    .data((cluster) => cluster.loci, (locus) => locus.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.locus)
          .attr("class", "locus");
        enter.append("line").attr("class", "trackBar").style("fill", "#111");
        enter.append("g").attr("class", "trimIndicators").style("pointer-events", "none");
        enter
          .append("rect")
          .attr("class", "locusHighlight")
          .style("pointer-events", "none");
        const hover = enter
          .append("g")
          .attr("class", "hover hidden")
          .attr("opacity", 0);
        // Hover must remain below genes: a handle drag may finish over a gene,
        // and the overlay must not intercept that pointer-up event.
        enter.append("g").attr("class", "genes");
        hover
          .append("rect")
          .attr("class", "hover")
          .attr("fill", "rgba(0, 0, 0, 0.4)")
          .call(createLocusPositionDrag({ plot, interactions }));
        hover
          .append("rect")
          .attr("class", "leftHandle")
          .attr("x", -8)
          .call(createLocusResizeDrag({ plot, interactions }));
        hover
          .append("rect")
          .attr("class", "rightHandle")
          .call(createLocusResizeDrag({ plot, interactions }));
        hover
          .selectAll(".leftHandle, .rightHandle")
          .attr("width", 8)
          .attr("cursor", "pointer");
        enter
          .on("mousedown.selection", (event) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) { event.preventDefault(); event.stopPropagation(); }
          })
          .on("mouseenter", (event) => {
            if (!interactions.isDragging()) {
              select(event.target).select("g.hover").transition().attr("opacity", 1);
            }
          })
          .on("mouseleave", (event) => {
            if (!interactions.isDragging()) {
              select(event.target).select("g.hover").transition().attr("opacity", 0);
            }
          })
          .on("click", (event, locus) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
              interactions.toggleLocusSelection(locus, plotSelectionOptions(event));
            }
          })
          .on("dblclick", (event, locus) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) return;
            // The hover rectangle describes pointer affordances, not locus
            // geometry. It would otherwise remain visible while the locus
            // itself animates through a flip.
            const locusNode = event.currentTarget;
            const hover = select(locusNode).select("g.hover").interrupt().attr("opacity", 0);
            // Restore the affordance only if this locus is still under the
            // pointer after its geometry transition completes.
            if (animate && config.plot.transitionDuration) {
              hover
                .transition()
                .delay(config.plot.transitionDuration)
                .duration(0)
                .on("end", function () {
                  if (locusNode.matches(":hover")) select(this).attr("opacity", 1);
                });
            }
            interactions.flipLocus(locus);
          });
        return updateLoci(enter, scene, config, highlightLocusIds);
      },
      (update) =>
        update.call((selection) =>
          updateLoci(updateRender(selection), scene, config, highlightLocusIds)
        )
    );

  loci
    .select("g.genes")
    .selectAll("g.gene")
    .data((locus) => locus.genes, (gene) => gene.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.gene)
          .attr("class", "gene")
          .attr("display", "inline");
        enter
          .append("polygon")
          .on("click", interactions.onGeneClick)
          .on("contextmenu", interactions.showGeneMenu)
          .attr("class", "genePolygon");
        enter
          .append("polygon")
          .attr("class", "geneHighlight")
          .style("pointer-events", "none");
        enter
          .append("text")
          .attr("class", "geneLabel")
          .attr("dy", "-0.3em")
          .style("font-family", config.plot.fontFamily);
        return updateGenes(enter, scene, config, scales, highlightGeneIds);
      },
      (update) =>
        update.call((selection) =>
          updateGenes(updateRender(selection), scene, config, scales, highlightGeneIds)
        )
    );

  // Keep allowed links even when their clusters are not currently adjacent:
  // a drag preview can reveal them without rebuilding the DOM.
  const allowedLinks = [...scene.links.values()].filter((link) => link.allowed).map((link) => link.source);
  linkGroup
    .selectAll("g.geneLinkG")
    .data(allowedLinks, ids.link)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.link)
          .attr("class", "geneLinkG");
        enter.append("path").attr("class", "geneLink");
        enter
          .append("path")
          .attr("class", "geneLinkHighlight")
          .style("pointer-events", "none");
        enter
          .append("text")
          .text((link) => link.label ?? link.identity.toFixed(2))
          .attr("class", "geneLinkLabel")
          .style("fill", "white")
          .style("text-anchor", "middle")
          .style("font-family", config.plot.fontFamily);
        return updateLinks(enter, scene, previousScene, config, scales, ids, highlightLinkIds);
      },
      (update) =>
        update.call((selection) => {
          selection.classed("hidden", !config.link.show);
          updateRender(selection).call(updateLinks, scene, previousScene, config, scales, ids, highlightLinkIds);
        }),
      (exit) =>
        exit.call((selection) => {
          if (animate) selection.transition(transition).attr("opacity", 0).remove();
          else selection.remove();
        })
    );

  renderPresentation();
}

// Apply renderer-neutral patches to retained SVG elements. Geometry, adjacency,
// visibility, and label movement come from the same accessors as raster marks.
function renderPreview({ plot, data, scene, preview, config, scales, ids, interactions,
  highlightGeneIds, highlightLocusIds, highlightClusterIds }) {
  const current = recordsForPreview(scene, preview, { includeClusters: true });
  // Select the node directly: selection.select() would replace its bound datum
  // with the plot datum, and UID strings need not be valid CSS identifiers.
  const element = (id) => select(plot.node().ownerDocument.getElementById(id));
  const previous = previewStates.get(plot.node());
  const affected = (kind) => new Set([
    ...current[kind], ...(previous?.scene === scene ? previous.records[kind] : []),
  ]);
  updateClusters(plot.selectAll("g.cluster").interrupt(), scene, { preview, highlightClusterIds });

  // DOM parents carry row and locus translations. Only trim/flip previews need
  // per-gene geometry; ordinary dragging never rewrites the gene polygons.
  const loci = new Map();
  for (const uid of affected("loci")) {
    const locus = scene.loci.get(uid);
    if (!locus) continue;
    const geometry = locusGeometryForPreview(preview, locus);
    loci.set(uid, { ...locus, ...geometry,
      localX: locus.localX + geometry.offsets.x,
    });
  }
  const projected = { ...scene, loci: { get: (uid) => loci.get(uid) || scene.loci.get(uid) } };
  for (const uid of loci.keys()) {
    const group = element(ids.locus({ uid })).interrupt();
    updateLoci(group, projected, config, highlightLocusIds);
    if (preview.type === "locus-flip") group.select("g.hover").interrupt().attr("opacity", 0);
  }
  if ([preview.type, previous?.type].some((type) => type === "locus-trim" || type === "locus-flip")) {
    const genes = new Map();
    for (const uid of affected("genes")) {
      const gene = scene.genes.get(uid);
      if (!gene) continue;
      const geometry = geneGeometryForPreview(preview, gene);
      const polygon = geometry.flipAxis === undefined ? gene.localPolygon
        : genePolygonForPreview(preview, gene, { includeClusterOffset: false })
          .map((value, index) => value - (index % 2 ? gene.locus.y : gene.locus.x));
      genes.set(uid, { ...gene, localPolygon: polygon, visible: geneVisibleForPreview(preview, gene),
        label: geometry.labelX === undefined ? gene.label
          : { ...gene.label, x: geometry.labelX - gene.locus.x },
      });
    }
    const geneScene = { ...scene, genes: { get: (uid) => genes.get(uid) || scene.genes.get(uid) } };
    for (const uid of genes.keys()) {
      updateGenes(element(ids.gene({ uid })).interrupt(), geneScene, config, scales, highlightGeneIds);
    }
  }
  // Include last frame's records so branches/links that leave the affected set
  // are restored to their retained positions rather than left behind.
  for (const uid of affected("links")) {
    const link = scene.links.get(uid);
    if (!link) continue;
    const geometry = linkGeometryForPreview(scene, link, preview, config);
    const anchors = geometry.anchors;
    const visible = config.link.show && geometry.visible && anchors;
    const group = element(ids.link(link.source)).interrupt().attr("opacity", visible ? link.opacity ?? 1 : 0);
    if (!visible) continue;
    group.selectAll("path.geneLink,path.geneLinkHighlight").interrupt().attr("d", getLinkPath(anchors, config.link));
    if (config.link.label.show) {
      const label = getLinkLabelPosition(anchors, config.link.label.position);
      group.select("text.geneLinkLabel").attr("x", label.x).attr("y", label.y)
        .attr("opacity", 1);
    }
  }
  renderChrome({ plot, chrome: preview.chrome || scene.chrome, ids, interactions });
  renderSvgAnnotations(plot, scene, { preview });
  renderTree(plot, data.tree, scene, config, interactions, null, false, { preview });
  previewStates.set(plot.node(), { scene, records: current, type: preview.type });
}

function updateClusters(selection, scene, { labelsOnly = false, preview = null, highlightClusterIds = new Set() } = {}) {
  const layout = (cluster) => scene.clusters.get(cluster.uid);
  selection.selectAll("g.clusterInfo text").attr("text-anchor", (cluster) => layout(cluster).info.anchor || "end");
  selection.selectAll("g.clusterInfo").style("fill", (cluster) => highlightClusterIds.has(cluster.uid) ? "#1677ff" : null);
  if (!labelsOnly) {
    selection.attr("transform", (cluster) => {
      const { x, y } = layout(cluster);
      return `translate(${x}, ${y + clusterOffsetForPreview(preview, cluster.uid)})`;
    });
    selection.selectAll("g.clusterInfo").attr("transform", (cluster) => {
      const { x, y } = layout(cluster).info;
      return `translate(${x + clusterLabelOffsetForPreview(preview, cluster.uid)}, ${y})`;
    });
  }
  selection.selectAll("text.locusText").each(function (cluster) {
    const text = clusterLabelTextForPreview(preview, cluster.uid, layout(cluster).info.locusText);
    if (this.textContent !== text) this.textContent = text;
  });
  return selection;
}

function createClusterDrag({ plot, ids, interactions }) {
  const clusterSelection = (uid) => plot.selectAll(`#${ids.cluster({ uid })}`);
  return drag()
    .filter((event) => !event.button && !event.shiftKey && !event.ctrlKey && !event.metaKey)
    .container(function () { return this.parentNode.parentNode; })
    .on("start", (event, cluster) => {
      clusterSelection(cluster.uid).classed("active", true).attr("cursor", "grabbing");
      interactions.beginClusterDrag(cluster.uid, event.y);
    })
    .on("drag", (event) => interactions.moveClusterDrag(event.y))
    .on("end", (_, cluster) => {
      clusterSelection(cluster.uid).classed("active", false).attr("cursor", null);
      interactions.endClusterDrag();
    });
}

function createLocusPositionDrag({ plot, interactions }) {
  return drag()
    .filter((event) => !event.button && !event.shiftKey && !event.ctrlKey && !event.metaKey)
    .container(() => plot.node())
    .on("start", (event, locus) => interactions.beginLocusDrag(locus.uid, event.x))
    .on("drag", (event) => interactions.moveLocusDrag(event.x))
    .on("end", () => interactions.endLocusDrag());
}

function createLocusResizeDrag({ plot, interactions }) {
  return drag()
    .filter((event) => !event.button && !event.shiftKey && !event.ctrlKey && !event.metaKey)
    // Trimming uses chart-world coordinates, matching Canvas and WebGPU.
    .container(() => plot.node())
    .on("start", () => interactions.beginLocusTrim())
    .on("drag", function (event, locus) {
      interactions.moveLocusTrim(locus, select(this).classed("leftHandle") ? "left" : "right", event.x);
    })
    .on("end", (_, locus) => interactions.endLocusTrim(locus));
}

function updateLoci(selection, scene, config, highlightLocusIds) {
  const trimIndicatorStyle = resolveTrimIndicatorStyle(config.locus.trimIndicators);
  const layout = (locus) => scene.loci.get(locus.uid);
  // D3 transitions are used for locus geometry, but annotation joins must be
  // performed on selections so entering/removing text does not depend on a
  // transition's timing.
  const base = typeof selection.selection === "function" ? selection.selection() : selection;

  selection.attr("transform", (locus) => `translate(${layout(locus).localX}, 0)`);
  selection
    .select("line.trackBar")
    .attr("x1", (locus) => layout(locus).track.x1)
    .attr("x2", (locus) => layout(locus).track.x2)
    .attr("y1", (locus) => layout(locus).track.y)
    .attr("y2", (locus) => layout(locus).track.y)
    .style("stroke", config.locus.trackBar.colour)
    .style("stroke-width", config.locus.trackBar.stroke);
  selection
    .select("rect.locusHighlight")
    .attr("x", (locus) => layout(locus).hover.x)
    .attr("y", (locus) => layout(locus).hover.y)
    .attr("width", (locus) => layout(locus).hover.width)
    .attr("height", (locus) => layout(locus).hover.height)
    .attr("display", (locus) => (highlightLocusIds.has(locus.uid) ? "inline" : "none"))
    .attr("fill", "rgba(22, 119, 255, 0.12)")
    .style("stroke", "#1677ff")
    .style("stroke-width", Math.max(2, config.locus.trackBar.stroke));
  selection
    .selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
    .attr("y", (locus) => layout(locus).hover.y)
    .attr("height", (locus) => layout(locus).hover.height);
  selection
    .select("rect.hover")
    .attr("x", (locus) => layout(locus).hover.x)
    .attr("width", (locus) => layout(locus).hover.width);
  selection
    .select("rect.leftHandle")
    .attr("x", (locus) => layout(locus).hover.leftHandleX);
  selection
    .select("rect.rightHandle")
    .attr("x", (locus) => layout(locus).hover.rightHandleX);
  base
    .select("g.trimIndicators")
    .selectAll("text.trimIndicator")
    .data(
      (locus) => (config.locus.trimIndicators?.show === false ? [] : layout(locus).trimIndicators),
      (indicator) => indicator.side
    )
    .join("text")
    .attr("class", "trimIndicator")
    .attr("x", (indicator) => indicator.x)
    .attr("y", (indicator) => indicator.y)
    .attr("text-anchor", (indicator) => indicator.anchor)
    .attr("dominant-baseline", "hanging")
    .attr("fill", "#536b88")
    .attr("stroke", `rgba(255, 255, 255, ${trimIndicatorStyle.borderOpacity})`)
    .attr("stroke-width", trimIndicatorStyle.borderWidth)
    .attr("stroke-linejoin", "round")
    .style("paint-order", "stroke")
    .style("font-size", `${trimIndicatorStyle.fontSize}px`)
    .style("font-weight", trimIndicatorStyle.fontWeight)
    .style("font-family", config.plot.fontFamily)
    .text((indicator) => indicator.text);
  return selection;
}

function updateGenes(selection, scene, config, scales, highlightGeneIds) {
  const geneLayout = (gene) => scene.genes.get(gene.uid);
  const fill = (gene) => {
    if (gene.colour) return gene.colour;
    const group = scales.group(gene.uid);
    return scales.colour(group);
  };

  selection.attr("display", (gene) =>
    geneLayout(gene)?.visible ? "inline" : "none"
  );
  selection
    .select("polygon.genePolygon")
    .attr("class", (gene) => {
      const group = scales.group(gene.uid);
      return group === null ? "genePolygon" : `genePolygon group-${group}`;
    })
    .attr("points", (gene) => geneLayout(gene)?.localPolygon.join(" ") || "")
    .attr("fill", fill)
    .style("stroke", config.gene.shape.stroke)
    .style("stroke-width", config.gene.shape.strokeWidth);
  selection
    .select("polygon.geneHighlight")
    .attr("points", (gene) => geneLayout(gene)?.localPolygon.join(" ") || "")
    .attr("display", (gene) => (highlightGeneIds.has(gene.uid) ? "inline" : "none"))
    .attr("fill", "rgba(22, 119, 255, 0.18)")
    .style("stroke", "#1677ff")
    .style("stroke-width", Math.max(2, config.gene.shape.strokeWidth))
    .style("pointer-events", "none");
  selection
    .select("text.geneLabel")
    .text((gene) => gene.label || gene.name || gene.uid)
    .attr("dy", { top: "-0.4em", middle: "0.4em", bottom: "0.8em" }[config.gene.label.position])
    .attr("display", config.gene.label.show ? "inherit" : "none")
    .attr("transform", (gene) => {
      const label = geneLayout(gene)?.label;
      return label ? `translate(${label.x}, ${label.y}) rotate(${label.rotation})` : null;
    })
    .attr("font-size", config.gene.label.fontSize)
    .attr("text-anchor", config.gene.label.anchor);
  return selection;
}

function updateLinks(selection, scene, previousScene, config, scales, ids, highlightLinkIds) {
  const linkLayout = (link) => scene.links.get(link.uid);
  const fill = (link) => config.link.asLine ? "none" : linkColours(link, scales, config).fill;
  const stroke = (link) => linkColours(link, scales, config).stroke;

  const opacity = (link) => interpolateLinkOpacity(
    previousScene?.links.get(link.uid),
    linkLayout(link),
    1,
    config.link.show
  );
  if (typeof selection.attrTween === "function") {
    selection.attrTween("opacity", function (link) {
      const previous = previousScene?.links.get(link.uid);
      const next = linkLayout(link);
      return (amount) => interpolateLinkOpacity(previous, next, amount, config.link.show);
    });
  } else {
    selection.attr("opacity", opacity);
  }
  const paths = selection.selectAll("path.geneLink,path.geneLinkHighlight");
  if (typeof paths.attrTween === "function") paths.attrTween("d", (link) => {
    const previous = previousScene?.links.get(link.uid), next = linkLayout(link);
    return (amount) => getLinkPath(
      interpolateLinkAnchors(previousScene, previous, scene, next, amount), config.link
    );
  });
  else paths.attr("d", (link) => getLinkPath(linkLayout(link)?.anchors, config.link));
  selection.select("path.geneLink")
    .style("fill", fill)
    .style("stroke", stroke)
    .style("stroke-width", `${config.link.strokeWidth}px`);
  selection.select("path.geneLinkHighlight")
    .attr("display", (link) => (highlightLinkIds.has(link.uid) ? "inline" : "none"))
    .style("fill", config.link.asLine ? "none" : "rgba(22, 119, 255, 0.18)")
    .style("stroke", "#1677ff")
    .style("stroke-width", `${Math.max(2, config.link.strokeWidth + 1)}px`)
    .style("pointer-events", "none");
  selection
    .select("text.geneLinkLabel")
    .text((link) => link.label ?? link.identity.toFixed(2))
    .attr("display", (link) =>
      config.link.label.show && linkLayout(link)?.visible ? null : "none"
    )
    .attr("filter", config.link.label.background ? `url(#${ids.filter})` : null)
    .style("font-size", `${config.link.label.fontSize}px`)
    .attr("x", (link) => linkLayout(link)?.labelPosition?.x)
    .attr("y", (link) => linkLayout(link)?.labelPosition?.y);
  return selection;
}

function renderChrome({ plot, chrome, ids, interactions }) {
  if (!chrome) return;
  const transform = ({ x, y }) => `translate(${x}, ${y})`;
  renderLegend({ plot, legend: chrome.legend, interactions, transform });
  renderScaleBar({ plot, scaleBar: chrome.scaleBar, interactions, transform });
  renderColourBar({ plot, colourBar: chrome.colourBar, ids, transform });
}

function renderLegend({ plot, legend, interactions, transform }) {
  const key = plot
    .selectAll("g.legend")
    .data(legend.visible ? [legend] : [])
    .join("g")
    .attr("class", "legend")
    .attr("transform", () => transform(legend.position));

  const items = key
    .selectAll("g.element")
    .data(legend.items, (item) => item.uid)
    .join((enter) => {
      const item = enter.append("g").attr("class", "element");
      item.append("circle");
      item
        .append("text")
        .attr("class", "legend-label")
        .attr("text-anchor", "start")
        .style("dominant-baseline", "middle");
      item
        .append("text")
        .attr("class", "legend-subtitle")
        .attr("text-anchor", "start")
        .style("dominant-baseline", "middle");
      return item;
    });

  items.attr("transform", (item) => `translate(${item.x}, ${item.y})`);
  items
    .select("circle")
    .attr("class", (item) => `group-${item.uid}`)
    .attr("cy", (item) => item.circleY)
    .attr("r", (item) => item.radius)
    .attr("fill", (item) => item.colour)
    .attr("cursor", "pointer")
    .on("click", (event, item) => interactions.legendColour(event, item.source));
  const updateLegendText = (text) => text
    .attr("x", (item) => item.textX)
    .style("font-family", legend.fontFamily)
    .attr("cursor", "pointer")
    .on("click", (event, item) => interactions.legendText(event, item.source))
    .on("contextmenu", (event, item) => interactions.legendMenu(event, item.source));
  items.select("text.legend-label").call(updateLegendText)
    .text((item) => item.label)
    .attr("y", (item) => item.textY)
    .style("font-size", `${legend.fontSize}px`);
  items.select("text.legend-subtitle").call(updateLegendText)
    .text((item) => item.subtitle)
    .attr("y", (item) => item.subtitleY ?? item.textY)
    .attr("opacity", (item) => item.subtitle ? 0.72 : 0)
    .style("font-size", `${legend.subtitleFontSize}px`);
}

function renderScaleBar({ plot, scaleBar, interactions, transform }) {
  const bar = plot
    .selectAll("g.scaleBar")
    .data(scaleBar.visible ? [scaleBar] : [])
    .join((enter) => {
      const group = enter.append("g").attr("class", "scaleBar");
      group.append("line").attr("class", "flatBar");
      group.append("line").attr("class", "leftBar");
      group.append("line").attr("class", "rightBar");
      group.append("text").attr("class", "barText").attr("text-anchor", "middle");
      return group;
    })
    .attr("transform", () => transform(scaleBar.position));

  bar
    .select("line.flatBar")
    .attr("x2", scaleBar.length)
    .attr("y1", scaleBar.middle)
    .attr("y2", scaleBar.middle);
  bar.select("line.leftBar").attr("y2", scaleBar.height);
  bar
    .select("line.rightBar")
    .attr("x1", scaleBar.length)
    .attr("x2", scaleBar.length)
    .attr("y2", scaleBar.height);
  bar
    .select("text.barText")
    .text(scaleBar.label)
    .attr("x", scaleBar.length / 2)
    .attr("y", scaleBar.height + 5)
    .style("dominant-baseline", "hanging")
    .style("font-size", `${scaleBar.fontSize}px`)
    .style("font-family", scaleBar.fontFamily)
    .attr("cursor", "pointer")
    .on("click", () => interactions.setScaleBarLength());
  bar
    .selectAll("line")
    .style("stroke", scaleBar.colour)
    .style("stroke-width", scaleBar.strokeWidth);
}

function renderColourBar({ plot, colourBar, ids, transform }) {
  const bar = plot
    .selectAll("g.colourBar")
    .data(colourBar.visible ? [colourBar] : [])
    .join((enter) => {
      const group = enter.append("g").attr("class", "colourBar");
      const gradient = group
        .append("defs")
        .append("linearGradient")
        .attr("id", ids.colourGradient)
        .attr("x1", "0%")
        .attr("x2", "100%");
      gradient.append("stop").attr("class", "startStop").attr("offset", "0%");
      gradient.append("stop").attr("class", "endStop").attr("offset", "100%");
      const parts = group.append("g").attr("class", "cbarParts");
      parts.append("rect").attr("class", "colourBarBG");
      parts.append("rect").attr("class", "colourBarFill");
      parts.append("text").attr("class", "labelText").attr("text-anchor", "middle");
      parts.append("text").attr("class", "startText").attr("text-anchor", "start");
      parts.append("text").attr("class", "endText").attr("text-anchor", "end");
      return group;
    })
    .attr("transform", () => transform(colourBar.position));

  bar.select(".startStop").attr("stop-color", colourBar.startColour);
  bar.select(".endStop").attr("stop-color", colourBar.endColour);
  bar
    .select(".colourBarBG")
    .attr("width", colourBar.width)
    .attr("height", colourBar.height)
    .style("fill", "white")
    .style("stroke", colourBar.textColour || "black")
    .style("stroke-width", "1px");
  bar
    .select(".colourBarFill")
    .attr("width", colourBar.width)
    .attr("height", colourBar.height)
    .style("fill", `url(#${ids.colourGradient})`);
  bar
    .select(".labelText")
    .text(colourBar.label)
    .attr("x", colourBar.width / 2)
    .attr("y", colourBar.height + 5);
  bar
    .select(".startText")
    .text(colourBar.startLabel)
    .attr("y", colourBar.height + 5);
  bar
    .select(".endText")
    .text(colourBar.endLabel)
    .attr("x", colourBar.width)
    .attr("y", colourBar.height + 5);
  bar
    .selectAll("text")
    .style("font-family", colourBar.fontFamily)
    .style("font-size", `${colourBar.fontSize}px`)
    .style("dominant-baseline", "hanging");
}
