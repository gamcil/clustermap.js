import { renameText } from "./utils.js"


export default function legend(colourScale) {
	/* Creates a legend component from a colour scale.
	 */

	let entryHeight = 15
	let fontSize = 12
	let onClickRect = null
	let onClickText = renameText
	let y = d3.scaleBand().paddingInner(0.5)
	let t = d3.transition().duration(500)

	function my(selection) {
		selection.each(function(data) {
			// Grab new domain from colourScale and update the y-scale
			let domain = colourScale.domain()
			y.domain(domain)
				.range([0, entryHeight * domain.length])

			// Grab the <g> element, if it exists
			let g = d3.select(this)
				.selectAll("g.legend")
				.data([data])
				.join("g")
				.attr("class", "legend")

			// Render each legend element <g>
			let translate = d => `translate(0, ${y(d)})`
			g.selectAll("g.element")
				.data(domain)
				.join(
					enter => {
						enter = enter.append("g")
							.attr("class", "element")
							.attr("transform", translate)
						enter.append("rect")
							.attr("fill", d => colourScale(d))
							.attr("class", d => `group-${d}`)
							.attr("width", 12)
							.attr("height", y.bandwidth())
						enter.append("text")
							.text(d => `Group ${d}`)
							.attr("x", 16)
							.attr("y", y.bandwidth())
							.attr("text-anchor", "start")
							.style("font-family", "sans")
							.style("font-size", fontSize)
						return enter
					},
					update => update.call(
						update => update.transition(t)
							.attr("transform", translate)
					)
				)

			// If click callbacks are specified, bind them
			if (onClickRect)
				g.selectAll("rect")
					.attr("cursor", "pointer")
					.on("click", onClickRect)
			if (onClickText)
				g.selectAll("text")
					.attr("cursor", "pointer")
					.on("click", onClickText)
		})
	}

	my.colourScale = function(_) {
		// Setter for the colour scale used as the basis of the legend
		if (!arguments.length) return colourScale
		colourScale = _
		return my
	}

	my.transition = function(_) {
		// Setter for transition used in legend updates
		if (!arguments.length) return t
		t = _
		return t
	}

	my.entryHeight = function(_) {
		// Setter for height of legend elements (def. 15)
		if (!arguments.length) return entryHeight
		entryHeight = parseInt(_)
		return my
	}

	my.fontSize = function(_) {
		// Setter for legend element text font size
		if (!arguments.length) return fontSize
		fontSize = parseInt(_)
		return my
	}

	my.onClickRect = function(_) {
		// Setter for <rect> element click callback
		if (!arguments.length) return onClickRect
		onClickRect = _
		return my
	}

	my.onClickText = function(_) {
		// Setter for <text> element click callback
		if (!arguments.length) return onClickText
		onClickText = _
		return my
	}

	return my
}
