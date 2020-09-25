import locus from "./locus.js"
import links from "./links.js"
import { updateConfig, renameText } from "../utils.js"


export default function cluster() {
	/* Draw gene clusters. */

	const config = {
		nameFontSize: 12,
		lociFontSize: 10,
		spacing: 60,
		alignLabels: false,
		plot: {
			transitionDuration: 250,
			scaleFactor: 15,
		},
		link: {
			threshold: 0,
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

	let anchors = []
	let dragging = false

	const scales = {
		x: d3.scaleLinear()
			.domain([0, 1000])
			.range([0, config.plot.scaleFactor]),
		y: null,
		group: null,
		colour: null,
		score: null,
		offset: d3.scaleOrdinal(),
		locus: d3.scaleOrdinal(),
	}

	let t = d3.transition().duration(config.plot.transitionDuration)

	let container = null
	let update = () => {
		if (!container) return
		container.call(my)
	}

	function my(selection) {
		selection.each(function(data) {
			updateScales(data)

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
					])

			container = d3.select(this)

			let linkGroup = container.selectAll("g.links")
				.data([data])
				.join("g")
				.attr("class", "links")

			let clusterGroup = container.selectAll("g.clusters")
				.data([data.clusters])
				.join("g")
				.attr("class", "clusters")

			// Draw cluster groups
			let clusters = clusterGroup
				.selectAll("g.cluster")
				.data(data.clusters, d => d.uid)
				.join(
					enter => {
						enter = enter.append("g")
							.attr("id", getId)
							.attr("class", "cluster")
						// let drag = clusterDrag()
						let info = enter.append("g")
							.attr("id", c => `cinfo_${c.uid}`)
							.attr("class", "clusterInfo")
							.attr("transform", `translate(-10, 0)`)
							.call(clusterDrag)
						info.append("text")
							.text(c => c.name)
							.attr("class", "clusterText")
							.attr("y", 8)
							.attr("cursor", "pointer")
							.style("font-weight", "bold")
							.on("click", config.onClickText || renameText)
						info.append("text")
							.attr("class", "locusText")
							.attr("y", 22)
						info.selectAll("text")
							.attr("text-anchor", "end")
							.style("font-family", "sans")
						enter.call(updateCluster)
						return enter
					},
					update => update.call(
						update => update.transition(t)
							.call(updateCluster)
					)
				)

			// Draw loci
			let locusFn = locus()
				.config({
					plot: config.plot,
					cluster: {alignLabels: config.alignLabels},
					trackBar: config.locus.trackBar,
					spacing: config.locus.spacing,
					gene: config.gene,
				})
				.scales(scales)
				.update(update)
				.transition(t)
			clusters.call(locusFn)

			// Draw links
			let linkFn = links()
				.config(config)
				.scales(scales)
				.transition(t)
				.update(update)
			linkGroup.call(linkFn)
		})
	}

	function getGeneData(uid) {
		// Gets data attached to a given gene UID
		return d3.select(`#gene_${uid}`).data()[0]
	}

	function getLinkPath(d) {
		// Calculates points linking two genes
		// Select genes by unique ID, get underlying data 
		let a = getGeneData(d.query.uid)
		let b = getGeneData(d.target.uid)

		if (!clustersAreAdjacent(a._cluster, b._cluster)) {
			return null
		}

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
		let getOffset = g => scales.offset(g._cluster) + scales.locus(g._locus)
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

	function clusterDrag(selection) {
		let free
		let height = scales.y.range()[1]

		const getCluster = uid => d3.select(`#cluster_${uid}`)
		const getMatrix = cluster => {
			return cluster.node()
				.transform
				.baseVal[0]
				.matrix
		}
		const getDomain = () => {
			let clusters = []
			selection.each(c => { clusters.push(c) })
			clusters = clusters.sort((a, b) => a.slot > b.slot)
			return clusters.map(c => c.uid)
		}

		selection.each((d, i) => { d.slot = i; })

		const started = (_, d) => {
			dragging = true
			getCluster(d.uid)
				.raise()
				.classed("active", true)
				.attr("cursor", "grabbing")
			free = d.slot
		}

		const dragged = (event, d) => {
			let me = getCluster(d.uid)
			let matrix = getMatrix(me)
			const yy = Math.min(height, Math.max(0, matrix.f + event.y))
			me.attr("transform", d => `translate(${scales.offset(d.uid)}, ${yy})`)

			// Get closest index based on new y-position
			let domain = scales.y.domain()
			let p = domain.length - Math.min(
				Math.round(height / yy),
				domain.length
			)

			d3.selectAll("path.geneLink")
				.attr("d", getLinkPath)

			if (p === d.slot) return

			// Re-arrange the y-scale domain
			selection.each(function(e) {
				if (e.uid !== d.uid && e.slot === p) {
					e.slot = free
					d.slot = free = p
					let uid = scales.y.domain()[e.slot]
					getCluster(e.uid)
						.transition()
						.attr("transform", c =>
							`translate(${scales.offset(c.uid)}, ${scales.y(uid)})`
						)
				}
			})
		}

		const ended = () => {
			dragging = false
			let dom = getDomain()
			scales.y.domain(dom)
			update()
		}

		return d3.drag()
			.on("start", started)
			.on("drag", dragged)
			.on("end", ended)
			(selection)
	}

	function getId(gene) {
		return `cluster_${gene.uid}`
	}

	function getClusterRange(cluster) {
		// Gets range for a cluster scale based on its loci
		// Note: transform on <g> element only applies to visible elements,
		//			 so no point adding offset here
		let range = []
		let value = 1
		let start, end
		for (const locus of cluster.loci) {
			if (start) value = range[range.length - 1] + end - start + config.locus.spacing
			start = scales.x(locus._start || locus.start)
			end = scales.x(locus._end || locus.end)
			range.push(value - start + locus._offset || 0)
		}
		return range
	}

	function getLocusScaleValues(clusters) {
		// Gets domain and range for the locus offset scale
		let domain = []
		let range = []
		clusters.forEach(cluster => {
			let d = cluster.loci.map(locus => locus.uid)
			let r = getClusterRange(cluster) 
			domain.push(...d)
			range.push(...r)
		})
		return [domain, range]
	}

	function updateScales(data) {
		let [domain, range] = getLocusScaleValues(data.clusters)
		scales.locus.domain(domain).range(range)
	}

	function alignLabels(selection) {
		let range = scales.offset.range()
		let position = Math.min(...range) - 10
		selection.attr("transform", d => {
			return `translate(${position - scales.offset(d.uid)}, 0)`
		})
	}

	function clusterTranslate(d) {
		return `translate(${scales.offset(d.uid)}, ${scales.y(d.uid)})`
	}

	function updateCluster(selection) {
		selection.attr("transform", clusterTranslate)
		if (config.alignLabels) {
			selection.selectAll(".clusterInfo")
				.call(alignLabels)
		} else {
			selection.selectAll(".clusterInfo")
				.attr("transform", `translate(-10, 0)`)
		}
		selection.selectAll("text.clusterText")
			.style("font-size", `${config.nameFontSize}px`)
		selection.selectAll("text.locusText")
			.text(locusText)
			.style("font-size", `${config.lociFontSize}px`)
	}

	function locusText(cluster) {
		return cluster.loci.map(locus => {
			if (!locus._start || !locus._end) return locus.name
			return `${locus.name}:${locus._start.toFixed(0)}-${locus._end.toFixed(0)}`
		}).join(", ")
	}

	my.anchors = _ => arguments.length ? (anchors = _, my) : anchors

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
