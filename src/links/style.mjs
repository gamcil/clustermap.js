import { color, rgb } from "d3-color";

export function linkColours(source, scales, config) {
  const { asLine, groupColour } = config.link;
  const colour = source.colour || (groupColour
    ? scales.colour(scales.group(source.query.uid)) : scales.score(source.identity));
  let fill = colour;
  if (!source.colour && groupColour) {
    const { r, g, b } = color(colour).rgb();
    // Group fills blend 40% white.
    fill = rgb(102 + 0.6 * r, 102 + 0.6 * g, 102 + 0.6 * b);
  }
  const stroke = asLine ? fill : source.colour || (groupColour ? colour : config.figureStyle?.outline || "black");
  return { fill, stroke };
}
