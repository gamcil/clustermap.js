// Browser-only tooltip lifecycle shared by any chart renderer. Menu content is
// supplied by the caller because those controls may dispatch chart actions.
export function createHtmlOverlay(tooltip) {
  const show = (event, contents) => {
    tooltip.html("").append(() => contents.node());
    const rect = event.target.getBoundingClientRect();
    const bounds = tooltip.node().getBoundingClientRect();
    tooltip
      .style("left", `${rect.x + rect.width / 2 - bounds.width / 2}px`)
      .style("top", `${rect.y + rect.height * 1.2}px`)
      .transition()
      .duration(100)
      .style("opacity", 1)
      .style("pointer-events", "all");
    tooltip
      .transition()
      .delay(1000)
      .style("opacity", 0)
      .style("pointer-events", "none");
  };

  return {
    enter: (event) => d3.select(event.target).interrupt(),
    leave: () => d3.select(window).on("click", () => tooltip.interrupt().style("opacity", 0)),
    show,
  };
}
