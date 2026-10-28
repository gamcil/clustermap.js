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

/** Width shared by label layout, tree placement and hit testing. */
export function clusterLabelWidth(name, locusText, config, measureText) {
  const width = (text, fontSize, fontWeight) =>
    textDimensions(text, { fontSize, fontWeight, fontFamily: config.plot.fontFamily }, measureText).width;
  return Math.max(width(name, config.cluster.nameFontSize, 700),
    width(locusText, config.cluster.lociFontSize, 400));
}

/** Project the same label blocks for committed geometry and live previews. */
export function layoutClusterLabels(clusters, { alignLabels = true, labelAlignment = "right", contentStart,
  startFor = (locus) => locus.worldStart, textFor = (cluster) => cluster.info.locusText,
  widthFor = (cluster) => cluster.info.width } = {}) {
  const left = labelAlignment === "left", labels = [];
  let firstStart = Infinity, maxWidth = 0;
  for (const cluster of clusters) {
    let start = Infinity;
    for (const locus of cluster.loci) start = Math.min(start, startFor(locus));
    firstStart = Math.min(firstStart, start);
    const locusText = textFor(cluster), width = left ? widthFor(cluster, locusText) : 0;
    maxWidth = Math.max(maxWidth, width);
    labels.push({ cluster, start: Number.isFinite(start) ? start : cluster.x, locusText, width });
  }
  const sharedStart = contentStart ?? firstStart;
  return new Map(labels.map(({ cluster, start, locusText, width }) => {
    const edge = alignLabels && Number.isFinite(sharedStart) ? sharedStart : start;
    const blockWidth = left ? (alignLabels ? maxWidth : width) : 0;
    return [cluster.source.uid, { x: edge - cluster.x - 10 - blockWidth,
      y: 0, locusText, width, anchor: left ? "start" : "end" }];
  }));
}
