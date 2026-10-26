// UI appearance is separate from figure colours and persisted chart settings.
export const uiPalettes = {
  light: { background: "#ffffff", surface: "#ffffff", subtle: "#f3f6fa", hover: "#e3ecf8",
    foreground: "#20252c", muted: "#687586", border: "#cbd3de", accent: "#1677ff",
    "focus-ring": "#1677ff", selection: "#d6e6fc", danger: "#b42318" },
  dark: { background: "#171b22", surface: "#232a35", subtle: "#293241", hover: "#354660",
    foreground: "#e5eaf1", muted: "#a0adbd", border: "#465365", accent: "#85b7ff",
    "focus-ring": "#85b7ff", selection: "#3a5276", danger: "#ffaaa3" },
};

export function validateUiAppearance(mode) {
  if (!["auto", "light", "dark"].includes(mode)) throw new TypeError("UI appearance must be auto, light or dark.");
  return mode;
}

export function resolveTheme(mode = "auto") {
  const dark = mode === "dark" || mode === "auto" && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return { mode: dark ? "dark" : "light", ...uiPalettes[dark ? "dark" : "light"] };
}

/** Only private defaults are declared here: inherited public tokens always win. */
export function uiAppearanceStyles(scope) {
  const attribute = (mode) => scope === ":host" ? `:host([appearance=${mode}])` : `${scope}[appearance=${mode}]`;
  return `
${scope} {
  ${Object.entries(uiPalettes.light).map(([key, light]) => `--_cm-${key}:light-dark(${light},${uiPalettes.dark[key]});`).join("\n  ")}
  --_cm-font:13px/1.4 system-ui,sans-serif;
  color-scheme:var(--_cm-ui-scheme,var(--_cm-chart-scheme,light dark));
  color:var(--cm-foreground,var(--_cm-foreground));
  font:var(--cm-font,var(--_cm-font));
}
${attribute("light")} { --_cm-ui-scheme:light; }
${attribute("dark")} { --_cm-ui-scheme:dark; }
${attribute("auto")} { --_cm-ui-scheme:light dark; }
`;
}

export function applyUiAppearance(element, mode = "auto") {
  validateUiAppearance(mode);
  // Keep auto responsive through CSS, including disconnected standalone panels.
  element.style.setProperty("--_cm-chart-scheme", mode === "auto" ? "light dark" : mode);
}
