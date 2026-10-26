import { textAsset, installStyle } from "./assets.mjs";
import { resolveTheme, applyUiAppearance, uiAppearanceStyles } from "./appearance.mjs";
import { lightControlStyles } from "./controlStyles.mjs";

export { resolveTheme } from "./appearance.mjs";

const css = uiAppearanceStyles(":where(.cm-chart,.cm-ui)") + lightControlStyles +
  await textAsset(new URL("./plot.css", import.meta.url));

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
export function applyTheme(element, mode = "auto") {
  if (!element) return;
  element.classList.add("cm-chart");
  element.dataset.clustermapTheme = resolveTheme(mode).mode;
  applyUiAppearance(element, mode);
  installStyle(element.getRootNode(), "clustermap-theme-style", css);
}
