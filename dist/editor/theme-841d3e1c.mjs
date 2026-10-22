const palettes = {
  light: { mode: "light", background: "#ffffff", foreground: "#20252c", muted: "#687586",
    branch: "#555555", guide: "#999999", outline: "#111111", surface: "#ffffff", border: "#cbd3de", missing: "#eeeeee", subtle: "#f3f6fa", hover: "#e3ecf8", selection: "#d6e6fc", accent: "#1677ff", danger: "#b42318" },
  dark: { mode: "dark", background: "#171b22", foreground: "#e5eaf1", muted: "#a0adbd",
    branch: "#bac4d1", guide: "#748193", outline: "#c9d2df", surface: "#232a35", border: "#465365", missing: "#39414e", subtle: "#293241", hover: "#354660", selection: "#3a5276", accent: "#85b7ff", danger: "#ffaaa3" },
};

function resolveTheme(mode = "auto") {
  const dark = mode === "dark" || mode === "auto" && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return palettes[dark ? "dark" : "light"];
}

/** Figure colours are independent of the interface/system theme. */
function figureConfig(config) {
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

const editorThemeStyles = `
:host {
  ${Object.entries(resolveTheme("light")).filter(([key]) => key !== "mode").map(([key, fallback]) =>
    `--cm-${key}:var(--clinker-${key},var(--cm-theme-${key},${fallback}));`).join("\n  ")}
  color:var(--cm-foreground); background:var(--cm-surface);
  font:var(--clinker-font,13px/1.4 system-ui,sans-serif);
}
:host([hidden]) { display:none!important; }
`;

function applyEditorTheme(element, config) {
  const theme = resolveTheme(config?.plot?.theme);
  element.dataset.clustermapTheme = theme.mode;
  element.style.colorScheme = theme.mode;
  for (const [key, value] of Object.entries(theme)) if (key !== "mode") element.style.setProperty(`--cm-theme-${key}`, value);
}

export { applyEditorTheme as a, editorThemeStyles as e, figureConfig as f };
