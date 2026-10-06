import { select } from "d3-selection";
import { drag } from "d3-drag";
import { renameText, rgbaToRgb } from "./utils.js";
import { filterLinks } from "./links/groups.mjs";

// Owns the D3 joins for chart-world SVG. The chart controller owns the SVG
// host, camera viewport, and interaction state that causes a redraw.
export function renderSvg({
  plot,
  data,
  scene,
  transition,
  animate,
  config,
  scales,
  ids,
  lookup,
  interactions,
  highlightGeneIds = new Set(),
  highlightLinkIds = new Set(),
  highlightLocusIds = new Set(),
}) {
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
          .call(createClusterDrag({ plot, ids, interactions }));

        info
          .append("text")
          .text((cluster) => cluster.name)
          .attr("class", "clusterText")
          .attr("y", 8)
          .attr("cursor", "pointer")
          .style("font-weight", "bold")
          .style("font-size", `${config.cluster.nameFontSize}px`)
          .style("font-family", config.plot.fontFamily)
          .on("click", renameText);
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

  // A cluster drag can leave an in-flight transform transition on sibling
  // rows. Cancel it before the scene supplies their snapped final positions.
  const updateRender = (selection) =>
    animate ? selection.interrupt().transition(transition) : selection.interrupt();
  // Cluster labels describe committed locus state. Keep them responsive even
  // when locus geometry is still travelling through an SVG transition.
  updateClusters(clusters.interrupt(), scene, { labelsOnly: true });
  const clusterRender = updateRender(clusters);
  updateClusters(clusterRender, scene);

  const loci = clusters
    .selectAll("g.loci")
    .selectAll("g.locus")
    .data((cluster) => cluster.loci, (locus) => locus.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", ids.locus)
          .attr("class", "locus");
        enter.append("line").attr("class", "trackBar").style("fill", "#111");
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
            if (event.shiftKey) interactions.toggleLocusSelection(locus);
          })
          .on("dblclick", (event, locus) => {
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
    .selectAll("g.genes")
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

  const visibleLinks = filterLinks(data.links, {
    groupForGene: scales.group,
    geneForUid: lookup.gene,
    bestOnly: config.link.bestOnly,
    threshold: config.link.threshold,
  });
  linkGroup
    .selectAll("g.geneLinkG")
    .data(visibleLinks, ids.link)
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
        return updateLinks(enter, scene, config, scales, ids, highlightLinkIds);
      },
      (update) =>
        update.call((selection) => {
          selection.classed("hidden", !config.link.show);
          updateRender(selection).call(updateLinks, scene, config, scales, ids, highlightLinkIds);
        }),
      (exit) =>
        exit.call((selection) => {
          if (animate) selection.transition(transition).attr("opacity", 0).remove();
          else selection.remove();
        })
    );

  renderChrome({ plot, chrome: scene.chrome, ids, interactions });
}

function updateClusters(selection, scene, { labelsOnly = false } = {}) {
  const layout = (cluster) => scene.clusters.get(cluster.uid);
  if (!labelsOnly) {
    selection.attr("transform", (cluster) => {
      const { x, y } = layout(cluster);
      return `translate(${x}, ${y})`;
    });
    selection.selectAll("g.clusterInfo").attr("transform", (cluster) => {
      const { x, y } = layout(cluster).info;
      return `translate(${x}, ${y})`;
    });
  }
  selection.selectAll("text.locusText").each(function (cluster) {
    const text = layout(cluster).info.locusText;
    if (this.textContent !== text) this.textContent = text;
  });
  return selection;
}

function createClusterDrag({ plot, ids, interactions }) {
  const clusterSelection = (uid) => plot.selectAll(`#${ids.cluster({ uid })}`);

  const started = (event, cluster) => {
    const subject = clusterSelection(cluster.uid);
    subject.classed("active", true).attr("cursor", "grabbing");
    interactions.beginClusterDrag(cluster.uid, event.y);
  };

  const dragged = (event) => interactions.moveClusterDrag(event.y);

  const ended = (_, cluster) => {
    clusterSelection(cluster.uid).classed("active", false).attr("cursor", null);
    interactions.endClusterDrag();
  };

  return drag()
    .container(function () {
      return this.parentNode.parentNode;
    })
    .on("start", started)
    .on("drag", dragged)
    .on("end", ended);
}

function createLocusPositionDrag({ plot, interactions }) {
  const started = (event, locus) => {
    interactions.beginLocusDrag(locus.uid, event.x);
  };

  const dragged = (event) => interactions.moveLocusDrag(event.x);

  const ended = () => interactions.endLocusDrag();

  return drag()
    .container(() => plot.node())
    .on("start", started)
    .on("drag", dragged)
    .on("end", ended);
}

// Resize changes chart state through the controller, while this renderer-owned
// adapter supplies immediate SVG feedback until the final redraw.
function createLocusResizeDrag({ plot, interactions }) {
  const started = () => interactions.beginLocusTrim();

  const dragged = function (event, locus) {
    interactions.moveLocusTrim(
      locus,
      select(this).classed("leftHandle") ? "left" : "right",
      event.x
    );
  };

  const ended = (_, locus) => interactions.endLocusTrim(locus);

  return drag()
    // Keep resize and Canvas pointer coordinates in the same chart-world
    // space. The default handle-parent container reports locus-local x,
    // which becomes incorrect as soon as that locus or its cluster moves.
    .container(() => plot.node())
    .on("start", started)
    .on("drag", dragged)
    .on("end", ended);
}

function updateLoci(selection, scene, config, highlightLocusIds) {
  const layout = (locus) => scene.loci.get(locus.uid);

  selection.attr("transform", (locus) => {
    const { x, y } = layout(locus).transform;
    return `translate(${x}, ${y})`;
  });
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
    .selectAll("text.geneLabel")
    .text((gene) => gene.label || gene.name || gene.uid)
    .attr("dy", (gene) => geneLayout(gene)?.labelDy)
    .attr("display", config.gene.label.show ? "inherit" : "none")
    .attr("transform", (gene) => geneLayout(gene)?.labelTransform)
    .attr("font-size", config.gene.label.fontSize)
    .attr("text-anchor", config.gene.label.anchor);
  return selection;
}

function updateLinks(selection, scene, config, scales, ids, highlightLinkIds) {
  const linkLayout = (link) => scene.links.get(link.uid);
  const fill = (link) => {
    if (config.link.asLine) return "none";
    if (link.colour) return link.colour;
    if (config.link.groupColour) return rgbaToRgb(scales.colour(scales.group(link.query.uid)));
    return scales.score(link.identity);
  };
  const stroke = (link) => {
    if (link.colour) return link.colour;
    if (config.link.groupColour) {
      const colour = scales.colour(scales.group(link.query.uid));
      return config.link.asLine ? rgbaToRgb(colour) : colour;
    }
    return config.link.asLine ? scales.score(link.identity) : "black";
  };

  selection.attr("opacity", (link) =>
    config.link.show && linkLayout(link)?.visible ? 1 : 0
  );
  selection
    .select("path.geneLink")
    .attr("d", (link) => linkLayout(link)?.path || "")
    .style("fill", fill)
    .style("stroke", stroke)
    .style("stroke-width", `${config.link.strokeWidth}px`);
  selection
    .select("path.geneLinkHighlight")
    .attr("d", (link) => linkLayout(link)?.path || "")
    .attr("display", (link) => (highlightLinkIds.has(link.uid) ? "inline" : "none"))
    .style("fill", config.link.asLine ? "none" : "rgba(22, 119, 255, 0.18)")
    .style("stroke", "#1677ff")
    .style("stroke-width", `${Math.max(2, config.link.strokeWidth + 1)}px`)
    .style("pointer-events", "none");
  selection
    .selectAll("text")
    .text((link) => link.label ?? link.identity.toFixed(2))
    .attr("opacity", (link) =>
      config.link.label.show && linkLayout(link)?.visible ? 1 : 0
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
    .data([legend])
    .join("g")
    .attr("class", "legend")
    .attr("opacity", legend.visible ? 1 : 0)
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
  items
    .select("text.legend-label")
    .text((item) => item.label)
    .attr("x", (item) => item.textX)
    .attr("y", (item) => item.textY)
    .style("font-size", `${legend.fontSize}px`)
    .style("font-family", legend.fontFamily)
    .attr("cursor", "pointer")
    .on("click", (event, item) => interactions.legendText(event, item.source))
    .on("contextmenu", (event, item) => interactions.legendMenu(event, item.source));
  items
    .select("text.legend-subtitle")
    .text((item) => item.subtitle)
    .attr("x", (item) => item.textX)
    .attr("y", (item) => item.subtitleY ?? item.textY)
    .attr("opacity", (item) => item.subtitle ? 0.72 : 0)
    .style("font-size", `${legend.subtitleFontSize}px`)
    .style("font-family", legend.fontFamily)
    .attr("cursor", "pointer")
    .on("click", (event, item) => interactions.legendText(event, item.source))
    .on("contextmenu", (event, item) => interactions.legendMenu(event, item.source));
}

function renderScaleBar({ plot, scaleBar, interactions, transform }) {
  const bar = plot
    .selectAll("g.scaleBar")
    .data([scaleBar])
    .join((enter) => {
      const group = enter.append("g").attr("class", "scaleBar");
      group.append("line").attr("class", "flatBar");
      group.append("line").attr("class", "leftBar");
      group.append("line").attr("class", "rightBar");
      group.append("text").attr("class", "barText").attr("text-anchor", "middle");
      return group;
    })
    .attr("opacity", scaleBar.visible ? 1 : 0)
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
    .style("font-size", `${scaleBar.fontSize}pt`)
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
    .data([colourBar])
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
    .attr("opacity", colourBar.visible ? 1 : 0)
    .attr("transform", () => transform(colourBar.position));

  bar.select(".startStop").attr("stop-color", colourBar.startColour);
  bar.select(".endStop").attr("stop-color", colourBar.endColour);
  bar
    .select(".colourBarBG")
    .attr("width", colourBar.width)
    .attr("height", colourBar.height)
    .style("fill", "white")
    .style("stroke", "black")
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
    .style("font-size", `${colourBar.fontSize}pt`)
    .style("dominant-baseline", "hanging");
}
