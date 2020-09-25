import { updateConfig } from "../utils.js"

export default function geneLinks() {

	const config = {
		link: {
			threshold: 0,
		},
		plot: {
			transitionDuration: 500,
			scaleFactor: 15,
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
		x: null,
		y: null,
		locus: null,
		offset: null,
		score: null,
	}
	let t = d3.transition()
	let container
	let update = () => container.call(my)

	function my(selection) {
		selection.each(function(data) {
			container = d3.select(this)

			// Cross-cluster gene links
			// Establish <g> before clusters, but must populate after clusters drawn
			container.selectAll("path.geneLink")
				.data(data.links, getLinkKey)
				.join(
					enter => enter.append("path")
						.attr("class", "geneLink")
						.attr("d", getLinkPath)
						.style("fill", d => scales.score(d.identity))
						.style("stroke", "black")
						.style("stroke-width", "0.5px")
						.on("click", function() {
							let link = d3.select(this)
							let fill = link.style("fill-opacity")
							while (true) {
								let result = prompt("Enter new opacity (0-1):", fill)
								if (!result) break
								if (result >= 0 && result <= 1) {
									link.style("fill-opacity", +result)
									break
								} else {
									alert("Invalid value, try again")
								}
							}
						}),
					update => update.call(
						update => update
							.transition(t)
							.attr("d", getLinkPath)
					)
				)
		})
	}

	function getGeneData(uid) {
		// Gets data attached to a given gene UID
		return d3.select(`#gene_${uid}`).data()[0]
	}

	function getLinkKey(link) {
		let [a, b] = [link.query.uid, link.target.uid].sort()
		return `${a}-${b}`
	}

	function clustersAreAdjacent(one, two) {
		let domain = scales.y.domain()
		let a = domain.indexOf(one)
		let b = domain.indexOf(two)
		return Math.abs(a - b) === 1
	}

	function getLinkPath(d) {
		// Calculates points linking two genes
		// Select genes by unique ID, get underlying data 
		let a = getGeneData(d.query.uid)
		let b = getGeneData(d.target.uid)

		if (!clustersAreAdjacent(a._cluster, b._cluster)) return null

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
			scales.y(g._cluster) + mid
		]
		let [ax1, ax2, ay] = getAnchors(a, aOffset)
		let [bx1, bx2, by] = getAnchors(b, bOffset)

		// Generate the path d attribute
		return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`
	}

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
