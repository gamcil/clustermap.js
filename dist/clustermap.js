(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ClusterMap = {}));
}(this, (function (exports) { 'use strict';

	function renameText() {
		// Changes value of a text node to a prompted value
		let text = d3.select(this);
		let result = prompt("Enter new value:", text.text());
		if (result) text.text(result);
	}

	function isObject(a) {
		return (!!a) && (a.constructor === Object)
	}

	function updateConfig(target, source) {
		for (const [key, value] of Object.entries(source)) {
			if (!target.hasOwnProperty(key))
				continue
			if (isObject(value)) {
				updateConfig(target[key], value);
			} else {
				target[key] = value;
			}
		}
	}

	function legend(colourScale) {
		/* Creates a legend component from a colour scale.
		 */

		let entryHeight = 15;
		let fontSize = 12;
		let hidden = [];
		let onClickCircle = null;
		let onClickText = renameText;
		let y = d3.scaleBand().paddingInner(0.5);
		let t = d3.transition().duration(500);

		function my(selection) {
			selection.each(function(data) {
				// Grab new domain from colourScale and update the y-scale
				let domain = colourScale.domain();
				let visible = domain.filter(g => !hidden.includes(g));
				y.domain(visible)
					.range([0, entryHeight * visible.length]);

				// Grab the <g> element, if it exists
				let g = d3.select(this)
					.selectAll("g.legend")
					.data([data])
					.join("g")
					.attr("class", "legend");

				// Render each legend element <g>
	      let translate = d => `translate(0, ${y(d)})`;
				g.selectAll("g.element")
					.data(visible)
					.join(
						enter => {
							enter = enter.append("g")
								.attr("class", "element")
								.attr("transform", translate);
							enter.append("circle")
								.attr("class", d => `group-${d}`);
								// .attr("width", 6)
							enter.append("text")
								.text(d => `Group ${d}`)
								.attr("x", 16)
								.attr("text-anchor", "start")
								.style("font-family", "sans")
	              .style("dominant-baseline", "middle");
							return enter.call(updateLegend)
						},
						update => update.call(
							update => update.transition(t)
	              .attr("transform", translate)
	              .call(updateLegend)
						)
					);

				// If click callbacks are specified, bind them
				if (onClickCircle)
					g.selectAll("circle")
						.attr("cursor", "pointer")
						.on("click", onClickCircle);
				if (onClickText)
					g.selectAll("text")
						.attr("cursor", "pointer")
						.on("click", onClickText);
			});
		}

	  function updateLegend(selection) {
	    selection.attr("transform", d => `translate(0, ${y(d)})`);
	    let half = y.bandwidth() / 2;
	    selection.selectAll("text")
	      .attr("x", half + 6)
	      .attr("y", half + 1)
	      .style("font-size", `${fontSize}px`);
	    selection.selectAll("circle")
	      .attr("cy", half)
	      .attr("r", half)
	      .attr("fill", d => colourScale(d));
	  }

		my.colourScale = _ => arguments.length ? (colourScale = _, my) : colourScale;
		my.transition = _ => arguments.length ? (t = _, my) : t;
		my.hidden = _ => arguments.length ? (hidden = _, my) : hidden;
		my.entryHeight = _ => arguments.length ? (entryHeight = parseInt(_), my) : entryHeight;
		my.fontSize = _ => arguments.length ? (fontSize = parseInt(_), my) : fontSize;
		my.onClickCircle = _ => arguments.length ? (onClickCircle = _, my) : onClickCircle;
		my.onClickText = _ => arguments.length ? (onClickText = _, my) : onClickText;

		return my
	}

	function colourBar(colourScale) {
		/* Creates the colour bar component.
		*/

		let height = 25;
		let width = 150;
		let fontSize = 12;
		let t = d3.transition();

		function my(selection) {
			selection.each(function(data) {
				d3.select(this)
					.selectAll("g.colourBar")
					.data([data])
					.join(
						enter => {
							enter = enter.append("g")
								.attr("class", "colourBar");

							// Add the gradient to <defs>
							let defs = enter.append("defs");
							let gradient = defs.append("linearGradient")
								.attr("id", "cbarGradient")
								.attr("x1", "0%")
								.attr("x2", "100%");
							gradient.append("stop")
								.attr("class", "startStop")
								.attr("offset", "0%");
							gradient.append("stop")
								.attr("class", "endStop")
								.attr("offset", "100%");

							// Draw the colour bar itself
							let cbar = enter.append("g")
								.attr("class", "cbarParts");
							cbar.append("rect")
								.attr("class", "colourBarBG")
								.style("fill", "white")
								.style("stroke", "black")
								.style("stroke-width", "1px");
							cbar.append("rect")
								.attr("class", "colourBarFill")
								.style("fill", "url(#cbarGradient)");
							cbar.append("text")
								.text("Identity (%)")
								.attr("class", "labelText")
								.attr("text-anchor", "middle");
							cbar.append("text")
								.text("0")
								.attr("class", "startText")
								.attr("text-anchor", "start");
							cbar.append("text")
								.text("100")
								.attr("class", "endText")
								.attr("text-anchor", "end");
							cbar.selectAll("text")
								.style("font-family", "sans-serif")
	              .style("dominant-baseline", "hanging");

							enter.call(updateColourBar);
							return enter
						},
						update => update.call(
							update => update.transition(t).call(updateColourBar)
						)
					);
			});
		}

		function updateColourBar(selection) {
			// Updates colour bar styling/positioning
			selection.select(".startStop")
				.attr("stop-color", colourScale(0));
			selection.select(".endStop")
				.attr("stop-color", colourScale(1));
			selection.selectAll("rect")
				.attr("width", width)
				.attr("height", height);
			selection.selectAll(".startText, .endText, .labelText")
				.attr("y", height + 5);
			selection.select(".labelText")
				.attr("x", width / 2);
			selection.select(".endText")
				.attr("x", width);
			selection.selectAll("text")
				.style("font-size", `${fontSize}pt`);					
		}

		// Setters/getters
		my.width = _ => arguments.length ? (width = parseInt(_), my) : width;
		my.height = _ => arguments.length ? (height = parseInt(_), my) : height;
		my.fontSize = _ => arguments.length ? (fontSize = parseInt(_), my) : fontSize;
		my.colourScale = _ => arguments.length ? (colourScale = _, my) : colourScale;
		my.transition = _ => arguments.length ? (t = _, my) : t;

		return my
	}

	function scaleBar(x) {
		/* Creates a scale bar component
		*/

		let basePair = 1000;
		let stroke = 1;
		let height = 10;
		let colour = "black";
		let fontSize = 12;
		let t = d3.transition().duration(500);
		let onClickText = null;

		function my(selection) {
			selection.each(function(data) {
				// Grab the <g> element, if it exists and draw scale bar
				d3.select(this)
					.selectAll("g.scaleBar")
					.data([data])
					.join(
						enter => {
							enter = enter.append("g").attr("class", "scaleBar");
							enter.append("line").attr("class", "flatBar");
							enter.append("line").attr("class", "leftBar");
							enter.append("line").attr("class", "rightBar");
							enter.append("text")
								.attr("class", "barText")
								.attr("text-anchor", "middle")
								.attr("cursor", "pointer")
								.on("click", onClickText || promptNewLength);
							enter.call(updateScaleBar);
							return enter
						},
						update => update.call(
							update => update.transition(t).call(updateScaleBar)
						)
					);
			});
		}

		function getLabel() {
			return `${+(basePair / 1000).toFixed(1)}kb`
		}

		function updateScaleBar(selection) {
			// Updates position and styling of scale bar components
			let middle = height / 2;
			let end = x(basePair);
			selection.select(".flatBar")
				.attr("x2", end)
				.attr("y1", middle)
				.attr("y2", middle);
			selection.select(".leftBar")
				.attr("y2", height);
			selection.select(".rightBar")
				.attr("x1", end)
				.attr("x2", end)
				.attr("y2", height);
			selection.select("text.barText")
				.text(getLabel)
				.attr("x", end / 2)
				.attr("y", height + 5)
	      .style("dominant-baseline", "hanging")
				.style("font-size", `${fontSize}pt`);				
			selection.selectAll("line")
				.style("stroke", colour)
				.style("stroke-width", stroke);
		}

		function promptNewLength() {
			let result = prompt("Enter new length (bp):", basePair);
			if (result) my.basePair(result);
		}

		my.basePair = _ => arguments.length ? (basePair = parseInt(_), my) : basePair;
		my.colour = _ => arguments.length ? (colour = _, my) : colour;
		my.colourScale = _ => arguments.length ? (colourScale = _, my) : colourScale;
		my.fontSize = _ => arguments.length ? (fontSize = parseInt(_), my) : fontSize;
		my.height = _ => arguments.length ? (height = parseInt(_), my) : height;
		my.onClickText = _ => arguments.length ? (onClickText = _, my): onClickText;
		my.stroke = _ => arguments.length ? (stroke = parseInt(_), my) : stroke;
		my.transition = _ => arguments.length ? (t = _, my) : t;
		my.width = _ => arguments.length ? (width = parseInt(_), my) : width;

		return my
	}

	var defaultConfig = {
		plot: {
			transitionDuration: 250,
			scaleFactor: 15,
		},
		legend: {
			entryHeight: 18,
			fontSize: 14,
			onClickCircle: null,
			onClickText: null,
			show: true,
		},
		colourBar: {
			fontSize: 12,
			height: 12,
			show: true,
			width: 150,
		},
		scaleBar: {
			colour: "black",
			fontSize: 12,
			height: 12,
			basePair: 2500,
			show: true,
			stroke: 1,
		},
		link: {
			threshold: 0,
	    bestOnly: false,
		},
		cluster: {
			nameFontSize: 12,
			lociFontSize: 10,
	    hideLocusCoordinates: false,
			spacing: 50,
			alignLabels: true,
		},
		locus: {
			trackBar: {
				colour: "#111",
				stroke: 1,
			},
			spacing: 50,
		},
		gene: {
			shape: {
				bodyHeight: 12,
				tipHeight: 5,
				tipLength: 12,
				onClick: null,
				stroke: "black",
				strokeWidth: 1,
			},
			label: {
				anchor: "start",
				fontSize: 10,
				rotation: 25,
				show: false,
				start: 0.5,
			},
		},
	};

	function getClosestValue(values, value) {
	  return Math.max(
	    Math.min(
	      d3.bisectLeft(values, value),
	      values.length - 1
	    ), 0)
	}

	function updateScaleRange(scale, uid, value) {
	  let domain = scales[scale].domain();
	  let range = scales[scale].range();
	  let index = domain.indexOf(uid);
	  range[index] = value;
	  scales[scale].range(range);
	}

	const config$1 = Object.assign({}, defaultConfig);
	const flags = { isDragging: false };

	function _get(uid, type) {
	  return d3.select(`#${type}_${uid}`)
	}

	const get = {
	  gene: uid => _get(uid, "gene"),
	  locus: uid => _get(uid, "locus"),
	  cluster: uid => _get(uid, "cluster"),
	  geneData: uid => get.gene(uid).datum(),
	  locusData: uid => get.locus(uid).datum(),
	  clusterData: uid => get.cluster(uid).datum(),
	  matrix: selection => selection.node().transform.baseVal[0].matrix,
	};

	const plot = {
	  legendTransform: d => {
	    let [_, max] = _cluster.extent(d.clusters);
	    return `translate(${max + 20}, ${0})`
	  },
	  colourBarTransform: () => {
	    let x = scales.x(config$1.scaleBar.basePair) + 20;
	    let y = scales.y.range()[1];
	    return `translate(${x}, ${y})`
	  },
	  scaleBarTransform: () => {
	    let y = scales.y.range()[1];
	    return `translate(0, ${y})`
	  },
	  updateConfig: function(target) {
	    updateConfig(config$1, target);  
	  },
	  update: null,
	};

	const scales = {
	  x: d3.scaleLinear()
	    .domain([1, 1001])
	    .range([0, config$1.plot.scaleFactor]),
	  y: d3.scaleBand().padding(0.05),
	  group: d3.scaleOrdinal().unknown(null),
	  colour: d3.scaleOrdinal().unknown("#bbb"),
	  score: d3.scaleSequential(d3.interpolateGreys).domain([0, 1]),
	  offset: d3.scaleOrdinal(),
	  locus: d3.scaleOrdinal(),
	};

	const _gene = {
	  getId: d => `gene_${d.uid}`,
	  fill: g => {
	    if (!scales.colour || !scales.group) return "#bbb"
	    let groupId = scales.group(g.uid);
	    return scales.colour(groupId)
	  },
	  points: g => {
	    // Calculates points attribute to draw a gene polygon
	    let points = [];

	    // Get start and end of Gene as percentages of Locus length
	    let scaledStart = scales.x(g.start);
	    let scaledEnd = scales.x(g.end);
	    let geneLength = scaledEnd - scaledStart;

	    // Calculate scaled constants based on scaled coordinates
	    let bottom = config$1.gene.shape.tipHeight * 2 + config$1.gene.shape.bodyHeight;
	    let midpoint = bottom / 2;
	    let third = config$1.gene.shape.tipHeight + config$1.gene.shape.bodyHeight;

	    // Determine polygon points for the Gene, 5' to 3' or 3' to 5'
	    if (g.strand === 1) {
	      let shaft = scaledEnd - config$1.gene.shape.tipLength;
	      points = [
	        scaledStart, config$1.gene.shape.tipHeight,
	        shaft, config$1.gene.shape.tipHeight,
	        shaft, 0,
	        scaledEnd, midpoint,
	        shaft, bottom,
	        shaft, third,
	        scaledStart, third,
	      ];
	      // Squeeze arrow when total length is less than tip length
	      if (geneLength < config$1.gene.shape.tipLength) {
	        [2, 4, 8, 10].forEach(item => (points[item] = scaledStart));
	      }
	    } else {
	      let shaft = scaledStart + config$1.gene.shape.tipLength;
	      points = [
	        scaledEnd, config$1.gene.shape.tipHeight,
	        shaft, config$1.gene.shape.tipHeight,
	        shaft, 0,
	        scaledStart, midpoint,
	        shaft, bottom,
	        shaft, third,
	        scaledEnd, third,
	      ];
	      if (geneLength < config$1.gene.shape.tipLength) {
	        [2, 4, 8, 10].forEach(item => (points[item] = scaledEnd));
	      }
	    }
	    return points.join(" ")
	  },
	  labelTransform: g => {
	    let offset = scales.x(g.end - g.start) * config$1.gene.label.start;
	    let gx = scales.x(g.start) + offset;
	    let rotate = (["start", "middle"].includes(config$1.gene.label.anchor))
	      ? -config$1.gene.label.rotation
	      : config$1.gene.label.rotation;
	    return `translate(${gx}, 0) rotate(${rotate})`
	  },
	  update: selection => {
	    selection.selectAll("polygon")
	      .attr("class", g => {
	        let group = scales.group(g.uid);
	        return (group !== null) ? `genePolygon group-${group}` : "genePolygon"
	      })
	      .attr("points", _gene.points)
	      .attr("fill", _gene.fill)
	      .style("stroke", config$1.gene.shape.stroke)
	      .style("stroke-width", config$1.gene.shape.strokeWidth);
	    selection.selectAll("text.geneLabel")
	      .attr("display", config$1.gene.label.show ? "inherit" : "none")
	      .attr("transform", _gene.labelTransform)
	      .attr("font-size", config$1.gene.label.fontSize)
	      .attr("text-anchor", config$1.gene.label.Anchor);
	    return selection
	  },
	  anchor: (_, anchor) => {
	    // Get original domain and range of cluster offset scale
	    let domain = scales.offset.domain();
	    let range = scales.offset.range();

	    // Anchor map on given uid
	    // Finds anchor genes in clusters given some initial anchor gene
	    // Find gene links, then filter out any not containing the anchor
	    let anchors = new Map();
	    scales.group
	      .domain()
	      .filter(uid => {  // Filter for matching groups
	        let g1 = scales.group(uid);
	        let g2 = scales.group(anchor.uid);
	        return g1 !== null && g1 === g2
	      })
	      .forEach(uid => {  // Group remaining anchors by cluster
	        let cluster = get.geneData(uid)._cluster;
	        if (anchors.has(cluster)) {
	          anchors.get(cluster).push(uid);
	        } else {
	          anchors.set(cluster, [uid]);
	        }
	      });
	    if (anchors.length === 0) return

	    // Get the midpoint of the clicked anchor gene
	    let getMidPoint = data => {
	      let length = data.end - data.start;
	      return (
	        scales.x(data.start + length / 2)
	        + scales.locus(data._locus)
	        + scales.offset(data._cluster)
	      )
	    };
	    let midPoint = getMidPoint(anchor);

	    // Calculate offset value of a link anchor from clicked anchor
	    let getOffset = link => {
	      let data = get.geneData(link);
	      return midPoint - getMidPoint(data)
	    };

	    // Get smallest offset value from anchors on the same cluster
	    let getGroupOffset = (group) => {
	      if (group.includes(anchor.uid)) return 0
	      let offsets = group.map(l => getOffset(l));
	      let index = d3.minIndex(offsets, l => Math.abs(l));
	      return offsets[index]
	    };

	    // Iterate all anchor groups and update offset scale range values
	    for (const [cluster, group] of anchors.entries()) {
	      let index = domain.findIndex(el => el === cluster);
	      range[index] += getGroupOffset(group);
	    }

	    // Update range, then update ClusterMap
	    scales.offset.range(range);
	    plot.update();
	  },
	};

	const _cluster = {
	  getId: d => `cluster_${d.uid}`,
	  transform: c => `translate(${scales.offset(c.uid)}, ${scales.y(c.uid)})`,
	  /**
	   * Generates locus coordinates displayed next underneath a cluster name.
	   * If a locus is flipped, (reversed) will be added to its name.
	   * @param {Object} cluster - Cluster data object
	   * @returns {String} Comma-separated locus coordinates
	   */
	  locusText: cluster => (
	    cluster.loci.map(locus => {
	      let flipped = locus._flipped ? " (reversed)" : "";
	      if (
	        config$1.cluster.hideLocusCoordinates
	        || locus._start == null
	        || locus._end == null
	      )
	        return `${locus.name}${flipped}`
	      return (
	        `${locus.name}${flipped}:`
	        + `${locus._start.toFixed(0)}`
	        + `-${locus._end.toFixed(0)}`
	      )
	    }).join(", ")
	  ),
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
	      if (ignore.includes(locus.uid)) continue
	      let offset = scales.offset(cluster.uid) + scales.locus(locus.uid);
	      let _start = scales.x(locus._start) + offset;
	      let _end = scales.x(locus._end) + offset;
	      if (!start || (start && _start < start)) start = _start;
	      if (!end || (end && _end > end)) end = _end;
	    }
	    return [start, end]
	  },
	  /**
	   * Finds minimum and maximum points of all clusters/loci.
	   * @param {Array} ignore - Cluster UIDs to ignore
	   * @return {Array} 2-element array containing min and max
	   */
	  extent: ignore => {
	    ignore = ignore || [];
	    let min, max;
	    for (const uid of scales.offset.domain()) {
	      // if (ignore.includes(uid)) continue
	      let cluster = get.clusterData(uid); 
	      let [_min, _max] = _cluster.extentOne(cluster, ignore);
	      if (!min || (min && _min < min)) min = _min;
	      if (!max || (max && _max > max)) max = _max;
	    }
	    return [min, max]
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
	    return Math.abs(a.slot - b.slot) === 1
	  },
	  /**
	   * Gets range for a cluster scale based on its loci
	   * Note: transform on <g> element only applies to visible elements,
	   *       so no point adding offset here
	   */
	  getRange: c => {
	    let range = [];
	    let value = 1;
	    let start, end, offset;
	    for (const [index, locus] of c.loci.entries()) {
	      if (index > 0)
	        value = range[range.length - 1] + end - start + config$1.locus.spacing;
	      offset = scales.locus(locus.uid) || 0;
	      start = scales.x(locus._start || locus.start);
	      end = scales.x(locus._end || locus.end);
	      range.push(value - start + offset);
	    }
	    return range
	  },
	  /**
	   * Gets domain and range for the locus offset scale
	   */
	  getLocusScaleValues: clusters => {
	    let domain = [];
	    let range = [];
	    clusters.forEach(cluster => {
	      let d = cluster.loci.map(locus => locus.uid);
	      let r = _cluster.getRange(cluster); 
	      domain.push(...d);
	      range.push(...r);
	    });
	    return [domain, range]
	  },
	  /**
	   * Aligns clusterInfo <g> elements based on leftmost cluster in the map.
	   * Should be used on a D3 selection using call().
	   * @param {d3.selection} selection - g.clusterInfo selection
	   * @return {d3.selection}
	   */
	  alignLabels: selection => {
	    let [min, _] = _cluster.extent();
	    return selection.attr("transform", d => {
	      let value = min - scales.offset(d.uid);
	      return `translate(${value - 10}, 0)`
	    })
	  },
	  update: selection => {
	    selection.attr("transform", _cluster.transform);
	    if (config$1.cluster.alignLabels) {
	      selection
	        .selectAll(".clusterInfo")
	        .call(_cluster.alignLabels);
	    } else {
	      selection
	        .selectAll(".clusterInfo")
	        .attr("transform", d => {
	          let [min, _] = _cluster.extentOne(d);
	          let value = min - 10 - scales.offset(d.uid);
	          return `translate(${value}, 0)`
	        });
	    }
	    selection
	      .selectAll("text.clusterText")
	      .style("font-size", `${config$1.cluster.nameFontSize}px`);
	    selection
	      .selectAll("text.locusText")
	      .text(_cluster.locusText)
	      .style("font-size", `${config$1.cluster.lociFontSize}px`);
	    return selection
	  },
	  drag: selection => {
	    let free;
	    let height = scales.y.range()[1];
	    selection.each((d, i) => { d.slot = i; });

	    const getDomain = () => {
	      let clusters = [];
	      selection.each(c => { clusters.push(c); });
	      clusters = clusters.sort((a, b) => a.slot > b.slot ? 1 : -1);
	      return clusters.map(c => c.uid)
	    };

	    const started = (_, d) => {
	      flags.isDragging = true;
	      get.cluster(d.uid)
	        .raise()
	        .classed("active", true)
	        .attr("cursor", "grabbing");
	      free = d.slot;
	    };

	    const dragged = (event, d) => {
	      let me = get.cluster(d.uid);
	      let matrix = get.matrix(me);
	      const yy = Math.min(height, Math.max(0, matrix.f + event.y));
	      me.attr("transform", d => `translate(${scales.offset(d.uid)}, ${yy})`);

	      // Get closest index based on new y-position
	      let domain = scales.y.domain();
	      let p = domain.length - Math.min(
	        Math.round(height / yy),
	        domain.length
	      );

	      d3.selectAll("path.geneLink")
	        .call(_link.setPath);

	      if (p === d.slot) return

	      // Re-arrange the y-scale domain
	      selection.each(function(e) {
	        if (e.uid !== d.uid && e.slot === p) {
	          e.slot = free;
	          d.slot = free = p;
	          let uid = scales.y.domain()[e.slot];
	          let translate = c => `translate(${scales.offset(c.uid)}, ${scales.y(uid)})`;
	          get.cluster(e.uid)
	            .transition()
	            .attr("transform", translate);
	        }
	      });
	    };

	    const ended = () => {
	      flags.isDragging = false;
	      let dom = getDomain();
	      scales.y.domain(dom);
	      plot.update();
	    };

	    return d3.drag()
	      .on("start", started)
	      .on("drag", dragged)
	      .on("end", ended)
	      (selection)
	  },
	};

	const _link = {
	  getId: l => {
	    let [a, b] = [l.query.uid, l.target.uid].sort();
	    return `${a}-${b}`
	  },
	  display: l => {
	    let a = get.gene(l.query.uid).attr("display");
	    let b = get.gene(l.target.uid).attr("display");
	    return (a === "none" || b === "none") ? "none" : "inline"
	  },
	  /**
	   * Sets the d attribute on a selection of link lines.
	   */
	  setPath: (selection, snap) => {
	    return selection.attr("d", d => _link.path(d, snap))
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
	  filter: links => {
	    if (!config$1.link.bestOnly) return links

	    const setsEqual = (a, b) => (
	      a.size === b.size && [...a].every(value => b.has(value))
	    );

	    // Have to extend Map object to support set key comparisons
	    // i.e. sets are tested for equality of their values, not just
	    // being the exact same object in memory
	    class MyMap extends Map {
	      has(...args) {
	        if (this.size === 0) return false
	        for (let key of this.keys()) {
	          if (setsEqual(args[0], key)) return true
	        }
	        return false
	      }
	      get(...args) {
	        for (const [key, value] of this) {
	          if (setsEqual(args[0], key)) return value
	        }
	      }
	      set(...args) {
	        let key = this.get(args[0]) || args[0];
	        return super.set(key, args[1])
	      }
	      reduce() {
	        let flat = [];
	        for (const values of this.values()) flat = flat.concat(values);
	        return flat
	      }
	    }
	    let groups = new MyMap();

	    // Descending sort by identity so best links come first
	    links.sort((a, b) => a.identity < b.identity ? 1 : -1);

	    for (const link of links) {
	      let clusterA = get.geneData(link.query.uid)._cluster;
	      let clusterB = get.geneData(link.target.uid)._cluster;
	      let pair = new Set([clusterA, clusterB]);

	      // Check if link has common query/target with another link
	      // Only add if a) doesn't or b) does but is higher scoring
	      if (groups.has(pair)) {
	        if (!groups.get(pair).some(l => {
	          let genes = new Set([l.query.uid, l.target.uid]);
	          let share = (genes.has(link.query.uid) || genes.has(link.target.uid));
	          return (share && link.identity < l.identity)
	        })) groups.get(pair).push(link);
	      } else {
	        groups.set(pair, [link]);
	      }
	    }
	    return groups.reduce().filter(link => link.identity > config$1.link.threshold)
	  },
	  path: (d, snap) => {
	    snap = snap || false;

	    // Calculates points linking two genes
	    // Select genes by unique ID, get underlying data 
	    let a = get.geneData(d.query.uid);
	    let b = get.geneData(d.target.uid);

	    if (!_cluster.adjacent(a._cluster, b._cluster)) {
	      return null
	    }

	    // Calculate vertical midpoint based on shape config
	    let mid = config$1.gene.shape.tipHeight + config$1.gene.shape.bodyHeight / 2;

	    // Locus offset in each cluster, mostly 0
	    let getOffset = g => {
	      if (snap) return scales.offset(g._cluster) + scales.locus(g._locus)
	      let locus = get.locus(g._locus);
	      let matrix = get.matrix(locus);
	      return scales.offset(g._cluster) + matrix.e
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
	        snap ? scales.y(g._cluster) + mid : matrix.f + mid
	      ]
	    };

	    let [ax1, ax2, ay] = getAnchors(a, aOffset);
	    let [bx1, bx2, by] = getAnchors(b, bOffset);

	    // Generate the path d attribute
	    return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`
	  },
	  /**
	   * Gets all groups of gene links from an array of link objects.
	   * Any link with identity score below the config threshold is ignored.
	   * @param {Array} links - Link objects
	   */
	  getGroups: links => {
	    let groups = [];
	    for (const link of links) {
	      if (link.identity < config$1.link.threshold) continue
	      let found = false;
	      for (let i = 0; i < groups.length; i++) {
	        let group = groups[i];
	        if (group.includes(link.query.uid) || group.includes(link.target.uid))
	          found = true;
	        if (found) {
	          if (!group.includes(link.query.uid)) group.push(link.query.uid);
	          if (!group.includes(link.target.uid)) group.push(link.target.uid);
	          break;
	        }
	      }
	      if (!found) groups.push([link.query.uid, link.target.uid]);
	    }
	    return groups
	  },
	  /**
	   * TODO: collapse this function into getGeneLinkGroups
	   * Merges two arrays of gene link groups and returns new array.
	   * @param {Array} one - An array of link group arrays
	   * @param {Array} two - Another array of link group arrays
	   * @return {Array} A new array consisting of merged groups
	   */
	  mergeGroups: (one, two) => {
	    if (one.length === 0 || one === two) return [...two]
	    let setA, intersect;
	    let merged = [...one];
	    merged.forEach(a => {
	      setA = new Set(a);
	      two.forEach(b => {
	        intersect = new Set([...b].filter(x => setA.has(x)));
	        if (intersect)
	          a.push(...b.filter(e => !a.includes(e)));
	      });
	    });
	    return merged
	  },
	  /**
	   * Tests two arrays of gene link groups for equality.
	   * @param {Array} one - An array of link group arrays
	   * @param {Array} two - Another array of link group arrays
	   * @return {boolean}
	    * */
	  compareGroups: (one, two) => {
	    let setA, found, intersect;
	    one.forEach(a => {
	      setA = new Set(a);
	      found = false;
	      two.forEach(b => {
	        intersect = new Set([...b].filter(x => setA.has(x)));
	        if (intersect.size > 0) found = true;
	      });
	      if (!found) return false
	    });
	    return (found) ? true : false
	  },
	  /**
	   * Creates flat link group domain and range for creating d3 scales.
	   * @param {Array} groups - An array of link group arrays
	   * @return {Object} An object with flattened domain and range arrays
	   */
	  getGroupDomainAndRange: groups => {
	    let scale = {domain: [], range: []};
	    groups.forEach((group, i) => {
	      scale.domain.push(...group);
	      scale.range.push(...group.map(() => i));
	    });
	    return scale
	  },
	  updateGroups: links => {
	    let oldRange = scales.group.range();
	    let oldGroups = Array.from(
	      d3.group(scales.group.domain(), (_, i) => oldRange[i]).values()
	    );
	    let newGroups = _link.getGroups(links);
	    let merged = _link.mergeGroups(oldGroups, newGroups);
	    let match = _link.compareGroups(oldGroups, merged);
	    if (!match) {
	      scales.colour
	        .domain(merged.map((_, i) => i))
	        .range(d3.quantize(d3.interpolateRainbow, merged.length + 1));
	      let {domain, range} = _link.getGroupDomainAndRange(merged);
	      scales.group
	        .domain(domain)
	        .range(range);
	    }
	  },
	};

	const _locus = {
	  getId: d => `locus_${d.uid}`,
	  realLength: d => scales.x(d._end - d._start),
	  updateTrackBar: selection => {
	    let midPoint = config$1.gene.shape.tipHeight + config$1.gene.shape.bodyHeight / 2;
	    selection.select("line.trackBar")
	      .attr("x1", d => scales.x(d._start))
	      .attr("x2", d => scales.x(d._end))
	      .attr("y1", midPoint)
	      .attr("y2", midPoint)
	      .style("stroke", config$1.locus.trackBar.colour)
	      .style("stroke-width", config$1.locus.trackBar.stroke);
	    return selection
	  },
	  updateHoverBox: selection => {
	    let botPoint = config$1.gene.shape.tipHeight * 2 + config$1.gene.shape.bodyHeight;
	    selection.selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
	      .attr("y", -10)
	      .attr("height", botPoint + 20);
	    selection.select("rect.hover")
	      .attr("x", d => scales.x(d._start))
	      .attr("width", _locus.realLength);
	    selection.select("rect.leftHandle")
	      .attr("x", d => scales.x(d._start) - 8);
	    selection.select("rect.rightHandle")
	      .attr("x", d => scales.x(d._end));
	    return selection
	  },
	  update: selection => {
	    let translate = d => `translate(${scales.locus(d.uid)}, 0)`;
	    return selection
	      .attr("transform", translate)
	      .call(_locus.updateTrackBar)
	      .call(_locus.updateHoverBox)
	  },
	  dragResize: selection => {
	    let minPos,
	      value,
	      initial;

	    const started = (_, d) => {
	      [minPos, _] = _cluster.extent([d.uid]);
	      flags.isDragging = true;
	      initial = scales.x(d._start);
	    };

	    function dragged(event, d) {
	      let handle = d3.select(this);
	      let func;
	      if (handle.attr("class") === "leftHandle") {
	        func = _left;
	      } else {
	        func = _right;
	      }
	      func(event, d, handle);
	    }

	    const _left = (event, d, handle) => {
	      // Find closest gene start, from start to _end
	      let geneStarts = d.genes
	        .filter(gene => gene.end <= d._end)
	        .map(gene => gene.start);
	      let starts = [d.start, ...geneStarts].sort((a, b) => a > b ? 1 : -1);
	      let coords = starts.map(value => scales.x(value));
	      let position = getClosestValue(coords, event.x);
	      value = coords[position];
	      d._start = starts[position];

	      // Adjust the dragged rect
	      handle.attr("x", value - 8);

	      // Resize the hover <rect>, hide any genes not within bounds
	      let locus = get.locus(d.uid);
	      locus.select("rect.hover")
	        .attr("x", value)
	        .attr("width", _locus.realLength);
	      locus.selectAll("g.gene")
	        .attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none");
	      locus.call(_locus.updateTrackBar);

	      // Hide any gene links connected to hidden genes
	      d3.selectAll("path.geneLink")
	        .attr("display", _link.display);

	      if (config$1.cluster.alignLabels) {
	        // Add offset/locus scale values to make equivalent to minPos from
	        // cluster.extent(), then remove from per-cluster transforms
	        let offs = scales.offset(d._cluster) + scales.locus(d.uid);
	        let newMin = Math.min(value + offs, minPos) - 10;
	        d3.selectAll("g.clusterInfo")
	          .attr("transform", c => {
	            let blah = newMin - scales.offset(c.uid);
	            return `translate(${blah}, 0)`
	          });
	      } else {
	        d3.select(`#cinfo_${d._cluster}`)
	          .attr("transform", `translate(${scales.locus(d.uid) + scales.x(d._start) - 10}, 0)`);
	      }
	    };

	    const _right = (event, d, handle) => {
	      // Find closest visible gene end, from _start to end
	      let ends = d.genes
	        .filter(gene => gene.start >= d._start)
	        .map(gene => gene.end)
	        .sort((a, b) => a > b ? 1 : -1);
	      let range = ends.map(value => scales.x(value));
	      let position = getClosestValue(range, event.x);
	      d._end = ends[position];

	      // Transform handle rect
	      handle.attr("x", scales.x(d._end));

	      // Update rect width, hide genes out of bounds
	      let locus = get.locus(d.uid);
	      locus.select("rect.hover")
	        .attr("width", _locus.realLength);
	      locus.selectAll("g.gene")
	        .attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none");
	      locus.call(_locus.updateTrackBar);

	      // Hide any gene links attached to hidden genes
	      d3.selectAll("path.geneLink")
	        .attr("display", _link.display);

	      // Adjust position of legend when final locus _end property changes
	      d3.select("g.legend")
	        .attr("transform", plot.legendTransform);
	    };

	    const ended = (_, d) => {
	      flags.isDragging = false;
	      d3.select(`#locus_${d.uid} .hover`)
	        .transition()
	        .attr("opacity", 0);
	      plot.update();
	    };

	    return d3.drag()
	      .on("start", started)
	      .on("drag", dragged)
	      .on("end", ended)
	      (selection)
	  },
	  dragPosition: selection => {
	    let minPos,
	      maxPos,
	      offset,
	      value,
	      locus;

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
	      d3.selectAll("path.geneLink")
	        .call(_link.setPath, false);

	      // Adjust clusterInfo groups
	      let locData = locus.datum();
	      let locStart = scales.x(locData._start);
	      if (config$1.cluster.alignLabels) {
	        let locMin = value + scales.offset(d._cluster) + locStart;
	        let newMin = Math.min(locMin, minPos) - 10;
	        d3.selectAll("g.clusterInfo")
	          .attr("transform", c => `translate(${newMin - scales.offset(c.uid)}, 0)`);
	      } else {
	        d3.select(`#cinfo_${d._cluster}`)
	          .attr("transform", `translate(${value + locStart - 10}, 0)`);
	      }

	      // Adjust legend group
	      let locEnd = scales.x(locData._end);
	      let newMax = Math.max(value + scales.offset(d._cluster) + locEnd, maxPos) + 20;
	      d3.select("g.legend")
	        .attr("transform", `translate(${newMax}, 0)`);
	    };

	    const ended = (_, d) => {
	      flags.isDragging = false;
	      updateScaleRange("locus", d.uid, value);
	      plot.update();
	    };

	    return d3.drag()
	      .on("start", started)
	      .on("drag", dragged)
	      .on("end", ended)
	      (selection)
	  },
	  /**
	   * Flips a locus by calculating inverse coordinates.
	   */
	  flip: d => {
	    // Invert locus coordinates
	    d._flipped = !d._flipped;
	    let length = d.end - d.start + 2;
	    let tmp = d._start;
	    d._start = length - d._end;
	    d._end = length - tmp;

	    // Invert coordinates of genes in the locus
	    d.genes.forEach(g => {
	      let tmp = g.start;
	      g.start = length - g.end;
	      g.end = length - tmp;
	      g.strand = (g.strand === 1) ? -1 : 1;
	    });

	    // Update range of locus scale
	    let diff = scales.x(tmp - d._start);
	    updateScaleRange("locus", d.uid, scales.locus(d.uid) + diff);
	  }
	};

	const _scale = {
	  check: s => _scale.checkDomain(s) && _scale.checkRange(s),
	  checkDomain: s => scales[s].domain().length > 0,
	  checkRange: s => scales[s].range().length > 0,
	  updateX: () => {scales.x.range([0, config$1.plot.scaleFactor]);},
	  updateY: data => {
	    scales.y
	      .range([
	        0,
	        data.clusters.length
	        * (config$1.gene.shape.tipHeight * 2 + config$1.gene.shape.bodyHeight)
	        + (data.clusters.length - 1) * config$1.cluster.spacing
	      ]);
	  },
	  updateOffset: clusters => {
	    scales.offset
	      .domain(clusters.map(d => d.uid))
	      .range(clusters.map(() => 0));
	  },
	  updateLocus: clusters => {
	    let [domain, range] = _cluster.getLocusScaleValues(clusters);
	    scales.locus.domain(domain).range(range);
	  },
	  /**
	   * Rescales offset and locus scales with an updated x scale.
	   * @param {d3.scale} old - The old x scale
	   */
	  rescaleRanges: old => {
	    [scales.offset, scales.locus].forEach(scale => {
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
	  update: data => {
	    let oldX = scales.x.copy();
	    _scale.updateX();
	    _scale.rescaleRanges(oldX);

	    if (!_scale.check("y"))
	      scales.y.domain(data.clusters.map(c => c.uid));
	    _scale.updateY(data);

	    if (!_scale.check("offset"))
	      _scale.updateOffset(data.clusters);

	    if (!_scale.check("locus"))
	      _scale.updateLocus(data.clusters);
	  }
	};

	config$1.gene.shape.onClick = _gene.anchor;
	config$1.legend.onClickText = renameText;

	function clusterMap() {
	  /* A ClusterMap plot. */

	  let container = null;
	  let transition = d3.transition();

	  plot.update = () => container.call(my);

	  function my(selection) {
	    selection.each(function(data) {

	      // Save the container for later updates
	      container = d3.select(this)
	        .attr("width", "100%")
	        .attr("height", "100%");

	      // Set up the shared transition
	      transition = d3.transition()
	        .duration(config$1.plot.transitionDuration);

	      // Build the figure
	      let plot$1 = container.selectAll("svg.clusterMap")
	        .data([data])
	        .join(
	          enter => {
	            // Add HTML colour picker input
	            enter.append("input")
	              .attr("id", "picker")
	              .attr("class", "colourPicker")
	              .attr("type", "color")
	              .style("opacity", 0);

	            // Add root SVG element
	            let svg = enter.append("svg")
	              .attr("class", "clusterMap")
	              .attr("id", "root-svg")
	              .attr("cursor", "grab")
	              .attr("width", "100%")
	              .attr("height", "100%")
	              .attr("xmlns", "http://www.w3.org/2000/svg")
	              .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

	            let g = svg.append("g")
	              .attr("class", "clusterMapG");

	            // Attach pan/zoom behaviour
	            let zoom = d3.zoom()
	              .scaleExtent([0, 8])
	              .on("zoom", event => g.attr("transform", event.transform))
	              .on("start", () => svg.attr("cursor", "grabbing"))
	              .on("end", () => svg.attr("cursor", "grab"));
	            let transform = d3.zoomIdentity
	              .translate(20, 50)
	              .scale(1.2);
	            svg.call(zoom)
	              .call(zoom.transform, transform)
	              .on("dblclick.zoom", null);

	            return g
	          },
	          update => update.call(
	            update => {
	              update
	                // .transition(transition)
	                .call(arrangePlot);
	            })
	        );

	      _scale.update(data);
	      _link.updateGroups(data.links);

	      container = d3.select(this);

	      let linkGroup = plot$1.selectAll("g.links")
	        .data([data])
	        .join("g")
	        .attr("class", "links");

	      let clusterGroup = plot$1.selectAll("g.clusters")
	        .data([data.clusters])
	        .join("g")
	        .attr("class", "clusters");

	      let clusters = clusterGroup
	        .selectAll("g.cluster")
	        .data(data.clusters, d => d.uid)
	        .join(
	          enter => {
	            enter = enter.append("g")
	              .attr("id", _cluster.getId)
	              .attr("class", "cluster")
	              .each(initialiseData);
	            let info = enter.append("g")
	              .attr("id", c => `cinfo_${c.uid}`)
	              .attr("class", "clusterInfo")
	              .attr("transform", `translate(-10, 0)`)
	              .call(_cluster.drag);
	            info.append("text")
	              .text(c => c.name)
	              .attr("class", "clusterText")
	              .attr("y", 8)
	              .attr("cursor", "pointer")
	              .style("font-weight", "bold")
	              .on("click", renameText);
	            info.append("text")
	              .attr("class", "locusText")
	              .attr("y", 10)
	              .style("dominant-baseline", "hanging");
	            enter.append("g")
	              .attr("class", "loci");
	            info.selectAll("text")
	              .attr("text-anchor", "end")
	              .style("font-family", "sans");
	            return enter
	              .call(_cluster.update)
	          },
	          update => update.call(
	            update => update
	              .transition(transition)
	              .call(_cluster.update)
	          )
	        );

	      let loci = clusters.selectAll("g.loci")
	        .selectAll("g.locus")
	        .data(d => d.loci, d => d.uid)
	        .join(
	          enter => {
	            enter = enter.append("g")
	              .attr("id", _locus.getId)
	              .attr("class", "locus");
	            enter.append("line")
	              .attr("class", "trackBar")
	              .style("fill", "#111");
	            let hover = enter.append("g")
	              .attr("class", "hover")
	              .attr("opacity", 0);
	            enter.append("g")
	              .attr("class", "genes");
	            hover.append("rect")
	              .attr("class", "hover")
	              .attr("fill", "rgba(0, 0, 0, 0.4)")
	              .call(_locus.dragPosition);
	            hover.append("rect")
	              .attr("class", "leftHandle")
	              .attr("x", -8)
	              .call(_locus.dragResize);
	            hover.append("rect")
	              .attr("class", "rightHandle")
	              .call(_locus.dragResize);
	            hover.selectAll(".leftHandle, .rightHandle")
	              .attr("width", 8)
	              .attr("cursor", "pointer");
	            enter
	              .on("mouseenter", event => {
	                if (flags.isDragging) return
	                d3.select(event.target)
	                  .select("g.hover")
	                  .transition()
	                  .attr("opacity", 1);
	              })
	              .on("mouseleave", event => {
	                if (flags.isDragging) return
	                d3.select(event.target)
	                  .select("g.hover")
	                  .transition()
	                  .attr("opacity", 0);
	              })
	              .on("dblclick", (_, d) => {
	                _locus.flip(d);
	                plot.update();
	              });
	            return enter
	              .call(_locus.update)
	          },
	          update => update.call(
	            update => update.transition(transition)
	              .call(_locus.update)
	          )
	        );

	      loci.selectAll("g.genes")
	        .selectAll("g.gene")
	        .data(d => d.genes, d => d.uid)
	        .join(
	          enter => {
	            enter = enter.append("g")
	              .attr("id", _gene.getId)
	              .attr("class", "gene")
	              .attr("display", "inline");
	            enter.append("polygon")
	              .on("click", config$1.gene.shape.onClick)
	              .attr("class", "genePolygon");
	            enter.append("text")
	              .text(g => g.name)
	              .attr("class", "geneLabel")
	              .attr("dy", "-0.3em");
	            return enter
	              .call(_gene.update)
	          },
	          update => update.call(
	            update => update.transition(transition)
	              .call(_gene.update)
	          )
	        );

	      linkGroup.selectAll("path.geneLink")
	        .data(_link.filter(data.links), _link.getId)
	        .join(
	          enter => enter.append("path")
	            .attr("id", _link.getId)
	            .attr("class", "geneLink")
	            .style("fill", d => scales.score(d.identity))
	            .style("stroke", "black")
	            .style("stroke-width", "0.5px")
	            .call(_link.setPath),
	          update => update.call(
	            update => update
	              .transition(transition)
	              .call(_link.setPath, true)
	          )
	        );

	      let legendFn = getLegendFn();
	      let scaleBarFn = getScaleBarFn();
	      let colourBarFn = getColourBarFn();

	      plot$1
	        .call(legendFn)
	        .call(colourBarFn)
	        .call(scaleBarFn)
	        .call(arrangePlot);
	    });
	  }

	  function arrangePlot(selection) {
	    selection.select("g.scaleBar")
	      .transition(transition)
	      .attr("transform", plot.scaleBarTransform);
	    selection.select("g.colourBar")
	      .transition(transition)
	      .attr("transform", plot.colourBarTransform);
	    selection.select("g.legend")
	      .transition(transition)
	      .attr("transform", plot.legendTransform);
	  }

	  function initialiseData(cluster) {
	    cluster.loci.forEach(locus => {
	      locus._start = locus.start;
	      locus._end = locus.end;
	      locus._offset = 0;
	      locus._cluster = cluster.uid;
	      locus._flipped = false;
	      locus.genes.forEach(gene => {
	        gene._locus = locus.uid;
	        gene._cluster = cluster.uid;
	      });
	    });
	  }

	  function changeGeneColour(_, d) {
	    let picker = d3.select("input.colourPicker");
	    picker.on("change", () => {
	      let value = picker.node().value;
	      let range = scales.colour.range();
	      range[d] = value;
	      scales.colour.range(range);
	      d3.selectAll(`.group-${d}`)
	        .attr("fill", value);
	    });
	    picker.node().click();
	  }

	  function resizeScaleBar() {
	    let result = prompt("Enter new length (bp):", config$1.scaleBar.basePair);
	    if (result) {
	      config$1.scaleBar.basePair = result;
	      plot.update();
	    }
	  }

	  function getScaleBarFn() {
	    return scaleBar(scales.x)
	      .stroke(config$1.scaleBar.stroke)
	      .height(config$1.scaleBar.height)
	      .colour(config$1.scaleBar.colour)
	      .basePair(config$1.scaleBar.basePair)
	      .fontSize(config$1.scaleBar.fontSize)
	      .onClickText(resizeScaleBar)
	      .transition(transition)
	  }

	  function getColourBarFn() {
	    return colourBar(scales.score)
	      .width(config$1.colourBar.width)
	      .height(config$1.colourBar.height)
	      .fontSize(config$1.colourBar.fontSize)
	      .transition(transition)
	  }

	  function getHiddenGeneGroups() {
	    let hidden;
	    let genes = d3.selectAll("g.gene");
	    if (genes.empty()) {
	      hidden = [];
	    } else {
	      hidden = scales.colour.domain();
	      genes.each((d, i, n) => {
	        let display = d3.select(n[i]).attr("display");
	        let group = scales.group(d.uid);
	        if (display === "inline" && group !== null && hidden.includes(group))
	          hidden = hidden.filter(g => g !== group);
	      });
	    }
	    return hidden 
	  }

	  function getLegendFn() {
	    let hidden = getHiddenGeneGroups();
	    return legend(scales.colour)
	      .hidden(hidden)
	      .fontSize(config$1.legend.fontSize)
	      .entryHeight(config$1.legend.entryHeight)
	      .onClickCircle(config$1.legend.onClickCircle || changeGeneColour)
	      .onClickText(config$1.legend.onClickText)
	  }

	  my.config = function(_) {
	    if (!arguments.length) return config
	    plot.updateConfig(_);
	    return my
	  };

	  return my
	}

	exports.ClusterMap = clusterMap;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
