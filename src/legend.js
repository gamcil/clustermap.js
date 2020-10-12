import { renameText } from "./utils.js"


export default function legend(colourScale) {
	/* Creates a legend component from a colour scale.
	 */

	let entryHeight = 15
	let fontSize = 12
	let hidden = []
	let onClickRect = null
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
		if (!arguments.length) return t
		t = _
		return t
	}
	my.hidden = function(_) {
		if (!arguments.length) return hidden
		hidden = _
		return my
	}
	my.entryHeight = function(_) {
		if (!arguments.length) return entryHeight
		entryHeight = parseInt(_)
		return my
	}
	my.fontSize = function(_) {
		if (!arguments.length) return fontSize
		fontSize = parseInt(_)
		return my
	}
	my.onClickRect = function(_) {
		if (!arguments.length) return onClickRect
		onClickRect = _
		return my
	}
	my.onClickText = function(_) {
		if (!arguments.length) return onClickText
		onClickText = _
		return my
	}

	return my
}
