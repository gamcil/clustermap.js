import legend from "./legend.js";
import colourBar from "./colourBar.js";
import scaleBar from "./scaleBar.js";
import { renameText } from "./utils.js";
import { createLinkGroups, filterLinks } from "./links/groups.mjs";
import { flipLocus } from "./chartState.mjs";
import { createChartIndex } from "./data/index.mjs";
import * as api from "./api.js";

export default function clusterMap() {
  /* A ClusterMap plot. */

  let container = null;
  let transition = d3.transition();
  let zoom = null;
  let hasInitialView = false;

  api.plot.update = () => container.call(my);
  api.plot.data = (data) => my.data(data);

  function my(selection) {
    selection.each(update);
  }

  function update(data) {
    const chartIndex = createChartIndex(data);
    api.setChartIndex(chartIndex);

    // Save the container for later updates
    container = d3.select(this).attr("width", "100%").attr("height", "100%");

    // Set up the shared transition
    transition = d3.transition().duration(api.config.plot.transitionDuration);

    // Build the figure
    let plot = container
      .selectAll("svg.clusterMap")
      .data([data])
      .join(
        (enter) => {
          // Add HTML colour picker input
          enter
            .append("input")
            .attr("id", "picker")
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
            .style("font-family", api.config.plot.fontFamily)
            .on("mouseenter", api.tooltip.enter)
            .on("mouseleave", api.tooltip.leave);

          // Add root SVG element
          let svg = enter
            .append("svg")
            .attr("class", "clusterMap")
            .attr("id", "root-svg")
            .attr("cursor", "grab")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

          let defs = svg.append("defs");
          let filter = defs
            .append("filter")
            .attr("id", "filter_solid")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 1)
            .attr("height", 1);
          filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
          filter
            .append("feComposite")
            .attr("in", "SourceGraphic")
            .attr("in2", "");

          let g = svg.append("g").attr("class", "clusterMapG");

          // Attach pan/zoom behaviour
          zoom = d3
            .zoom()
            .scaleExtent([0, 8])
            .on("zoom", (event) => g.attr("transform", event.transform))
            .on("start", () => svg.attr("cursor", "grabbing"))
            .on("end", () => svg.attr("cursor", "grab"));
          svg.call(zoom).on("dblclick.zoom", null);

          return g;
        },
        (update) =>
          update.call((update) => {
            update.call(arrangePlot);
          })
      );

    api.scale.update(data);

    // Only disable grouping if explicitly defined false
    if (data.config && data.config.updateGroups === false) {
      if (!data.groups) data.groups = [];
    } else {
      data.groups = createLinkGroups(data.links, data.groups);
    }

    api.link.updateGroups(data.groups);

    container = d3.select(this);

    let linkGroup = plot
      .selectAll("g.links")
      .data([data])
      .join("g")
      .attr("class", "links");

    let clusterGroup = plot
      .selectAll("g.clusters")
      .data([data.clusters])
      .join("g")
      .attr("class", "clusters");

    let clusters = clusterGroup
      .selectAll("g.cluster")
      .data(data.clusters, (d) => d.uid)
      .join(
        (enter) => {
          enter = enter
            .append("g")
            .attr("id", api.cluster.getId)
            .attr("class", "cluster");
          let info = enter
            .append("g")
            .attr("id", (c) => `cinfo_${c.uid}`)
            .attr("class", "clusterInfo")
            .attr("transform", `translate(-10, 0)`)
            .call(api.cluster.drag);
          info
            .append("text")
            .text((c) => c.name)
            .attr("class", "clusterText")
            .attr("y", 8)
            .attr("cursor", "pointer")
            .style("font-weight", "bold")
            .style("font-family", api.config.plot.fontFamily)
            .on("click", renameText);
          info
            .append("text")
            .attr("class", "locusText")
            .attr("y", 12)
            .style("dominant-baseline", "hanging")
            .style("font-family", api.config.plot.fontFamily);
          enter.append("g").attr("class", "loci");
          info
            .selectAll("text")
            .attr("text-anchor", "end")
            .style("font-family", api.config.plot.fontFamily);
          return enter.call(api.cluster.update);
        },
        (update) =>
          update.call((update) =>
            update.transition(transition).call(api.cluster.update)
          )
      );

    let loci = clusters
      .selectAll("g.loci")
      .selectAll("g.locus")
      .data(
        (d) => d.loci,
        (d) => d.uid
      )
      .join(
        (enter) => {
          // Make sure that, on first appearance of data, we
          // convert to relative coordinates.
          for (const locus of enter.data()) {
            if (locus.start === 0) continue;
            locus._bio_start = locus.start;
            locus._bio_end = locus.end;
            locus.start = 0;
            locus.end = locus._bio_end - locus._bio_start;
            for (const gene of locus.genes) {
              gene._start = gene.start - locus._bio_start;
              gene._end = gene.end - locus._bio_start;
            }
          }
          enter = enter
            .append("g")
            .attr("id", api.locus.getId)
            .attr("class", "locus");
          enter.append("line").attr("class", "trackBar").style("fill", "#111");
          let hover = enter
            .append("g")
            .attr("class", "hover hidden")
            .attr("opacity", 0);
          enter.append("g").attr("class", "genes");
          hover
            .append("rect")
            .attr("class", "hover")
            .attr("fill", "rgba(0, 0, 0, 0.4)")
            .call(api.locus.dragPosition);
          hover
            .append("rect")
            .attr("class", "leftHandle")
            .attr("x", -8)
            .call(api.locus.dragResize);
          hover
            .append("rect")
            .attr("class", "rightHandle")
            .call(api.locus.dragResize);
          hover
            .selectAll(".leftHandle, .rightHandle")
            .attr("width", 8)
            .attr("cursor", "pointer");
          enter
            .on("mouseenter", (event) => {
              if (api.flags.isDragging) return;
              d3.select(event.target)
                .select("g.hover")
                .transition()
                .attr("opacity", 1);
            })
            .on("mouseleave", (event) => {
              if (api.flags.isDragging) return;
              d3.select(event.target)
                .select("g.hover")
                .transition()
                .attr("opacity", 0);
            })
            .on("dblclick", (_, d) => {
              flipLocus(d);
              api.plot.update();
            });
          return enter.call(api.locus.update);
        },
        (update) =>
          update.call((update) =>
            update.transition(transition).call(api.locus.update)
          )
      );

    loci
      .selectAll("g.genes")
      .selectAll("g.gene")
      .data(
        (d) => d.genes,
        (d) => d.uid
      )
      .join(
        (enter) => {
          enter = enter
            .append("g")
            .attr("id", api.gene.getId)
            .attr("class", "gene")
            .attr("display", "inline");
          enter
            .append("polygon")
            .on("click", api.config.gene.shape.onClick)
            .on("contextmenu", api.gene.contextMenu)
            .attr("class", "genePolygon");
          enter
            .append("text")
            .attr("class", "geneLabel")
            .attr("dy", "-0.3em")
            .style("font-family", api.config.plot.fontFamily);
          return enter.call(api.gene.update);
        },
        (update) =>
          update.call((update) =>
            update.transition(transition).call(api.gene.update)
          )
      );

    linkGroup
      .selectAll("g.geneLinkG")
      .data(
        filterLinks(data.links, {
          groupForGene: api.scales.group,
          geneForUid: api.get.geneData,
          bestOnly: api.config.link.bestOnly,
          threshold: api.config.link.threshold,
        }),
        api.link.getId
      )
      .join(
        (enter) => {
          enter = enter
            .append("g")
            .attr("id", api.link.getId)
            .attr("class", "geneLinkG");
          enter.append("path").attr("class", "geneLink");
          enter
            .append("text")
            .text((d) => d.identity.toFixed(2))
            .attr("class", "geneLinkLabel")
            .style("fill", "white")
            .style("text-anchor", "middle")
            .style("font-family", api.config.plot.fontFamily);
          // Initial and subsequent static renders must use the scale model.
          // Live DOM transforms are only needed while a locus is being dragged.
          return enter.call(api.link.update, true);
        },
        (update) =>
          update.call((update) =>
            update
              .classed("hidden", api.config.link.show ? false : true)
              .transition(transition)
              .call(api.link.update, true)
          ),
        (exit) =>
          exit.call((exit) => {
            exit.transition(transition).attr("opacity", 0).remove();
          })
      );

    let legendFn = getLegendFn();
    let scaleBarFn = getScaleBarFn();
    let colourBarFn = getColourBarFn();

    plot.call(legendFn).call(colourBarFn).call(scaleBarFn).call(arrangePlot);

    if (!hasInitialView) fitInitialView(container.select("svg.clusterMap"), plot);
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

  function arrangePlot(selection) {
    let showSbar = api.config.plot.scaleGenes;
    selection
      .select("g.scaleBar")
      .classed("hidden", showSbar ? false : true)
      .transition(transition)
      .attr("opacity", showSbar ? 1 : 0)
      .attr("transform", api.plot.scaleBarTransform);

    let showCbar = api.config.link.groupColour || !api.config.link.show;
    selection
      .select("g.colourBar")
      .classed("hidden", showCbar ? true : false)
      .transition(transition)
      .attr("opacity", showCbar ? 0 : 1)
      .attr("transform", api.plot.colourBarTransform);

    selection
      .select("g.legend")
      .transition(transition)
      .attr("transform", api.plot.legendTransform);
  }

  function changeGeneColour(_, data) {
    let picker = d3.select("input.colourPicker");
    picker.on("change", () => {
      data.colour = picker.node().value;
      api.plot.update();
    });
    picker.node().click();
  }

  function resizeScaleBar() {
    let result = prompt("Enter new length (bp):", api.config.scaleBar.basePair);
    if (result) {
      api.config.scaleBar.basePair = result;
      api.plot.update();
    }
  }

  function getScaleBarFn() {
    return scaleBar(api.scales.x)
      .stroke(api.config.scaleBar.stroke)
      .height(api.config.scaleBar.height)
      .colour(api.config.scaleBar.colour)
      .basePair(api.config.scaleBar.basePair)
      .fontSize(api.config.scaleBar.fontSize)
      .onClickText(resizeScaleBar)
      .transition(transition);
  }

  function getColourBarFn() {
    return colourBar(api.scales.score)
      .width(api.config.colourBar.width)
      .height(api.config.colourBar.height)
      .fontSize(api.config.colourBar.fontSize)
      .transition(transition);
  }

  function getHiddenGeneGroups() {
    let hidden;
    let genes = d3.selectAll("g.gene");
    if (genes.empty()) {
      hidden = [];
    } else {
      hidden = api.scales.colour.domain();
      genes.each((d, i, n) => {
        let display = d3.select(n[i]).attr("display");
        let group = api.scales.group(d.uid);
        if (display === "inline" && group !== null && hidden.includes(group))
          hidden = hidden.filter((g) => g !== group);
      });
    }
    return hidden;
  }

  function getLegendFn() {
    let hidden = getHiddenGeneGroups();
    return legend(api.scales.colour)
      .hidden(hidden)
      .fontSize(api.config.legend.fontSize)
      .entryHeight(api.config.legend.entryHeight)
      .onClickCircle(api.config.legend.onClickCircle || changeGeneColour)
      .onClickText(api.config.legend.onClickText)
      .onAltClickText(api.config.legend.onAltClickText);
  }

  my.config = function (_) {
    if (!arguments.length) return api.config;
    api.plot.updateConfig(_);
    return my;
  };
  my.data = (data) => {
    if (!data) return container.select("svg.clusterMap").datum();
    container.datum(data).call(my);
    return my;
  };

  return my;
}
