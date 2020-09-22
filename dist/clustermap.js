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

	function gene() {
		/* Draw genes in loci */

		let config = {
			scaleFactor: 15,
			transitionDuration: 500,
			shape: {
				bodyHeight: 12,
				tipHeight: 5,
				tipLength: 12,
				stroke: "black",
				strokeWidth: 1,
				onClick: null,
			},
			label: {
				anchor: "start",
				fontSize: 10,
				rotation: 12,
				show: true,
				start: 0.5,
			}
		};

		let t = d3.transition()
			.duration(config.transitionDuration);

		let scales = {
			x: d3.scaleLinear()
				.domain([0, 1000])
				.range([0, config.scaleFactor]),
			colour: null,
			group: null,
		};
		let update = () => {
			return
		};

		function my(selection) {
			selection.each(function(data) {
				d3.select(this)
					.selectAll("g.gene")
					.data(data.genes, d => d.uid)
					.join(
						enter => {
							enter = enter.append("g")
								.attr("id", getId)
								.attr("class", "gene")
								.each(gene => {
									gene._locus = data.uid;
									gene._cluster = data._cluster;
								});
							enter.append("polygon")
								.attr("class", "genePolygon")
								.on("click", config.shape.onClick);
							enter.append("text")
								.text(g => g.name)
								.attr("class", "geneLabel")
								.attr("dy", "-0.3em");
							return enter.call(updateGenes)
						},
						update => update.call(update => update.transition(t).call(updateGenes))
					);
			});
		}

		function updateGenes(selection) {
			selection.selectAll("polygon.genePolygon")
				.attr("class", g => `genePolygon group-${g.group}`)
				.attr("points", getPoints)
				.attr("fill", getFill)
				.style("stroke", config.shape.stroke)
				.style("stroke-width", config.shape.strokeWidth);
			selection.selectAll("text.geneLabel")
				.attr("display", config.label.show ? "inherit" : "none")
				.attr("transform", labelTranslate)
				.attr("font-size", config.label.fontSize)
				.attr("text-anchor", config.label.Anchor);
		}

		function getFill(g) {
			// Gets the current fill of a gene based on group/colour scales
			if (!scales.colour || !scales.group) return "#bbb"
			let groupId = scales.group(g.uid);
			return scales.colour(groupId)
		}

		function labelTranslate(g) {
			// Calculates rotation and translation for a gene label
			let offset = scales.x(g.end - g.start) * config.label.start;
			let gx = scales.x(g.start) + offset;
			let rotate = (["start", "middle"].includes(config.label.anchor))
				? -config.label.rotation
				: config.label.rotation;
			return `translate(${gx}, 0) rotate(${rotate})`
		}

		function getId(gene) {
			// Gets unique ID of a given gene
			return `gene_${gene.uid}`
		}

		function getPoints(gene) {
			// Calculates points attribute to draw a gene polygon
			let inverse = false;
			let points = [];

			// Get start and end of Gene as percentages of Locus length
			let scaledStart = scales.x(gene.start);
			let scaledEnd = scales.x(gene.end);
			let geneLength = scaledEnd - scaledStart;

			// Calculate scaled constants based on scaled coordinates
			let bottom = config.shape.tipHeight * 2 + config.shape.bodyHeight;
			let midpoint = bottom / 2;
			let third = config.shape.tipHeight + config.shape.bodyHeight;

			// Determine polygon points for the Gene
			if ((gene.strand === 1) || ((gene.strand === -1) & (inverse === true))) {
				// Draw gene 5' to 3'
				let shaft = scaledEnd - config.shape.tipLength;
				points = [
					scaledStart, config.shape.tipHeight,
					shaft, config.shape.tipHeight,
					shaft, 0,
					scaledEnd, midpoint,
					shaft, bottom,
					shaft, third,
					scaledStart, third,
				];
				// Squeeze arrow when total length is less than tip length
				if (geneLength < config.shape.tipLength) {
					[2, 4, 8, 10].forEach(item => (points[item] = scaledStart));
				}
			} else if ((gene.strand === -1) | ((gene.strand === 1) & (inverse === true))) {
				// Draw gene 3' to 5'
				let shaft = scaledStart + config.shape.tipLength;
				points = [
					scaledEnd, config.shape.tipHeight,
					shaft, config.shape.tipHeight,
					shaft, 0,
					scaledStart, midpoint,
					shaft, bottom,
					shaft, third,
					scaledEnd, third,
				];
				if (geneLength < config.shape.tipLength) {
					[2, 4, 8, 10].forEach(item => (points[item] = scaledEnd));
				}
			}
			return points.join(" ")
		}

		my.config = function(_) {
			if (!arguments.length) return config
			updateConfig(config, _);
			return my
		};
		my.scales = function(_) {
			if (!arguments.length) return scales
			updateConfig(scales, _);
			return my
		};
		my.transition = function(_) {
			if (!arguments.length) return t
			t = _;
			return my
		};
		my.update = function(_) {
			if (!arguments.length) return update
			update = _;
			return my
		};

		return my
	}

	function locus() {
		/* Draw cluster loci
		 *
		 * config: ClusterMap configuration object
		 * x: x scale
		 * s: loci scales
		 * t: d3 transition
		 * groupScale: ordinal scale mapping genes to homology groups
		 * legendScale: ordinal scale mapping homology groups to colours
		*/

		const config = {
			transitionDuration: 500,
			scaleFactor: 15,
			spacing: 50,
			offsetFromZero: false,
			trackBar: {
				colour: "#111",
				stroke: 1,
			},
			gene: {
				shape: {
					bodyHeight: 12,
					tipHeight: 5,
					tipLength: 12,
					onClick: null,
				},
				label: {
					anchor: "start",
					fontSize: 10,
					rotation: 12,
					show: true,
					start: 0.5,
				},
			},
		};

		const scales = {
			x: d3.scaleLinear()
				.domain([0, 1000])
				.range([0, config.scaleFactor]),
			offset: null,
			locus: null,
			group: null,
			colour: null,
		};

		let container = null;
		let update = () => {
			if (!container) return
			container.call(my);
		};

		let isDragging = false;
		let t = d3.transition().duration(config.transitionDuration);

		function my(selection) {
			if (!config) return
			selection.each(function(data) {

				// Establish locus scale if one isn't passed down
				if (!scales.locus)
					scales.locus = d3.scaleOrdinal()
						.domain(data.loci.map(l => l.uid))
						.range([1, data.loci.slice(0, data.loci.length).map(l => l.start)]);

				container = d3.select(this);

				let locusEnter = (enter) => {
					enter = enter.append("g")
						.attr("id", getId)
						.attr("class", "locus")
						.each(locus => {
							locus._start = locus.start;
							locus._end = locus.end;
							locus._cluster = data.uid;
						});
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
						.attr("fill", "rgba(0, 0, 0, 0.4)");

					let leftDrag = d3.drag()
						.on("start", () => { isDragging = true; })
						.on("drag", (d, i, n) => {
							// Find closest gene start, from start to _end
							let geneStarts = d.genes
								.filter(gene => gene.end <= d._end)
								.map(gene => gene.start);
							let starts = [d.start, ...geneStarts].map(value => scales.x(value));
							let position = getClosest(starts, d3.event.x);
							let value = starts[position];

							d3.select(n[i]).attr("x", value - 8);

							// Adjust the cluster offset scale, update _start of this locus
							let domain = scales.offset.domain();
							let index = domain.findIndex(el => el === d._cluster);
							let range = scales.offset.range();

							// Update cluster offset scale based on new locus borders
							// If offsetFromZero is true, offset is always relative to the previous offset.
							// Otherwise, it is additive, resizing to the current mouse position
							// Adds/subtracts distance from previous locus start to current mouse position
							if (config.offsetFromZero) {
								range[index] -= value - scales.x(d._start);
							} else {
								range[index] += value - scales.x(d._start);
							}
							scales.offset.range(range);
							d._start = getBasePair(value);

							// Resize the hover <rect>, hide any genes not within bounds
							hover.select("rect.hover")
								.attr("x", value)
								.attr("width", getRealLength);
							enter.selectAll("g.gene")
								.attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none");
							d3.selectAll("path.geneLink")
								.attr("display", getLinkDisplay);
							d3.select(`#cinfo_${d._cluster}`)
								.attr("transform", `translate(${scales.locus(d.uid) + scales.x(d._start) - 10}, 0)`);
							enter.call(updateTrackBar);
						})
						.on("end", () => {
							isDragging = false;
							hover.transition().attr("opacity", 0);
							update();
						});
					hover.append("rect")
						.attr("class", "leftHandle")
						.attr("x", -8)
						.call(leftDrag);

					let rightDrag = d3.drag()
						.on("start", () => { isDragging = true; })
						.on("drag", (d, i, n) => {
							// Find closest visible gene end, from _start to end
							let ends = d.genes
								.filter(gene => gene.start >= d._start)
								.map(gene => gene.end);
							let range = ends.map(value => scales.x(value));
							let position = getClosest(range, d3.event.x);
							d._end = getBasePair(range[position]);

							// Update rect width, hide genes out of bounds
							d3.select(n[i])
								.attr("x", scales.x(d._end));
							hover.select("rect.hover")
								.attr("width", getRealLength);
							enter.selectAll("g.gene")
								.attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none");
							d3.selectAll("path.geneLink")
								.attr("display", getLinkDisplay);
							enter.call(updateTrackBar);
						})
						.on("end", () => {
							isDragging = false;
							hover.transition().attr("opacity", 0);
							update();
						});
					hover.append("rect")
						.attr("class", "rightHandle")
						.call(rightDrag);
					hover.selectAll("rect.leftHandle, rect.rightHandle")
						.attr("width", 8)
						.attr("cursor", "pointer");
					enter
						.on("mouseenter", () => { if (!isDragging) hover.transition().attr("opacity", 1); })
						.on("mouseleave", () => { if (!isDragging) hover.transition().attr("opacity", 0); });
					return enter.call(updateLoci)
				};

				let locusUpdate = (update) => {
					return update.call(update => update.transition(t).call(updateLoci))
				};

				// Draw each locus group
				let loci = container.selectAll("g.locus")
					.data(data.loci, d => d.uid)
					.join(locusEnter, locusUpdate);

				let geneFn = gene()
					.config({
						shape: config.gene.shape,
						label: config.gene.label,
					})
					.scales(scales)
					.update(update)
					.transition(t);

				loci.selectAll("g.genes")
					.call(geneFn);
			});
		}

		function getId(gene) {
			return `locus_${gene.uid}`
		}

		function getLinkDisplay(link) {
			let a = d3.select(`#gene_${link.query.uid}`).attr("display");
			let b = d3.select(`#gene_${link.target.uid}`).attr("display");
			return (a === "none" || b === "none") ? "none" : "inline"
		}

		function getBasePair(value) {
			// Converts scale coordinates back to base pair value
			return Math.round(value * 1000 / config.scaleFactor)
		}

		function getClosest(values, value) {
			// Finds closest element to value in an array of values using D3 bisect
			return Math.max(Math.min(d3.bisectLeft(values, value), values.length - 1), 0)
		}

		function getRealLength(d) {
			return scales.x(d._end) - scales.x(d._start)
		}

		function updateTrackBar(selection) {
			let midPoint = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;
			selection.select("line.trackBar")
				.attr("x1", d => scales.x(d._start))
				.attr("x2", d => scales.x(d._end))
				.attr("y1", midPoint)
				.attr("y2", midPoint)
				.style("stroke", config.trackBar.colour)
				.style("stroke-width", config.trackBar.stroke);
		}

		function updateLoci(selection) {
			let botPoint = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
			let translate = d => `translate(${scales.locus(d.uid)}, 0)`;
			selection.call(updateTrackBar);
			selection.attr("transform", translate);
			selection.selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
				.attr("y", -10)
				.attr("height", botPoint + 20);
			selection.select("rect.hover")
				.attr("width", getRealLength);
			selection.select("rect.rightHandle")
				.attr("x", d => scales.x(d._end));
		}

		// Getters/setters
		my.config = function(_) {
			if (!arguments.length) return config
			updateConfig(config, _);
			return my
		};
		my.scales = function(_) {
			if (!arguments.length) return scales
			updateConfig(scales, _);
			return my
		};
		my.transition = function(_) {
			if (!arguments.length) return t
			t = _;
			return my
		};
		my.update = function(_) {
			if (!arguments.length) return update
			update = _;
			return my
		};

		return my
	}

	function geneLinks() {

		const config = {
			transitionDuration: 500,
			scaleFactor: 15,
			nameFontSize: 12,
			lociFontSize: 10,
			spacing: 60,
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
				},
				label: {
					anchor: "start",
					fontSize: 10,
					rotation: 12,
					show: true,
					start: 0.5,
				},
			},
		};
		const scales = {
			x: null,
			y: null,
			locus: null,
			offset: null,
		};
		let t = d3.transition();
		let container;
		let update = () => container.call(my);

		function my(selection) {
			selection.each(function(data) {
				container = d3.select(this);

				// Get filtering function based on current data
				let filterGeneLinks = getLinkFilterFn(data);

				// Cross-cluster gene links
				// Establish <g> before clusters, but must populate after clusters drawn
				container.selectAll("path.geneLink")
					.data(data.links.filter(filterGeneLinks), getLinkKey)
					.join(
						enter => enter.append("path")
							.attr("class", "geneLink")
							.attr("d", getLinkPath)
							.style("fill", "black")
							.style("fill-opacity", link => link.identity)
							.on("click", function() {
								let link = d3.select(this);
								let fill = link.style("fill-opacity");
								while (true) {
									let result = prompt("Enter new opacity (0-1):", fill);
									if (!result) break
									if (result >= 0 && result <= 1) {
										link.style("fill-opacity", +result);
										break
									} else {
										alert("Invalid value, try again");
									}
								}
							}),
						update => update.call(
							update => update
								.transition(t)
								.attr("d", getLinkPath)
						)
					);
			});
		}

		function getGeneData(uid) {
			// Gets data attached to a given gene UID
			return d3.select(`#gene_${uid}`).data()[0]
		}

		function getLinkKey(link) {
			let [a, b] = [link.query.uid, link.target.uid].sort();
			return `${a}-${b}`
		}

		function getLinkFilterFn(data) {
			// Generates function which filters links to those between immediately adjacent clusters
			return function(d) {
				let a = getGeneData(d.query.uid);
				let b = getGeneData(d.target.uid);
				// if (a.style("display") !== "inline" || b.style("display") !== "inline") return false
				a = data.clusters.findIndex(el => el.uid === a._cluster);
				b = data.clusters.findIndex(el => el.uid === b._cluster);
				return Math.abs(a - b) === 1
			}
		}

		function getLinkPath(d) {
			// Calculates points linking two genes
			// Select genes by unique ID, get underlying data 
			let a = getGeneData(d.query.uid);
			let b = getGeneData(d.target.uid);

			// Calculate vertical midpoint based on shape config
			let mid = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;

			// Locus offset in each cluster, mostly 0
			let getOffset = g => (
				scales.offset(g._cluster)
				+ scales.locus(g._locus)
			);
			let aOffset = getOffset(a);
			let bOffset = getOffset(b);

			// Get anchoring points for each gene polygon
			let getAnchors = (g, offset) => [
				scales.x(g.start) + offset,
				scales.x(g.end) + offset,
				scales.y(g._cluster) + mid
			];
			let [ax1, ax2, ay] = getAnchors(a, aOffset);
			let [bx1, bx2, by] = getAnchors(b, bOffset);

			// Generate the path d attribute
			return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by}`
		}

		my.config = function(_) {
			if (!arguments.length) return config
			updateConfig(config, _);
			return my
		};
		my.scales = function(_) {
			if (!arguments.length) return scales
			updateConfig(scales, _);
			return my
		};
		my.transition = function(_) {
			if (!arguments.length) return t
			t = _;
			return my
		};
		my.update = function(_) {
			if (!arguments.length) return update
			update = _;
			return my
		};

		return my
	}

	function cluster() {
		/* Draw gene clusters. */

		const config = {
			transitionDuration: 500,
			scaleFactor: 15,
			nameFontSize: 12,
			lociFontSize: 10,
			spacing: 60,
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
				},
				label: {
					anchor: "start",
					fontSize: 10,
					rotation: 12,
					show: true,
					start: 0.5,
				},
			},
		};

		let anchors = [];

		const scales = {
			x: d3.scaleLinear()
				.domain([0, 1000])
				.range([0, config.scaleFactor]),
			y: null,
			group: null,
			colour: null,
			offset: d3.scaleOrdinal(),
			locus: d3.scaleOrdinal(),
		};

		let t = d3.transition().duration(config.transitionDuration);

		let container = null;
		let update = () => {
			if (!container) return
			container.call(my);
		};

		function my(selection) {
			selection.each(function(data) {
				updateScales(data);

				// Update the y-scale, if it doesn't exist already
				if (!scales.y)
					scales.y = d3.scaleBand()
						.padding(0.05)
						.domain(data.clusters.map(c => c.uid))
						.range([
							0,
							data.clusters.length
							* (config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight)
							+ (data.clusters.length - 1) * config.spacing
						]);

				container = d3.select(this);

				let linkGroup = container.selectAll("g.links")
					.data([data])
					.join("g")
					.attr("class", "links");

				let clusterGroup = container.selectAll("g.clusters")
					.data([data.clusters])
					.join("g")
					.attr("class", "clusters");

				// Draw cluster groups
				let clusters = clusterGroup
					.selectAll("g.cluster")
					.data(data.clusters, d => d.uid)
					.join(
						enter => {
							enter = enter.append("g")
								.attr("id", getId)
								.attr("class", "cluster");
							let info = enter.append("g")
								.attr("id", c => `cinfo_${c.uid}`)
								.attr("class", "clusterInfo")
								.attr("transform", `translate(-10, 0)`);
							info.append("text")
								.text(c => c.name)
								.attr("class", "clusterText")
								.attr("y", 8)
								.attr("cursor", "pointer")
								.style("font-weight", "bold")
								.on("click", config.onClickText || renameText);
							info.append("text")
								.attr("class", "locusText")
								.attr("y", 22);
							info.selectAll("text")
								.attr("text-anchor", "end")
								.style("font-family", "sans");
							enter.call(updateCluster);
							return enter
						},
						update => update.call(
							update => update.transition(t)
								.call(updateCluster)
						)
					);

				// Draw loci
				let locusFn = locus()
					.config({
						trackBar: config.locus.trackBar,
						spacing: config.locus.spacing,
						gene: config.gene,
					})
					.scales(scales)
					.transition(t)
					.update(update);
				clusters.call(locusFn);

				// Draw links
				let linkFn = geneLinks()
					.config(config)
					.scales(scales)
					.transition(t)
					.update(update);
				linkGroup.call(linkFn);
			});
		}

		function getId(gene) {
			return `cluster_${gene.uid}`
		}

		function getClusterRange(cluster) {
			// Gets range for a cluster scale based on its loci
			// Note: transform on <g> element only applies to visible elements,
			//			 so no point adding offset here
			let range = [];
			let value = 1;
			let start, end;
			for (const locus of cluster.loci) {
				if (start) value = range[range.length - 1] + end - start + config.locus.spacing;
				start = scales.x(locus._start || locus.start);
				end = scales.x(locus._end || locus.end);
				range.push(value - start);
			}
			return range
		}

		function getLocusScaleValues(clusters) {
			// Gets domain and range for the locus offset scale
			let domain = [];
			let range = [];
			clusters.forEach(cluster => {
				let d = cluster.loci.map(locus => locus.uid);
				let r = getClusterRange(cluster); 
				domain.push(...d);
				range.push(...r);
			});
			return [domain, range]
		}

		function updateScales(data) {
			let [domain, range] = getLocusScaleValues(data.clusters);
			scales.locus.domain(domain).range(range);
		}

		function updateCluster(selection) {
			selection.attr(
				"transform",
				d => `translate(${scales.offset(d.uid)}, ${scales.y(d.uid)})`
			);
			selection.select(".clusterInfo").attr("transform", `translate(-10, 0)`);
			selection.selectAll("text.clusterText")
				.style("font-size", `${config.nameFontSize}px`);
			selection.selectAll("text.locusText")
				.text(locusText)
				.style("font-size", `${config.lociFontSize}px`);
		}

		function locusText(cluster) {
			return cluster.loci.map(locus => {
				if (!locus._start || !locus._end) return locus.name
				return `${locus.name}:${locus._start.toFixed(0)}-${locus._end.toFixed(0)}`
			}).join(", ")
		}

		my.anchors = _ => arguments.length ? (anchors = _, my) : anchors;

		my.config = function(_) {
			if (!arguments.length) return config
			updateConfig(config, _);
			return my
		};
		my.scales = function(_) {
			if (!arguments.length) return scales
			updateConfig(scales, _);
			return my
		};
		my.transition = function(_) {
			if (!arguments.length) return t
			t = _;
			return my
		};
		my.update = function(_) {
			if (!arguments.length) return update
			update = _;
			return my
		};

		return my
	}

	function legend(colourScale) {
		/* Creates a legend component from a colour scale.
		 */

		let entryHeight = 15;
		let fontSize = 12;
		let onClickRect = null;
		let onClickText = renameText;
		let y = d3.scaleBand().paddingInner(0.5);
		let t = d3.transition().duration(500);

		function my(selection) {
			selection.each(function(data) {
				// Grab new domain from colourScale and update the y-scale
				let domain = colourScale.domain();
				y.domain(domain)
					.range([0, entryHeight * domain.length]);

				// Grab the <g> element, if it exists
				let g = d3.select(this)
					.selectAll("g.legend")
					.data([data])
					.join("g")
					.attr("class", "legend");

				// Render each legend element <g>
				let translate = d => `translate(0, ${y(d)})`;
				g.selectAll("g.element")
					.data(domain)
					.join(
						enter => {
							enter = enter.append("g")
								.attr("class", "element")
								.attr("transform", translate);
							enter.append("rect")
								.attr("fill", d => colourScale(d))
								.attr("class", d => `group-${d}`)
								.attr("width", 12)
								.attr("height", y.bandwidth());
							enter.append("text")
								.text(d => `Group ${d}`)
								.attr("x", 16)
								.attr("y", y.bandwidth())
								.attr("text-anchor", "start")
								.style("font-family", "sans")
								.style("font-size", fontSize);
							return enter
						},
						update => update.call(
							update => update.transition(t)
								.attr("transform", translate)
						)
					);

				// If click callbacks are specified, bind them
				if (onClickRect)
					g.selectAll("rect")
						.attr("cursor", "pointer")
						.on("click", onClickRect);
				if (onClickText)
					g.selectAll("text")
						.attr("cursor", "pointer")
						.on("click", onClickText);
			});
		}

		my.colourScale = function(_) {
			// Setter for the colour scale used as the basis of the legend
			if (!arguments.length) return colourScale
			colourScale = _;
			return my
		};

		my.transition = function(_) {
			// Setter for transition used in legend updates
			if (!arguments.length) return t
			t = _;
			return t
		};

		my.entryHeight = function(_) {
			// Setter for height of legend elements (def. 15)
			if (!arguments.length) return entryHeight
			entryHeight = parseInt(_);
			return my
		};

		my.fontSize = function(_) {
			// Setter for legend element text font size
			if (!arguments.length) return fontSize
			fontSize = parseInt(_);
			return my
		};

		my.onClickRect = function(_) {
			// Setter for <rect> element click callback
			if (!arguments.length) return onClickRect
			onClickRect = _;
			return my
		};

		my.onClickText = function(_) {
			// Setter for <text> element click callback
			if (!arguments.length) return onClickText
			onClickText = _;
			return my
		};

		return my
	}

	function colourBar(colourScale, t) {
		/* Creates the colour bar component.
		*/

		let height = 25;
		let width = 150;
		let fontSize = 12;

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
								.style("font-family", "sans-serif");

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
				.attr("y", height + 20);
			selection.select(".labelText")
				.attr("x", width / 2);
			selection.select(".endText")
				.attr("x", width);
			selection.selectAll("text")
				.style("font-size", fontSize);					
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
				.attr("y", height + 20)
				.style("font-size", fontSize);				
			selection.selectAll("line")
				.style("stroke", colour)
				.style("stroke-width", stroke);
		}

		function promptNewLength() {
			let result = prompt("Enter new length (bp):", basePair);
			if (result) my.basePair(result);
		}

		my.basePair = function(_) {
			// Setter for scale bar length
			if (!arguments.length) return basePair
			basePair = parseInt(_);
			return my
		};

		my.stroke = function(_) {
			// Setter for scale bar length
			if (!arguments.length) return stroke
			stroke = parseInt(_);
			return my
		};

		my.height = function(_) {
			// Setter for scale bar height
			if (!arguments.length) return height
			height = parseInt(_);
			return my
		};

		my.colour = function(_) {
			// Setter for scale bar colour
			if (!arguments.length) return colour
			colour = _;
			return my
		};

		my.fontSize = function(_) {
			// Setter for scale bar text font size
			if (!arguments.length) return fontSize
			fontSize = parseInt(_);
			return my
		};

		my.onClickText = function(_) {
			if (!arguments.length) return onClickText
			onClickText = _;
			return my
		};

		my.transition = function(_) {
			// Setter for scale bar d3.transition element
			if (!arguments.length) return t
			t = _;
			return my
		};

		return my
	}

	function clusterMap() {
		/* A ClusterMap plot. */

		const config = {
			transitionDuration: 250,
			scaleFactor: 15,
			legend: {
				entryHeight: 15,
				fontSize: 14,
				onClickRect: null,
				onClickText: renameText,
				show: true,
			},
			colourBar: {
				fontSize: 12,
				height: 15,
				show: true,
				width: 150,
			},
			scaleBar: {
				colour: "black",
				fontSize: 12,
				height: 15,
				basePair: 2500,
				show: true,
				stroke: 1,
			},
			cluster: {
				nameFontSize: 12,
				lociFontSize: 10,
				spacing: 50,
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
					onClick: anchorGenes,
				},
				label: {
					anchor: "start",
					fontSize: 10,
					rotation: 25,
					show: true,
					start: 0.5,
				},
			},
		};

		const scales = {
			x: d3.scaleLinear().domain([1, 1001]),
			y: d3.scaleBand().padding(0.05),
			offset: null,
			score: d3.scaleSequential(d3.interpolateGreys).domain([0, 1]),
			group: d3.scaleOrdinal().unknown(null),
			colour: d3.scaleOrdinal().unknown("#bbb"),
			locus: d3.scaleOrdinal(),
		};

		let t = d3.transition().duration(config.transitionDuration);
		let container = null;

		function my(selection) {
			selection.each(function(data) {
				console.log("Start building", config);

				// Update scales and transition
				console.log("Updating scales");
				updateScales(data);

				console.log("Updating colour scales");
				updateLinkGroups(data);

				console.log("Updating transition");
				t = d3.transition().duration(config.transitionDuration);

				container = d3.select(this)
					.attr("width", "100%")
					.attr("height", "100%");

				// Build the figure
				console.log("Building cluster map");
				container.selectAll("svg.clusterMap")
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
							let g = svg.append("g");

							// Attach pan/zoom behaviour
							let zoom = d3.zoom()
								.scaleExtent([0, 8])
								.on("zoom", () => g.attr("transform", d3.event.transform))
								.on("start", () => svg.attr("cursor", "grabbing"))
								.on("end", () => svg.attr("cursor", "grab"));
							let transform = d3.zoomIdentity
								.translate(20, 50)
								.scale(1.2);
							svg.call(zoom)
								.call(zoom.transform, transform);

							// Build the map
							return g.call(buildClusterMap)
						},
						update => update.call(
							update => update.transition(t).call(buildClusterMap)
						)
					);
				console.log("Finished");
			});
		}

		function updateScales(data) {
			if (!scales.offset)
				scales.offset = d3.scaleOrdinal()
					.domain(data.clusters.map(d => d.uid))
					.range(data.clusters.map(() => 0));
			scales.x
				.range([0, config.scaleFactor]);
			scales.y
				.domain(data.clusters.map(c => c.uid))
				.range([
					0,
					data.clusters.length
					* (config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight)
					+ (data.clusters.length - 1) * config.cluster.spacing
				]);
		}

		function updateLinkGroups(data) {
			let geneLinkGroups = getGeneLinkGroups(data.links);
			let groupDomain = geneLinkGroups.map((_, i) => i);
			scales.colour
				.domain(groupDomain)
				.range(d3.quantize(d3.interpolateRainbow, geneLinkGroups.length + 1));
			let {domain, range} = getLinkGroupDomainAndRange(geneLinkGroups);
			scales.group
				.domain(domain)
				.range(range);
		}

		function resizeScaleBar() {
			let result = prompt("Enter new length (bp):", config.scaleBar.basePair);
			if (result) {
				config.scaleBar.basePair = result;
				update();
			}
		}

		function getScaleBarFn() {
			return scaleBar(scales.x)
				.stroke(config.scaleBar.stroke)
				.height(config.scaleBar.height)
				.colour(config.scaleBar.colour)
				.basePair(config.scaleBar.basePair)
				.fontSize(config.scaleBar.fontSize)
				.onClickText(resizeScaleBar)
				.transition(t)
		}

		function getColourBarFn() {
			return colourBar(scales.score)
				.width(config.colourBar.width)
				.height(config.colourBar.height)
				.fontSize(config.colourBar.fontSize)
				.transition(t)
		}

		function getClusterFn() {
			return cluster()
				.config({
					...config.cluster,
					locus: config.locus,
					gene: config.gene,
				})
				.scales(scales)
				.update(update)
				.transition(t)
		}

		function getLegendFn() {
			return legend(scales.colour)
				.fontSize(config.legend.fontSize)
				.entryHeight(config.legend.entryHeight)
				.onClickRect(config.legend.onClickRect)
				.onClickText(config.legend.onClickText)
		}

		function buildClusterMap(selection) {
			let clusterFn = getClusterFn();
			let legendFn = getLegendFn();
			let scaleBarFn = getScaleBarFn();
			let colourBarFn = getColourBarFn();
			return selection
				.call(clusterFn)
				.call(legendFn)
				.call(colourBarFn)
				.call(scaleBarFn)
				.call(arrangeMap)
		}

		function update() {
			container
				.transition(t)
				.call(my);
		}

		function getGeneLinkGroups(links) {
			// Finds groups of homologous genes via data.links
			let groups = [];
			links.forEach(link => {
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
			});
			return groups
		}

		function getLinkGroupDomainAndRange(groups) {
			// Generates domain and range for groupScale (gene -> group)
			let scale = {domain: [], range: []};
			groups.forEach((group, i) => {
				scale.domain.push(...group);
				scale.range.push(...group.map(() => i));
			});
			return scale
		}

		function getLargestClusterSize(clusters) {
			let max = 0;
			for (let cluster of clusters) {
				let sum = cluster.loci.reduce((a, b) => a + (b._end - b._start), 0);
				if (sum > max) max = sum;
			}
			return max
		}

		function arrangeMap(selection) {
			// Arrange map elements
			selection.select("g.scaleBar")
				.attr("transform", `translate(0, ${scales.y.range()[1]})`);
			selection.select("g.colourBar")
				.attr("transform", `translate(${scales.x(config.scaleBar.basePair) + 20}, ${scales.y.range()[1]})`);
			selection.select("g.legend")
				.attr("transform", d => {
					let max = getLargestClusterSize(d.clusters);
					return `translate(${scales.x(max) + 20}, ${0})`
				});
		}

		function anchorGenes(anchor) {
			// Anchor map on given uid
			// Finds anchor genes in clusters given some initial anchor gene
			// Find gene links, then filter out any not containing the anchor
			let anchors = scales.group
				.domain()
				.filter(uid => {
					let g1 = scales.group(uid);
					let g2 = scales.group(anchor.uid);
					return g1 != null && g1 === g2
				});
			if (anchors.length === 0) return

			// Get original domain and range of cluster offset scale
			let domain = scales.offset.domain();
			let range = scales.offset.range();

			// Get the midpoint of the clicked anchor gene
			let getMidPoint = data => {
				let length = data.end - data.start;
				return (
					scales.x(data.start + length / 2)
					+ scales.locus(data._locus)
				)
			};
			let midPoint = getMidPoint(anchor);

			// For each anchor:
			// 1. Get its data
			// 2. Get its midpoint
			// 3. Get the corresponding cluster index in the offset scale domain
			// 4. Determine distance between two midpoints and update range,
			//		taking into account locus _start property
			for (const link of anchors) {
				let data = d3.select(`#gene_${link}`).data()[0];
				let index = domain.findIndex(el => el === data._cluster);
				if (link === anchor.uid) {
					range[index] = 0;
					continue
				}
				let linkPoint = getMidPoint(data);
				let offset = Math.abs(midPoint - linkPoint);
				if (linkPoint > midPoint) offset = -offset;
				if (offset === 0) continue
				range[index] = offset;
			}

			scales.offset.range(range);
			update();
		}

		my.config = function(_) {
			return arguments.length ? (config = updateConfig(_, config), my) : config
		};

		return my
	}

	exports.ClusterMap = clusterMap;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
