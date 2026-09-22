import { renameText, updateConfig, rgbaToRgb } from "./utils.js";
import defaultConfig from "./config.js";
import { getGroupScaleValues } from "./links/groups.mjs";
import {
  getLinkAnchors,
  getLinkLabelPosition,
  getLinkPath,
} from "./links/layout.mjs";
import {
  getGeneLabelDy,
  getGeneLabelTransform,
  getGenePolygonPoints,
} from "./genes/layout.mjs";
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
  setClusterOrder,
  setLocusOffset,
} from "./chartState.mjs";
import {
  getClusterExtent,
  getClusterExtents,
  getLocusScaleValues,
  xDistance,
} from "./loci/layout.mjs";

function getClosestValue(values, value) {
  return Math.max(Math.min(d3.bisectLeft(values, value), values.length - 1), 0);
}

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

function getChartExtent(ignoredLoci) {
  const clusters = scales.offset.domain().map(get.clusterData);
  return getClusterExtents(clusters, locusLayout(), ignoredLoci);
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

function geneVisible(gene) {
  const locus = get.locusData(gene._locus);
  const bounds = locusState(locus);
  const display = displayGene(gene);
  return display.start >= bounds.start && display.end <= bounds.end + 1;
}

function _get(uid, type) {
  return d3.select(`#${type}_${uid}`);
}

const get = {
  gene: (uid) => _get(uid, "gene"),
  locus: (uid) => _get(uid, "locus"),
  cluster: (uid) => _get(uid, "cluster"),
  geneData: (uid) => chartIndex?.geneById.get(uid),
  locusData: (uid) => chartIndex?.locusById.get(uid),
  clusterData: (uid) => chartIndex?.clusterById.get(uid),
  matrix: (selection) => selection.node().transform.baseVal[0].matrix,
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

const _gene = {
  getId: (d) => `gene_${d.uid}`,
  fill: (g) => {
    if (g.colour) return g.colour;
    if (!scales.group) return "#bbb";
    let groupId = scales.group(g.uid);
    return scales.colour(groupId);
  },
  points: (gene) =>
    getGenePolygonPoints(displayGene(gene), {
      scaleX: scales.x,
      shape: config.gene.shape,
    }),
  labelTransform: (gene) =>
    getGeneLabelTransform(displayGene(gene), {
      scaleX: scales.x,
      shape: config.gene.shape,
      label: config.gene.label,
    }),
  labelDy: () => getGeneLabelDy(config.gene.label.position),
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
  labelText: (g) => g.label || g.uid,
  polygonClass: (g) => {
    let group = scales.group(g.uid);
    return group !== null ? `genePolygon group-${group}` : "genePolygon";
  },
  update: (selection) => {
    selection.attr("display", (gene) => (geneVisible(gene) ? "inline" : "none"));
    selection
      .selectAll("polygon")
      .attr("class", _gene.polygonClass)
      .attr("points", _gene.points)
      .attr("fill", _gene.fill)
      .style("stroke", config.gene.shape.stroke)
      .style("stroke-width", config.gene.shape.strokeWidth);
    selection
      .selectAll("text.geneLabel")
      .text(_gene.labelText)
      .attr("dy", _gene.labelDy)
      .attr("display", config.gene.label.show ? "inherit" : "none")
      .attr("transform", _gene.labelTransform)
      .attr("font-size", config.gene.label.fontSize)
      .attr("text-anchor", config.gene.label.anchor);
    // .attr("dominant-baseline", _gene.labelBaseline)
    return selection;
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
  transform: (c) => `translate(${scales.offset(c.uid)}, ${scales.y(c.uid)})`,
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
  /**
   * Aligns clusterInfo <g> elements based on leftmost cluster in the map.
   * Should be used on a D3 selection using call().
   * @param {d3.selection} selection - g.clusterInfo selection
   * @return {d3.selection}
   */
  alignLabels: (selection) => {
    let [min] = getChartExtent();
    return selection.attr("transform", (d) => {
      let value = min - scales.offset(d.uid);
      return `translate(${value - 10}, 0)`;
    });
  },
  update: (selection) => {
    selection.selectAll("g.locus").each(updateLocusScaling);
    selection.attr("transform", _cluster.transform);
    if (config.cluster.alignLabels) {
      selection.selectAll(".clusterInfo").call(_cluster.alignLabels);
    } else {
      selection.selectAll(".clusterInfo").attr("transform", (d) => {
        let [min] = getClusterExtent(d, locusLayout());
        let value = min - 10 - scales.offset(d.uid);
        return `translate(${value}, 0)`;
      });
    }
    selection
      .selectAll("text.locusText")
      .text(_cluster.locusText)
      .style("font-size", `${config.cluster.lociFontSize}px`);
    selection
      .selectAll("text.clusterText")
      .style("font-size", `${config.cluster.nameFontSize}px`);
    return selection;
  },
  drag: (selection) => {
    let y, range, order;

    const started = (event, d) => {
      flags.isDragging = true;
      order = [...getClusterOrder(chartState)];

      // Get subject cluster, change cursor
      let cluster = get.cluster(d.uid);
      cluster.classed("active", true).attr("cursor", "grabbing");

      // Get current position of subject cluster
      y = get.matrix(cluster).f - event.y;

      // Get y-axis bounds for dragging
      range = scales.y.range();
    };

    const dragged = (event, d) => {
      // Select cluster and raise here to not consume click event in cluster label
      let me = get.cluster(d.uid);
      me.raise();

      // Get current y value with mouse event
      let yy = Math.min(range[range.length - 1], Math.max(range[0], y + event.y));
      me.attr("transform", (d) => `translate(${scales.offset(d.uid)}, ${yy})`);

      // Snap to the closest configured cluster row, while leaving the dragged
      // cluster under the pointer until the drag ends.
      let p = range.reduce(
        (closest, position, index) =>
          Math.abs(position - yy) < Math.abs(range[closest] - yy) ? index : closest,
        0
      );
      let current = order.indexOf(d.uid);

      d3.selectAll("g.geneLinkG").call(_link.update);

      if (p === current) return;

      order.splice(current, 1);
      order.splice(p, 0, d.uid);
      order.forEach((uid, index) => {
        if (uid === d.uid) return;
        get.cluster(uid)
          .transition()
          .attr("transform", `translate(${scales.offset(uid)}, ${range[index]})`);
      });
    };

    const ended = () => {
      flags.isDragging = false;
      setClusterOrder(chartState, order);
      plot.update();
    };

    return d3
      .drag()
      .container(function () {
        return this.parentNode.parentNode;
      })
      .on("start", started)
      .on("drag", dragged)
      .on(
        "end",
        ended
      )(selection);
  },
};

const _link = {
  getId: (l) => `link-${l.uid}`,
  /**
   * Determines the opacity of a given link.
   * A link is hidden (opacity set to 0) if a) the query or target genes are
   * hidden, or b) if config.link.show is false.
   */
  opacity: (l) => {
    let a = get.gene(l.query.uid).attr("display");
    let b = get.gene(l.target.uid).attr("display");
    let hide = ["none", null]; // Set to none or still undefined
    return !config.link.show || hide.includes(a) || hide.includes(b) ? 0 : 1;
  },
  fill: (d) => {
    if (config.link.asLine) return "none";
    if (config.link.groupColour)
      return rgbaToRgb(scales.colour(scales.group(d.query.uid)));
    return scales.score(d.identity);
  },
  stroke: (d) => {
    if (config.link.groupColour) {
      let colour = scales.colour(scales.group(d.query.uid));
      return config.link.asLine ? rgbaToRgb(colour) : colour;
    }
    if (config.link.asLine) return scales.score(d.identity);
    return "black";
  },
  /**
   * Updates position of gene link <path> and <text> elements.
   * @param {bool} snap - calculate path to axis, not including transform matrix
   */
  update: (selection, snap) => {
    if (!config.link.show) return selection.attr("opacity", 0);
    const values = {};
    selection.each(function (data) {
      const anchors = _link.getAnchors(data, snap);
      if (!anchors || data.identity < config.link.threshold) {
        values[data.uid] = {
          d: null,
          anchors: null,
          opacity: 0,
          x: null,
          y: null,
        };
        return;
      }
      const labelPosition = getLinkLabelPosition(
        anchors,
        config.link.label.position
      );
      values[data.uid] = {
        anchors: anchors,
        opacity: 1,
        x: labelPosition.x,
        y: labelPosition.y,
      };
    });
    selection.attr("opacity", 1);
    selection
      .selectAll("path")
      .attr("d", (d) => _link.path(values[d.uid].anchors))
      .style("fill", _link.fill)
      .style("stroke", _link.stroke)
      .style("stroke-width", `${config.link.strokeWidth}px`);
    selection
      .selectAll("text")
      .attr("opacity", (d) =>
        config.link.label.show ? values[d.uid].opacity : 0
      )
      .attr("filter", () =>
        config.link.label.background ? "url(#filter_solid)" : null
      )
      .style("font-size", () => `${config.link.label.fontSize}px`)
      .attr("x", (d) => values[d.uid].x)
      .attr("y", (d) => values[d.uid].y);
    return selection;
  },
  path: (anchors) =>
    getLinkPath(anchors, {
      asLine: config.link.asLine,
      straight: config.link.straight,
    }),
  getAnchors: (d, snap) => {
    const useScalePositions = snap || false;
    return getLinkAnchors(d, {
      geneForUid: (uid) => displayGene(get.geneData(uid)),
      areClustersAdjacent: _cluster.adjacent,
      scaleX: scales.x,
      horizontalOffset: (gene) => {
        if (useScalePositions)
          return scales.offset(gene._cluster) + scales.locus(gene._locus);
        return scales.offset(gene._cluster) + get.matrix(get.locus(gene._locus)).e;
      },
      verticalPosition: (gene) =>
        useScalePositions
          ? scales.y(gene._cluster)
          : get.matrix(get.cluster(gene._cluster)).f,
      geneMidpoint:
        config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2,
    });
  },
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
  realLength: (d) => {
    const state = locusState(d);
    return xDistance(scales.x, state.start, state.end);
  },
  updateTrackBar: (selection) => {
    let midPoint =
      config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;
    selection
      .select("line.trackBar")
      .attr("x1", (d) => scales.x(locusState(d).start))
      .attr("x2", (d) => scales.x(locusState(d).end))
      .attr("y1", midPoint)
      .attr("y2", midPoint)
      .style("stroke", config.locus.trackBar.colour)
      .style("stroke-width", config.locus.trackBar.stroke);
    return selection;
  },
  updateHoverBox: (selection) => {
    let botPoint =
      config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
    selection
      .selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
      .attr("y", -10)
      .attr("height", botPoint + 20);
    selection
      .select("rect.hover")
      .attr("x", (d) => scales.x(locusState(d).start))
      .attr("width", _locus.realLength);
    selection
      .select("rect.leftHandle")
      .attr("x", (d) => scales.x(locusState(d).start) - 8);
    selection
      .select("rect.rightHandle")
      .attr("x", (d) => scales.x(locusState(d).end));
    return selection;
  },
  update: (selection) =>
    selection
      .attr("transform", (d) => `translate(${scales.locus(d.uid)}, 0)`)
      .call(_locus.updateTrackBar)
      .call(_locus.updateHoverBox),
  dragResize: (selection) => {
    let minPos, value, initial;

    const started = (_, d) => {
      [minPos] = getChartExtent([d.uid]);
      flags.isDragging = true;
      initial = scales.x(locusState(d).start);
    };

    function dragged(event, d) {
      let handle = d3.select(this);
      if (handle.attr("class") === "leftHandle") {
        _left(event, d, handle);
      } else {
        _right(event, d, handle);
      }
    }

    const _left = (event, d, handle) => {
      const state = locusState(d);
      // Find closest gene start, from start to _end
      let genes = d.genes
        .filter((gene) => displayGene(gene).end <= state.end)
        .sort((a, b) =>
          displayGene(a).start > displayGene(b).start ? 1 : -1
        );
      let starts = [d.start, ...genes.map((gene) => displayGene(gene).start)];
      let coords = starts.map((value) => scales.x(value));
      let position = getClosestValue(coords, event.x);
      value = coords[position];
      state.start = starts[position];
      state.trimLeft = state.start === starts[0] ? null : genes[position - 1];

      // Adjust the dragged rect
      handle.attr("x", value - 8);

      // Resize the hover <rect>, hide any genes not within bounds
      let locus = get.locus(d.uid);
      locus
        .select("rect.hover")
        .attr("x", value)
        .attr("width", _locus.realLength);
      locus
        .selectAll("g.gene")
        .attr("display", (g) =>
          displayGene(g).start >= state.start &&
          displayGene(g).end <= state.end + 1
            ? "inline"
            : "none"
        );
      locus.call(_locus.updateTrackBar);

      // Hide any gene links connected to hidden genes
      d3.selectAll("path.geneLink").attr("opacity", _link.opacity);

      if (config.cluster.alignLabels) {
        // Add offset/locus scale values to make equivalent to minPos from
        // cluster.extent(), then remove from per-cluster transforms
        let offs = scales.offset(d._cluster) + scales.locus(d.uid);
        let newMin = Math.min(value + offs, minPos) - 10;
        d3.selectAll("g.clusterInfo").attr("transform", (c) => {
          let blah = newMin - scales.offset(c.uid);
          return `translate(${blah}, 0)`;
        });
      } else {
        d3.select(`#cinfo_${d._cluster}`).attr(
          "transform",
          `translate(${scales.locus(d.uid) + scales.x(state.start) - 10}, 0)`
        );
      }
    };

    const _right = (event, d, handle) => {
      const state = locusState(d);
      // Find closest visible gene end, from _start to end
      let genes = d.genes
        .filter((gene) => displayGene(gene).start >= state.start)
        .sort((a, b) =>
          displayGene(a).start > displayGene(b).start ? 1 : -1
        );
      let geneEnds = genes.map((gene) => displayGene(gene).end);
      let ends = [...geneEnds, config.plot.scaleGenes ? d.end : state.end];
      let range = ends.map((value) => scales.x(value));
      let position = getClosestValue(range, event.x);
      state.trimRight = genes[position] ? genes[position] : null;
      state.end = ends[position];

      // Transform handle rect
      handle.attr("x", scales.x(state.end));

      // Update rect width, hide genes out of bounds
      let locus = get.locus(d.uid);
      locus.select("rect.hover").attr("width", _locus.realLength);
      locus
        .selectAll("g.gene")
        .attr("display", (g) =>
          displayGene(g).start >= state.start &&
          displayGene(g).end <= state.end + 1
            ? "inline"
            : "none"
        );
      locus.call(_locus.updateTrackBar);

      // Hide any gene links attached to hidden genes
      d3.selectAll("path.geneLink").attr("opacity", _link.opacity);

      // Adjust position of legend when final locus _end property changes
      d3.select("g.legend").attr("transform", plot.legendTransform);
    };

    const ended = (_, d) => {
      flags.isDragging = false;
      // Check if visible locus coordinates equal default coordinates in data
      // If yes, make sure trimLeft/trimRight are reset to null
      const state = locusState(d);
      if (state.end === d.end) state.trimRight = null;
      if (state.start === d.start) state.trimLeft = null;
      d3.select(`#locus_${d.uid} .hover`).transition().attr("opacity", 0);
      plot.update();
    };

    return d3.drag().on("start", started).on("drag", dragged).on("end", ended)(
      selection
    );
  },
  dragPosition: (selection) => {
    let minPos, maxPos, offset, value, locus;

    const started = (event, d) => {
      [minPos, maxPos] = getChartExtent([d.uid]);
      offset = event.x;
      value = scales.locus(d.uid);
      flags.isDragging = true;
    };

    const dragged = (event, d) => {
      value += event.x - offset;

      locus = get.locus(d.uid);
      locus.attr("transform", `translate(${value}, 0)`);

      // Adjust any gene links affected by moving the locus.
      // Make sure setLinkPath is called with snap=false
      d3.selectAll("g.geneLinkG").call(_link.update, false);

      // Adjust clusterInfo groups
      let locData = locus.datum();
      let locStart = scales.x(locusState(locData).start);
      if (config.cluster.alignLabels) {
        let locMin = value + scales.offset(d._cluster) + locStart;
        let newMin = Math.min(locMin, minPos) - 10;
        d3.selectAll("g.clusterInfo").attr(
          "transform",
          (c) => `translate(${newMin - scales.offset(c.uid)}, 0)`
        );
      } else {
        // TODO: should take into consideration all loci in the cluster
        // use extentOne?
        d3.select(`#cinfo_${d._cluster}`).attr(
          "transform",
          `translate(${value + locStart - 10}, 0)`
        );
      }

      // Adjust legend group
      let locEnd = scales.x(locusState(locData).end);
      let newMax =
        Math.max(value + scales.offset(d._cluster) + locEnd, maxPos) + 20;
      d3.select("g.legend").attr("transform", `translate(${newMax}, 0)`);
    };

    const ended = (_, d) => {
      flags.isDragging = false;
      setLocusOffset(chartState, d.uid, value);
      refreshLocusOffsetScale();
      plot.update();
    };

    return d3.drag().on("start", started).on("drag", dragged).on("end", ended)(
      selection
    );
  },
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
  _tooltip as tooltip,
};
