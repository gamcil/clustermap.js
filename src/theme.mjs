const palettes = {
  light: { mode: "light", background: "#ffffff", foreground: "#20252c", muted: "#687586",
    branch: "#555555", guide: "#999999", outline: "#111111", surface: "#ffffff", border: "#cbd3de", missing: "#eeeeee", subtle: "#f3f6fa", hover: "#e3ecf8", selection: "#d6e6fc", accent: "#1677ff", danger: "#b42318" },
  dark: { mode: "dark", background: "#171b22", foreground: "#e5eaf1", muted: "#a0adbd",
    branch: "#bac4d1", guide: "#748193", outline: "#c9d2df", surface: "#232a35", border: "#465365", missing: "#39414e", subtle: "#293241", hover: "#354660", selection: "#3a5276", accent: "#85b7ff", danger: "#ffaaa3" },
};

export function resolveTheme(mode = "auto") {
  const dark = mode === "dark" || mode === "auto" && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return palettes[dark ? "dark" : "light"];
}

/** Figure colours are independent of the interface/system theme. */
export function figureConfig(config) {
  if (config.figureStyle) return config;
  const theme = { background: config.plot?.background ?? "#ffffff", foreground: "#000000",
    outline: "#000000", branch: "#555555", guide: "#999999",
    muted: "#687586", missing: "#eeeeee" };
  return { ...config, figureStyle: theme,
    tree: { ...config.tree, textColour: theme.foreground,
      branch: { ...config.tree?.branch, colour: config.tree?.branch?.colour ?? theme.branch },
      leafGuide: { ...config.tree?.leafGuide, colour: config.tree?.leafGuide?.colour ?? theme.guide } },
    gene: { ...config.gene, shape: { ...config.gene?.shape, stroke: config.gene?.shape?.stroke ?? theme.outline } },
    locus: { ...config.locus, trackBar: { ...config.locus?.trackBar, colour: config.locus?.trackBar?.colour ?? theme.outline } },
    scaleBar: { ...config.scaleBar, colour: config.scaleBar?.colour ?? theme.foreground },
  };
}

/** Scoped CSS keeps multiple independently themed charts on one page possible. */
export function applyTheme(element, theme) {
  if (!element) return;
  element.dataset.clustermapTheme = theme.mode;
  element.style.colorScheme = theme.mode;
  for (const [key, value] of Object.entries(theme)) if (key !== "mode") element.style.setProperty(`--cm-${key}`, value);
  const doc = element.ownerDocument;
  if (doc.getElementById("clustermap-theme-style")) return;
  const style = doc.createElement("style"); style.id = "clustermap-theme-style";
  style.textContent = `
[data-clustermap-theme] { color:var(--cm-foreground); background:var(--cm-background); }
[data-clustermap-theme] :is(.tooltip,.cm-annotation-menu,.cm-annotation-hidden,.annotation-tooltip) { color:var(--cm-foreground)!important; background:var(--cm-surface)!important; border-color:var(--cm-border)!important; }
[data-clustermap-theme] :is(button,select,input:not([type=color]):not([type=checkbox]),textarea):not(.cm-data-ui *) { color:var(--cm-foreground)!important; background:var(--cm-surface)!important; border-color:var(--cm-border)!important; }
[data-clustermap-theme] button:hover:not(.cm-data-ui *) { background:var(--cm-hover)!important; }
[data-clustermap-theme] button:disabled { opacity:.45; }
:is(clinker-editor,clinker-data-panel)[data-clustermap-theme] { background:var(--cm-surface); color:var(--cm-foreground); border-color:var(--cm-border); }
[data-clustermap-theme] .cm-annotation-menu :is(p,summary) { color:var(--cm-muted); }
[data-clustermap-theme] :is(svg.clusterMap,canvas.clusterMapCanvas,canvas.clusterMapWebGpuOverlay) { position:relative; z-index:1; background:transparent; color-scheme:light; }
[data-clustermap-theme] .clusterMapFigureSurface { z-index:0; box-shadow:0 2px 12px rgba(0,0,0,.2); outline:1px solid var(--cm-border); }
[data-clustermap-theme] .clusterMapFigureDimensions { z-index:2; color:var(--cm-muted); font:12px/20px system-ui,sans-serif; white-space:nowrap; }
[data-clustermap-theme] canvas.clusterMapMinimap { color-scheme:light; }
`;
  doc.head.append(style);
}
