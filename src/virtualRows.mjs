/** Shared fixed-height row window for scrollable data editors. */
export function virtualRowWindow(count, scrollTop, height, { rowHeight = 34, overscan = 8, threshold = 200 } = {}) {
  const virtual = count > threshold;
  const first = virtual ? Math.min(Math.max(0, count - 1), Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)) : 0;
  const last = virtual ? Math.min(count, first + Math.ceil((height || 320) / rowHeight) + overscan * 2) : count;
  return { first, last, before: first * rowHeight, after: (count - last) * rowHeight };
}

/** Own scrolling, resizing and keyed DOM rows; callers supply row/spacer elements. */
export function createVirtualRows({ viewport, container, key, createRow, updateRow,
  createSpacer, createEmpty, headerHeight = () => 0, onRender = () => {} }) {
  const document = container.ownerDocument, view = document.defaultView;
  if (!viewport.hasAttribute("tabindex")) viewport.tabIndex = -1;
  const spacer = () => {
    const node = createSpacer ? createSpacer() : document.createElement("div");
    node.setAttribute("aria-hidden", "true"); container.append(node); return node;
  };
  const top = spacer(), bottom = spacer(), mounted = new Map();
  const empty = createEmpty?.();
  if (empty) container.insertBefore(empty, bottom);
  let rows = [], first = -1, last = -1, frame = null, destroyed = false, rendering = false, pending = false;
  const render = (force = false) => {
    if (destroyed) return;
    if (rendering) { pending = true; return; }
    const window = virtualRowWindow(rows.length, Math.max(0, viewport.scrollTop - headerHeight()), viewport.clientHeight);
    if (!force && first === window.first && last === window.last) return;
    rendering = true;
    try {
      first = window.first; last = window.last;
      const visible = rows.slice(first, last), ids = new Set(visible.map(key));
      const remove = (node) => {
        if (node.contains(document.activeElement)) { document.activeElement.blur(); viewport.focus({ preventScroll: true }); }
        node.remove();
      };
      for (const [id, entry] of mounted) if (!ids.has(id)) { remove(entry.node); mounted.delete(id); }
      if (empty) empty.hidden = rows.length > 0;
      let next = empty || bottom, restoreFocus = null;
      for (let index = visible.length - 1; index >= 0; index--) {
        const row = visible[index], id = key(row);
        let entry = mounted.get(id);
        if (!entry) { entry = { node: createRow(row) }; mounted.set(id, entry); }
        else if (updateRow) {
          const updated = updateRow(entry.node, row);
          if (updated && updated !== entry.node) {
            const active = document.activeElement, label = active?.getAttribute("aria-label");
            if (label && entry.node.contains(active)) restoreFocus = [...updated.querySelectorAll("[aria-label]")]
              .find((control) => control.tagName === active.tagName && control.type === active.type && control.getAttribute("aria-label") === label);
            remove(entry.node); entry.node = updated;
          }
        }
        entry.node.setAttribute("aria-rowindex", first + index + 2);
        if (entry.node.nextSibling !== next) container.insertBefore(entry.node, next);
        next = entry.node;
      }
      // A table spacer uses its cell for height; a list spacer uses the element.
      (top.firstElementChild || top).style.height = `${window.before}px`;
      (bottom.firstElementChild || bottom).style.height = `${window.after}px`;
      onRender([...mounted.values()].map((entry) => entry.node));
      restoreFocus?.focus({ preventScroll: true });
    } finally {
      rendering = false;
      if (pending && !destroyed) { pending = false; view.queueMicrotask(() => render(true)); }
    }
  };
  const schedule = () => { if (frame === null) frame = view.requestAnimationFrame(() => { frame = null; render(); }); };
  viewport.addEventListener("scroll", schedule);
  const observer = new view.ResizeObserver(schedule); observer.observe(viewport);
  return {
    setRows(next) { rows = next; render(true); },
    refresh() { render(true); },
    destroy() {
      destroyed = true; observer.disconnect(); viewport.removeEventListener("scroll", schedule);
      if (frame !== null) view.cancelAnimationFrame(frame);
      for (const { node } of mounted.values()) node.remove();
      top.remove(); bottom.remove(); empty?.remove(); mounted.clear();
    },
  };
}
