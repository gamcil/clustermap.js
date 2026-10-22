import { resolveTheme } from "../../ui/theme.mjs";

export const editorThemeStyles = `
:host {
  ${Object.entries(resolveTheme("light")).filter(([key]) => key !== "mode").map(([key, fallback]) =>
    `--cm-${key}:var(--clinker-${key},var(--cm-theme-${key},${fallback}));`).join("\n  ")}
  color:var(--cm-foreground); background:var(--cm-surface);
  font:var(--clinker-font,13px/1.4 system-ui,sans-serif);
}
`;

export function applyEditorTheme(element, config) {
  const theme = resolveTheme(config?.plot?.theme);
  element.dataset.clustermapTheme = theme.mode;
  element.style.colorScheme = theme.mode;
  for (const [key, value] of Object.entries(theme)) if (key !== "mode") element.style.setProperty(`--cm-theme-${key}`, value);
}
