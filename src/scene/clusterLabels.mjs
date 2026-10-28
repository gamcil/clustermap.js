import { textDimensions } from "./text.mjs";

/** Shared label positions for drawing, figure bounds and interaction. */
export function clusterLabelLayout(config) {
  const nameSize = config.cluster.nameFontSize;
  if (config.cluster.hideLocusLabels) {
    const shape = config.gene.shape;
    const nameY = shape.tipHeight + shape.bodyHeight / 2;
    return { nameY, nameBaseline: "middle", top: nameY - nameSize / 2, bottom: nameY + nameSize / 2 };
  }
  return { nameY: 8, nameBaseline: "alphabetic", top: 8 - nameSize, bottom: 12 + config.cluster.lociFontSize };
}

/** Measure both lines once while projecting a left-aligned label block. */
export function clusterLabelWidth(name, locusText, config, measureText) {
  const width = (text, fontSize, fontWeight) =>
    textDimensions(text, { fontSize, fontWeight, fontFamily: config.plot.fontFamily }, measureText).width;
  return Math.max(width(name, config.cluster.nameFontSize, 700),
    width(locusText, config.cluster.lociFontSize, 400));
}
