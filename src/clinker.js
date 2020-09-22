/* clinker.js
 * Cameron L.M. Gilchrist
	const colourScale = * 2020
 */

const constants = {
	bodyHeight: 12,
	clusterSpacing: 50,
	locusSpacing: 40,
	scaleFactor: 30,
	scaleBarLength: 1000,
	tipHeight: 5,
	tipLength: 12,
	showGeneLabels: true,
	labelRotation: 12,
	labelStart: 0.5,
	labelAnchor: "start",
}

if (typeof data === 'undefined') {
	const data = d3.json("data.json").then(data => plot(data));
} else {
	plot(data);
}

function serialise(svg) {
	/* Saves the figure to SVG in its current state.
	 * Clones the provided SVG and sets the width/height of the clone to the
	 * bounding box of the original SVG. Thus, downloaded figures will be sized
	 * correctly.
	 * This function returns a new Blob, which can then be downloaded.
	*/
	node = svg.node();
	const xmlns = "http://www.w3.org/2000/xmlns/";
	const xlinkns = "http://www.w3.org/1999/xlink";
	const xhtml = "http://www.w3.org/1999/xhtml";
	const svgns = "http://www.w3.org/2000/node";
	const bbox = svg.select("g").node().getBBox()

	node = node.cloneNode(true);
	node.setAttribute("width", bbox.width);
	node.setAttribute("height", bbox.height);
	node.setAttributeNS(xmlns, "xmlns", svgns);
	node.setAttributeNS(xmlns, "xmlns:xlink", xlinkns);
	node.setAttributeNS(xmlns, "xmlns:xhtml", xhtml);

	// Adjust x/y of <g> to account for axis/title position.
	// Replaces the transform attribute, so drag/zoom is ignored.
	d3.select(node)
		.select("g")
		.attr("transform", `translate(${Math.abs(bbox.x)}, ${Math.abs(bbox.y)})`)

	const serializer = new window.XMLSerializer;
	const string = serializer.serializeToString(node);
	return new Blob([string], {type: "image/node+xml"});
}

function download(blob, filename) {
	/* Downloads a given blob to filename.
	 * This function appends a new anchor to the document, which points to the
	 * supplied blob. The anchor.click() method is called to trigger the download,
	 * then the anchor is removed.
	*/
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

function renameText() {
	// Changes value of a text node to a prompted value
	let text = d3.select(this)
	let result = prompt("Enter new value:", text.text())
	if (result) text.text(result)
}

function getGeneLinks(clusters) {
	// Get links between genes in every cluster pair
	let links = []
	for (let i = 0; i < clusters.length; i++) {
		if (i === clusters.length - 1) break
		let [clusterA, clusterB] = clusters.slice(i, i + 2)
		for (let locusA of clusterA.loci) {
			for (let locusB of clusterB.loci) {
				for (let geneA of locusA.genes) {
					for (let geneB of locusB.genes) {
						if (geneA === geneB) continue
						if (geneA.group === geneB.group)
							links.push([geneA.uid, geneB.uid])
					}
				}
			}
		}
	}
	return links
}

function getGeneGroups(clusters) {
	// Get all unique gene groups
	let groups = new Set()
	for (const cluster of clusters) {
		for (const locus of cluster.loci) {
			for (const gene of locus.genes) {
				if (!gene.group) continue
				groups.add(gene.group)
			}
		}
	}
	return [...groups]
}

function getLinkedElements(element, array) {
	// Gets all elements linked to given element in an array of arrays
	let start = array.findIndex(el => el.includes(element))
	let [lower, upper] = array[start]
	let lowerIndex = start
	let upperIndex = start
	let lowerFlag = (start === 0) ? true : false
	let upperFlag = (start === array.length - 1) ? true : false
	let i = 0
	let final = [upper]
	while (true) {
		if (lowerFlag && upperFlag) break
		if (!lowerFlag) {
			lowerIndex = start - i
			if (lowerIndex === 0) lowerFlag = true
			if (array[lowerIndex].includes(lower)) {
				lower = array[lowerIndex][0]
				final.unshift(lower)
			}
		}
		if (!upperFlag) {
			upperIndex = start + i + 1
			if (upperIndex === array.length - 1) upperFlag = true
			if (array[upperIndex].includes(upper)) {
				upper = array[upperIndex][1]
				final.push(upper)
			}
		}
		++i;
	}
	return final;
}

function plot(data) {
	// Plot skeleton
	const plotDiv = d3.select("#plot");
	const svg = plotDiv.append("svg")
		.classed("wrapper-svg", true)
		.attr("id", "root-svg")
		.attr("cursor", "grab")
		.attr("xmlns", "http://www.w3.org/2000/svg")
		.attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml")
	const g = svg.append("g").attr("transform", "translate(2,0)")
	const geneLinkGroup = g.append("g").attr("id", "gene-links").classed("genelinks", true)
	const clusterGroup = g.append("g").classed("clusters", true)
	const legendGroup = g.append("g").classed("legend", true)

	// Set up pan/zoom behaviour, and set default pan/zoom position
	const zoom = d3.zoom()
		.scaleExtent([0, 8])
		.on("zoom", () => g.attr("transform", d3.event.transform))
		.on("start", () => svg.attr("cursor", "grabbing"))
		.on("end", () => svg.attr("cursor", "grab"))
	const transform = d3.zoomIdentity
		.translate(20, 50)
		.scale(1.2)
	svg.call(zoom).call(zoom.transform, transform)

	// Set up the save SVG button
	d3.select("#btn-save-svg")
		.on("click", () => {
			const blob = serialise(svg)
			download(blob, "clinker.svg")
		})

	// Reset to the original data. Have to make a deep copy here, since update
	// will mutate data
  const originalData = JSON.parse(JSON.stringify(data))
	d3.select("#btn-reset-filters")
		.on("click", () => {
			const copy = JSON.parse(JSON.stringify(originalData))
			update(copy)
		})

	// Set up colour picker
	const picker = plotDiv.append("input")
		.attr("id", "picker")
		.attr("type", "color")
		.style("opacity", 0)

	// Set up axes
	// x: scaling of gene polygons (def. every 1000bp = 50px)
	// y: vertical position of clusters
	// aOffset: anchor offset for each cluster <svg>
	const x = d3.scaleLinear()
		.domain([0, 1000])
		.range([0, constants.scaleFactor])
	const y = d3.scaleBand()
		.padding(0.05)
	const o = d3.scaleOrdinal()
		.domain(data.order)
		.range(data.order.map(() => 0))
	const idScale = d3.scaleSequential(d3.interpolateGreys)
		.domain([0, 1])

	// Generate colour bar and linear gradient definition
	const def = svg.append("defs");
	def.append(() => colourBarGradient(idScale))

	// Draw the colourbar
	const bar = g.append(() => colourBar());

	// Initialise object to store cluster loci scales
	// These determine offset for each locus when >1 loci in a cluster
	const clusterScales = {}
	const locusScales = {}

	data.order.forEach(uid => {
		data.clusters[uid].loci.forEach(locus => {
			locusScales[locus.uid] = {start: locus.start, end: locus.end}
		})
	})

	const getGeneData = uid => {
		// Gets data attached to a given gene UID
		return d3.select(`#gene_${uid}`).data()[0]
	}

	const filterGeneLinks = d => {
		// Filters gene links to only those between immediately adjacent clusters
		let a = d3.select(`#gene_${d.query.uid}`)
		let b = d3.select(`#gene_${d.target.uid}`)
		if (a.style("display") !== "inline" || b.style("display") !== "inline") return false
		a = data.order.findIndex(el => el === a.data()[0].locus.cluster.uid)
		b = data.order.findIndex(el => el === b.data()[0].locus.cluster.uid)
		return Math.abs(a - b) === 1
	}

	const linkGenes = d => {
		// Calculates points linking two genes
		// Select genes by unique ID, get underlying data 
		let a = getGeneData(d.query.uid)
		let b = getGeneData(d.target.uid)

		// Calculate vertical midpoint based on shape constants
		let mid = constants.tipHeight + constants.bodyHeight / 2

		// Locus offset in each cluster, mostly 0
		let aOffset = clusterScales[a.locus.cluster.uid](a.locus.index)
			+ o(a.locus.cluster.name)
			- x(locusScales[a.locus.uid].start)
		let bOffset = clusterScales[b.locus.cluster.uid](b.locus.index)
			+ o(b.locus.cluster.name)
			- x(locusScales[b.locus.uid].start)

		// Link anchors for top gene
		let ax1 = x(a.start) + aOffset
		let ax2 = x(a.end) + aOffset
		let ay = y(a.locus.cluster.uid) + mid

		// Link anchors for bottom gene
		let bx1 = x(b.start) + bOffset
		let bx2 = x(b.end) + bOffset
		let by = y(b.locus.cluster.uid) + mid

		// Generate the path d attribute
		return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by}`
	}

	// Set up scale bar
	// Ensure bar boundaries are inclusive of the length, not additive
	const scaleBar = g.append("g")
		.classed("scaleBar", true)
	scaleBar.append("rect")
		.classed("flatBar", true)
		.attr("y", "4px")
		.attr("height", "1px")
		.style("fill", "black")
	scaleBar.append("rect")
		.classed("leftBar", true)
		.attr("x", 0)
		.attr("width", "1px")
		.attr("height", "10px")
	scaleBar.append("rect")
		.classed("rightBar", true)
		.attr("width", "1px")
		.attr("height", "10px")
	scaleBar.append("text")
		.classed("barText", true)
		.attr("y", 25)
		.attr("text-anchor", "middle")
		.attr("font-size", "12px")

	// Shared transition
	const t = d3.transition().duration(400)

	// Set up gene fill colour scale
	const groupScale = d3.scaleOrdinal()  // Genes to link groups
	const colorScale = d3.scaleOrdinal()  // Link groups to colours
	const legendScale = d3.scaleBand().paddingInner(0.5)
	const legendTranslate = (d) => `translate(0, ${legendScale(d)})`

	const getGeneLinkGroups = links => {
		// Finds groups of homologous genes via data.links
		let groups = []
		links.forEach(link => {
			let found = false
			for (i = 0; i < groups.length; i++) {
				let group = groups[i]
				if (group.includes(link.query.uid) | group.includes(link.target.uid))
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

	const getLinkGroupDomainAndRange = groups => {
		// Generates domain and range for groupScale (gene -> group)
		let scale = {domain: [], range: []}
		groups.forEach((group, i) => {
			scale.domain = scale.domain.concat(group)
			scale.range = scale.range.concat(group.map(() => i))
		})
		return scale
	}

	const genePoints = gene => {
		// Calculates points attribute to draw a gene polygon
		let inverse = false;
		let points = [];

		// Get start and end of Gene as percentages of Locus length
		let scaledStart = x(gene.start)
		let scaledEnd = x(gene.end)
		let geneLength = scaledEnd - scaledStart;

		// Calculate scaled constants based on scaled coordinates
		let bottom = constants.tipHeight * 2 + constants.bodyHeight;
		let midpoint = bottom / 2;
		let third = constants.tipHeight + constants.bodyHeight;

		// Determine polygon points for the Gene
		if ((gene.strand === 1) || ((gene.strand === -1) & (inverse === true))) {
			// Draw gene 5' to 3'
			let shaft = scaledEnd - constants.tipLength;
			points = [
				scaledStart, constants.tipHeight,
				shaft, constants.tipHeight,
				shaft, 0,
				scaledEnd, midpoint,
				shaft, bottom,
				shaft, third,
				scaledStart, third,
			];
			// Squeeze arrow when total length is less than tip length
			if (geneLength < constants.tipLength) {
				[2, 4, 8, 10].forEach(item => (points[item] = scaledStart));
			}
		} else if ((gene.strand === -1) | ((gene.strand === 1) & (inverse === true))) {
			// Draw gene 3' to 5'
			let shaft = scaledStart + constants.tipLength;
			points = [
				scaledEnd, constants.tipHeight,
				shaft, constants.tipHeight,
				shaft, 0,
				scaledStart, midpoint,
				shaft, bottom,
				shaft, third,
				scaledEnd, third,
			];
			if (geneLength < constants.tipLength) {
				[2, 4, 8, 10].forEach(item => (points[item] = scaledEnd));
			}
		}
		return points.join(" ");
	}

	const anchorGenes = (anchor, clusters) => {
		// Finds anchor genes in clusters given some initial anchor gene
		// Find gene links, then filter out any not containing the anchor
		let anchorData = getGeneData(anchor)
		let clusterScale = clusterScales[anchorData.locus.cluster.uid]

		let range = clusters.map(() => 0)
		let anchors = groupScale.domain()
			.filter(uid => groupScale(uid) === groupScale(anchor))

		// No links, do nothing
		if (anchors.length === 0) {
			return
		}

		// x position + locus offset
		let anchorLength = anchorData.end - anchorData.start
		let midPoint = (
			x(anchorData.start + anchorLength / 2)
			+ clusterScale(anchorData.locus.index)
			- x(locusScales[anchorData.locus.uid].start)
		)

		for (const [i, link] of anchors.entries()) {
			if (link === anchor) {
				range[i] = 0
				continue
			}
			let linkData = getGeneData(link)
			let linkScale = clusterScales[linkData.locus.cluster.uid]
			let linkLength = linkData.end - linkData.start
			let linkMidPoint = (
				x(linkData.start + linkLength / 2)
				+ linkScale(linkData.locus.index)
				- x(locusScales[linkData.locus.uid].start)
			)
			let offset = Math.abs(midPoint - linkMidPoint)
			if (linkMidPoint > midPoint) offset = -offset
			range[i] = offset
		}
		o.range(range)
		update(data)
	}

	const arrayMove = (arr, from, to) => {
		// Moves element in array from one index to another
		let el = arr[from]
		arr.splice(from, 1)
		arr.splice(to, 0, el)
	}

	function update(data) {
		// Adjust y domain for clusters in the figure
		x.range([0, constants.scaleFactor])
		y.domain(data.order)
			.range([
				0,
				data.order.length * (constants.tipHeight * 2 + constants.bodyHeight)
				+ (data.order.length - 1) * constants.clusterSpacing
			])
		o.domain(data.order)

		// Adjust legend scales
		let geneLinkGroups = getGeneLinkGroups(data.links)
		let geneLinkDomain = getLinkGroupDomainAndRange(geneLinkGroups)
		let groupDomain = geneLinkGroups.map((_, i) => i)
		groupScale.domain(geneLinkDomain.domain)
			.range(geneLinkDomain.range)
		colorScale.domain(groupDomain)
			.range(d3.quantize(d3.interpolateRainbow, geneLinkGroups.length + 1))
		legendScale.domain(groupDomain)
			.range([0, 15 * groupDomain.length])
		legendGroup.selectAll("g")
			.data(groupDomain)
			.join(
				enter => {
					enter = enter.append("g")
						.attr("transform", legendTranslate)
					enter.append("rect")
						.attr("fill", d => colorScale(d))
						.attr("class", d => `group-${d}`)
						.attr("width", 12)
						.attr("height", legendScale.bandwidth())
						.attr("cursor", "pointer")
						.on("click", e => {
							// Bind fill change behaviour then simulate click event
							picker.on("change", () => {
								d3.selectAll(`.group-${e}`).attr("fill", picker.node().value)
							})
							picker.node().click()
						})
					enter.append("text")
						.attr("x", 16)
						.attr("y", legendScale.bandwidth())
						.attr("text-anchor", "start")
						.attr("cursor", "pointer")
						.style("font-size", "12px")
						.style("font-family", "sans")
						.text(d => `Group ${d}`)
						.on("click", renameText)
					return enter
				},
				update => update.call(
					update => update.transition(t)
						.attr("transform", legendTranslate)
				)
			)

		// Populate cluster scales
		let clusterRange = (c) => {
			let range = [1]
			for (let i=0; i < c.loci.length - 1; i++) {
				let value = (
					range[range.length - 1]
					+ x(c.loci[i].show.end)
					+ constants.locusSpacing
				)
				range.push(value)
			}
			return range
		}
		let clusterScale = (c) => {
			return d3.scaleOrdinal()
				.domain(c.loci.map((_, i) => i))
				.range(clusterRange(c))
		}
		data.order.forEach(uid => {
			clusterScales[uid] = clusterScale(data.clusters[uid])
		})

		// Add <g> for each cluster
		let clusterData = data.order.map((uid, i) => {
			return { ...data.clusters[uid], "index": i }
		})
		let clusterTranslate = c => `translate(${o(c.uid)}, ${y(c.uid)})`
		let clusterIndex = c => data.order.findIndex(el => el === c.uid)
		let upArrowFill = c => (clusterIndex(c) === 0) ? "grey" : "black"
		let downArrowFill = c => (clusterIndex(c) === data.order.length - 1) ? "grey" : "black"
		let clusters = clusterGroup.selectAll("g.cluster")	
			.data(clusterData, c => `cluster_${c.uid}`)
			.join(
				enter => {
					enter = enter.append("g")
						.attr("id", c => `cluster_${c.uid}`)
						.classed("cluster", true)
						.attr("transform", clusterTranslate)
					let info = enter.append("g")
						.attr("id", c => `cinfo_${c.uid}`)
						.classed("clusterInfo", true)
					info.append("text")
						.text(c => c.name)
						.attr("x", (_, i) => -o(i) - 10)
						.attr("y", 8)
						.attr("text-anchor", "end")
						.attr("cursor", "pointer")
						.style("font-size", "12px")
						.style("font-weight", "bold")
						.style("font-family", "sans")
						.on("click", renameText)
					info.append("text")
						.text(c => c.loci.map(l => {
							let sc = locusScales[l.uid]
							return `${l.name}:${sc.start}-${sc.end}`
						}).join(", "))
						.classed("lociText", true)
						.attr("x", (_, i) => -o(i) - 10)
						.attr("y", 22)
						.attr("text-anchor", "end")
						.style("font-size", "10px")
						.style("font-family", "sans")

					// Add arrows to change cluster ordering
					let order = enter.append("g")
						.attr("transform", c => {
							let bbox = d3.select(`#cinfo_${c.uid}`).node().getBBox()
							let boxX = o(c.uid) - bbox.width - 30
							let boxY = constants.bodyHeight
							return `translate(${boxX}, ${boxY})`
						})
					order.append("text")
						.text("▲")
						.classed("upArrow", true)
						.attr("cursor", "pointer")
						.attr("fill", upArrowFill)
						.on("click", c => {
							let idx = data.order.findIndex(el => el === c.uid)
							if (idx === 0) return
							arrayMove(data.order, idx, idx - 1)
							update(data)
						})
					order.append("text")
						.text("▼")
						.classed("downArrow", true)
						.attr("y", 10)
						.attr("cursor", "pointer")
						.attr("fill", downArrowFill)
						.on("click", c => {
							let idx = data.order.findIndex(el => el === c.uid)
							if (idx === data.order.length - 1) return
							arrayMove(data.order, idx, idx + 1)
							update(data)
						})
					order.selectAll("text")
						.style("font-weight", 300)
						.style("font-size", "10px")
					return enter
				},
				update => update.call(
					update => {
						update.transition(t)
							.attr("transform", clusterTranslate)
						update.selectAll("text.upArrow").transition(t).attr("fill", upArrowFill)
						update.selectAll("text.downArrow").transition(t).attr("fill", downArrowFill)
						update.selectAll("text.lociText")
							.text(c => c.loci.map(l => {
								let sc = locusScales[l.uid]
								return `${l.name}:${sc.start.toFixed(0)}-${sc.end.toFixed(0)}`
							}).join(", "))
						// TODO reposition arrows
						return update
					}
				)
			)

		// Add <g> for each locus in each cluster
		let midPoint = constants.bodyHeight / 2 + constants.tipHeight - 0.5
		let locusId = l => `locus_${l.uid}`
		let locusEnd = l => x(locusScales[l.uid].end)
		let locusStart = l => x(locusScales[l.uid].start)
		let locusWidth = l => locusEnd(l) - locusStart(l)
		let locusTranslate = (l, i) => `translate(${clusterScales[l.cluster.uid](i) - x(locusScales[l.uid].start)}, 0)`
		let loci = clusters.selectAll("g.locus")
			.data(
				c => c.loci.map((l, i) => {
					return { ...l, cluster: c, index: i }
				}),
				locusId,
			)
			.join(
				enter => {
					enter = enter.append("g")
						.attr("id", locusId)
						.attr("transform", locusTranslate)
						.classed("locus", true)
					let trackBar = enter.append("g").classed("trackBar", true)
					trackBar.append("rect")
						.classed("horizontal", true)
						.attr("y", midPoint)
						.attr("height", "1px")
						.attr("width", locusWidth)
						.style("fill", "#111")
					trackBar.append("rect")
						.classed("leftVertical", true)
						.attr("x", "-1px")
						.attr("y", midPoint - 7)
						.attr("width", "1px")
						.attr("height", "16px")
						.on("mouseenter", (_, i, n) => {
							d3.select(n[i])
								.attr("width", "4px")
								.style("cursor", "pointer")
						})
						.on("mouseleave", (_, i, n) => {
							d3.select(n[i])
								.attr("width", "1px")
						})
						.call(
							d3.drag()
							.on("start", () => {})
							.on("end", () => { update(data) })
							.on("drag", (d, i, n) => {
								let scale = locusScales[d.uid]
								if (d3.event.x <= 0 || d3.event.x >= x(d.end)) return
								d3.select(n[i]).attr("x", d3.event.x)
								let loc = d3.select(`#locus_${d.uid}`)
								let hor = loc.select("rect.horizontal")

								// Adjust the cluster offset scale
								let idx = data.order.findIndex(el => el === d.cluster.uid)
								let off = o(d.cluster.uid)
								let dif = d3.event.x - x(scale.start)
								let range = o.range()
								range[idx] = off + dif
								o.range(range)

								scale.start = d3.event.x * (1000 / constants.scaleFactor)
								hor.attr("x", d3.event.x).attr("width", locusWidth)
								loc.selectAll("g.gene")
									.attr("display", g => {
										let start = x(g.start)
										let end = x(g.end)
										return (start >= x(scale.start) && end <= x(scale.end)) ? "inline" : "none"
									})
							})
						)
					trackBar.append("rect")
						.classed("rightVertical", true)
						.attr("x", locusEnd)
						.attr("y", midPoint - 7)
						.attr("width", "1px")
						.attr("height", "16px")
						.on("mouseenter", (_, i, n) => {
							d3.select(n[i]).attr("width", "4px").style("cursor", "pointer")
						})
						.on("mouseleave", (_, i, n) => {
							d3.select(n[i]).attr("width", "1px")
						})
						.call(
							d3.drag()
							.on("end", () => { update(data) })
							.on("drag", (d, i, n) => {
								let scale = locusScales[d.uid]
								if (d3.event.x <= 0 || d3.event.x >= x(d.end)) return
								d3.select(n[i]).attr("x", d3.event.x)	
								let loc = d3.select(`#locus_${d.uid}`)
								let hor = loc.select("rect.horizontal")

								let off = o(d.cluster.uid)
								scale.end = d3.event.x * (1000 / constants.scaleFactor)
								hor.attr("width", locusWidth)

								loc.selectAll("g.gene")
									.attr("display", g => {
										return (
											g.start >= scale.start
											&& g.end <= scale.end
										) ? "inline" : "none"
									})
							})
						)
					enter.append("g").classed("genes", true)
					return enter
				},
				update => update.call(
					update => {
						update.selectAll(".horizontal")
							.transition(t)
							.attr("y", midPoint)
							.attr("width", locusWidth)
						update.selectAll(".leftVertical")
							.transition(t)
							.attr("y", midPoint - 7)
						update.selectAll(".rightVertical")
							.transition(t)
							.attr("x", locusEnd)
							.attr("y", midPoint - 7)
						return update.transition(t)
							.attr("transform", locusTranslate)
					}
				)
			)

		// Add <polygon> for each gene in each locus
		let labelTranslate = g => {
			let offset = x(g.end - g.start) * constants.labelStart
			let gx = x(g.start) + offset
			let rotate = (["start", "middle"].includes(constants.labelAnchor)) ? -constants.labelRotation : constants.labelRotation
			return `translate(${gx}, 0)`
				+ `rotate(${rotate})`
		}
		let geneId = g => `gene_${g.uid}`
		let genes = loci.selectAll("g.genes")
			.selectAll("g.gene")
			.data(
				l => l.genes.map((g, i) => {
					return {...g, "locus": l, "index": i}
				}),
				geneId,
			)
			.join(
				enter => {
					enter = enter.append("g").classed("gene", true)
					enter.append("polygon")
						.attr("id", geneId)
						.attr("class", g => `genePolygon group-${g.group}`)
						.attr("fill", g => colorScale(groupScale(g.uid)))
						.attr("points", genePoints)
						.style("stroke", "black")
						.style("stroke-width", "1px")
					enter.append("text")
						.text(g => g.name)
						.attr("class", "geneLabel")
						.attr("display", constants.showGeneLabels ? "inherit" : "none")
						.attr("dy", "-0.3em")
						.attr("font-size", "10px")
						.attr("text-anchor", constants.labelAnchor)
						.attr("transform", labelTranslate)
					return enter
				},
				update => update.call(
					update => {
						update.selectAll("polygon.genePolygon")
							.transition(t)
							.attr("points", genePoints)
						update.selectAll("text.geneLabel")
							.attr("display", constants.showGeneLabels ? "inherit" : "none")
							.transition(t)
							.attr("transform", labelTranslate)
							.attr("text-anchor", constants.labelAnchor)
						return update
					}
				)
			)

		// Gene linkages
		geneLinkGroup
			.selectAll("path")
			.data(data.links.filter(filterGeneLinks), link => {
				let [a, b] = [link.query.uid, link.target.uid].sort()
				return `${a}-${b}`
			})
			.join(
				enter => enter.append("path")
					.classed("geneLink", true)
					.attr("d", linkGenes)
					.style("fill", "LightBlue")
					.style("fill-opacity", link => link.identity)
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
					update => update.transition(t)
						.attr("d", linkGenes)
				)
			)

		// Click a gene to anchor the figure on it
		genes.on("click", g => {
			anchorGenes(g.uid, data.order.map(uid => data.clusters[uid]))
		})

		// Figure layout
		d3.select("#input-scale-factor")
			.on("change", function() {constants.scaleFactor = +this.value; update(data)})
		d3.select("#input-cluster-spacing")
			.on("change", function() {constants.clusterSpacing = +this.value; update(data)})
		d3.select("#input-locus-spacing")
			.on("change", function() {constants.locusSpacing = +this.value; update(data)})

		// Gene polygon shape
		d3.select("#input-body-height")
			.on("change", function() {constants.bodyHeight = +this.value; update(data)})
		d3.select("#input-tip-height")
			.on("change", function() {constants.tipHeight = +this.value; update(data)})
		d3.select("#input-tip-length")
			.on("change", function() {constants.tipLength = +this.value; update(data)})

		// Gene text position/visibility
		d3.select("#toggle-gene-labels")
			.on("click", () => {constants.showGeneLabels = !constants.showGeneLabels; update(data)})
		d3.select("#input-label-rotation")
			.on("change", function() {constants.labelRotation = +this.value; update(data)})
		d3.select("#input-label-start")
			.on("change", function() {constants.labelStart = +this.value; update(data)})
		d3.select("#select-label-anchor")
			.on("change", function() {constants.labelAnchor = this.value; update(data)})

		// Position scale bar after all clusters
		scaleBar.attr("transform", `translate(0, ${y.range()[1]})`)
		scaleBar.select("rect.flatBar").attr("width", x(constants.scaleBarLength))
		scaleBar.select("rect.rightBar").attr("x", x(constants.scaleBarLength))
		scaleBar.select("text.barText")
			.text(() => `${+(constants.scaleBarLength / 1000).toFixed(1)}kb`)
			.attr("x", x(constants.scaleBarLength) / 2)
			.attr("cursor", "pointer")
			.on("click", function() {
				let result = prompt("Enter new scale bar length (bp):", constants.scaleBarLength)
				if (result) {
					constants.scaleBarLength = parseInt(result)
					update(data)
				}
			})
		bar.attr("transform", `translate(${x(constants.scaleBarLength) + 20}, ${y.range()[1]})`)
	
		// Position legend to top right
		let max = 0
		clusters.each(c => {
			let value = c.loci.reduce((a, b) => a + o(c.uid) + x(locusScales[b.uid].end), 0)	
			if (value > max) max = value
		})
		let legendX = max + 50
		legendGroup.transition(t)
			.attr("transform", () => `translate(${legendX}, 0)`)
	}

	update(data)
}
