import { resolveTrimIndicatorStyle } from "./trimIndicators.mjs";

/** Figure content excludes the hover region and trim handles. */
export function locusContentBounds(locus, { shape, trimIndicatorStyle = {} }, geometry = locus) {
  const { x = 0, y = 0 } = geometry.offsets || {};
  const { fontSize } = resolveTrimIndicatorStyle(trimIndicatorStyle);
  return {
    minX: geometry.worldStart ?? locus.worldStart + x,
    maxX: geometry.worldEnd ?? locus.worldEnd + x,
    minY: locus.y + y,
    maxY: Math.max(
      locus.y + y + shape.tipHeight * 2 + shape.bodyHeight,
      ...(geometry.trimIndicators || locus.trimIndicators || [])
        .map((indicator) => locus.y + y + indicator.y + fontSize + 1)
    ),
  };
}

export function xDistance(scaleX, start, end) {
  return scaleX(end) - scaleX(start);
}

export function getLocusScaleValues(clusters, { scaleX, locusOffset, spacing, locusState }) {
  const domain = [], range = [];
  for (const cluster of clusters) {
    let value = 1, start, end;
    for (const [index, locus] of cluster.loci.entries()) {
      if (index > 0) value = range[range.length - 1] + end - start + spacing;
      const offset = locusOffset(locus.uid) || 0;
      const state = locusState ? locusState(locus) : locus;
      start = scaleX(state.start ?? locus.start);
      end = scaleX(state.end ?? locus.end);
      domain.push(locus.uid);
      range.push(value - start + offset);
    }
  }
  return { domain, range };
}
