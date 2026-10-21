import { APPEARANCE_FIELDS } from "./appearanceFields.mjs";
import { createControls, colourHex } from "../uiControls.mjs";
import { createTreeControls } from "../treeControls.mjs";

/** Build native fields once; synchronize values and filtering without losing focus. */
export function createAppearanceControls({ document, patch, preview, rotate }) {
  const ui = createControls(document), node = ui.el("div", undefined, null, "cm-editor__appearance-grid");
  const sections = new Map(), fields = [];
  for (const [name, path, label, type, options, advanced] of APPEARANCE_FIELDS) {
    let section = sections.get(name);
    if (!section) {
      const box = ui.el("fieldset", undefined, node); ui.el("legend", name, box);
      section = { box, key: name.toLowerCase().replaceAll(/\W+/g, "-"), details: null, fields: [] }; sections.set(name, section);
    }
    if (advanced && !section.details) {
      section.details = ui.el("details", undefined, section.box); section.details.dataset.appearanceSection = section.key;
      ui.el("summary", "Advanced", section.details);
    }
    const row = ui.row(advanced ? section.details : section.box, label);
    // Some sections interleave general and advanced entries; keep disclosure last.
    if (!advanced && section.details) section.box.insertBefore(row, section.details);
    const control = type === "select" ? ui.select(row, label, "", options)
      : ui.input(row, label, "", type === "colour" ? "color" : type);
    control.dataset.config = path;
    const field = { row, control, path, type, advanced, search: `${name} ${label} ${path}`.toLowerCase() };
    fields.push(field); section.fields.push(field);
  }
  const empty = ui.el("p", "", node, "cm-editor__empty"), treeHost = ui.el("div", undefined, node, "cm-editor__appearance-tree");
  let treeState = null;
  return { node, update({ config, tree, filter, expanded }) {
    for (const field of fields) {
      const { control, path, type } = field;
      const value = path.split(".").reduce((current, key) => current?.[key], config);
      if (type === "checkbox") control.checked = Boolean(value);
      else if (control !== document.activeElement) control.value = type === "colour" ? colourHex(value) : value ?? "";
      const bound = path === "colourBar.domain.min" ? "min" : path === "colourBar.domain.max" ? "max" : null;
      control.disabled = Boolean(bound && config.colourBar.domain[`${bound}Mode`] === "data");
      field.row.hidden = Boolean(filter && !field.search.includes(filter));
    }
    let visible = 0;
    for (const section of sections.values()) {
      section.box.hidden = section.fields.every((field) => field.row.hidden);
      if (!section.box.hidden) visible++;
      if (section.details) {
        section.details.hidden = !section.fields.some((field) => field.advanced && !field.row.hidden);
        section.details.open = Boolean(filter) || expanded.has(section.key);
      }
    }
    empty.hidden = visible > 0; empty.textContent = `No appearance settings match “${filter}”.`;
    treeHost.hidden = !tree || Boolean(filter && !/tree|clade|colour|color|annotation|branch|cut|palette/.test(filter));
    const treeKey = JSON.stringify(config.tree);
    if (!treeHost.hidden && (treeState?.tree !== tree || treeState?.config !== treeKey)) {
      treeHost.replaceChildren(createTreeControls({ tree, config: config.tree, patch, preview, rotate, document }));
      treeState = { tree, config: treeKey };
    }
  } };
}
