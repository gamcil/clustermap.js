/**
 * Mount the small batch-locus toolbar inside a plot container.
 * It is intentionally separate from <clinker-editor>: selection and flipping
 * are plot operations, and applications may use them without opening data UI.
 */
let activeToolbar = null;

export function mountPlotSelectionToolbar(chart, container) {
  if (!chart?.locusSelection || !chart?.flipLoci) throw new TypeError("A mounted ClusterMap chart is required.");
  if (!(container instanceof Element)) throw new TypeError("A plot container element is required.");
  const root = document.createElement("div");
  root.className = "cm-plot-selection-toolbar";
  root.hidden = true;
  root.innerHTML = `<strong></strong><button type="button" data-flip>Flip selected loci</button><button type="button" data-clear>Clear</button>`;
  const summary = root.querySelector("strong");
  const sync = () => {
    const count = chart.locusSelection().length;
    root.hidden = count === 0;
    summary.textContent = `${count} ${count === 1 ? "locus" : "loci"} selected`;
  };
  const clear = () => chart.locusSelection([]);
  const activate = () => { activeToolbar = root; };
  root.querySelector("[data-flip]").addEventListener("click", () => chart.flipLoci());
  root.querySelector("[data-clear]").addEventListener("click", clear);
  const onKeyDown = (event) => {
    if (activeToolbar !== root || event.key !== "Escape" || event.defaultPrevented || !chart.locusSelection().length) return;
    if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    clear();
  };
  // Keyboard focus is commonly still on <body> after an SVG/canvas click, so
  // track the active chart at its container rather than requiring focusable
  // renderer surfaces. This prevents one chart's Escape handler clearing all
  // other charts on the page.
  container.addEventListener("pointerdown", activate);
  container.addEventListener("focusin", activate);
  document.addEventListener("keydown", onKeyDown);
  const unsubscribe = chart.on("change", (change) => {
    if (change.type === "loci.select") sync();
  });
  container.append(root);
  sync();
  return () => {
    unsubscribe();
    if (activeToolbar === root) activeToolbar = null;
    container.removeEventListener("pointerdown", activate);
    container.removeEventListener("focusin", activate);
    document.removeEventListener("keydown", onKeyDown);
    root.remove();
  };
}
