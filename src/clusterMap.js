import cluster from "./cluster/cluster.js"
import legend from "./legend.js"
import colourBar from "./colourBar.js"
import scaleBar from "./scaleBar.js"
import { renameText, updateConfig } from "./utils.js"


export default function clusterMap() {
  /* A ClusterMap plot. */

	const config = {
		plot: {
			transitionDuration: 250,
			scaleFactor: 15,
		},
		legend: {
			entryHeight: 18,
			fontSize: 14,
			onClickRect: changeGeneColour,
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
		link: {
			threshold: 0,
		},
		cluster: {
			nameFontSize: 12,
			lociFontSize: 10,
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

  let t = d3.transition().duration(config.plot.transitionDuration)
  let container = null
	let update = () => container.call(my)

  function my(selection) {
    selection.each(function(data) {
      console.log("Start building", config)

      // Update scales and transition
      console.log("Updating scales")
      updateScales(data)

      console.log("Updating colour scales")
      updateLinkGroups(data)

      console.log("Updating transition")
      t = d3.transition().duration(config.plot.transitionDuration)

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
              .on("zoom", event => g.attr("transform", event.transform))
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

  function changeGeneColour(_, d) {
    let picker = d3.select("input.colourPicker")
    picker.on("change", () => {
      let value = picker.node().value
      let range = scales.colour.range()
      range[d] = value
      scales.colour.range(range)
      d3.selectAll(`.group-${d}`)
        .attr("fill", value)
    })
    picker.node().click()
  }

  function updateScales(data) {
    if (!scales.offset)
      scales.offset = d3.scaleOrdinal()
        .domain(data.clusters.map(d => d.uid))
        .range(data.clusters.map(() => 0))
		if (scales.y.domain().length === 0)
			scales.y.domain(data.clusters.map(c => c.uid))
    scales.x.range([0, config.plot.scaleFactor])
    scales.y
      .range([
        0,
        data.clusters.length
        * (config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight)
        + (data.clusters.length - 1) * config.cluster.spacing
      ])
  }

  function updateLinkGroups(data) {
    let oldRange = scales.group.range()
    let oldGroups = Array.from(
      d3.group(scales.group.domain(), (_, i) => oldRange[i]).values()
    )
    let newGroups = getGeneLinkGroups(data.links)
    let merged = mergeLinkGroups(oldGroups, newGroups)
    let match = compareLinkGroups(oldGroups, merged)
    if (!match) {
      scales.colour
        .domain(merged.map((_, i) => i))
        .range(d3.quantize(d3.interpolateRainbow, merged.length + 1))
      let {domain, range} = getLinkGroupDomainAndRange(merged)
      scales.group
        .domain(domain)
        .range(range)
    }
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
        plot: config.plot,
        locus: config.locus,
        gene: config.gene,
				link: config.link,
      })
      .scales(scales)
      .update(update)
      .transition(t)
  }

  /* Retrieves all gene groups in the colour scale that are currently hidden.
  */
  function getHiddenGeneGroups() {
    let hidden
    let genes = d3.selectAll("g.gene")
    if (genes.empty()) {
      hidden = []
    } else {
      hidden = scales.colour.domain()
      genes.each((d, i, n) => {
        let display = d3.select(n[i]).attr("display")
        let group = scales.group(d.uid)
        if (display === "inline" && group !== null && hidden.includes(group))
          hidden = hidden.filter(g => g !== group)
      })
    }
    return hidden 
  }

  function getLegendFn() {
    let hidden = getHiddenGeneGroups()
    return legend(scales.colour)
      .hidden(hidden)
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

	/**
	 * Gets all groups of gene links from an array of link objects.
	 * Any link with identity score below the config threshold is ignored.
	 *
	 * @param {Array} links - Link objects
	 */
  function getGeneLinkGroups(links) {
    let groups = []
		for (const link of links) {
			if (link.identity < config.link.threshold) continue
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
		}
    return groups
  }

  /**
	 * TODO: collapse this function into getGeneLinkGroups
	 *
   * Merges two arrays of gene link groups and returns new array.
   *
   * @param {Array} one - An array of link group arrays
   * @param {Array} two - Another array of link group arrays
   * @return {Array} A new array consisting of merged groups
   */
  function mergeLinkGroups(one, two) {
    if (one.length === 0 || one === two) return [...two]
    let setA, intersect
    let merged = [...one]
    merged.forEach(a => {
      setA = new Set(a)
      two.forEach(b => {
        intersect = new Set([...b].filter(x => setA.has(x)))
        if (intersect)
          a.push(...b.filter(e => !a.includes(e)))
      })
    })
    return merged
  }

  /**
   * Tests two arrays of gene link groups for equality.
   *
   * @param {Array} one - An array of link group arrays
   * @param {Array} two - Another array of link group arrays
   * @return {boolean}
    * */
  function compareLinkGroups(one, two) {
    let setA, found, intersect
    one.forEach(a => {
      setA = new Set(a)
      found = false
      two.forEach(b => {
        intersect = new Set([...b].filter(x => setA.has(x)))
        if (intersect.size > 0) found = true
      })
      if (!found) return false
    })
    return (found) ? true : false
  }

  /**
   * Creates flat link group domain and range for creating d3 scales.
   *
   * @param {Array} groups - An array of link group arrays
   * @return {Object} An object with flattened domain and range arrays
    * */
  function getLinkGroupDomainAndRange(groups) {
    let scale = {domain: [], range: []}
    groups.forEach((group, i) => {
      scale.domain.push(...group)
      scale.range.push(...group.map(() => i))
    })
    return scale
  }

  /**
   * Finds the max x position of any cluster in the plot.
   *
   * This takes into account locus scale (i.e. offset in multi-locus clusters
   * and the _start property), the cluster offset scale and the x position of
   * the final locus in each cluster.
   *
   * @param {Array} clusters - Gene cluster data objects
   * @return {number} The maximum x value
    * */
  function getClusterEnd(clusters) {
    let max = 0
    for (let cluster of clusters) {
      let last = cluster.loci[cluster.loci.length - 1]
      let end = scales.locus(last.uid) + scales.offset(cluster.uid) + scales.x(last._end)
      if (end > max) max = end
    }
    return max
  }

  const legendTransform = (d) => {
    let max = getClusterEnd(d.clusters)
    return `translate(${max + 20}, ${0})`
  }

  const colourBarTransform = () => {
    let x = scales.x(config.scaleBar.basePair) + 20
    let y = scales.y.range()[1]
    return `translate(${x}, ${y})`
  }

  const scaleBarTransform = () => {
    let y = scales.y.range()[1]
    return `translate(0, ${y})`
  }

  /**
   * Arranges various plot elements around the cluster map.
   */
  function arrangeMap(selection) {
    selection.select("g.scaleBar")
      .attr("transform", scaleBarTransform)
    selection.select("g.colourBar")
      .attr("transform", colourBarTransform)
    selection.select("g.legend")
      .attr("transform", legendTransform)
  }

  function anchorGenes(_, anchor) {
    // Get original domain and range of cluster offset scale
    let domain = scales.offset.domain()
    let range = scales.offset.range()

    // Anchor map on given uid
    // Finds anchor genes in clusters given some initial anchor gene
    // Find gene links, then filter out any not containing the anchor
    let anchors = new Map()
		scales.group
			.domain()
      .filter(uid => {
				// Filter for matching groups
        let g1 = scales.group(uid)
        let g2 = scales.group(anchor.uid)
				return g1 !== null && g1 === g2
      })
			.forEach(uid => {
				// Group remaining anchors by cluster
				let cluster = d3.select(`#gene_${uid}`).data()[0]._cluster
				if (anchors.has(cluster)) {
					anchors.get(cluster).push(uid)
				} else {
					anchors.set(cluster, [uid])
				}
			})
    if (anchors.length === 0) return

    // Get the midpoint of the clicked anchor gene
    let getMidPoint = data => {
      let length = data.end - data.start
      return (
        scales.x(data.start + length / 2)
        + scales.locus(data._locus)
      )
    }
    let midPoint = getMidPoint(anchor)

		// Calculate offset value of a link anchor from clicked anchor
		let getOffset = link => {
			let data = d3.select(`#gene_${link}`).data()[0]
			return midPoint - getMidPoint(data)
		}

		// Get smallest offset value from anchors on the same cluster
		let getGroupOffset = (group) => {
			if (group.includes(anchor.uid)) return 0
			let offsets = group.map(l => getOffset(l))
			let index = d3.minIndex(offsets, l => Math.abs(l))
			return offsets[index]
		}

		// Iterate all anchor groups and update offset scale range values
		for (const [cluster, group] of anchors.entries()) {
			let index = domain.findIndex(el => el === cluster)
			range[index] = getGroupOffset(group)
		}

		// Update range, then update ClusterMap
    scales.offset.range(range)
    update()
  }

  my.config = function(_) {
    if (!arguments.length) return config
    updateConfig(config, _)
    return my
  }

  return my
}
