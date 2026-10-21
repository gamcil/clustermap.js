/** Cubic-in-out animation; returns a cancellation function. */
export function animate(duration, update, complete) {
  const startedAt = performance.now();
  let cancelled = false;
  const tick = (now) => {
    const elapsed = duration ? Math.min(1, (now - startedAt) / duration) : 1;
    update(elapsed < 0.5 ? 4 * elapsed * elapsed * elapsed : 1 - Math.pow(-2 * elapsed + 2, 3) / 2);
    if (cancelled) return;
    if (elapsed < 1) frame = requestAnimationFrame(tick);
    else { frame = null; complete?.(); }
  };
  let frame = requestAnimationFrame(tick);
  return () => { cancelled = true; if (frame !== null) cancelAnimationFrame(frame); frame = null; };
}

/** Allow a queued preview to paint before preparing its committed scene. */
export function afterPaint(action) {
  let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(action); });
  return () => cancelAnimationFrame(frame);
}
