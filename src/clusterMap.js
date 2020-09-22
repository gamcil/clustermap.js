import cluster from "./cluster/cluster.js"
import legend from "./legend.js"
import colourBar from "./colourBar.js"
import scaleBar from "./scaleBar.js"
import { renameText, updateConfig } from "./utils.js"


export default function clusterMap() {
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
	}

	const scales = {
		x: d3.scaleLinear().domain([1, 1001]),
		y: d3.scaleBand().padding(0.05),
		offset: null,
		score: d3.scaleSequential(d3.interpolateGreys).domain([0, 1]),
		group: d3.scaleOrdinal().unknown(null),
		colour: d3.scaleOrdinal().unknown("#bbb"),
		locus: d3.scaleOrdinal(),
	}

	let t = d3.transition().duration(config.transitionDuration)
	let container = null

	function my(selection) {
		selection.each(function(data) {
			console.log("Start building", config)

			// Update scales and transition
			console.log("Updating scales")
			updateScales(data)

			console.log("Updating colour scales")
			updateLinkGroups(data)

			console.log("Updating transition")
			t = d3.transition().duration(config.transitionDuration)

			container = d3.select(this)
				.attr("width", "100%")
				.attr("height", "100%")

			// Build the figure
			console.log("Building cluster map")
			container.selectAll("svg.clusterMap")
				.data([data])
				.join(
					enter => {
						// Add HTML colour picker input
						enter.append("input")
							.attr("id", "picker")
							.attr("class", "colourPicker")
							.attr("type", "color")
							.style("opacity", 0)

						// Add root SVG element
						let svg = enter.append("svg")
							.attr("class", "clusterMap")
							.attr("id", "root-svg")
							.attr("cursor", "grab")
							.attr("width", "100%")
							.attr("height", "100%")
							.attr("xmlns", "http://www.w3.org/2000/svg")
							.attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml")
						let g = svg.append("g")

						// Attach pan/zoom behaviour
						let zoom = d3.zoom()
							.scaleExtent([0, 8])
							.on("zoom", () => g.attr("transform", d3.event.transform))
							.on("start", () => svg.attr("cursor", "grabbing"))
							.on("end", () => svg.attr("cursor", "grab"))
						let transform = d3.zoomIdentity
							.translate(20, 50)
							.scale(1.2)
						svg.call(zoom)
							.call(zoom.transform, transform)

						// Build the map
						return g.call(buildClusterMap)
					},
					update => update.call(
						update => update.transition(t).call(buildClusterMap)
					)
				)
			console.log("Finished")
		})
	}

	function updateScales(data) {
		if (!scales.offset)
			scales.offset = d3.scaleOrdinal()
				.domain(data.clusters.map(d => d.uid))
				.range(data.clusters.map(() => 0))
		scales.x
			.range([0, config.scaleFactor])
		scales.y
			.domain(data.clusters.map(c => c.uid))
			.range([
				0,
				data.clusters.length
				* (config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight)
				+ (data.clusters.length - 1) * config.cluster.spacing
			])
	}

	function updateLinkGroups(data) {
		let geneLinkGroups = getGeneLinkGroups(data.links)
		let groupDomain = geneLinkGroups.map((_, i) => i)
		scales.colour
			.domain(groupDomain)
			.range(d3.quantize(d3.interpolateRainbow, geneLinkGroups.length + 1))
		let {domain, range} = getLinkGroupDomainAndRange(geneLinkGroups)
		scales.group
			.domain(domain)
			.range(range)
	}

	function resizeScaleBar() {
		let result = prompt("Enter new length (bp):", config.scaleBar.basePair)
		if (result) {
			config.scaleBar.basePair = result
			update()
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
		let clusterFn = getClusterFn()
		let legendFn = getLegendFn()
		let scaleBarFn = getScaleBarFn()
		let colourBarFn = getColourBarFn()
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
			.call(my)
	}

	function getGeneLinkGroups(links) {
		// Finds groups of homologous genes via data.links
		let groups = []
		links.forEach(link => {
			let found = false
			for (let i = 0; i < groups.length; i++) {
				let group = groups[i]
				if (group.includes(link.query.uid) || group.includes(link.target.uid))
					found = true
				if (found) {
					if (!group.includes(link.query.uid)) group.push(link.query.uid);
					if (!group.includes(link.target.uid)) group.push(link.target.uid);
					break;
				}
			}
			if (!found) groups.push([link.query.uid, link.target.uid])
		})
		return groups
	}

	function getLinkGroupDomainAndRange(groups) {
		// Generates domain and range for groupScale (gene -> group)
		let scale = {domain: [], range: []}
		groups.forEach((group, i) => {
			scale.domain.push(...group)
			scale.range.push(...group.map(() => i))
		})
		return scale
	}

	function getLargestClusterSize(clusters) {
		let max = 0
		for (let cluster of clusters) {
			let sum = cluster.loci.reduce((a, b) => a + (b._end - b._start), 0)
			if (sum > max) max = sum
		}
		return max
	}

	function arrangeMap(selection) {
		// Arrange map elements
		selection.select("g.scaleBar")
			.attr("transform", `translate(0, ${scales.y.range()[1]})`)
		selection.select("g.colourBar")
			.attr("transform", `translate(${scales.x(config.scaleBar.basePair) + 20}, ${scales.y.range()[1]})`)
		selection.select("g.legend")
			.attr("transform", d => {
				let max = getLargestClusterSize(d.clusters)
				return `translate(${scales.x(max) + 20}, ${0})`
			})
	}

	function anchorGenes(anchor) {
		// Anchor map on given uid
		// Finds anchor genes in clusters given some initial anchor gene
		// Find gene links, then filter out any not containing the anchor
		let anchors = scales.group
			.domain()
			.filter(uid => {
				let g1 = scales.group(uid)
				let g2 = scales.group(anchor.uid)
				return g1 != null && g1 === g2
			})
		if (anchors.length === 0) return

		// Get original domain and range of cluster offset scale
		let domain = scales.offset.domain()
		let range = scales.offset.range()

		// Get the midpoint of the clicked anchor gene
		let getMidPoint = data => {
			let length = data.end - data.start
			return (
				scales.x(data.start + length / 2)
				+ scales.locus(data._locus)
			)
		}
		let midPoint = getMidPoint(anchor)

		// For each anchor:
		// 1. Get its data
		// 2. Get its midpoint
		// 3. Get the corresponding cluster index in the offset scale domain
		// 4. Determine distance between two midpoints and update range,
		//		taking into account locus _start property
		for (const link of anchors) {
			let data = d3.select(`#gene_${link}`).data()[0]
			let index = domain.findIndex(el => el === data._cluster)
			if (link === anchor.uid) {
				range[index] = 0
				continue
			}
			let linkPoint = getMidPoint(data)
			let offset = Math.abs(midPoint - linkPoint)
			if (linkPoint > midPoint) offset = -offset
			if (offset === 0) continue
			range[index] = offset
		}

		scales.offset.range(range)
		update()
	}

	my.config = function(_) {
		return arguments.length ? (config = updateConfig(_, config), my) : config
	}

	return my
}
