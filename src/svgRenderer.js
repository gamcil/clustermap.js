import { renameText, rgbaToRgb } from "./utils.js";
import { filterLinks } from "./links/groups.mjs";
import {
  getLinkAnchors,
  getLinkLabelPosition,
  getLinkPath,
} from "./links/layout.mjs";

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
  const refreshLinkPreview = createLinkPreview({
    plot,
    config,
    scales,
    ids,
    lookup,
    interactions,
  });

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
          .call(
            createClusterDrag({ plot, scales, ids, interactions, refreshLinkPreview })
          );

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
          .call(
            createLocusPositionDrag({
              config,
              plot,
              scales,
              ids,
              interactions,
              refreshLinkPreview,
            })
          );
        hover
          .append("rect")
          .attr("class", "leftHandle")
          .attr("x", -8)
          .call(
            createLocusResizeDrag({
              config,
              plot,
              scales,
              ids,
              interactions,
              refreshLinkPreview,
            })
          );
        hover
          .append("rect")
          .attr("class", "rightHandle")
          .call(
            createLocusResizeDrag({
              config,
              plot,
              scales,
              ids,
              interactions,
              refreshLinkPreview,
            })
          );
        hover
          .selectAll(".leftHandle, .rightHandle")
          .attr("width", 8)
          .attr("cursor", "pointer");
        enter
          .on("mouseenter", (event) => {
            if (!interactions.isDragging()) {
              d3.select(event.target).select("g.hover").transition().attr("opacity", 1);
            }
          })
          .on("mouseleave", (event) => {
            if (!interactions.isDragging()) {
              d3.select(event.target).select("g.hover").transition().attr("opacity", 0);
            }
          })
          .on("dblclick", (_, locus) => interactions.flipLocus(locus));
        return updateLoci(enter, scene, config);
      },
      (update) =>
        update.call((selection) =>
          updateLoci(updateRender(selection), scene, config)
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
          .append("text")
          .attr("class", "geneLabel")
          .attr("dy", "-0.3em")
          .style("font-family", config.plot.fontFamily);
        return updateGenes(enter, scene, config, scales);
      },
      (update) =>
        update.call((selection) =>
          updateGenes(updateRender(selection), scene, config, scales)
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
          .append("text")
          .text((link) => link.identity.toFixed(2))
          .attr("class", "geneLinkLabel")
          .style("fill", "white")
          .style("text-anchor", "middle")
          .style("font-family", config.plot.fontFamily);
        return updateLinks(enter, scene, config, scales, ids);
      },
      (update) =>
        update.call((selection) => {
          selection.classed("hidden", !config.link.show);
          updateRender(selection).call(updateLinks, scene, config, scales, ids);
        }),
      (exit) =>
        exit.call((selection) => {
          if (animate) selection.transition(transition).attr("opacity", 0).remove();
          else selection.remove();
        })
    );

  renderChrome({ plot, chrome: scene.chrome, ids, config, interactions });
}

function updateClusters(selection, scene) {
  const layout = (cluster) => scene.clusters.get(cluster.uid);
  selection.attr("transform", (cluster) => {
    const { x, y } = layout(cluster);
    return `translate(${x}, ${y})`;
  });
  selection.selectAll("g.clusterInfo").attr("transform", (cluster) => {
    const { x, y } = layout(cluster).info;
    return `translate(${x}, ${y})`;
  });
  selection.selectAll("text.locusText").each(function (cluster) {
    const text = layout(cluster).info.locusText;
    if (this.textContent !== text) this.textContent = text;
  });
  return selection;
}

function createClusterDrag({ plot, scales, ids, interactions, refreshLinkPreview }) {
  let pointerOffset;
  let range;
  let order;

  const clusterSelection = (uid) => plot.selectAll(`#${ids.cluster({ uid })}`);
  const matrixY = (selection) => {
    const transform = selection.node().transform.baseVal;
    return transform.numberOfItems ? transform.getItem(0).matrix.f : 0;
  };

  const started = (event, cluster) => {
    interactions.setDragging(true);
    order = [...interactions.getClusterOrder()];
    const subject = clusterSelection(cluster.uid);
    subject.classed("active", true).attr("cursor", "grabbing");
    pointerOffset = matrixY(subject) - event.y;
    range = scales.y.range();
  };

  const dragged = (event, cluster) => {
    const subject = clusterSelection(cluster.uid);
    subject.raise();
    const y = Math.min(
      range[range.length - 1],
      Math.max(range[0], pointerOffset + event.y)
    );
    subject.attr("transform", `translate(${scales.offset(cluster.uid)}, ${y})`);

    const targetIndex = range.reduce(
      (closest, position, index) =>
        Math.abs(position - y) < Math.abs(range[closest] - y) ? index : closest,
      0
    );
    const currentIndex = order.indexOf(cluster.uid);
    refreshLinkPreview();
    if (targetIndex === currentIndex) return;

    order.splice(currentIndex, 1);
    order.splice(targetIndex, 0, cluster.uid);
    order.forEach((uid, index) => {
      if (uid === cluster.uid) return;
      clusterSelection(uid)
        .transition()
        .attr("transform", `translate(${scales.offset(uid)}, ${range[index]})`);
    });
  };

  const ended = (_, cluster) => {
    interactions.setDragging(false);
    interactions.moveClusterToIndex(cluster.uid, order.indexOf(cluster.uid));
    order.forEach((uid, index) => {
      clusterSelection(uid)
        .interrupt()
        .classed("active", false)
        .attr("cursor", null)
        .attr("transform", `translate(${scales.offset(uid)}, ${range[index]})`);
    });
    refreshLinkPreview();
  };

  return d3
    .drag()
    .container(function () {
      return this.parentNode.parentNode;
    })
    .on("start", started)
    .on("drag", dragged)
    .on("end", ended);
}

function createLocusPositionDrag({
  config,
  plot,
  scales,
  ids,
  interactions,
  refreshLinkPreview,
}) {
  let minPos;
  let maxPos;
  let pointerStart;
  let value;

  const locusSelection = (uid) => plot.selectAll(`#${ids.locus({ uid })}`);

  const started = (event, locus) => {
    [minPos, maxPos] = interactions.getLocusMoveBounds(locus.uid);
    pointerStart = event.x;
    value = interactions.getLocusOffset(locus.uid);
    interactions.setDragging(true);
  };

  const dragged = (event, locus) => {
    value += event.x - pointerStart;
    const subject = locusSelection(locus.uid);
    subject.attr("transform", `translate(${value}, 0)`);
    refreshLinkPreview();

    const state = interactions.getLocusState(locus);
    const locusStart = scales.x(state.start);
    if (config.cluster.alignLabels) {
      const locusMin = value + scales.offset(locus.clusterUid) + locusStart;
      const newMin = Math.min(locusMin, minPos) - 10;
      plot.selectAll("g.clusterInfo").attr(
        "transform",
        (cluster) => `translate(${newMin - scales.offset(cluster.uid)}, 0)`
      );
    } else {
      plot.selectAll(`#${ids.clusterInfo({ uid: locus.clusterUid })}`).attr(
        "transform",
        `translate(${value + locusStart - 10}, 0)`
      );
    }

    const locusEnd = scales.x(state.end);
    const newMax = Math.max(value + scales.offset(locus.clusterUid) + locusEnd, maxPos) + 20;
    plot.selectAll("g.legend").attr("transform", `translate(${newMax}, 0)`);
  };

  const ended = (_, locus) => {
    interactions.setDragging(false);
    interactions.setLocusOffset(locus.uid, value);
    interactions.redraw({ animate: false });
  };

  return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
}

// Resize changes chart state through the controller, while this renderer-owned
// adapter supplies immediate SVG feedback until the final redraw.
function createLocusResizeDrag({
  config,
  plot,
  scales,
  ids,
  interactions,
  refreshLinkPreview,
}) {
  let minPos;
  let maxPos;

  const locusSelection = (uid) => plot.selectAll(`#${ids.locus({ uid })}`);
  const realLength = (state) => scales.x(state.end) - scales.x(state.start);
  const updateTrackBar = (selection, state) => {
    const y = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;
    selection
      .selectAll("line.trackBar")
      .interrupt()
      .attr("x1", scales.x(state.start))
      .attr("x2", scales.x(state.end))
      .attr("y1", y)
      .attr("y2", y);
  };
  const updateVisibleGenes = (selection, state) => {
    selection.selectAll("g.genes").selectAll("g.gene").attr("display", (gene) => {
      const display = interactions.getGeneState(gene);
      return display.start >= state.start && display.end <= state.end + 1
        ? "inline"
        : "none";
    });
  };
  const started = (_, locus) => {
    [minPos, maxPos] = interactions.getLocusMoveBounds(locus.uid);
    interactions.setDragging(true);
  };

  const dragLeft = (event, locus, handle) => {
    const { state, coordinate } = interactions.trimLocus(locus, {
      edge: "left",
      position: event.x,
      coordinateFor: scales.x,
      scaleGenes: config.plot.scaleGenes,
    });
    const subject = locusSelection(locus.uid);
    handle.attr("x", coordinate - 8);
    subject
      .selectAll("rect.hover")
      .attr("x", coordinate)
      .attr("width", realLength(state));
    updateVisibleGenes(subject, state);
    updateTrackBar(subject, state);
    refreshLinkPreview();

    if (config.cluster.alignLabels) {
      const offset = scales.offset(locus.clusterUid) + scales.locus(locus.uid);
      const newMin = Math.min(coordinate + offset, minPos) - 10;
      plot.selectAll("g.clusterInfo").attr(
        "transform",
        (cluster) => `translate(${newMin - scales.offset(cluster.uid)}, 0)`
      );
    } else {
      plot.selectAll(`#${ids.clusterInfo({ uid: locus.clusterUid })}`).attr(
        "transform",
        `translate(${scales.locus(locus.uid) + scales.x(state.start) - 10}, 0)`
      );
    }
  };

  const dragRight = (event, locus, handle) => {
    const { state, coordinate } = interactions.trimLocus(locus, {
      edge: "right",
      position: event.x,
      coordinateFor: scales.x,
      scaleGenes: config.plot.scaleGenes,
    });
    const subject = locusSelection(locus.uid);
    handle.attr("x", coordinate);
    subject.selectAll("rect.hover").attr("width", realLength(state));
    updateVisibleGenes(subject, state);
    updateTrackBar(subject, state);
    refreshLinkPreview();

    const locusEnd = scales.x(state.end);
    const newMax = Math.max(
      scales.offset(locus.clusterUid) + scales.locus(locus.uid) + locusEnd,
      maxPos
    ) + config.legend.marginLeft;
    plot.selectAll("g.legend").attr("transform", `translate(${newMax}, 0)`);
  };

  const dragged = function (event, locus) {
    const handle = d3.select(this);
    if (handle.classed("leftHandle")) dragLeft(event, locus, handle);
    else dragRight(event, locus, handle);
  };

  const ended = (_, locus) => {
    interactions.setDragging(false);
    interactions.finalizeLocusTrim(locus);
    locusSelection(locus.uid).select("g.hover").transition().attr("opacity", 0);
    interactions.redraw({ animate: false });
  };

  return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
}

function createLinkPreview({ plot, config, scales, ids, lookup, interactions }) {
  const matrix = (selection) => {
    const transform = selection.node().transform.baseVal;
    return transform.numberOfItems ? transform.getItem(0).matrix : { e: 0, f: 0 };
  };
  const geneIsVisible = (uid) =>
    plot.selectAll(`#${ids.gene({ uid })}`).attr("display") !== "none";
  const displayGene = (uid) => {
    const gene = lookup.gene(uid);
    return gene && { ...gene, ...interactions.getGeneState(gene) };
  };
  const areClustersAdjacent = (one, two) => {
    const order = interactions.getClusterOrder();
    return Math.abs(order.indexOf(one) - order.indexOf(two)) === 1;
  };
  const linkValues = (link) => {
    if (
      !config.link.show ||
      link.identity < config.link.threshold ||
      !geneIsVisible(link.query.uid) ||
      !geneIsVisible(link.target.uid)
    ) {
      return { anchors: null, visible: false, labelPosition: null };
    }
    const anchors = getLinkAnchors(link, {
      geneForUid: displayGene,
      areClustersAdjacent,
      scaleX: scales.x,
      horizontalOffset: (gene) =>
        scales.offset(gene.clusterUid) + matrix(plot.selectAll(`#${ids.locus({ uid: gene.locusUid })}`)).e,
      verticalPosition: (gene) => matrix(plot.selectAll(`#${ids.cluster({ uid: gene.clusterUid })}`)).f,
      geneMidpoint: config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2,
    });
    return {
      anchors,
      visible: Boolean(anchors),
      labelPosition: anchors
        ? getLinkLabelPosition(anchors, config.link.label.position)
        : null,
    };
  };

  return () => {
    const values = new Map();
    const links = plot.selectAll("g.geneLinkG");
    links.each((link) => values.set(link.uid, linkValues(link)));
    links.attr("opacity", (link) => (values.get(link.uid).visible ? 1 : 0));
    links
      .select("path.geneLink")
      .attr("d", (link) =>
        getLinkPath(values.get(link.uid).anchors, {
          asLine: config.link.asLine,
          straight: config.link.straight,
        })
      );
    links
      .select("text.geneLinkLabel")
      .attr("opacity", (link) =>
        config.link.label.show && values.get(link.uid).visible ? 1 : 0
      )
      .attr("x", (link) => values.get(link.uid).labelPosition?.x)
      .attr("y", (link) => values.get(link.uid).labelPosition?.y);
  };
}

function updateLoci(selection, scene, config) {
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

function updateGenes(selection, scene, config, scales) {
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
    .selectAll("polygon")
    .attr("class", (gene) => {
      const group = scales.group(gene.uid);
      return group === null ? "genePolygon" : `genePolygon group-${group}`;
    })
    .attr("points", (gene) => geneLayout(gene)?.localPolygon.join(" ") || "")
    .attr("fill", fill)
    .style("stroke", config.gene.shape.stroke)
    .style("stroke-width", config.gene.shape.strokeWidth);
  selection
    .selectAll("text.geneLabel")
    .text((gene) => gene.label || gene.uid)
    .attr("dy", (gene) => geneLayout(gene)?.labelDy)
    .attr("display", config.gene.label.show ? "inherit" : "none")
    .attr("transform", (gene) => geneLayout(gene)?.labelTransform)
    .attr("font-size", config.gene.label.fontSize)
    .attr("text-anchor", config.gene.label.anchor);
  return selection;
}

function updateLinks(selection, scene, config, scales, ids) {
  const linkLayout = (link) => scene.links.get(link.uid);
  const fill = (link) => {
    if (config.link.asLine) return "none";
    if (config.link.groupColour) return rgbaToRgb(scales.colour(scales.group(link.query.uid)));
    return scales.score(link.identity);
  };
  const stroke = (link) => {
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
    .selectAll("path")
    .attr("d", (link) => linkLayout(link)?.path || "")
    .style("fill", fill)
    .style("stroke", stroke)
    .style("stroke-width", `${config.link.strokeWidth}px`);
  selection
    .selectAll("text")
    .attr("opacity", (link) =>
      config.link.label.show && linkLayout(link)?.visible ? 1 : 0
    )
    .attr("filter", config.link.label.background ? `url(#${ids.filter})` : null)
    .style("font-size", `${config.link.label.fontSize}px`)
    .attr("x", (link) => linkLayout(link)?.labelPosition?.x)
    .attr("y", (link) => linkLayout(link)?.labelPosition?.y);
  return selection;
}

function renderChrome({ plot, chrome, ids, config, interactions }) {
  if (!chrome) return;
  const transform = ({ x, y }) => `translate(${x}, ${y})`;
  renderLegend({ plot, legend: chrome.legend, config, interactions, transform });
  renderScaleBar({ plot, scaleBar: chrome.scaleBar, interactions, transform });
  renderColourBar({ plot, colourBar: chrome.colourBar, ids, transform });
}

function renderLegend({ plot, legend, config, interactions, transform }) {
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
    .on("click", (event, item) => {
      if (config.legend.onClickCircle) config.legend.onClickCircle(event, item.source);
      else interactions.chooseLegendColour(item.source);
    });
  items
    .select("text")
    .text((item) => item.label)
    .attr("x", (item) => item.textX)
    .attr("y", (item) => item.textY)
    .style("font-size", `${legend.fontSize}px`)
    .style("font-family", legend.fontFamily)
    .attr("cursor", "pointer")
    .on(
      "click",
      config.legend.onClickText
        ? (event, item) => config.legend.onClickText(event, item.source)
        : null
    )
    .on("contextmenu", (event, item) => {
      const handler = config.legend.onAltClickText || interactions.showGroupMenu;
      handler(event, item.source);
    });
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
    .on("click", () => {
      const value = prompt("Enter new length (bp):", scaleBar.basePair);
      if (value) interactions.setScaleBarLength(value);
    });
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
