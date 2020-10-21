import { renameText } from "./utils.js"


export default function legend(colourScale) {
	/* Creates a legend component from a colour scale.
	 */

	let entryHeight = 15
	let fontSize = 12
	let hidden = []
	let onClickCircle = null
	let onClickText = renameText
	let y = d3.scaleBand().paddingInner(0.5)
	let t = d3.transition().duration(500)

	function my(selection) {
		selection.each(function(data) {
			// Grab new domain from colourScale and update the y-scale
			let domain = colourScale.domain()
			let visible = domain.filter(g => !hidden.includes(g))
			y.domain(visible)
				.range([0, entryHeight * visible.length])

			// Grab the <g> element, if it exists
			let g = d3.select(this)
				.selectAll("g.legend")
				.data([data])
				.join("g")
				.attr("class", "legend")

			// Render each legend element <g>
      let translate = d => `translate(0, ${y(d)})`
			g.selectAll("g.element")
				.data(visible)
				.join(
					enter => {
						enter = enter.append("g")
							.attr("class", "element")
							.attr("transform", translate)
						enter.append("circle")
							.attr("class", d => `group-${d}`)
							// .attr("width", 6)
						enter.append("text")
							.text(d => `Group ${d}`)
							.attr("x", 16)
							.attr("text-anchor", "start")
							.style("font-family", "sans")
              .style("dominant-baseline", "middle")
						return enter.call(updateLegend)
					},
					update => update.call(
						update => update.transition(t)
              .attr("transform", translate)
              .call(updateLegend)
					)
				)

			// If click callbacks are specified, bind them
			if (onClickCircle)
				g.selectAll("circle")
					.attr("cursor", "pointer")
					.on("click", onClickCircle)
			if (onClickText)
				g.selectAll("text")
					.attr("cursor", "pointer")
					.on("click", onClickText)
		})
	}

  function updateLegend(selection) {
    selection.attr("transform", d => `translate(0, ${y(d)})`)
    let half = y.bandwidth() / 2
    selection.selectAll("text")
      .attr("x", half + 6)
      .attr("y", half + 1)
      .style("font-size", `${fontSize}px`)
    selection.selectAll("circle")
      .attr("cy", half)
      .attr("r", half)
      .attr("fill", d => colourScale(d))
  }

	my.colourScale = _ => arguments.length ? (colourScale = _, my) : colourScale
	my.transition = _ => arguments.length ? (t = _, my) : t
	my.hidden = _ => arguments.length ? (hidden = _, my) : hidden
	my.entryHeight = _ => arguments.length ? (entryHeight = parseInt(_), my) : entryHeight
	my.fontSize = _ => arguments.length ? (fontSize = parseInt(_), my) : fontSize
	my.onClickCircle = _ => arguments.length ? (onClickCircle = _, my) : onClickCircle
	my.onClickText = _ => arguments.length ? (onClickText = _, my) : onClickText

	return my
}
