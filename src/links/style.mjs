import { rgbaToRgb } from "../utils.js";

export function linkColours(source, scales, config) {
  const { asLine, groupColour } = config.link;
  const colour = source.colour || (groupColour
    ? scales.colour(scales.group(source.query.uid)) : scales.score(source.identity));
  const fill = !source.colour && groupColour ? rgbaToRgb(colour) : colour;
  const stroke = asLine ? fill : source.colour || (groupColour ? colour : config.figureStyle?.outline || "black");
  return { fill, stroke };
}
