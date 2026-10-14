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

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

/**
 * Shared text metrics for layout and renderers. The width estimate only
 * chooses collision lanes; the renderer remains the source of exact glyph
 * placement.
 */
export function resolveTrimIndicatorStyle(style = {}) {
  const fontSize = boundedNumber(style.fontSize, 10, 6, 48);
  const fontWeight = boundedNumber(style.fontWeight, 600, 100, 900);
  return {
    fontSize,
    fontWeight,
    borderWidth: boundedNumber(style.borderWidth, 3, 0, 12),
    borderOpacity: boundedNumber(style.borderOpacity, 1, 0, 1),
    lineHeight: Math.ceil(fontSize * 1.2),
    characterWidth: fontSize * (fontWeight >= 600 ? 0.6 : 0.56),
  };
}

function indicatorBounds(locus, indicator, metrics) {
  const width = indicator.text.length * metrics.characterWidth;
  const x = locus.x + indicator.x;
  const left = indicator.anchor === "end" ? x - width : x;
  return {
    left: left - 2,
    right: left + width + 2,
    top: locus.y + indicator.y - 1,
    bottom: locus.y + indicator.y + metrics.fontSize + 1,
  };
}

function overlaps(one, two) {
  return (
    one.left < two.right && one.right > two.left &&
    one.top < two.bottom && one.bottom > two.top
  );
}

/**
 * Assign the smallest non-overlapping vertical lane to every trim label.
 * This keeps both labels on one locus aligned whenever they fit, while also
 * preventing labels from separate loci in the same cluster from colliding.
 */
export function arrangeTrimIndicators(loci, replacements = new Map(), style = {}) {
  const metrics = resolveTrimIndicatorStyle(style);
  const arranged = new Map();
  const placed = [];
  for (const locus of [...loci].sort((one, two) => one.y - two.y || one.x - two.x)) {
    const indicators = replacements.get(locus.source.uid) || locus.trimIndicators || [];
    const positioned = [];
    for (const indicator of indicators) {
      const next = { ...indicator };
      let bounds = indicatorBounds(locus, next, metrics);
      while (placed.some((candidate) => overlaps(bounds, candidate))) {
        next.y += metrics.lineHeight;
        bounds = indicatorBounds(locus, next, metrics);
      }
      positioned.push(next);
      placed.push(bounds);
    }
    arranged.set(locus.source.uid, positioned);
  }
  return arranged;
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
  const indicators = [];

  if (start > fullStart) {
    indicators.push({
      side: "left",
      x: scaleX(start) + 3,
      y,
      anchor: "start",
      text: `← ${formatLength(start - fullStart)} · ${featureText(countBefore(start))}`,
    });
  }
  if (end < fullEnd) {
    indicators.push({
      side: "right",
      x: scaleX(end) - 3,
      y,
      anchor: "end",
      text: `${featureText(countAfter(end))} · ${formatLength(fullEnd - end)} →`,
    });
  }
  return indicators;
}
