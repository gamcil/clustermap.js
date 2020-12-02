export default function legend(colourScale) {
	/* Creates a legend component from a colour scale.
	 */

	let entryHeight = 15
	let fontSize = 12
	let hidden = []
	let onClickCircle = () => {}
  let onClickText = () => {}
  let onAltClickText = () => {}
	let y = d3.scaleBand().paddingInner(0.5)
	let t = d3.transition().duration(500)

	function my(selection) {
		selection.each(function(data) {
			// Grab new domain from colourScale and update the y-scale
			let visible = data.groups.filter(g => !hidden.includes(g.uid) && !g.hidden)

      y.domain(visible.map(v => v.uid))
				.range([0, entryHeight * visible.length])

			// Grab the <g> element, if it exists
			let g = d3.select(this)
				.selectAll("g.legend")
				.data([data])
				.join("g")
				.attr("class", "legend")

			// Render each legend element <g>
      let translate = d => `translate(0, ${y(d.uid)})`
			g.selectAll("g.element")
				.data(visible, d => d.uid)
				.join(
					enter => {
						enter = enter.append("g")
							.attr("class", "element")
							.attr("transform", translate)
						enter.append("circle")
							.attr("class", d => `group-${d.uid}`)
						enter.append("text")
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
      g.selectAll("text")
        .attr("cursor", "pointer")
        .on("click", onClickText)
        .on("contextmenu", onAltClickText)
		})
	}

  function updateLegend(selection) {
    selection.attr("transform", d => `translate(0, ${y(d.uid)})`)
    let half = y.bandwidth() / 2
    selection.selectAll("text")
      .text(d => d.label)
      .attr("x", half + 6)
      .attr("y", half + 1)
      .style("font-size", `${fontSize}px`)
    selection.selectAll("circle")
      .attr("cy", half)
      .attr("r", half)
      .attr("fill", d => colourScale(d.uid))
  }

	my.colourScale = _ => arguments.length ? (colourScale = _, my) : colourScale
	my.transition = _ => arguments.length ? (t = _, my) : t
	my.hidden = _ => arguments.length ? (hidden = _, my) : hidden
	my.entryHeight = _ => arguments.length ? (entryHeight = parseInt(_), my) : entryHeight
	my.fontSize = _ => arguments.length ? (fontSize = parseInt(_), my) : fontSize
	my.onClickCircle = _ => arguments.length ? (onClickCircle = _, my) : onClickCircle
	my.onClickText = _ => arguments.length ? (onClickText = _, my) : onClickText
	my.onAltClickText = _ => arguments.length ? (onAltClickText = _, my) : onAltClickText

	return my
}
