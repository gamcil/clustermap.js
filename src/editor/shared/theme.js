import { applyUiAppearance, uiAppearanceStyles } from "../../ui/appearance.mjs";

// Nested controls inherit public overrides and the enclosing editor's explicit
// appearance. Each panel also works independently with complete system defaults.
export const editorThemeStyles = uiAppearanceStyles(":host") + `
:host { background:var(--cm-surface,var(--_cm-surface)); }
`;

export function applyEditorTheme(element, chart) {
  applyUiAppearance(element, chart ? chart.uiAppearance() : "auto");
}
