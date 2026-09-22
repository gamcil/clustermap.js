import { renameText, updateConfig } from "./utils.js";
import defaultConfig from "./config.js";
import { getGroupScaleValues } from "./links/groups.mjs";
import {
  flipLocus,
  getClusterOffset,
  formatLocusText,
  getClusterOrder,
  getGeneState,
  getLocusOffset,
  getLocusState,
  initializeLocusOffsets,
  recalculateLocusCoordinates,
  setClusterOffset,
  setLocusOffset,
} from "./chartState.mjs";
import {
  getClusterExtents,
  getLocusScaleValues,
  xDistance,
} from "./loci/layout.mjs";
import { buildScene } from "./layout.mjs";

function refreshClusterOffsetScale() {
  scales.offset.range(
    scales.offset.domain().map((uid) => getClusterOffset(chartState, uid))
  );
}

function refreshLocusOffsetScale() {
  scales.locus.range(
    scales.locus.domain().map((uid) => getLocusOffset(chartState, uid))
  );
}

function locusLayout() {
  return {
    scaleX: scales.x,
    clusterOffset: scales.offset,
    locusOffset: scales.locus,
    locusState,
    spacing: config.locus.spacing,
  };
}

function updateLocusScaling(locus) {
  const { oldStart } = recalculateLocusCoordinates(
    chartState,
    locus,
    config.plot.scaleGenes
  );
  setLocusOffset(
    chartState,
    locus.uid,
    getLocusOffset(chartState, locus.uid) +
      xDistance(scales.x, locusState(locus).start, oldStart)
  );
  refreshLocusOffsetScale();
}

const config = Object.assign({}, defaultConfig);
const flags = { isDragging: false };
let chartIndex = null;
let chartState = null;
let scene = null;

function setChartIndex(index) {
  chartIndex = index;
}

function setChartState(state) {
  chartState = state;
}

function locusState(locus) {
  return getLocusState(chartState, locus);
}

function displayGene(gene) {
  return { ...gene, ...getGeneState(chartState, gene) };
}

const get = {
  geneData: (uid) => chartIndex?.geneById.get(uid),
  locusData: (uid) => chartIndex?.locusById.get(uid),
  clusterData: (uid) => chartIndex?.clusterById.get(uid),
};

const plot = {
  legendTransform: (d) => {
    let [_, max] = getClusterExtents(d.clusters, locusLayout());
    return `translate(${max + config.legend.marginLeft}, ${0})`;
  },
  bottomY: () => {
    let range = scales.y.range();
    let body = config.gene.shape.bodyHeight + 2 * config.gene.shape.tipHeight;
    return range[range.length - 1] + body;
  },
  colourBarTransform: () => {
    let x = config.plot.scaleGenes
      ? scales.x(config.scaleBar.basePair) + 20
      : 0;
    let y = plot.bottomY() + config.colourBar.marginTop;
    return `translate(${x}, ${y})`;
  },
  scaleBarTransform: () => {
    let y = plot.bottomY() + config.scaleBar.marginTop;
    return `translate(0, ${y})`;
  },
  updateConfig: function (target) {
    updateConfig(config, target);
  },
  update: null,
  data: null,
};

const scales = {
  x: d3.scaleLinear().domain([1, 1001]).range([0, config.plot.scaleFactor]),
  y: d3.scaleOrdinal(),
  group: d3.scaleOrdinal().unknown(null),
  colour: d3.scaleOrdinal().unknown("#bbb"),
  name: d3.scaleOrdinal().unknown("None"),
  score: d3.scaleSequential(d3.interpolateGreys).domain([0, 1]),
  offset: d3.scaleOrdinal(),
  locus: d3.scaleOrdinal(),
};

const _layout = {
  update: (data) => {
    // Normalise scale-dependent locus state before deriving immutable scene
    // geometry. Rendering must not be responsible for this state work.
    data.clusters.forEach((cluster) =>
      cluster.loci.forEach((locus) => updateLocusScaling(locus))
    );
    scene = buildScene(data, {
      scaleX: scales.x,
      scaleY: scales.y,
      clusterOffset: scales.offset,
      locusOffset: scales.locus,
      getLocusState: locusState,
      getGeneState: (gene) => getGeneState(chartState, gene),
      areClustersAdjacent: _cluster.adjacent,
      shape: config.gene.shape,
      label: config.gene.label,
      link: {
        asLine: config.link.asLine,
        straight: config.link.straight,
        threshold: config.link.threshold,
        labelPosition: config.link.label.position,
      },
      clusterLabel: _cluster.locusText,
      alignLabels: config.cluster.alignLabels,
      chrome: {
        legendMarginLeft: config.legend.marginLeft,
        scaleBarX: 0,
        scaleBarMarginTop: config.scaleBar.marginTop,
        colourBarX: config.plot.scaleGenes
          ? scales.x(config.scaleBar.basePair) + 20
          : 0,
        colourBarMarginTop: config.colourBar.marginTop,
      },
    });
    return scene;
  },
  get: () => scene,
};

const _gene = {
  getId: (d) => `gene_${d.uid}`,
  tooltipHTML: (g) => {
    // Create detached <div>
    let div = d3
      .create("div")
      .attr("class", "tooltip-contents")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("gap", "4px")
      .style("width", "260px");

    // This is HTML, not SVG: use ordinary form elements rather than SVG
    // <text> nodes so consumers can style the tooltip predictably.
    div.append("label").attr("for", "gene-label-input").text("Edit label");
    let text = div
      .append("input")
      .attr("id", "gene-label-input")
      .attr("type", "text")
      .attr("value", g.label || g.name || g.uid)
      .style("box-sizing", "border-box")
      .style("width", "100%");

    // Add multiple <select> for each saved gene identifier
    div
      .append("label")
      .attr("for", "gene-qualifiers-input")
      .text("Gene qualifiers");
    let select = div
      .append("select")
      .attr("id", "gene-qualifiers-input")
      .attr("multiple", true)
      .attr("size", 4)
      .style("box-sizing", "border-box")
      .style("width", "100%");
    const names = g.names || {};
    select
      .selectAll("option")
      .data(Object.keys(names))
      .join("option")
      .text((d) => `${names[d]} [${d}]`)
      .attr("value", (d) => names[d]);

    // Add group label
    let group = div.append("div").style("margin-top", "2px");
    const groupId = scales.group(g.uid);
    group.append("span").text("Similarity group: ");
    group
      .append("span")
      .text(scales.name(groupId))
      .style("color", scales.colour(groupId))
      .style("font-weight", "bold");

    // HTML colour inputs accept only hexadecimal colour values. D3's
    // interpolators produce rgb(...) strings, which browsers otherwise reset
    // to black when assigned as an input value.
    const geneColour = d3.color(g.colour || scales.colour(groupId));
    const pickerColour = geneColour ? geneColour.formatHex() : "#000000";

    // Add colour picker for changing individual gene colour
    div
      .append("label")
      .text("Choose gene colour: ")
      .append("input")
      .attr("type", "color")
      .attr("value", pickerColour)
      .property("value", pickerColour)
      .on("change", (e) => {
        g.colour = e.target.value;
        plot.update();
      });

    // Add anchoring button which will also automatically flip loci
    div
      .append("button")
      .text("Anchor map on gene")
      .on("click", (_) => _gene.anchor(_, g, true));

    // Add event handlers to update labels
    text.on("input", (e) => {
      g.label = e.target.value;
      select.attr("value", null);
      plot.update({});
    });
    select.on("change", (e) => {
      g.label = e.target.value;
      text.attr("value", e.target.value);
      plot.update({});
    });
    return div;
  },
  contextMenu: (event, data) => {
    event.preventDefault();

    // Clear tooltip contents, generate new data
    let tip = d3.select("div.tooltip");
    tip.html("");
    tip.append(() => _gene.tooltipHTML(data).node());

    // Get position relative to clicked element
    let rect = event.target.getBoundingClientRect();
    let bbox = tip.node().getBoundingClientRect();
    let xOffset = rect.width / 2 - bbox.width / 2;
    let yOffset = rect.height * 1.2;

    // Adjust position and show tooltip
    // Add a delayed fade-out transition if user does not enter tooltip
    tip
      .style("left", rect.x + xOffset + "px")
      .style("top", rect.y + yOffset + "px");
    tip
      .transition()
      .duration(100)
      .style("opacity", 1)
      .style("pointer-events", "all");
    tip
      .transition()
      .delay(1000)
      .style("opacity", 0)
      .style("pointer-events", "none");
  },
  anchor: (_, anchor, flipLoci = false) => {
    // Anchor map on given uid
    // Finds anchor genes in clusters given some initial anchor gene
    // Find gene links, then filter out any not containing the anchor
    let anchors = new Map();
    scales.group
      .domain()
      .filter((uid) => {
        // Filter for matching groups
        let g1 = scales.group(uid);
        let g2 = scales.group(anchor.uid);
        return g1 !== null && g1 === g2;
      })
      .forEach((uid) => {
        // Group remaining anchors by cluster
        let gene = get.geneData(uid);
        if (
          flipLoci &&
          displayGene(gene).strand !== displayGene(anchor).strand
        ) {
          let locus = get.locusData(gene._locus);
          flipLocus(chartState, locus);
          updateLocusScaling(locus);
        }
        if (anchors.has(gene._cluster)) {
          anchors.get(gene._cluster).push(uid);
        } else {
          anchors.set(gene._cluster, [uid]);
        }
      });

    if (anchors.length === 0) return;

    // Get the midpoint of the clicked anchor gene
    let getMidPoint = (data) =>
      scales.x(
        displayGene(data).start +
          (displayGene(data).end - displayGene(data).start) / 2
      ) +
      scales.locus(data._locus) +
      scales.offset(data._cluster);
    let midPoint = getMidPoint(anchor);

    // Calculate offset value of a link anchor from clicked anchor
    let getOffset = (link) => {
      let data = get.geneData(link);
      return midPoint - getMidPoint(data);
    };

    // Get smallest offset value from anchors on the same cluster
    let getGroupOffset = (group) => {
      if (group.includes(anchor.uid)) return 0;
      let offsets = group.map((l) => getOffset(l));
      let index = d3.minIndex(offsets, (l) => Math.abs(l));
      return offsets[index];
    };

    // Iterate all anchor groups and update offset scale range values
    for (const [cluster, group] of anchors.entries()) {
      setClusterOffset(
        chartState,
        cluster,
        getClusterOffset(chartState, cluster) + getGroupOffset(group)
      );
    }

    refreshClusterOffsetScale();
    plot.update();
  },
};

const _cluster = {
  getId: (d) => `cluster_${d.uid}`,
  /**
   * Generates locus coordinates displayed next underneath a cluster name.
   * If a locus is flipped, (reversed) will be added to its name.
   * @param {Object} cluster - Cluster data object
   * @returns {String} Comma-separated locus coordinates
   */
  locusText: (cluster) =>
    formatLocusText(cluster.loci, chartState, config.cluster.hideLocusCoordinates),
  /**
   * Tests if two clusters are vertically adjacent.
   * @param {String} one - First cluster UID
   * @param {String} two - Second cluster UID
   * @return {bool} - Clusters are adjacent
   */
  adjacent: (one, two) => {
    const domain = getClusterOrder(chartState);
    return Math.abs(domain.indexOf(one) - domain.indexOf(two)) === 1;
  },
};

const _link = {
  getId: (l) => `link-${l.uid}`,
  /**
   * Update group scales given new data.
   */
  updateGroups: (groups) => {
    let { domain, range } = getGroupScaleValues(groups);
    let uids = groups.map((g) => g.uid);
    scales.group.domain(domain).range(range);
    scales.name.domain(uids).range(groups.map((g) => g.label));
    let colours = d3.quantize(d3.interpolateRainbow, groups.length + 1);
    groups.forEach((group, index) => {
      if (group.colour) colours[index] = group.colour;
      else group.colour = colours[index];
    });
    scales.colour.domain(uids).range(colours);
  },
  hide: (event, datum) => {
    event.preventDefault();
    datum.hidden = true;
    plot.update();
  },
  rename: (event, datum) => {
    if (event.defaultPrevented) return;
    let text = d3.select(event.target);
    let result = prompt("Enter new value:", text.text());
    if (result) {
      datum.label = result;
      text.text(result);
      plot.update();
    }
  },
};

const _locus = {
  getId: (d) => `locus_${d.uid}`,
};

const _scale = {
  check: (s) => _scale.checkDomain(s) && _scale.checkRange(s),
  checkDomain: (s) => scales[s].domain().length > 0,
  checkRange: (s) => scales[s].range().length > 0,
  updateX: () => {
    scales.x.range([0, config.plot.scaleFactor]);
  },
  updateY: (data) => {
    let body = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
    let rng = data.clusters.map((_, i) => {
      return i * (config.cluster.spacing + body);
    });
    scales.y.range(rng);
  },
  updateOffset: (clusters) => {
    scales.offset.domain(clusters.map((d) => d.uid));
    refreshClusterOffsetScale();
  },
  updateLocus: (clusters) => {
    let { domain, range } = getLocusScaleValues(clusters, {
      ...locusLayout(),
      locusOffset: () => 0,
    });
    initializeLocusOffsets(
      chartState,
      domain.map((uid, index) => [uid, range[index]])
    );
    scales.locus.domain(domain);
    refreshLocusOffsetScale();
  },
  /**
   * Rescales offset and locus scales with an updated x scale.
   * @param {d3.scale} old - The old x scale
   */
  rescaleRanges: (old) => {
    for (const [uid, offset] of chartState.clusterOffsets) {
      setClusterOffset(chartState, uid, scales.x(old.invert(offset)));
    }
    for (const [uid, offset] of chartState.locusOffsets) {
      setLocusOffset(chartState, uid, scales.x(old.invert(offset)));
    }
    refreshClusterOffsetScale();
    refreshLocusOffsetScale();
  },
  /**
   * Updates all scales based on new data.
   * @param {Object} data - New data object
   */
  update: (data) => {
    let oldX = scales.x.copy();
    _scale.updateX();
    // Reproject dependent ranges only when the x-scale range actually
    // changes. Repeating invert()/scale() on every redraw accumulates small
    // floating-point errors, causing static link paths to drift after flips.
    let xRangeChanged = oldX
      .range()
      .some((value, index) => value !== scales.x.range()[index]);
    if (xRangeChanged) _scale.rescaleRanges(oldX);

    scales.y.domain(getClusterOrder(chartState));
    _scale.updateY(data);

    _scale.updateOffset(data.clusters);
    _scale.updateLocus(data.clusters);
  },
};

const _tooltip = {
  enter: (event) => {
    // Show the tooltip
    d3.select(event.target)
      .transition()
      .duration(0)
      .style("opacity", 1)
      .style("pointer-events", "all");

    // Hide tooltip when there's a click anywhere else in the window
    d3.select(window).on("click", (e) => {
      if (e.target === event.target || event.target.contains(e.target)) return;
      d3.select(event.target)
        .transition()
        .style("opacity", 0)
        .style("pointer-events", "none");
    });
  },
  leave: (event) => {
    // Do not hide tooltip if <input> has focus
    let tip = d3.select(event.target);
    let active = document.activeElement;
    if (active.tagName === "INPUT" && tip.node().contains(active)) return;
    tip
      .transition()
      .delay(400)
      .style("opacity", 0)
      .style("pointer-events", "none");
  },
};

const _group = {
  tooltipHTML: (g) => {
    // Create detached <div>
    let div = d3
      .create("div")
      .attr("class", "tooltip-contents")
      .style("display", "flex")
      .style("flex-direction", "column");

    // Add <input> so label can be edited directly
    div.append("text").text("Edit label");
    let text = div
      .append("input")
      .attr("type", "input")
      .attr("value", g.label || g.uid);

    // Add multiple <select> for each saved gene identifier
    div.append("text").text("Merge with...");
    let groups = plot.data().groups;
    let select = div.append("select").attr("multiple", true);
    select
      .selectAll("option")
      .data(groups.filter((d) => d.uid !== g.uid))
      .join("option")
      .text((d) => d.label)
      .attr("value", (d) => d.uid);

    div
      .append("button")
      .text("Merge!")
      .on("click", () => {
        // Find selected options from multiselect
        const selected = [];
        for (let opt of select.node().options)
          if (opt.selected) selected.push(opt);

        // Find indexes of selected groups in groups
        // + Merge genes to the current group
        // + Remove them from the multiselect
        let mergeeIds = [];
        for (const opt of selected) {
          let idx = groups.findIndex((d) => d.uid === opt.value);
          mergeeIds.push(idx);
          g.genes.push(...groups[idx].genes);
          opt.remove();
        }

        // Remove merged groups from the data
        // Reverse sort ensures splices do not affect lower indexes
        mergeeIds.sort((a, b) => b - a);
        for (const idx of mergeeIds) groups.splice(idx, 1);

        // Update the plot
        plot.data({ ...plot.data(), groups: groups });
        plot.update();
      });

    // Add colour picker for changing individual gene colour
    div
      .append("label")
      .append("text")
      .text("Choose group colour: ")
      .append("input")
      .attr("type", "color")
      .attr("default", g.colour)
      .on("change", (e) => {
        g.colour = e.target.value;
        plot.update();
      });

    // Add anchoring button which will also automatically flip loci
    div
      .append("button")
      .text("Hide group")
      .on("click", () => {
        g.hidden = true;
        plot.update();
      });

    // Add event handlers to update labels
    text.on("input", (e) => {
      g.label = e.target.value;
      select.attr("value", null);
      plot.update({});
    });
    select;
    return div;
  },
  contextMenu: (event, data) => {
    event.preventDefault();

    // Clear tooltip contents, generate new data
    let tip = d3.select("div.tooltip");
    tip.html("");
    tip.append(() => _group.tooltipHTML(data).node());

    // Get position relative to clicked element
    let rect = event.target.getBoundingClientRect();
    let bbox = tip.node().getBoundingClientRect();
    let xOffset = rect.width / 2 - bbox.width / 2;
    let yOffset = rect.height * 1.2;

    // Adjust position and show tooltip
    // Add a delayed fade-out transition if user does not enter tooltip
    tip
      .style("left", rect.x + xOffset + "px")
      .style("top", rect.y + yOffset + "px");
    tip
      .transition()
      .duration(100)
      .style("opacity", 1)
      .style("pointer-events", "all");
    tip
      .transition()
      .delay(1000)
      .style("opacity", 0)
      .style("pointer-events", "none");
  },
};

config.gene.shape.onClick = _gene.anchor;
config.legend.onClickText = _link.rename;
config.legend.onAltClickText = _group.contextMenu;

export {
  config,
  flags,
  get,
  setChartIndex,
  setChartState,
  plot,
  scales,
  _cluster as cluster,
  _gene as gene,
  _group as group,
  _link as link,
  _locus as locus,
  _scale as scale,
  _layout as layout,
  _tooltip as tooltip,
};
