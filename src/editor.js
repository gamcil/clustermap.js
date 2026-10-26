export { mountPlotSelectionToolbar } from "./editor/plotSelectionToolbar.js";

import { defineClinkerEditor } from "./editor/element.js";
if (globalThis.customElements) defineClinkerEditor();
