import { createLinkGroups } from "./links/groups.mjs";
import { createChartState, getCamera, flipLocus, setCamera } from "./chartState.mjs";
import { createChartIndex } from "./data/index.mjs";
import { normalizeChartData } from "./data/normalize.mjs";
import { renderSvg } from "./svgRenderer.js";
import * as api from "./api.js";

export default function clusterMap() {
  /* A ClusterMap plot. */

  let container = null;
  let transition = d3.transition();
  let zoom = null;
  let hasInitialView = false;
  let chartState = null;

  api.plot.update = () => container.call(my);
  api.plot.data = (data) => my.data(data);

  function my(selection) {
    selection.each(update);
  }

  function update(data) {
    data = normalizeChartData(data);
    const chartIndex = createChartIndex(data);
    chartState = createChartState(data, chartState);
    api.setChartIndex(chartIndex);
    api.setChartState(chartState);

    // Save the container for later updates
    container = d3.select(this).attr("width", "100%").attr("height", "100%");

    // Set up the shared transition
    transition = d3.transition().duration(api.config.plot.transitionDuration);

    // Build the figure
    const svg = container
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
    applyCamera(svg.select("g.clusterMapViewport"));

    api.scale.update(data);

    // Only disable grouping if explicitly defined false
    if (data.config && data.config.updateGroups === false) {
      if (!data.groups) data.groups = [];
    } else {
      data.groups = createLinkGroups(data.links, data.groups);
    }

    api.link.updateGroups(data.groups);

    const scene = api.layout.update(data);

    renderSvg({
      plot,
      data,
      scene,
      transition,
      animate: hasInitialView,
      config: api.config,
      scales: api.scales,
      ids: {
        cluster: api.cluster.getId,
        locus: api.locus.getId,
        gene: api.gene.getId,
        link: api.link.getId,
      },
      lookup: { gene: api.get.geneData },
      interactions: {
        dragCluster: api.cluster.drag,
        dragLocusPosition: api.locus.dragPosition,
        dragLocusResize: api.locus.dragResize,
        isDragging: () => api.flags.isDragging,
        flipLocus: (locus) => {
          flipLocus(chartState, locus);
          api.plot.update();
        },
        onGeneClick: api.config.gene.shape.onClick,
        showGeneMenu: api.gene.contextMenu,
        setScaleBarLength: (value) => {
          api.config.scaleBar.basePair = value;
          api.plot.update();
        },
        chooseLegendColour: (group) => {
          const picker = container.select("input.colourPicker");
          picker.on("change", () => {
            group.colour = picker.node().value;
            api.plot.update();
          });
          picker.node().click();
        },
      },
    });

    if (!hasInitialView) fitInitialView(svg, plot);
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

  function applyCamera(selection) {
    const { x, y, k } = getCamera(chartState);
    selection.attr("transform", `translate(${x}, ${y}) scale(${k})`);
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
