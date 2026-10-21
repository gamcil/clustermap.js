import { csvParseRows, tsvParseRows, csvFormatRows } from "d3-dsv";

/** Shared CSV/TSV/JSON boundary for creation and replacement. */
export function parseAnnotationTable(text, categorical = false) {
  const raw = text.trim();
  if (raw.startsWith("{")) {
    const { columns, values } = JSON.parse(raw);
    return { columns, values };
  }
  let parse = csvParseRows;
  for (const token of raw.matchAll(/"(?:[^"]|"")*"|([,\t\r\n])/g)) {
    if (token[1]) { parse = token[1] === "\t" ? tsvParseRows : csvParseRows; break; }
  }
  const rows = parse(raw);
  if (rows.length < 2 || rows[0].length < 2) throw new Error("Include a header and at least one cluster row.");
  const columns = rows.shift().slice(1).map((label) => label.trim()), values = Object.create(null);
  for (const row of rows) {
    if (row.every((cell) => !cell.trim())) continue;
    const uid = row[0].trim();
    if (Object.hasOwn(values, uid)) throw new Error(`Duplicate cluster ID '${uid}'.`);
    if (row.length > columns.length + 1) throw new Error(`Too many values for '${uid}'.`);
    values[uid] = columns.map((_, index) => {
      const value = (row[index + 1] ?? "").trim();
      if (!value) return null;
      if (categorical) return value;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new Error(`Expected a numeric value for '${uid}'.`);
      return numeric;
    });
  }
  return { columns, values };
}

export function annotationTableText(panel, clusters) {
  return csvFormatRows([["cluster", ...panel.columns], ...clusters.map((cluster) =>
    [cluster.uid, ...(panel.values[cluster.uid] ?? panel.columns.map(() => null))])]);
}

export function mapAnnotationValues(values, map) {
  return Object.fromEntries(Object.entries(values).map(([uid, row]) => [uid, row.map(map)]));
}
