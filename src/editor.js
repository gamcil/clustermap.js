export { ClinkerEditorElement, defineClinkerEditor } from "./editor/element.js";
export { ClinkerDataPanelElement, defineDataPanel } from "./editor/components/data-panel/data-panel.js";
export { ClinkerAppearancePanelElement, defineAppearancePanel } from "./editor/components/appearance-panel/appearance-panel.js";
export { mountPlotSelectionToolbar } from "./editor/plotSelectionToolbar.js";

import { defineClinkerEditor } from "./editor/element.js";
if (globalThis.customElements) defineClinkerEditor();
