import { updateConfig } from "../utils.js"


export default function gene() {
	/* Draw genes in loci */

	let config = {
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
		},
		plot: {
			transitionDuration: 250,
			scaleFactor: 15,
		},
	}

	let t = d3.transition()
		.duration(config.plot.transitionDuration)

	let scales = {
		x: d3.scaleLinear()
			.domain([0, 1000])
			.range([0, config.plot.scaleFactor]),
		colour: null,
		group: null,
	}

	let container = null
	let update = () => {
		if (!container) return
		container.call(my)
	}

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
							.attr("display", "inline")
							.each(gene => {
								gene._locus = data.uid
								gene._cluster = data._cluster
							})
						enter.append("polygon")
							.on("click", config.shape.onClick)
						enter.append("text")
							.text(g => g.name)
							.attr("class", "geneLabel")
							.attr("dy", "-0.3em")
						return enter.call(updateGenes)
					},
					update => update.call(update => update.transition(t).call(updateGenes))
				)
		})
	}

	function updateGenes(selection) {
		selection.selectAll("polygon")
			.attr("class", g => {
				let group = scales.group(g.uid)
				return (group !== null) ? `genePolygon group-${group}` : "genePolygon"
			})
			.attr("points", getPoints)
			.attr("fill", getFill)
			.style("stroke", config.shape.stroke)
			.style("stroke-width", config.shape.strokeWidth)
		selection.selectAll("text.geneLabel")
			.attr("display", config.label.show ? "inherit" : "none")
			.attr("transform", labelTranslate)
			.attr("font-size", config.label.fontSize)
			.attr("text-anchor", config.label.Anchor)
	}

	function getFill(g) {
		// Gets the current fill of a gene based on group/colour scales
		if (!scales.colour || !scales.group) return "#bbb"
		let groupId = scales.group(g.uid)
		return scales.colour(groupId)
	}

	function labelTranslate(g) {
		// Calculates rotation and translation for a gene label
		let offset = scales.x(g.end - g.start) * config.label.start
		let gx = scales.x(g.start) + offset
		let rotate = (["start", "middle"].includes(config.label.anchor))
			? -config.label.rotation
			: config.label.rotation
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
		let scaledStart = scales.x(gene.start)
		let scaledEnd = scales.x(gene.end)
		let geneLength = scaledEnd - scaledStart

		// Calculate scaled constants based on scaled coordinates
		let bottom = config.shape.tipHeight * 2 + config.shape.bodyHeight
		let midpoint = bottom / 2
		let third = config.shape.tipHeight + config.shape.bodyHeight

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
			]
			// Squeeze arrow when total length is less than tip length
			if (geneLength < config.shape.tipLength) {
				[2, 4, 8, 10].forEach(item => (points[item] = scaledStart))
			}
		} else if ((gene.strand === -1) | ((gene.strand === 1) & (inverse === true))) {
			// Draw gene 3' to 5'
			let shaft = scaledStart + config.shape.tipLength
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
				[2, 4, 8, 10].forEach(item => (points[item] = scaledEnd))
			}
		}
		return points.join(" ")
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
