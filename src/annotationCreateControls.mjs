import { csvParseRows, tsvParseRows, csvFormatRows } from "d3-dsv";

// Detect the header separator outside quoted fields. Tabs inside a CSV value
// must not turn the entire table into TSV.
function parseTable(text) {
  for (const token of text.matchAll(/"(?:[^"]|"")*"|([,\t\r\n])/g)) {
    if (token[1]) return (token[1] === "\t" ? tsvParseRows : csvParseRows)(text);
  }
  return csvParseRows(text);
}

/** Small data-entry form; panel validation and history remain in the patch API. */
export function createAnnotationCreateControls({ document, getClusters, getPanels, patch, onCreate, annotationApi }) {
  const { validateAnnotationPanels } = annotationApi;
  const node = document.createElement("form");
  const field = (title, tag) => {
    const label = document.createElement("label"), caption = document.createElement("span");
    caption.textContent = title;
    const input = document.createElement(tag); label.append(caption, input); node.append(label);
    return input;
  };
  const options = (select, entries) => {
    for (const [value, label] of entries) {
      const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option);
    }
  };
  const type = field("Type", "select");
  options(type, [["heatmap", "Heatmap"], ["bar", "Bar chart"]]);
  const title = field("Title", "input"); title.type = "text";
  const scale = field("Values", "select");
  options(scale, [["continuous", "Numeric"], ["categorical", "Categories"]]);
  type.onchange = () => { scale.disabled = type.value === "bar"; if (scale.disabled) scale.value = "continuous"; };
  const help = document.createElement("p");
  help.textContent = "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
  node.append(help);
  const data = field("Data", "textarea"); data.rows = 8; data.spellcheck = false;
  data.parentElement.className = "cm-annotation-data";
  data.value = csvFormatRows([["cluster", "Value"], ...getClusters().map((cluster) => [cluster.uid, ""])]);
  const error = document.createElement("p"); error.dataset.annotationError = ""; error.setAttribute("role", "alert"); node.append(error);
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Add panel"; node.append(submit);
  node.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    try {
      const raw = data.value.trim();
      let columns, values;
      if (raw.startsWith("{")) ({ columns, values } = JSON.parse(raw));
      else {
        const rows = parseTable(raw);
        if (rows.length < 2 || rows[0].length < 2) throw new Error("Include a header and at least one cluster row.");
        columns = rows.shift().slice(1).map((label) => label.trim());
        values = Object.create(null);
        for (const row of rows) {
          if (row.every((cell) => !cell.trim())) continue;
          const uid = row[0].trim();
          if (Object.hasOwn(values, uid)) throw new Error(`Duplicate cluster ID '${uid}'.`);
          if (row.length > columns.length + 1) throw new Error(`Too many values for '${uid}'.`);
          values[uid] = columns.map((_, index) => {
            const value = (row[index + 1] ?? "").trim();
            if (!value) return null;
            if (scale.value === "categorical") return value;
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) throw new Error(`Expected a numeric value for '${uid}'.`);
            return numeric;
          });
        }
      }
      const ids = new Set(getPanels().map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type.value}-${serial}`)) serial++;
      const panel = { uid: `${type.value}-${serial}`, type: type.value,
        title: title.value.trim() || (type.value === "bar" ? "Bar chart" : "Heatmap"),
        columns, values, scale: { type: scale.value } };
      validateAnnotationPanels([panel], getClusters());
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    } catch (exception) { error.textContent = exception.message; }
  };
  return { node };
}
