import { renameText, updateConfig } from "./utils.js"
import defaultConfig from "./config.js"

function getClosestValue(values, value) {
  return Math.max(
    Math.min(
      d3.bisectLeft(values, value),
      values.length - 1
    ), 0)
}

function updateScaleRange(scale, uid, value) {
  let domain = scales[scale].domain()
  let range = scales[scale].range()
  let index = domain.indexOf(uid)
  range[index] = value
  scales[scale].range(range)
}

const config = Object.assign({}, defaultConfig)
const flags = { isDragging: false }

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
}

const plot = {
  legendTransform: d => {
    let [_, max] = _cluster.extent(d.clusters)
    return `translate(${max + 20}, ${0})`
  },
  colourBarTransform: () => {
    let x = scales.x(config.scaleBar.basePair) + 20
    let y = scales.y.range()[1]
    return `translate(${x}, ${y})`
  },
  scaleBarTransform: () => {
    let y = scales.y.range()[1]
    return `translate(0, ${y})`
  },
  updateConfig: function(target) {
    updateConfig(config, target)  
  },
  update: null,
  arrange: selection => {
    selection.select("g.scaleBar")
      .attr("transform", plot.scaleBarTransform)
    selection.select("g.colourBar")
      .attr("transform", plot.colourBarTransform)
    selection.select("g.legend")
      .attr("transform", plot.legendTransform)
  }
}

const scales = {
  x: d3.scaleLinear()
    .domain([1, 1001])
    .range([0, config.plot.scaleFactor]),
  y: d3.scaleBand().padding(0.05),
  group: d3.scaleOrdinal().unknown(null),
  colour: d3.scaleOrdinal().unknown("#bbb"),
  score: d3.scaleSequential(d3.interpolateGreys).domain([0, 1]),
  offset: d3.scaleOrdinal(),
  locus: d3.scaleOrdinal(),
}

const style = {
  cluster: selection => {
    let info = selection.selectAll(".clusterInfo")
    info.selectAll("text")
      .attr("text-anchor", "end")
      .style("font-family", "sans")
    info.selectAll(".locusText")
      .attr("y", 22)
    info.selectAll(".clusterText")
      .attr("y", 8)
      .attr("cursor", "pointer")
      .style("font-weight", "bold")
    return selection
  },
  locus: selection => {
    selection.selectAll("line.trackBar")
      .style("fill", "#111")
    let hover = selection.selectAll("g.hover")
      .attr("opacity", 0)
    hover.selectAll("rect.hover")
      .attr("fill", "rgba(0, 0, 0, 0.4)")
    hover.selectAll(".leftHandle")
      .attr("x", -8)
    hover.selectAll(".leftHandle, .rightHandle")
      .attr("width", 8)
      .attr("cursor", "pointer")
    return selection
  },
  gene: selection => {
    selection.attr("display", "inline")
    selection.selectAll("text")
      .attr("dy", "-0.3em")
    return selection
  },
  link: selection => {
    selection
      .style("stroke", "black")
      .style("stroke-width", "0.5px")
    return selection
  },
}

const _gene = {
  getId: d => `gene_${d.uid}`,
  fill: g => {
    if (!scales.colour || !scales.group) return "#bbb"
    let groupId = scales.group(g.uid)
    return scales.colour(groupId)
  },
  points: g => {
    // Calculates points attribute to draw a gene polygon
    let points = []

    // Get start and end of Gene as percentages of Locus length
    let scaledStart = scales.x(g.start)
    let scaledEnd = scales.x(g.end)
    let geneLength = scaledEnd - scaledStart

    // Calculate scaled constants based on scaled coordinates
    let bottom = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight
    let midpoint = bottom / 2
    let third = config.gene.shape.tipHeight + config.gene.shape.bodyHeight

    // Determine polygon points for the Gene, 5' to 3' or 3' to 5'
    if (g.strand === 1) {
      let shaft = scaledEnd - config.gene.shape.tipLength;
      points = [
        scaledStart, config.gene.shape.tipHeight,
        shaft, config.gene.shape.tipHeight,
        shaft, 0,
        scaledEnd, midpoint,
        shaft, bottom,
        shaft, third,
        scaledStart, third,
      ]
      // Squeeze arrow when total length is less than tip length
      if (geneLength < config.gene.shape.tipLength) {
        [2, 4, 8, 10].forEach(item => (points[item] = scaledStart))
      }
    } else {
      let shaft = scaledStart + config.gene.shape.tipLength
      points = [
        scaledEnd, config.gene.shape.tipHeight,
        shaft, config.gene.shape.tipHeight,
        shaft, 0,
        scaledStart, midpoint,
        shaft, bottom,
        shaft, third,
        scaledEnd, third,
      ];
      if (geneLength < config.gene.shape.tipLength) {
        [2, 4, 8, 10].forEach(item => (points[item] = scaledEnd))
      }
    }
    return points.join(" ")
  },
  labelTransform: g => {
    let offset = scales.x(g.end - g.start) * config.gene.label.start
    let gx = scales.x(g.start) + offset
    let rotate = (["start", "middle"].includes(config.gene.label.anchor))
      ? -config.gene.label.rotation
      : config.gene.label.rotation
    return `translate(${gx}, 0) rotate(${rotate})`
  },
  update: selection => {
    selection.selectAll("polygon")
      .attr("class", g => {
        let group = scales.group(g.uid)
        return (group !== null) ? `genePolygon group-${group}` : "genePolygon"
      })
      .attr("points", _gene.points)
      .attr("fill", _gene.fill)
      .style("stroke", config.gene.shape.stroke)
      .style("stroke-width", config.gene.shape.strokeWidth)
    selection.selectAll("text.geneLabel")
      .attr("display", config.gene.label.show ? "inherit" : "none")
      .attr("transform", _gene.labelTransform)
      .attr("font-size", config.gene.label.fontSize)
      .attr("text-anchor", config.gene.label.Anchor)
    return selection
  },
  anchor: (_, anchor) => {
    // Get original domain and range of cluster offset scale
    let domain = scales.offset.domain()
    let range = scales.offset.range()

    // Anchor map on given uid
    // Finds anchor genes in clusters given some initial anchor gene
    // Find gene links, then filter out any not containing the anchor
    let anchors = new Map()
    scales.group
      .domain()
      .filter(uid => {  // Filter for matching groups
        let g1 = scales.group(uid)
        let g2 = scales.group(anchor.uid)
        return g1 !== null && g1 === g2
      })
      .forEach(uid => {  // Group remaining anchors by cluster
        let cluster = get.geneData(uid)._cluster
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
        + scales.offset(data._cluster)
      )
    }
    let midPoint = getMidPoint(anchor)

    // Calculate offset value of a link anchor from clicked anchor
    let getOffset = link => {
      let data = get.geneData(link)
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
      range[index] += getGroupOffset(group)
    }

    // Update range, then update ClusterMap
    scales.offset.range(range)
    plot.update()
  },
}

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
      let flipped = locus._flipped ? " (reversed)" : ""
      if (locus._start == null || locus._end == null)
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
    ignore = ignore || []
    let start
    let end
    for (let locus of cluster.loci) {
      if (ignore.includes(locus.uid)) continue
      let offset = scales.offset(cluster.uid) + scales.locus(locus.uid)
      let _start = scales.x(locus._start) + offset
      let _end = scales.x(locus._end) + offset
      if (!start || (start && _start < start)) start = _start
      if (!end || (end && _end > end)) end = _end
    }
    return [start, end]
  },
  /**
   * Finds minimum and maximum points of all clusters/loci.
   * @param {Array} ignore - Cluster UIDs to ignore
   * @return {Array} 2-element array containing min and max
   */
  extent: ignore => {
    ignore = ignore || []
    let min, max
    for (const uid of scales.offset.domain()) {
      // if (ignore.includes(uid)) continue
      let cluster = get.clusterData(uid) 
      let [_min, _max] = _cluster.extentOne(cluster, ignore)
      if (!min || (min && _min < min)) min = _min
      if (!max || (max && _max > max)) max = _max
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
    let a = get.cluster(one).datum()
    let b = get.cluster(two).datum()
    return Math.abs(a.slot - b.slot) === 1
  },
  /**
   * Gets range for a cluster scale based on its loci
   * Note: transform on <g> element only applies to visible elements,
   *       so no point adding offset here
   */
  getRange: c => {
    let range = []
    let value = 1
    let start, end, offset
    for (const [index, locus] of c.loci.entries()) {
      if (index > 0)
        value = range[range.length - 1] + end - start + config.locus.spacing
      offset = scales.locus(locus.uid) || 0
      start = scales.x(locus._start || locus.start)
      end = scales.x(locus._end || locus.end)
      range.push(value - start + offset)
    }
    return range
  },
  /**
   * Gets domain and range for the locus offset scale
   */
  getLocusScaleValues: clusters => {
    let domain = []
    let range = []
    clusters.forEach(cluster => {
      let d = cluster.loci.map(locus => locus.uid)
      let r = _cluster.getRange(cluster) 
      domain.push(...d)
      range.push(...r)
    })
    return [domain, range]
  },
  /**
   * Aligns clusterInfo <g> elements based on leftmost cluster in the map.
   * Should be used on a D3 selection using call().
   * @param {d3.selection} selection - g.clusterInfo selection
   * @return {d3.selection}
   */
  alignLabels: selection => {
    let [min, _] = _cluster.extent()
    return selection.attr("transform", d => {
      let value = min - scales.offset(d.uid)
      return `translate(${value - 10}, 0)`
    })
  },
  update: selection => {
    selection.attr("transform", _cluster.transform)
    if (config.cluster.alignLabels) {
      selection
        .selectAll(".clusterInfo")
        .call(_cluster.alignLabels)
    } else {
      selection
        .selectAll(".clusterInfo")
        .attr("transform", `translate(-10, 0)`)
    }
    selection
      .selectAll("text.clusterText")
      .style("font-size", `${config.cluster.nameFontSize}px`)
    selection
      .selectAll("text.locusText")
      .text(_cluster.locusText)
      .style("font-size", `${config.cluster.lociFontSize}px`)
    return selection
  },
  drag: selection => {
    let free
    let height = scales.y.range()[1]
    selection.each((d, i) => { d.slot = i; })

    const getDomain = () => {
      let clusters = []
      selection.each(c => { clusters.push(c) })
      clusters = clusters.sort((a, b) => a.slot > b.slot)
      return clusters.map(c => c.uid)
    }

    const started = (_, d) => {
      flags.isDragging = true
      get.cluster(d.uid)
        .raise()
        .classed("active", true)
        .attr("cursor", "grabbing")
      free = d.slot
    }

    const dragged = (event, d) => {
      let me = get.cluster(d.uid)
      let matrix = get.matrix(me)
      const yy = Math.min(height, Math.max(0, matrix.f + event.y))
      me.attr("transform", d => `translate(${scales.offset(d.uid)}, ${yy})`)

      // Get closest index based on new y-position
      let domain = scales.y.domain()
      let p = domain.length - Math.min(
        Math.round(height / yy),
        domain.length
      )

      d3.selectAll("path.geneLink")
        .call(_link.setPath)

      if (p === d.slot) return

      // Re-arrange the y-scale domain
      selection.each(function(e) {
        if (e.uid !== d.uid && e.slot === p) {
          e.slot = free
          d.slot = free = p
          let uid = scales.y.domain()[e.slot]
          get.cluster(e.uid)
            .transition()
            .attr("transform", c =>
              `translate(${scales.offset(c.uid)}, ${scales.y(uid)})`
            )
        }
      })
    }

    const ended = () => {
      flags.isDragging = false
      let dom = getDomain()
      scales.y.domain(dom)
      plot.update()
    }

    return d3.drag()
      .on("start", started)
      .on("drag", dragged)
      .on("end", ended)
      (selection)
  },
}

const _link = {
  getId: l => {
    let [a, b] = [l.query.uid, l.target.uid].sort()
    return `${a}-${b}`
  },
  display: l => {
    let a = get.gene(l.query.uid).attr("display")
    let b = get.gene(l.target.uid).attr("display")
    return (a === "none" || b === "none") ? "none" : "inline"
  },
  /**
   * Sets the d attribute on a selection of link lines.
   */
  setPath: (selection, snap) => {
    return selection.attr("d", d => _link.path(d, snap))
  },
  path: (d, snap) => {
    snap = snap || false

    // Calculates points linking two genes
    // Select genes by unique ID, get underlying data 
    let a = get.geneData(d.query.uid)
    let b = get.geneData(d.target.uid)

    if (!_cluster.adjacent(a._cluster, b._cluster)) {
      return null
    }

    // Calculate vertical midpoint based on shape config
    let mid = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2

    // Locus offset in each cluster, mostly 0
    let getOffset = g => {
      if (snap) return scales.offset(g._cluster) + scales.locus(g._locus)
      let locus = get.locus(g._locus)
      let matrix = get.matrix(locus)
      return scales.offset(g._cluster) + matrix.e
    }
    let aOffset = getOffset(a)
    let bOffset = getOffset(b)

    // Get anchoring points for each gene polygon
    let getAnchors = (g, offset) => {
      let inverse = get.locusData(g._locus)._flipped
      let cluster = get.cluster(g._cluster)
      let matrix = get.matrix(cluster)
      let left = scales.x(g.start) + offset
      let right = scales.x(g.end) + offset
      return [
        inverse ? right : left,
        inverse ? left : right,
        snap ? scales.y(g._cluster) + mid : matrix.f + mid
      ]
    }

    let [ax1, ax2, ay] = getAnchors(a, aOffset)
    let [bx1, bx2, by] = getAnchors(b, bOffset)

    // Generate the path d attribute
    return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`
  },
  /**
   * Gets all groups of gene links from an array of link objects.
   * Any link with identity score below the config threshold is ignored.
   * @param {Array} links - Link objects
   */
  getGroups: links => {
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
  },
  /**
   * Tests two arrays of gene link groups for equality.
   * @param {Array} one - An array of link group arrays
   * @param {Array} two - Another array of link group arrays
   * @return {boolean}
    * */
  compareGroups: (one, two) => {
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
  },
  /**
   * Creates flat link group domain and range for creating d3 scales.
   * @param {Array} groups - An array of link group arrays
   * @return {Object} An object with flattened domain and range arrays
   */
  getGroupDomainAndRange: groups => {
    let scale = {domain: [], range: []}
    groups.forEach((group, i) => {
      scale.domain.push(...group)
      scale.range.push(...group.map(() => i))
    })
    return scale
  },
  updateGroups: links => {
    let oldRange = scales.group.range()
    let oldGroups = Array.from(
      d3.group(scales.group.domain(), (_, i) => oldRange[i]).values()
    )
    let newGroups = _link.getGroups(links)
    let merged = _link.mergeGroups(oldGroups, newGroups)
    let match = _link.compareGroups(oldGroups, merged)
    if (!match) {
      scales.colour
        .domain(merged.map((_, i) => i))
        .range(d3.quantize(d3.interpolateRainbow, merged.length + 1))
      let {domain, range} = _link.getGroupDomainAndRange(merged)
      scales.group
        .domain(domain)
        .range(range)
    }
  },
}

const _locus = {
  getId: d => `locus_${d.uid}`,
  realLength: d => scales.x(d._end - d._start),
  updateTrackBar: selection => {
    let midPoint = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2
    selection.select("line.trackBar")
      .attr("x1", d => scales.x(d._start))
      .attr("x2", d => scales.x(d._end))
      .attr("y1", midPoint)
      .attr("y2", midPoint)
      .style("stroke", config.locus.trackBar.colour)
      .style("stroke-width", config.locus.trackBar.stroke)
    return selection
  },
  updateHoverBox: selection => {
    let botPoint = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight
    selection.selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
      .attr("y", -10)
      .attr("height", botPoint + 20)
    selection.select("rect.hover")
      .attr("x", d => scales.x(d._start))
      .attr("width", _locus.realLength)
    selection.select("rect.leftHandle")
      .attr("x", d => scales.x(d._start) - 8)
    selection.select("rect.rightHandle")
      .attr("x", d => scales.x(d._end))
    return selection
  },
  update: selection => {
    let translate = d => `translate(${scales.locus(d.uid)}, 0)`
    return selection
      .attr("transform", translate)
      .call(_locus.updateTrackBar)
      .call(_locus.updateHoverBox)
  },
  dragResize: selection => {
    let minPos,
      value,
      side,
      initial

    const started = (_, d) => {
      [minPos, _] = _cluster.extent([d.uid])
      flags.isDragging = true
      initial = scales.x(d._start)
    }

    function dragged(event, d) {
      let handle = d3.select(this)
      let func
      if (handle.attr("class") === "leftHandle") {
        side = "left"
        func = _left
      } else {
        side = "right"
        func = _right
      }
      func(event, d, handle)
    }

    const _left = (event, d, handle) => {
      // Find closest gene start, from start to _end
      let geneStarts = d.genes
        .filter(gene => gene.end <= d._end)
        .map(gene => gene.start)
      let starts = [d.start, ...geneStarts].sort((a, b) => a > b)
      let coords = starts.map(value => scales.x(value))
      let position = getClosestValue(coords, event.x)
      value = coords[position]
      d._start = starts[position]

      // Adjust the dragged rect
      handle.attr("x", value - 8)

      // Resize the hover <rect>, hide any genes not within bounds
      let locus = get.locus(d.uid)
      locus.select("rect.hover")
        .attr("x", value)
        .attr("width", _locus.realLength)
      locus.selectAll("g.gene")
        .attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none")
      locus.call(_locus.updateTrackBar)

      // Hide any gene links connected to hidden genes
      d3.selectAll("path.geneLink")
        .attr("display", _link.display)

      if (config.cluster.alignLabels) {
        // Add offset/locus scale values to make equivalent to minPos from
        // cluster.extent(), then remove from per-cluster transforms
        let offs = scales.offset(d._cluster) + scales.locus(d.uid)
        let newMin = Math.min(value + offs, minPos) - 10
        d3.selectAll("g.clusterInfo")
          .attr("transform", c => {
            let blah = newMin - scales.offset(c.uid)
            return `translate(${blah}, 0)`
          })
      } else {
        d3.select(`#cinfo_${d._cluster}`)
          .attr("transform", `translate(${scales.locus(d.uid) + scales.x(d._start) - 10}, 0)`)
      }
    }

    const _right = (event, d, handle) => {
      // Find closest visible gene end, from _start to end
      let ends = d.genes
        .filter(gene => gene.start >= d._start)
        .map(gene => gene.end)
        .sort((a, b) => a > b)
      let range = ends.map(value => scales.x(value))
      let position = getClosestValue(range, event.x)
      d._end = ends[position]

      // Transform handle rect
      handle.attr("x", scales.x(d._end))

      // Update rect width, hide genes out of bounds
      let locus = get.locus(d.uid)
      locus.select("rect.hover")
        .attr("width", _locus.realLength)
      locus.selectAll("g.gene")
        .attr("display", g => (g.start >= d._start && g.end <= d._end + 1) ? "inline" : "none")
      locus.call(_locus.updateTrackBar)

      // Hide any gene links attached to hidden genes
      d3.selectAll("path.geneLink")
        .attr("display", _link.display)

      // Adjust position of legend when final locus _end property changes
      d3.select("g.legend")
        .attr("transform", plot.legendTransform)
    }

    const ended = (_, d) => {
      flags.isDragging = false
      d3.select(`#locus_${d.uid} .hover`)
        .transition()
        .attr("opacity", 0)
      // if (side === "left") {
      //   let diff = value - initial
        // updateScaleRange("locus", d.uid, scales.locus(d.uid) + diff) //scales.locus(d.uid) + diff)
        // updateScaleRange("offset", d._cluster, scales.offset(d._cluster) - diff)
      // }
      plot.update()
    }

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
      locus

    const started = (event, d) => {
      [minPos, maxPos] = _cluster.extent([d.uid])
      offset = event.x
      value = scales.locus(d.uid)
      flags.isDragging = true
    }

    const dragged = (event, d) => {
      value += event.x - offset

      locus = get.locus(d.uid)
      locus.attr("transform", `translate(${value}, 0)`)

      // Adjust any gene links affected by moving the locus.
      // Make sure setLinkPath is called with snap=false
      d3.selectAll("path.geneLink")
        .call(_link.setPath, false)

      // Adjust clusterInfo groups
      let locData = locus.datum()
      let locStart = scales.x(locData._start)
      let newMin = Math.min(value + scales.offset(d._cluster) + locStart, minPos) - 10
      let translate = c => `translate(${newMin - scales.offset(c.uid)}, 0)`
      d3.selectAll("g.clusterInfo")
        .attr("transform", translate)

      // Adjust legend group
      let locEnd = scales.x(locData._end)
      let newMax = Math.max(value + scales.offset(d._cluster) + locEnd, maxPos) + 20
      d3.select("g.legend")
        .attr("transform", `translate(${newMax}, 0)`)
    }

    const ended = (_, d) => {
      flags.isDragging = false
      updateScaleRange("locus", d.uid, value)
      plot.update()
    }

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
    d._flipped = !d._flipped
    let length = d.end - d.start + 2
    let tmp = d._start
    d._start = length - d._end
    d._end = length - tmp

    // Invert coordinates of genes in the locus
    d.genes.forEach(g => {
      let tmp = g.start
      g.start = length - g.end
      g.end = length - tmp
      g.strand = (g.strand === 1) ? -1 : 1
    })

    // Update range of locus scale
    let diff = scales.x(tmp - d._start)
    updateScaleRange("locus", d.uid, scales.locus(d.uid) + diff)
  }
}

const _scale = {
  check: s => _scale.checkDomain(s) && _scale.checkRange(s),
  checkDomain: s => scales[s].domain().length > 0,
  checkRange: s => scales[s].range().length > 0,
  updateX: () => {scales.x.range([0, config.plot.scaleFactor])},
  updateY: data => {
    scales.y
      .range([
        0,
        data.clusters.length
        * (config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight)
        + (data.clusters.length - 1) * config.cluster.spacing
      ])
  },
  updateOffset: clusters => {
    scales.offset
      .domain(clusters.map(d => d.uid))
      .range(clusters.map(() => 0))
  },
  updateLocus: clusters => {
    let [domain, range] = _cluster.getLocusScaleValues(clusters)
    scales.locus.domain(domain).range(range)
  },
  update: data => {
    _scale.updateX()

    if (!_scale.check("y"))
      scales.y.domain(data.clusters.map(c => c.uid))
    _scale.updateY(data)

    if (!_scale.check("offset"))
      _scale.updateOffset(data.clusters)

    if (!_scale.check("locus"))
      _scale.updateLocus(data.clusters)
  }
}

config.gene.shape.onClick = _gene.anchor
config.legend.onClickText = renameText

export {
  config,
  flags,
  get,
  plot,
  scales,
  style,
  _cluster as cluster,
  _gene as gene,
  _link as link,
  _locus as locus,
  _scale as scale,
}
