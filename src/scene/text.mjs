export function textFont({ fontSize, fontFamily, fontWeight = 400, fontStyle = "normal" }) {
  return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
}

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

function measure(value, { fontSize, fontFamily, fontWeight = 400, fontStyle = "normal", baseline = "alphabetic" }, measureText) {
  const text = String(value ?? "");
  if (!text) return { width: 0, left: 0, right: 0, top: 0, bottom: 0 };
  const metrics = measureText?.(text, { fontSize, fontFamily, fontWeight, fontStyle, textBaseline: baseline });
  const width = finite(metrics?.width, text.length * fontSize * 0.6);
  const top = baseline === "top" ? 0 : baseline === "middle" ? -fontSize / 2 : -fontSize * 0.8;
  return { width,
    left: -finite(metrics?.actualBoundingBoxLeft, 0),
    right: finite(metrics?.actualBoundingBoxRight, width),
    top: -finite(metrics?.actualBoundingBoxAscent, -top),
    bottom: finite(metrics?.actualBoundingBoxDescent, top + fontSize),
  };
}

/** Unrotated layout dimensions include glyph overhang and the advance width. */
export function textDimensions(value, style, measureText) {
  const box = measure(value, style, measureText);
  const overhang = Math.max(0, -box.left, box.right - box.width);
  return { width: box.width + overhang * 2, overhang,
    height: Math.max(style.fontSize, box.bottom - box.top) };
}

/** Ink bounds relative to the text anchor and baseline, in chart units. */
export function textBounds(value, style, measureText) {
  const box = measure(value, style, measureText);
  const shift = style.anchor === "end" ? -box.width : style.anchor === "middle" ? -box.width / 2 : 0;
  const angle = (style.rotation || 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const points = [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]]
    .map(([x, y]) => [(x + shift) * cos - y * sin, (x + shift) * sin + y * cos]);
  return { minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)) };
}
