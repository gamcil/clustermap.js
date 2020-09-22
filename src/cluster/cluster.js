import locus from "./locus.js"
import links from "./links.js"
import { updateConfig, renameText } from "../utils.js"


export default function cluster() {
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
	}

	let anchors = []

	const scales = {
		x: d3.scaleLinear()
			.domain([0, 1000])
			.range([0, config.scaleFactor]),
		y: null,
		group: null,
		colour: null,
		offset: d3.scaleOrdinal(),
		locus: d3.scaleOrdinal(),
	}

	let t = d3.transition().duration(config.transitionDuration)

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
						let info = enter.append("g")
							.attr("id", c => `cinfo_${c.uid}`)
							.attr("class", "clusterInfo")
							.attr("transform", `translate(-10, 0)`)
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
					trackBar: config.locus.trackBar,
					spacing: config.locus.spacing,
					gene: config.gene,
				})
				.scales(scales)
				.transition(t)
				.update(update)
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
			range.push(value - start)
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

	function updateCluster(selection) {
		selection.attr(
			"transform",
			d => `translate(${scales.offset(d.uid)}, ${scales.y(d.uid)})`
		)
		selection.select(".clusterInfo").attr("transform", `translate(-10, 0)`)
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
