import { renameText, updateConfig, rgbaToRgb } from "./utils.js";
import defaultConfig from "./config.js";

function getClosestValue(values, value) {
  return Math.max(Math.min(d3.bisectLeft(values, value), values.length - 1), 0);
}

function updateScaleRange(scale, uid, value) {
  let domain = scales[scale].domain();
  let range = scales[scale].range();
  let index = domain.indexOf(uid);
  range[index] = value;
  scales[scale].range(range);
}

const config = Object.assign({}, defaultConfig);
const flags = { isDragging: false };

function _get(uid, type) {
  return d3.select(`#${type}_${uid}`);
}

const get = {
  gene: (uid) => _get(uid, "gene"),
  locus: (uid) => _get(uid, "locus"),
  cluster: (uid) => _get(uid, "cluster"),
  geneData: (uid) => get.gene(uid).datum(),
  locusData: (uid) => get.locus(uid).datum(),
  clusterData: (uid) => get.cluster(uid).datum(),
  matrix: (selection) => selection.node().transform.baseVal[0].matrix,
};

const plot = {
  legendTransform: (d) => {
    let [_, max] = _cluster.extent(d.clusters);
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
  points: (g) => {
    // Calculates points attribute to draw a gene polygon
    let points = [];

    // Get start and end of Gene as percentages of Locus length
    let scaledStart = scales.x(g.start);
    let scaledEnd = scales.x(g.end);
    let geneLength = scaledEnd - scaledStart;

    // Calculate scaled constants based on scaled coordinates
    let bottom = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
    let midpoint = bottom / 2;
    let third = config.gene.shape.tipHeight + config.gene.shape.bodyHeight;

    // Determine polygon points for the Gene, 5' to 3' or 3' to 5'
    if (g.strand === 1) {
      let shaft = scaledEnd - config.gene.shape.tipLength;
      points = [
        scaledStart,
        config.gene.shape.tipHeight,
        shaft,
        config.gene.shape.tipHeight,
        shaft,
        0,
        scaledEnd,
        midpoint,
        shaft,
        bottom,
        shaft,
        third,
        scaledStart,
        third,
      ];
      // Squeeze arrow when total length is less than tip length
      if (geneLength < config.gene.shape.tipLength) {
        [2, 4, 8, 10].forEach((item) => (points[item] = scaledStart));
      }
    } else {
      let shaft = scaledStart + config.gene.shape.tipLength;
      points = [
        scaledEnd,
        config.gene.shape.tipHeight,
        shaft,
        config.gene.shape.tipHeight,
        shaft,
        0,
        scaledStart,
        midpoint,
        shaft,
        bottom,
        shaft,
        third,
        scaledEnd,
        third,
      ];
      if (geneLength < config.gene.shape.tipLength) {
        [2, 4, 8, 10].forEach((item) => (points[item] = scaledEnd));
      }
    }
    return points.join(" ");
  },
  labelTransform: (g) => {
    let offset = scales.x(g.end - g.start) * config.gene.label.start;
    let gx = scales.x(g.start) + offset;
    let gy;
    if (config.gene.label.position === "middle")
      gy = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;
    else if (config.gene.label.position === "bottom")
      gy =
        2 * config.gene.shape.tipHeight +
        config.gene.shape.bodyHeight +
        config.gene.label.spacing;
    else gy = -config.gene.label.spacing;
    let rotate = ["start", "middle"].includes(config.gene.label.anchor)
      ? -config.gene.label.rotation
      : config.gene.label.rotation;
    return `translate(${gx}, ${gy}) rotate(${rotate})`;
  },
  labelDy: () => {
    switch (config.gene.label.position) {
      case "top":
        return "-0.4em";
      case "middle":
        return "0.4em";
      case "bottom":
        return "0.8em";
    }
  },
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
    div.append("text").text("Gene qualifiers");
    let select = div.append("select").attr("multiple", true);
    select
      .selectAll("option")
      .data(Object.keys(g.names))
      .join("option")
      .text((d) => `${g.names[d]} [${d}]`)
      .attr("value", (d) => g.names[d]);

    // Add group label
    let group = div.append("div").style("margin-top", "2px").append("text");
    let groupId = scales.group(g.uid);
    group.append("tspan").text("Similarity group: ");
    group
      .append("tspan")
      .text(scales.name(groupId))
      .style("color", scales.colour(groupId))
      .style("font-weight", "bold");

    // Add colour picker for changing individual gene colour
    div
      .append("label")
      .append("text")
      .text("Choose gene colour: ")
      .append("input")
      .attr("type", "color")
      .attr("default", scales.colour(groupId))
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
    // Get original domain and range of cluster offset scale
    let domain = scales.offset.domain();
    let range = scales.offset.range();

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
        if (flipLoci && gene.strand !== anchor.strand) {
          let locus = get.locusData(gene._locus);
          _locus.flip(locus);
          _locus.updateScaling(locus);
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
      scales.x(data.start + (data.end - data.start) / 2) +
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
      let index = domain.findIndex((el) => el === cluster);
      range[index] += getGroupOffset(group);
    }

    // Update range, then update ClusterMap
    scales.offset.range(range);
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
    cluster.loci
      .map((locus) => {
        let start, end;

        // Calculate biological start/end, if exists
        // -- Calculate difference between trimmed start and real start of loci
        // -- Flip them if locus is flipped
        // -- Calculate new biological start/end based on differences
        // Note: adds 1 to locus start for display, as all coordinates are 0-based
        if (locus._bio_start) {
          let startDiff = locus._start - locus.start;
          let endDiff = locus.end - locus._end;
          if (locus._flipped) [startDiff, endDiff] = [endDiff, startDiff];
          start = locus._bio_start + startDiff + 1;
          end = locus._bio_end - endDiff;
        } else {
          // Otherwise, just use current relative start/end
          start = locus._start + 1;
          end = locus._end;
        }

        // Display in reverse if locus is flipped
        if (locus._flipped) [start, end] = [end, start];

        let flipped = locus._flipped ? " (reversed)" : "";
        if (
          config.cluster.hideLocusCoordinates ||
          locus._start == null ||
          locus._end == null
        )
          return `${locus.name}${flipped}`;
        return `${locus.name}${flipped}:${start.toFixed(0)}-${end.toFixed(0)}`;
      })
      .join(", "),
  /**
   * Calculates the extent of a single cluster.
   * @param {Object} cluster - Cluster data object
   * @return {Array} 2-element array containing min and max of the cluster
   */
  extentOne: (cluster, ignore) => {
    ignore = ignore || [];
    let start;
    let end;
    for (let locus of cluster.loci) {
      if (ignore.includes(locus.uid)) continue;
      let offset = scales.offset(cluster.uid) + scales.locus(locus.uid);
      let _start = scales.x(locus._start) + offset;
      let _end = scales.x(locus._end) + offset;
      if (!start || (start && _start < start)) start = _start;
      if (!end || (end && _end > end)) end = _end;
    }
    return [start, end];
  },
  /**
   * Finds minimum and maximum points of all clusters/loci.
   * @param {Array} ignore - Cluster UIDs to ignore
   * @return {Array} 2-element array containing min and max
   */
  extent: (ignore) => {
    ignore = ignore || [];
    let min, max;
    for (const uid of scales.offset.domain()) {
      // if (ignore.includes(uid)) continue
      let cluster = get.clusterData(uid);
      let [_min, _max] = _cluster.extentOne(cluster, ignore);
      if (!min || (min && _min < min)) min = _min;
      if (!max || (max && _max > max)) max = _max;
    }
    return [min, max];
  },
  /**
   * Tests if two clusters are vertically adjacent.
   * @param {String} one - First cluster UID
   * @param {String} two - Second cluster UID
   * @return {bool} - Clusters are adjacent
   */
  adjacent: (one, two) => {
    let a = get.cluster(one).datum();
    let b = get.cluster(two).datum();
    return Math.abs(a.slot - b.slot) === 1;
  },
  /**
   * Gets range for a cluster scale based on its loci
   * Note: transform on <g> element only applies to visible elements,
   *			 so no point adding offset here
   */
  getRange: (c) => {
    let range = [];
    let value = 1;
    let start, end, offset;
    for (const [index, locus] of c.loci.entries()) {
      if (index > 0)
        value = range[range.length - 1] + end - start + config.locus.spacing;
      offset = scales.locus(locus.uid) || 0;
      start = scales.x(locus._start || locus.start);
      end = scales.x(locus._end || locus.end);
      range.push(value - start + offset);
    }
    return range;
  },
  /**
   * Gets domain and range for the locus offset scale
   */
  getLocusScaleValues: (clusters) => {
    let domain = [];
    let range = [];
    clusters.forEach((cluster) => {
      let d = cluster.loci.map((locus) => locus.uid);
      let r = _cluster.getRange(cluster);
      domain.push(...d);
      range.push(...r);
    });
    return [domain, range];
  },
  /**
   * Aligns clusterInfo <g> elements based on leftmost cluster in the map.
   * Should be used on a D3 selection using call().
   * @param {d3.selection} selection - g.clusterInfo selection
   * @return {d3.selection}
   */
  alignLabels: (selection) => {
    let [min, _] = _cluster.extent();
    return selection.attr("transform", (d) => {
      let value = min - scales.offset(d.uid);
      return `translate(${value - 10}, 0)`;
    });
  },
  update: (selection) => {
    selection.selectAll("g.locus").each(_locus.updateScaling);
    selection.attr("transform", _cluster.transform);
    if (config.cluster.alignLabels) {
      selection.selectAll(".clusterInfo").call(_cluster.alignLabels);
    } else {
      selection.selectAll(".clusterInfo").attr("transform", (d) => {
        let [min, _] = _cluster.extentOne(d);
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
    let free, y, range, height;
    selection.each((d, i) => {
      d.slot = i;
    });

    const getDomain = () => {
      let clusters = [];
      selection.each((c) => {
        clusters.push(c);
      });
      clusters = clusters.sort((a, b) => (a.slot > b.slot ? 1 : -1));
      return clusters.map((c) => c.uid);
    };

    const started = (event, d) => {
      flags.isDragging = true;
      free = d.slot;

      // Get subject cluster, change cursor
      let cluster = get.cluster(d.uid);
      cluster.classed("active", true).attr("cursor", "grabbing");

      // Get current position of subject cluster
      y = get.matrix(cluster).f - event.y;

      // Get y-axis bounds for dragging
      range = scales.y.range();
      height = range[range.length - 1];
    };

    const dragged = (event, d) => {
      // Select cluster and raise here to not consume click event in cluster label
      let me = get.cluster(d.uid);
      me.raise();

      // Get current y value with mouse event
      let yy = Math.min(height, Math.max(0, y + event.y));
      me.attr("transform", (d) => `translate(${scales.offset(d.uid)}, ${yy})`);

      // Get closest index based on new y-position
      let domain = scales.y.domain();
      let p = Math.round(yy / (height / domain.length));

      d3.selectAll("g.geneLinkG").call(_link.update);

      if (p === d.slot) return;

      // Re-arrange the y-scale domain
      selection.each(function (e) {
        if (e.uid !== d.uid && e.slot === p) {
          e.slot = free;
          d.slot = free = p;
          let uid = scales.y.domain()[e.slot];
          let translate = (c) =>
            `translate(${scales.offset(c.uid)}, ${scales.y(uid)})`;
          get.cluster(e.uid).transition().attr("transform", translate);
        }
      });
    };

    const ended = () => {
      flags.isDragging = false;
      let dom = getDomain();
      scales.y.domain(dom);
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
      const [ax1, ax2, ay, bx1, bx2, by] = anchors;
      let aMid = ax1 + (ax2 - ax1) / 2;
      let bMid = bx1 + (bx2 - bx1) / 2;
      let horizontalMid = aMid + (bMid - aMid) * config.link.label.position;
      let verticalMid = ay + Math.abs(by - ay) * config.link.label.position;
      values[data.uid] = {
        d: `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`,
        anchors: anchors,
        opacity: 1,
        x: horizontalMid,
        y: verticalMid,
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
  /**
   * Generates sankey link path.
   * Draws bezier curves connecting ends of two genes.
   */
  sankey: ([ax1, ax2, ay, bx1, bx2, by]) => {
    let vMid = ay + Math.abs(by - ay) / 2;
    let path = d3.path();
    path.moveTo(ax2, ay);
    path.bezierCurveTo(ax2, vMid, bx2, vMid, bx2, by);
    path.lineTo(bx1, by);
    path.bezierCurveTo(bx1, vMid, ax1, vMid, ax1, ay);
    path.lineTo(ax2, ay);
    return path.toString();
  },
  /**
   * Generates straight link path.
   */
  straight: ([ax1, ax2, ay, bx1, bx2, by]) =>
    `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`,
  /**
   * Generates single line path.
   */
  line: ([ax1, ax2, ay, bx1, bx2, by]) => {
    let aMid = ax1 + (ax2 - ax1) / 2;
    let bMid = bx1 + (bx2 - bx1) / 2;
    return config.link.straight
      ? `M${aMid},${ay} L${bMid},${by}`
      : d3.linkVertical()({ source: [aMid, ay], target: [bMid, by] });
  },
  path: (anchors) => {
    if (!anchors) return "";
    return config.link.asLine
      ? _link.line(anchors)
      : config.link.straight
      ? _link.straight(anchors)
      : _link.sankey(anchors);
  },
  /**
   * Filters links for only the best between each cluster.
   * For every link, tracks clusters of query and target.
   * If this cluster pair has not been seen before, saves the current
   * link in a Map keyed on the pair.
   * If it has, tests if the current link shares a gene with other
   * saved links. The link is added if a) it has no common genes, or
   * b) it has common genes, but higher identity score.
   * @param {Array} links - All link data objects
   */
  filter: (links) => {
    // Filter out any links with no group -- have been hidden
    links = links.filter((link) => {
      let query = scales.group(link.query.uid) !== null;
      let target = scales.group(link.target.uid) !== null;
      return query && target;
    });

    if (!config.link.bestOnly) return links;

    const setsEqual = (a, b) =>
      a.size === b.size && [...a].every((value) => b.has(value));

    // Have to extend Map object to support set key comparisons
    // i.e. sets are tested for equality of their values, not just
    // being the exact same object in memory
    class MyMap extends Map {
      has(...args) {
        if (this.size === 0) return false;
        for (let key of this.keys()) {
          if (setsEqual(args[0], key)) return true;
        }
        return false;
      }
      get(...args) {
        for (const [key, value] of this) {
          if (setsEqual(args[0], key)) return value;
        }
      }
      set(...args) {
        let key = this.get(args[0]) || args[0];
        return super.set(key, args[1]);
      }
      reduce() {
        let flat = [];
        for (const values of this.values()) flat = flat.concat(values);
        return flat;
      }
    }
    let groups = new MyMap();

    // Descending sort by identity so best links come first
    links.sort((a, b) => (a.identity < b.identity ? 1 : -1));

    for (const link of links) {
      let clusterA = get.geneData(link.query.uid)._cluster;
      let clusterB = get.geneData(link.target.uid)._cluster;
      let pair = new Set([clusterA, clusterB]);

      // Check if link has common query/target with another link
      // Only add if a) doesn't or b) does but is higher scoring
      if (groups.has(pair)) {
        if (
          !groups.get(pair).some((l) => {
            let genes = new Set([l.query.uid, l.target.uid]);
            let share = genes.has(link.query.uid) || genes.has(link.target.uid);
            return share && link.identity < l.identity;
          })
        )
          groups.get(pair).push(link);
      } else {
        groups.set(pair, [link]);
      }
    }
    return groups
      .reduce()
      .filter((link) => link.identity > config.link.threshold);
  },
  getAnchors: (d, snap) => {
    snap = snap || false;

    // Calculates points linking two genes
    // Select genes by unique ID, get underlying data
    let a = get.geneData(d.query.uid);
    let b = get.geneData(d.target.uid);

    if (!_cluster.adjacent(a._cluster, b._cluster)) {
      return null;
    }

    // Calculate vertical midpoint based on shape config
    let mid = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;

    // Locus offset in each cluster, mostly 0
    let getOffset = (g) => {
      if (snap) return scales.offset(g._cluster) + scales.locus(g._locus);
      let locus = get.locus(g._locus);
      let matrix = get.matrix(locus);
      return scales.offset(g._cluster) + matrix.e;
    };
    let aOffset = getOffset(a);
    let bOffset = getOffset(b);

    // Get anchoring points for each gene polygon
    let getAnchors = (g, offset) => {
      let cluster = get.cluster(g._cluster);
      let matrix = get.matrix(cluster);
      let left = scales.x(g.start) + offset;
      let right = scales.x(g.end) + offset;
      return [
        g.strand === -1 ? right : left,
        g.strand === -1 ? left : right,
        snap ? scales.y(g._cluster) + mid : matrix.f + mid,
      ];
    };

    // Ensure ax/y is always top and bx/y is always bottom,
    // so label position can just be some % of these values
    let [ax1, ax2, ay] = getAnchors(a, aOffset);
    let [bx1, bx2, by] = getAnchors(b, bOffset);
    return ay > by
      ? [bx1, bx2, by, ax1, ax2, ay]
      : [ax1, ax2, ay, bx1, bx2, by];
  },
  /**
   * Gets all groups of gene links from an array of link objects.
   * Any link with identity score below the config threshold is ignored.
   * @param {Array} links - Link objects
   */
  getGroups: (links, oldGroups) => {
    let groups = links
      .map((link) => [link.query.uid, link.target.uid])
      .map((e, i, a) =>
        a.slice(i).reduce(
          // Form initial groups of overlapping links
          (p, c) =>
            e.some((n) => c.includes(n)) ? [...new Set([...p, ...c])] : p,
          []
        )
      )
      .map((group, index) => ({
        label: `Group ${index}`,
        genes: group,
        hidden: false,
        colour: null,
      }))
      .reduce((r, s) => {
        // Merge groups into old groups if any genes are shared
        let merged = false;
        r = r.map((a) => {
          if (a.genes.some((n) => s.genes.includes(n))) {
            merged = true;
            a.genes = [...new Set([...a.genes, ...s.genes])];
          }
          return a;
        });
        !merged && r.push({ ...s, uid: r.length });
        return r;
      }, oldGroups || []);
    if (!oldGroups)
      groups.forEach((group, index) => (group.label = `Group ${index}`));
    return groups;
  },
  /**
   * Creates flat link group domain and range for creating d3 scales.
   * @param {Array} groups - An array of link group arrays
   * @return {Object} An object with flattened domain and range arrays
   */
  getGroupDomainAndRange: (groups) => {
    let values = { domain: [], range: [] };
    groups.forEach((group) => {
      if (group.hidden) return;
      for (const gene of group.genes) {
        values.domain.push(gene);
        values.range.push(group.uid);
      }
    });
    return values;
  },
  /**
   * Update group scales given new data.
   */
  updateGroups: (groups) => {
    let { domain, range } = _link.getGroupDomainAndRange(groups);
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
  realLength: (d) => scales.x(d._end - d._start),
  updateTrackBar: (selection) => {
    let midPoint =
      config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;
    selection
      .select("line.trackBar")
      .attr("x1", (d) => scales.x(d._start))
      .attr("x2", (d) => scales.x(d._end))
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
      .attr("x", (d) => scales.x(d._start))
      .attr("width", _locus.realLength);
    selection
      .select("rect.leftHandle")
      .attr("x", (d) => scales.x(d._start) - 8);
    selection.select("rect.rightHandle").attr("x", (d) => scales.x(d._end));
    return selection;
  },
  updateScaling: (locus) => {
    // Recalculate gene positions:
    // Gene length = 1000bp if unscaled mode
    // Gene start = real start if scaled, else previous end or 0
    // Gene end = new gene start + length
    locus.genes.forEach((g, i, n) => {
      let length = config.plot.scaleGenes ? g._end - g._start : 1000;
      g.start = config.plot.scaleGenes ? g._start : i > 0 ? n[i - 1].end : 0;
      g.end = g.start + length;
      g.strand = g._strand;
    });
    // Recalculate locus boundaries & locus scale offset:
    // Start = trim start or 0
    // End = trim end or actual end if scaled, end of last gene if unscaled
    // Scale - difference between previous and new _start property
    let oldStart = locus._start;
    let total = locus.genes.length - 1;
    locus._start = locus._trimLeft ? locus._trimLeft.start : 0;
    locus._end = locus._trimRight
      ? locus._trimRight.end
      : config.plot.scaleGenes
      ? locus.end
      : locus.genes[total].end;
    updateScaleRange(
      "locus",
      locus.uid,
      scales.locus(locus.uid) + scales.x(oldStart - locus._start)
    );
  },
  update: (selection) =>
    selection
      .attr("transform", (d) => `translate(${scales.locus(d.uid)}, 0)`)
      .call(_locus.updateTrackBar)
      .call(_locus.updateHoverBox),
  dragResize: (selection) => {
    let minPos, value, initial;

    const started = (_, d) => {
      [minPos, _] = _cluster.extent([d.uid]);
      flags.isDragging = true;
      initial = scales.x(d._start);
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
      // Find closest gene start, from start to _end
      let genes = d.genes
        .filter((gene) => gene.end <= d._end)
        .sort((a, b) => (a.start > b.start ? 1 : -1));
      let starts = [d.start, ...genes.map((gene) => gene.start)];
      let coords = starts.map((value) => scales.x(value));
      let position = getClosestValue(coords, event.x);
      value = coords[position];
      d._start = starts[position];
      d._trimLeft = d._start === starts[0] ? null : genes[position - 1];

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
          g.start >= d._start && g.end <= d._end + 1 ? "inline" : "none"
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
          `translate(${scales.locus(d.uid) + scales.x(d._start) - 10}, 0)`
        );
      }
    };

    const _right = (event, d, handle) => {
      // Find closest visible gene end, from _start to end
      let genes = d.genes
        .filter((gene) => gene.start >= d._start)
        .sort((a, b) => (a.start > b.start ? 1 : -1));
      let geneEnds = genes.map((g) => g.end);
      let ends = [...geneEnds, config.plot.scaleGenes ? d.end : d._end];
      let range = ends.map((value) => scales.x(value));
      let position = getClosestValue(range, event.x);
      d._trimRight = genes[position] ? genes[position] : null;
      d._end = ends[position];

      // Transform handle rect
      handle.attr("x", scales.x(d._end));

      // Update rect width, hide genes out of bounds
      let locus = get.locus(d.uid);
      locus.select("rect.hover").attr("width", _locus.realLength);
      locus
        .selectAll("g.gene")
        .attr("display", (g) =>
          g.start >= d._start && g.end <= d._end + 1 ? "inline" : "none"
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
      if (d._end === d.end) d._trimRight = null;
      if (d._start === d.start) d._trimLeft = null;
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
      [minPos, maxPos] = _cluster.extent([d.uid]);
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
      let locStart = scales.x(locData._start);
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
      let locEnd = scales.x(locData._end);
      let newMax =
        Math.max(value + scales.offset(d._cluster) + locEnd, maxPos) + 20;
      d3.select("g.legend").attr("transform", `translate(${newMax}, 0)`);
    };

    const ended = (_, d) => {
      flags.isDragging = false;
      updateScaleRange("locus", d.uid, value);
      plot.update();
    };

    return d3.drag().on("start", started).on("drag", dragged).on("end", ended)(
      selection
    );
  },
  /**
   * Flips a locus by calculating inverse coordinates.
   */
  flip: (d) => {
    // Invert locus coordinates
    d._flipped = !d._flipped;
    let length = d.end - d.start;

    // Invert trimmed genes
    let tmp = d._trimRight;
    d._trimRight = d._trimLeft;
    d._trimLeft = tmp;

    // Invert coordinates of genes in the locus
    d.genes.forEach((g) => {
      let tmp = g._start;
      g._start = length - g._end;
      g._end = length - tmp;
      g._strand = g._strand === 1 ? -1 : 1;
    });
    d.genes.sort((a, b) => a._start - b._start);
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
    scales.offset
      .domain(clusters.map((d) => d.uid))
      .range(clusters.map(() => 0));
  },
  updateLocus: (clusters) => {
    let [domain, range] = _cluster.getLocusScaleValues(clusters);
    scales.locus.domain(domain).range(range);
  },
  /**
   * Rescales offset and locus scales with an updated x scale.
   * @param {d3.scale} old - The old x scale
   */
  rescaleRanges: (old) => {
    [scales.offset, scales.locus].forEach((scale) => {
      let range = scale.range();
      for (let i = 0; i < range.length; i++) {
        let input = old.invert(range[i]);
        range[i] = scales.x(input);
      }
      scale.range(range);
    });
  },
  /**
   * Updates all scales based on new data.
   * @param {Object} data - New data object
   */
  update: (data) => {
    let oldX = scales.x.copy();
    _scale.updateX();
    _scale.rescaleRanges(oldX);

    if (!_scale.check("y")) scales.y.domain(data.clusters.map((c) => c.uid));
    _scale.updateY(data);

    if (!_scale.check("offset")) _scale.updateOffset(data.clusters);

    if (!_scale.check("locus")) _scale.updateLocus(data.clusters);
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
