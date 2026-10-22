const sceneMetrics = new WeakMap();
const textProperties = ["direction", "fontKerning", "fontStretch", "fontVariantCaps", "letterSpacing", "wordSpacing"];

/** Share native text metrics across Canvas consumers without changing their context. */
export function measureCanvasText(context, scene, text, {
  font = context.font, align = context.textAlign, baseline = context.textBaseline,
} = {}) {
  let cache = sceneMetrics.get(scene);
  if (!cache) { cache = new Map(); sceneMetrics.set(scene, cache); }
  text = String(text);
  const key = JSON.stringify([font, align, baseline, ...textProperties.map((name) => context[name]), text]);
  if (cache.has(key)) return cache.get(key);
  context.save();
  let metrics;
  try {
    context.font = font;
    context.textAlign = align;
    context.textBaseline = baseline;
    metrics = context.measureText(text);
  } finally { context.restore(); }
  // Preview coordinate labels can change on every drag frame.
  if (cache.size >= 4096) cache.delete(cache.keys().next().value);
  cache.set(key, metrics);
  return metrics;
}
