export default function colourBar(colourScale) {
	/* Creates the colour bar component.
	*/

	let height = 25
	let width = 150
	let fontSize = 12
  let lowerBound = 0
  let upperBound = 1
	let t = d3.transition()

	function my(selection) {
		selection.each(function(data) {
			d3.select(this)
				.selectAll("g.colourBar")
				.data([data])
				.join(
					enter => {
						enter = enter.append("g")
							.attr("class", "colourBar")

						// Add the gradient to <defs>
						let defs = enter.append("defs")
						let gradient = defs.append("linearGradient")
							.attr("id", "cbarGradient")
							.attr("x1", "0%")
							.attr("x2", "100%")
						gradient.append("stop")
							.attr("class", "startStop")
							.attr("offset", "0%")
						gradient.append("stop")
							.attr("class", "endStop")
							.attr("offset", "100%")

						// Draw the colour bar itself
						let cbar = enter.append("g")
							.attr("class", "cbarParts")
						cbar.append("rect")
							.attr("class", "colourBarBG")
							.style("fill", "white")
							.style("stroke", "black")
							.style("stroke-width", "1px")
						cbar.append("rect")
							.attr("class", "colourBarFill")
							.style("fill", "url(#cbarGradient)")
						cbar.append("text")
							.text("Identity (%)")
							.attr("class", "labelText")
							.attr("text-anchor", "middle")
						cbar.append("text")
							.attr("class", "startText")
							.attr("text-anchor", "start")
						cbar.append("text")
							.attr("class", "endText")
							.attr("text-anchor", "end")
						cbar.selectAll("text")
							.style("font-family", "sans-serif")
              .style("dominant-baseline", "hanging")
						return enter.call(updateColourBar)
					},
					update => update.call(
						update => update.transition(t).call(updateColourBar)
					)
				)
		})
	}

	function updateColourBar(selection) {
		// Updates colour bar styling/positioning
		selection.select(".startStop")
			.attr("stop-color", colourScale(lowerBound))
		selection.select(".endStop")
			.attr("stop-color", colourScale(upperBound))
		selection.selectAll("rect")
			.attr("width", width)
			.attr("height", height)
		selection.selectAll(".startText, .endText, .labelText")
			.attr("y", height + 5)
		selection.select(".labelText")
			.attr("x", width / 2)
		selection.select(".startText")
      .text(`${Math.round(lowerBound * 100)}`)
		selection.select(".endText")
      .text(`${Math.round(upperBound * 100)}`)
			.attr("x", width)
		selection.selectAll("text")
			.style("font-size", `${fontSize}pt`)					
    return selection
	}

	// Setters/getters
	my.width = _ => arguments.length ? (width = parseInt(_), my) : width
	my.height = _ => arguments.length ? (height = parseInt(_), my) : height
	my.fontSize = _ => arguments.length ? (fontSize = parseInt(_), my) : fontSize
	my.colourScale = _ => arguments.length ? (colourScale = _, my) : colourScale
	my.transition = _ => arguments.length ? (t = _, my) : t
  my.lowerBound = _ => arguments.length ? (lowerBound = parseFloat(_), my) : lowerBound
  my.upperBound = _ => arguments.length ? (upperBound = parseFloat(_), my) : upperBound

	return my
}
