
/** One read-only HTML tooltip and one hit-test path for all three renderers. */
export function createAnnotationTooltip({ container, surfaces, getScene, getPreview, getCamera, isBusy, fontFamily, annotationApi }) {
  const { hitTestAnnotationCell } = annotationApi;
  const document = container.ownerDocument, window = document.defaultView;
  const tooltip = document.createElement("div");
  tooltip.className = "annotation-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  Object.assign(tooltip.style, { position: "fixed", pointerEvents: "none", zIndex: "4",
    maxWidth: "300px", padding: "8px 10px", border: "1px solid #cbd3de", borderRadius: "4px",
    background: "white", boxShadow: "0 2px 8px rgba(0,0,0,.15)", color: "#273444",
    fontFamily, fontSize: "12px", lineHeight: "1.5", overflowWrap: "anywhere" });
  container.append(tooltip);
  let key = null;
  const hide = () => { tooltip.hidden = true; key = null; };
  const move = (event) => {
    if (event.buttons || isBusy()) { hide(); return; }
    const rect = event.currentTarget.getBoundingClientRect(), camera = getCamera();
    const cell = hitTestAnnotationCell(getScene(), {
      x: (event.clientX - rect.left - camera.x) / camera.k,
      y: (event.clientY - rect.top - camera.y) / camera.k,
    }, getPreview());
    if (!cell) { hide(); return; }
    const nextKey = JSON.stringify([cell.panelUid, cell.clusterUid, cell.column, cell.value]);
    if (key !== nextKey) {
      key = nextKey;
      tooltip.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = cell.title || cell.panelUid;
      tooltip.append(title);
      for (const value of [cell.clusterName, `${cell.column}: ${cell.value === null ? "Missing" : cell.value}`]) {
        const line = document.createElement("div"); line.textContent = value; tooltip.append(line);
      }
    }
    tooltip.hidden = false;
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX + 12, window.innerWidth - bounds.width - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(event.clientY + 12, window.innerHeight - bounds.height - 8))}px`;
  };
  const escape = (event) => { if (event.key === "Escape") hide(); };
  for (const surface of surfaces.filter(Boolean)) {
    surface.addEventListener("pointermove", move);
    for (const event of ["pointerleave", "pointerdown", "wheel"]) surface.addEventListener(event, hide);
  }
  window.addEventListener("keydown", escape);
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  return { hide, dispose() {
    for (const surface of surfaces.filter(Boolean)) {
      surface.removeEventListener("pointermove", move);
      for (const event of ["pointerleave", "pointerdown", "wheel"]) surface.removeEventListener(event, hide);
    }
    window.removeEventListener("keydown", escape);
    window.removeEventListener("scroll", hide, true);
    window.removeEventListener("resize", hide);
    tooltip.remove();
  } };
}
