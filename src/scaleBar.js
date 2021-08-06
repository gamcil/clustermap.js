import * as api from "./api.js";

export default function scaleBar(x) {
  /* Creates a scale bar component
   */

  let basePair = 1000;
  let stroke = 1;
  let height = 10;
  let colour = "black";
  let fontSize = 12;
  let t = d3.transition().duration(500);
  let onClickText = null;

  function my(selection) {
    selection.each(function (data) {
      // Grab the <g> element, if it exists and draw scale bar
      d3.select(this)
        .selectAll("g.scaleBar")
        .data([data])
        .join(
          (enter) => {
            enter = enter.append("g").attr("class", "scaleBar");
            enter.append("line").attr("class", "flatBar");
            enter.append("line").attr("class", "leftBar");
            enter.append("line").attr("class", "rightBar");
            enter
              .append("text")
              .attr("class", "barText")
              .attr("text-anchor", "middle")
              .attr("cursor", "pointer")
              .style("font-family", api.config.plot.fontFamily)
              .on("click", onClickText || promptNewLength);
            enter.call(updateScaleBar);
            return enter;
          },
          (update) =>
            update.call((update) => update.transition(t).call(updateScaleBar))
        );
    });
  }

  function getLabel() {
    return `${+(basePair / 1000).toFixed(1)}kb`;
  }

  function updateScaleBar(selection) {
    // Updates position and styling of scale bar components
    let middle = height / 2;
    let end = x(basePair);
    selection
      .select(".flatBar")
      .attr("x2", end)
      .attr("y1", middle)
      .attr("y2", middle);
    selection.select(".leftBar").attr("y2", height);
    selection
      .select(".rightBar")
      .attr("x1", end)
      .attr("x2", end)
      .attr("y2", height);
    selection
      .select("text.barText")
      .text(getLabel)
      .attr("x", end / 2)
      .attr("y", height + 5)
      .style("dominant-baseline", "hanging")
      .style("font-size", `${fontSize}pt`);
    selection
      .selectAll("line")
      .style("stroke", colour)
      .style("stroke-width", stroke);
  }

  function promptNewLength() {
    let result = prompt("Enter new length (bp):", basePair);
    if (result) my.basePair(result);
  }

  my.basePair = (_) =>
    arguments.length ? ((basePair = parseInt(_)), my) : basePair;
  my.colour = (_) => (arguments.length ? ((colour = _), my) : colour);
  my.colourScale = (_) =>
    arguments.length ? ((colourScale = _), my) : colourScale;
  my.fontSize = (_) =>
    arguments.length ? ((fontSize = parseInt(_)), my) : fontSize;
  my.height = (_) => (arguments.length ? ((height = parseInt(_)), my) : height);
  my.onClickText = (_) =>
    arguments.length ? ((onClickText = _), my) : onClickText;
  my.stroke = (_) => (arguments.length ? ((stroke = parseInt(_)), my) : stroke);
  my.transition = (_) => (arguments.length ? ((t = _), my) : t);
  my.width = (_) => (arguments.length ? ((width = parseInt(_)), my) : width);

  return my;
}
