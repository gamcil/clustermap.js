import gene from "./gene.js"
import { updateConfig } from "../utils.js"


export default function locus() {
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
		spacing: 50,
		offsetFromZero: false,
		trackBar: {
			colour: "#111",
			stroke: 1,
		},
		plot: {
			transitionDuration: 250,
			scaleFactor: 15,
		},
		cluster: {
			alignLabels: false,
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
	}

	const scales = {
		x: d3.scaleLinear()
			.domain([0, 1000])
			.range([0, config.plot.scaleFactor]),
		offset: null,
		locus: null,
		group: null,
		colour: null,
	}

	let container = null
	let update = () => {
		if (!container) return
		container.call(my)
	}

	let isDragging = false
	let t = d3.transition().duration(config.plot.transitionDuration)

	function my(selection) {
		if (!config) return
		selection.each(function(data) {

			// Establish locus scale if one isn't passed down
			if (!scales.locus)
				scales.locus = d3.scaleOrdinal()
					.domain(data.loci.map(l => l.uid))
					.range([1, data.loci.slice(0, data.loci.length).map(l => l.start)])

			container = d3.select(this)

			let locusEnter = (enter) => {
				enter = enter.append("g")
					.attr("id", getId)
					.attr("class", "locus")
					.each(locus => {
						// Assign visible start/end, cluster UID and offset added to scale
						// when e.g. locus is repositioned by dragging
						locus._start = locus.start
						locus._end = locus.end
						locus._cluster = data.uid
						locus._offset = 0
					})
				enter.append("line")
					.attr("class", "trackBar")
					.style("fill", "#111")

				let hover = enter.append("g")
					.attr("class", "hover")
					.attr("opacity", 0)
				enter.append("g")
					.attr("class", "genes")
				hover.append("rect")
					.attr("class", "hover")
					.attr("fill", "rgba(0, 0, 0, 0.4)")
					.call(dragLocusPosition)
				hover.append("rect")
					.attr("class", "leftHandle")
					.attr("x", -8)
				hover.append("rect")
					.attr("class", "rightHandle")
				hover.selectAll("rect.leftHandle, rect.rightHandle")
					.attr("width", 8)
					.attr("cursor", "pointer")
					.call(locusDrag)
				enter
					.on("mouseenter", () => { if (!isDragging) hover.transition().attr("opacity", 1) })
					.on("mouseleave", () => { if (!isDragging) hover.transition().attr("opacity", 0) })

				return enter.call(updateLoci)
			}

			let locusUpdate = (update) => {
				return update.call(update => update.transition(t).call(updateLoci))
			}

			// Draw each locus group
			let loci = container.selectAll("g.locus")
				.data(data.loci, d => d.uid)
				.join(locusEnter, locusUpdate)

			let geneFn = gene()
				.config({
					plot: config.plot,
					shape: config.gene.shape,
					label: config.gene.label,
				})
				.scales(scales)
				.update(update)
				.transition(t)

			loci.selectAll("g.genes")
				.call(geneFn)
		})
	}

	function locusDrag(selection) {
		function started() {
			isDragging = true
		}
		function dragged(event, d) {
			let handle = d3.select(this)
			let func = (handle.attr("class") === "leftHandle") ? _left : _right
			func(event, d, handle)
		}
		function _left(event, d, handle) {
			// Find closest gene start, from start to _end
			let geneStarts = d.genes
				.filter(gene => gene.end <= d._end)
				.map(gene => gene.start)
			let starts = [d.start, ...geneStarts].map(value => scales.x(value))
			let position = getClosest(starts, event.x)
			let value = starts[position]

			// Adjust the dragged rect
			handle.attr("x", value - 8)

			// Adjust the cluster offset scale, update _start of this locus
			let domain = scales.offset.domain()
			let index = domain.findIndex(el => el === d._cluster)
			let range = scales.offset.range()

			// Update cluster offset scale based on new locus borders
			// If offsetFromZero is true, offset is always relative to the previous offset.
			// Otherwise, it is additive, resizing to the current mouse position
			// Adds/subtracts distance from previous locus start to current mouse position
			if (config.offsetFromZero) {
				range[index] -= value - scales.x(d._start)
			} else {
				range[index] += value - scales.x(d._start)
			}
			scales.offset.range(range)
			d._start = getBasePair(value)

			// Resize the hover <rect>, hide any genes not within bounds
			let locus = d3.select(`#locus_${d.uid}`)
			locus.select("rect.hover")
				.attr("x", value)
				.attr("width", getRealLength)
			locus.selectAll("g.gene")
				.attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none")
			locus.call(updateTrackBar)

			// Hide any gene links connected to hidden genes
			d3.selectAll("path.geneLink")
				.attr("display", getLinkDisplay)

			// If config.alignLabels is true, transform cluster labels to
			// current lowest offset range value. Have to take into account
			// current locus scale and _start property values
			if (config.cluster.alignLabels) {
				let min = Math.min(...range) - 10
				d3.selectAll("g.clusterInfo")
					.attr("transform", c => {
						let first = c.loci[0]
						let val = (
							min
							- scales.offset(c.uid)
							+ scales.locus(first.uid)
							+ scales.x(first._start)
						)
						return `translate(${val}, 0)`
					})
			} else {
				d3.select(`#cinfo_${d._cluster}`)
					.attr("transform", `translate(${scales.locus(d.uid) + scales.x(d._start) - 10}, 0)`)
			}
		}
		function _right(event, d, handle) {
			// Find closest visible gene end, from _start to end
			let ends = d.genes
				.filter(gene => gene.start >= d._start)
				.map(gene => gene.end)
			let range = ends.map(value => scales.x(value))
			let position = getClosest(range, event.x)
			d._end = getBasePair(range[position])

			// Transform handle rect
			handle.attr("x", scales.x(d._end))

			// Update rect width, hide genes out of bounds
			let locus = d3.select(`#locus_${d.uid}`)
			locus.select("rect.hover")
				.attr("width", getRealLength)
			locus.selectAll("g.gene")
				.attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none")
			locus.call(updateTrackBar)

			// Hide any gene links attached to hidden genes
			d3.selectAll("path.geneLink")
				.attr("display", getLinkDisplay)

			// Adjust position of legend when final locus _end property changes
			d3.select("g.legend")
				.attr("transform", getLegendTransform)
		}

		function ended(_, d) {
			isDragging = false
			d3.select(`#locus_${d.uid} .hover`)
				.transition()
				.attr("opacity", 0)
			update()
		}
		return d3.drag()
			.on("start", started)
			.on("drag", dragged)
			.on("end", ended)
			(selection)
	}

	function getLinkPath(d) {
		// Calculates points linking two genes
		// Select genes by unique ID, get underlying data 
		let a = getGeneData(d.query.uid)
		let b = getGeneData(d.target.uid)

		if (!clustersAreAdjacent(a._cluster, b._cluster)) {
			return null
		}

		const getLocus = uid => d3.select(`#locus_${uid}`)
		const getCluster = uid => d3.select(`#cluster_${uid}`)
		const getMatrix = cluster => {
			return cluster.node()
				.transform
				.baseVal[0]
				.matrix
		}

		// Calculate vertical midpoint based on shape config
		let mid = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2

		// Locus offset in each cluster, mostly 0
		let getOffset = g => (
			scales.offset(g._cluster)
			+ getMatrix(getLocus(g._locus)).e
		)
		let aOffset = getOffset(a)
		let bOffset = getOffset(b)

		// Get anchoring points for each gene polygon
		let getAnchors = (g, offset) => [
			scales.x(g.start) + offset,
			scales.x(g.end) + offset,
			getMatrix(getCluster(g._cluster)).f + mid
		]
		let [ax1, ax2, ay] = getAnchors(a, aOffset)
		let [bx1, bx2, by] = getAnchors(b, bOffset)

		// Generate the path d attribute
		return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`
	}

	function clustersAreAdjacent(one, two) {
		const getCluster = uid => d3.select(`#cluster_${uid}`)
		let a = getCluster(one).datum()
		let b = getCluster(two).datum()
		return Math.abs(a.slot - b.slot) === 1
	}

	function getGeneData(uid) {
		// Gets data attached to a given gene UID
		return d3.select(`#gene_${uid}`).data()[0]
	}

	function dragLocusPosition(selection) {
		let offset
		const getLocus = uid => d3.select(`#locus_${uid}`)
		const getCluster = uid => d3.select(`#cluster_${uid}`)
		const getMatrix = element => {
			return element.node()
				.transform
				.baseVal[0]
				.matrix
		}
		const started = (event) => {
			offset = event.x
		}
		const dragged = (event, d) => {
			// TODO: re-order locus slots
			// TODO: update offset scale based on drag values
			//				i.e. min value of cluster offset/locus drag offset

			let locus = getLocus(d.uid)
			let matrix = getMatrix(locus)
			let value = matrix.e + event.x - offset

			locus.attr("transform", `translate(${value}, 0)`)

			d3.selectAll("path.geneLink")
				.attr("d", getLinkPath)
		}
		const ended = (event, d) => {
			d._offset = getMatrix(getLocus(d.uid)).e
			update()
		}

		return d3.drag()
			.on("start", started)
			.on("drag", dragged)
			.on("end", ended)
			(selection)
	}

	function getClusterEnd(clusters) {
		let max = 0
		for (let cluster of clusters) {
			let last = cluster.loci[cluster.loci.length - 1]
			let end = scales.locus(last.uid) + scales.offset(cluster.uid) + scales.x(last._end)
			if (end > max) max = end
		}
		return max
	}

	function getLegendTransform(d) {
		let max = getClusterEnd(d.clusters)
		return `translate(${max + 20}, ${0})`
	}

	function getId(gene) {
		return `locus_${gene.uid}`
	}

	function getGene(uid) {
		// Gets data attached to a given gene UID
		return d3.select(`#gene_${uid}`)
	}

	function getLinkDisplay(link) {
		let a = d3.select(`#gene_${link.query.uid}`).attr("display")
		let b = d3.select(`#gene_${link.target.uid}`).attr("display")
		return (a === "none" || b === "none") ? "none" : "inline"
	}

	function getBasePair(value) {
		// Converts scale coordinates back to base pair value
		return Math.round(value * 1000 / config.plot.scaleFactor)
	}

	function getClosest(values, value) {
		// Finds closest element to value in an array of values using D3 bisect
		return Math.max(Math.min(d3.bisectLeft(values, value), values.length - 1), 0)
	}

	function getRealLength(d) {
		return scales.x(d._end - d._start)
	}

	function updateTrackBar(selection) {
		let midPoint = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2
		selection.select("line.trackBar")
			.attr("x1", d => scales.x(d._start))
			.attr("x2", d => scales.x(d._end))
			.attr("y1", midPoint)
			.attr("y2", midPoint)
			.style("stroke", config.trackBar.colour)
			.style("stroke-width", config.trackBar.stroke)
	}

	function updateLoci(selection) {
		let botPoint = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight
		let translate = d => `translate(${scales.locus(d.uid)}, 0)`
		selection.call(updateTrackBar)
		selection.attr("transform", translate)
		selection.selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
			.attr("y", -10)
			.attr("height", botPoint + 20)
		selection.select("rect.hover")
			.attr("width", getRealLength)
		selection.select("rect.rightHandle")
			.attr("x", d => scales.x(d._end))
	}

	// Getters/setters
	my.config = function(_) {
		if (!arguments.length) return config
		updateConfig(config, _)
		return my
	}
	my.scales = function(_) {
		if (!arguments.length) return scales
		updateConfig(scales, _)
		return my
	}
	my.transition = function(_) {
		if (!arguments.length) return t
		t = _
		return my
	}
	my.update = function(_) {
		if (!arguments.length) return update
		update = _
		return my
	}

	return my
}
