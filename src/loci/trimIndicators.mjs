function formatLength(length) {
  const rounded = Math.round(length);
  if (rounded >= 1000) {
    const kilobases = rounded / 1000;
    return `${Number(kilobases.toFixed(kilobases >= 10 ? 0 : 1))} kb`;
  }
  return `${rounded} bp`;
}

function featureText(count) {
  return `${count} ${count === 1 ? "feature" : "features"}`;
}

/**
 * Describe the hidden flanks of a trimmed locus in its local display space.
 * The resulting records are deliberately renderer-neutral: SVG can use them
 * as text nodes while Canvas and WebGPU's Canvas overlay draw the same labels.
 */
export function createTrimIndicators({ locus, state, getGeneState, scaleX, shape = {} }) {
  if (!locus || !state) return [];
  const start = Number(state.start);
  const end = Number(state.end);
  const fullStart = Number(locus.start);
  const fullEnd = Number(locus.end);
  if (![start, end, fullStart, fullEnd].every(Number.isFinite)) return [];

  const genes = locus.genes || [];
  const countBefore = (boundary) =>
    genes.filter((gene) => Number(getGeneState(gene)?.end) <= boundary).length;
  const countAfter = (boundary) =>
    genes.filter((gene) => Number(getGeneState(gene)?.start) >= boundary).length;
  const y = (shape.tipHeight || 0) * 2 + (shape.bodyHeight || 0) + 4;
  const hasLeft = start > fullStart;
  const hasRight = end < fullEnd;
  const indicators = [];

  if (hasLeft) {
    indicators.push({
      side: "left",
      x: scaleX(start) + 3,
      y,
      anchor: "start",
      text: `← ${formatLength(start - fullStart)} · ${featureText(countBefore(start))}`,
    });
  }
  if (hasRight) {
    indicators.push({
      side: "right",
      x: scaleX(end) - 3,
      // Keep the two flanks on distinct baselines. A 12px step suits the
      // compact renderer font while staying within normal cluster spacing.
      y: y + (hasLeft ? 12 : 0),
      anchor: "end",
      text: `${featureText(countAfter(end))} · ${formatLength(fullEnd - end)} →`,
    });
  }
  return indicators;
}
