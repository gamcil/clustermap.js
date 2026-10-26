# Annotation panels

Optional top-level `annotationPanels` defines data displayed to the right of
the gene clusters. The array order is the left-to-right panel order. Supported
types are `heatmap` (continuous or categorical colours), `bar` (horizontal
numeric bars), and `groups` (labelled vertical bars spanning cluster rows).

Panels are disabled by default. Enable them with:

```js
chart.config({ annotations: { enabled: true } });
```

The global Appearance panel also has an **Enable annotation panels** checkbox.
Panel-specific settings stay in the individual panel menus. Disabling the
feature hides its geometry, keys, tooltips and editing affordances, including
the add-panel slot. It does not delete definitions or history: data exports
retain the panels, and project exports retain the feature flag. Static SVG
export follows the flag. Data containing annotation panels does not implicitly
enable them. The `heatmap` and `heatmap-project` demo URLs opt in explicitly.

```json
{
  "clusters": ["... existing cluster objects ..."],
  "links": [],
  "groups": [],
  "annotationPanels": [
    {
      "uid": "expression",
      "type": "heatmap",
      "title": "Expression",
      "columns": ["Control", "Treatment"],
      "values": {
        "cluster-a": [0.2, 0.8],
        "cluster-b": [0.6, null]
      },
      "scale": {
        "type": "continuous",
        "domain": [0, 1],
        "colours": ["#f7fbff", "#08306b"]
      }
    }
  ]
}
```

The example's `clusters` entry is a placeholder: use ordinary cluster objects
whose `uid` fields match the keys in `values`.

## Panel fields

`columns`, `values` and scale fields apply to heatmaps and bars. Group-marker
fields are described [below](#group-markers).

| Field | Meaning | Default |
| --- | --- | --- |
| `uid` | Unique, non-empty panel ID | Required |
| `type` | `"heatmap"`, `"bar"` or `"groups"` | Required |
| `show` | Whether the panel is drawn and reserves space | `true` |
| `title` | Panel heading; an empty string hides it | `uid` |
| `columns` | Unique, non-empty column labels; exactly one for bars | Required |
| `values` | Cluster ID to array of values, in column order | Required |
| `scale.type` | `"continuous"` or `"categorical"` | `"continuous"` |
| `scale.domain` | `[min, max]` or ordered category strings | Inferred from values |
| `scale.colours` | Array of CSS colours | Blue ramp or qualitative palette |
| `missingColour` | Cell colour for `null` or an omitted cluster row | `"#eeeeee"` |
| `cellWidth` | Heatmap column width in chart/world units | `32` |
| `cellHeight` | Heatmap cell or bar height in chart/world units | `20` |
| `width` | Total bar panel width in chart/world units | `120` |
| `colour` | Bar fill colour | `"#267c9e"` |
| `cellGap` | Heatmap space between columns; also insets cells vertically | `0` |
| `cellBorderWidth` | Inset cell border width in chart/world units | `0` |
| `cellBorderColour` | Cell border CSS colour | `"#ffffff"` |
| `gap` | Distance from the preceding panel's grid edge, in chart/world units | `24` |
| `fontSize` | Heading/key text size in chart/world units | `10` |
| `headingRotation` | Column heading rotation, from -90 to 0 degrees | Heatmap `-60`; bar `0` |
| `showColumnLabels` | Whether column headings are drawn | `true` |
| `showKey` | Whether the heatmap colour key or bar numeric axis is drawn | `true` |

The chart's `plot.fontFamily` applies to panels. Sizes follow chart pan/zoom.
Every panel defaults to the same `gap` (24 world units). Automatic placement
reserves the complete measured horizontal footprint: cells/bars, keys, group
labels, titles, rotated headings and legend or axis text. The first footprint
starts that distance after the full cluster area, including visible scale/identity
bars and a bottom legend. Each following footprint starts `gap` units after the
preceding footprint's right edge. Left text overhang is reserved as well; the
data-mark origin may therefore sit to the right of the footprint's left edge.

This spacing never stretches data marks: heatmap width remains column count
times `cellWidth`, and bar width remains `width`. Hidden panels reserve no space.
Panel order follows the array; there is no manual overlapping placement mode.
Figure bounds, the right-side gene legend, minimap and panel hover frames use
the same full footprint. Cell tooltips continue to target actual cells.
Label, style and font changes remeasure the footprint, including when browser
fonts finish loading; unchanged panels retain cached geometry.

Cell gaps are inset equally on both sides of each cell. `cellWidth` remains the
column pitch, and cluster rows keep their existing centers; changing `cellGap`
does not move headings or change panel alignment. `cellGap` must be non-negative
and smaller than both cell dimensions. A zero gap gives touching columns.

Borders are optional and drawn entirely inside heatmap cells or bars. Their
width is capped at half the smaller visible mark dimension. They
do not change cell size, panel bounds or spacing. All renderers use the same
fill/border rectangle primitives; WebGPU retains them as GPU instances. Colour
keys are unaffected. For example, add `"cellBorderWidth": 0.5`,
`"cellBorderColour": "#ffffff"`, and optionally `"cellGap": 1` to a panel.

Each row array must contain exactly one value per column. Omit a cluster key
to leave its whole row missing; use `null` for an individual missing value.
Unknown cluster IDs and malformed values are rejected when loading data.

Continuous values must be finite JSON numbers. One colour scale is shared by
all columns in a panel; use separate panels for different units or domains.
Values outside an explicit domain are clamped to its endpoint colours. With
more than two colours, stops are evenly spaced across the domain. An inferred
constant domain is expanded by 0.5 on either side; all-missing data uses [0, 1].

Categorical values must be strings. For example:

```json
{
  "uid": "habitat",
  "type": "heatmap",
  "columns": ["Habitat"],
  "values": {
    "cluster-a": ["Soil"],
    "cluster-b": ["Marine"]
  },
  "scale": {
    "type": "categorical",
    "domain": ["Soil", "Marine"],
    "colours": ["#228833", "#4477aa"]
  }
}
```

Inferred category order follows first occurrence in `values`, independently of
the displayed row order. An explicit category domain must contain every
non-missing value. Colours cycle if there are more categories than colours;
provide a full palette when each category needs a distinct colour.

## Horizontal bars

Bar panels use the same cluster-keyed row arrays, with exactly one numeric
column. Each row draws one horizontal bar on a common linear scale:

```json
{
  "uid": "abundance",
  "type": "bar",
  "title": "Abundance",
  "columns": ["Relative abundance (%)"],
  "values": {
    "cluster-a": [80],
    "cluster-b": [20],
    "cluster-c": [null]
  },
  "width": 120,
  "colour": "#267c9e",
  "scale": { "domain": [0, 100] }
}
```

- Positive values extend right from zero; negative values extend left. Inferred
  domains include zero. Explicit domains must also include zero, and values
  outside them are clamped, while tooltips retain the original values.
- Empty/all-zero data uses domain [0, 1]. Null or omitted rows show a small
  marker in `missingColour`; zero values show only the baseline.
- `width` sets the complete numeric range's width. `cellHeight` sets bar height,
  aligned on the same row centers as heatmaps and clusters. `cellWidth` and
  `cellGap` apply only to heatmaps.
- `showKey` toggles the numeric axis below the bars. Axis ticks, bars and missing
  markers are shared rectangle geometry, including in WebGPU and SVG export.
- The Edit menu offers panel width, bar height, fill colour, borders, automatic
  or custom numeric bounds, and axis visibility. Heading rotation defaults to
  zero for bars. `showColumnLabels: false` avoids a redundant column heading
  when the title already describes the measurement.
- This first bar type has one value per cluster; grouped and stacked series
  are not supported. Add separate bar panels for different measurements.

## Behaviour

- Membership and values use cluster IDs. Panels stay aligned with cluster rows
  during reordering and tree rotations; locus movement preserves column alignment.
- Panels start after the cluster area, including trim indicators, scales and a
  bottom legend. A right-positioned gene legend follows the panels.
- Visible panels share title, heading and key baselines, reserving enough space
  for the tallest heading/key. Cell heights may be styled separately.
- Titles, rotated headings and keys contribute to figure bounds and SVG export.
  Editing borders, buttons, menus and tooltips are excluded.
- Hover a panel for its **Edit** menu or a cell for its original value. Controls
  update immediately. Escape, the close button or clicking outside dismisses menus.
- Use **+** after the last panel to add a panel. Hidden panels remain accessible
  through **Hidden panels** and **Data → Annotations**.

## Editing and history

Panel menus use the ordinary undoable data-operation API. For example:

```js
chart.patch([{ type: "annotationPanels.create", panel: {
  uid: "counts", type: "bar", title: "Counts", columns: ["Count"],
  values: { "cluster-a": [12] },
} }]); // Optional index inserts at a particular position; default is append.
chart.patch([{ type: "annotationPanels.reorder", ids: ["counts", "expression"] }]);
// reorder requires every current panel UID exactly once.
chart.patch([{ type: "annotationPanels.delete", ids: ["counts"] }]);
```

Creation and deletion retain a complete panel definition for undo; ordinary
styling edits retain only presentation fields. Structural and styling operations
can be combined in one batch, validated before any live changes are made.

```js
chart.patch([{
  type: "annotationPanels.update",
  ids: ["expression"],
  changes: {
    cellWidth: 40,
    headingRotation: -45,
    scale: { type: "continuous", domain: [0, 2], colours: ["#ffffff", "#2166ac"] },
  },
}]);
```

For inline or batch value edits, replace only the affected rows. Undo retains those
rows; unchanged rows are shared. A `null` row removes its entry (missing data).

```js
chart.patch([{ type: "annotationPanels.updateRows", uid: "expression",
  values: { "cluster-a": [0.2, 0.8], "cluster-b": null },
}]);
```

Updates accept the panel fields except `uid` and `type`, including `values`
and group-marker definitions. `scale` replaces the complete scale: omit `domain`
to restore inferred bounds. Column labels must remain unique and non-empty,
and each row array must match the column count. Send dependent columns, values
and category-domain changes in one batch. Style-only undo shares the existing
matrix; project and data exports include current definitions.

## Demos

- `?fixture=heatmap`: numeric and categorical heatmaps, signed bars, missing/zero
  values and a small tree.
- `?fixture=heatmap-project`: 50 clusters with a saved layout, synthetic response
  values, source gene counts and gene-group presence. Open the same fixture via
  **Load project…** using `fixtures/clinker-project-heatmap.json`.
- `?fixture=group-markers`: nested clades and an explicit non-contiguous group.

Add `&renderer=svg`, `canvas` or `webgpu` to choose a renderer. Synthetic values
and tree distances are illustrative, not biological measurements.

## Group markers

A `groups` panel shares the positioning, visibility, editing and ordering of
other annotation panels. It does not need `columns`, `values` or a colour scale.
Try `?fixture=group-markers&renderer=webgpu` (or `canvas` / `svg`).

```json
{
  "uid": "taxonomy",
  "type": "groups",
  "title": "Clades",
  "groups": [
    { "uid": "genus", "label": "Example genus", "nodeUid": "ingroup", "colour": "#7547a8" },
    { "uid": "isolates", "label": "Clinical", "clusterIds": ["a", "c"], "colour": "#228833" }
  ]
}
```

Each group requires a unique `uid` within its panel and exactly one of:

- `nodeUid`: a node in the loaded tree; its descendant clusters define membership.
- `clusterIds`: a non-empty list of unique cluster IDs, also usable without a tree.

`label` defaults to the group UID; an empty string hides it. `colour` defaults to
the panel's `colour`, then `#267c9e`. Membership follows cluster IDs during
reordering. Groups with separated rows produce separate labelled segments;
unselected intervening rows are never included. Overlapping/nested groups use
separate lanes, allocated in group definition order. Disjoint groups share a
lane. Labels are vertically centred beside each segment.

Common `show`, `title`, `gap`, `fontSize` and `cellHeight` fields apply.
`markerWidth` controls bar thickness (default 3); `laneGap` controls the gap
between lanes (default 12). Width is computed from lanes and label lengths.
`cellHeight` controls the padding about each segment's first and last row
centres. Scale/key and column-heading fields are unused.

Use the existing **+** slot and choose **Group markers** to add a definition as
JSON. The panel's **Edit** menu changes labels, colours, memberships, thickness
and spacing directly, with undo/redo. Move-left/right, hide and remove actions
work as for other panels. Group bars use WebGPU rectangles in the GPU renderer;
text follows the existing text overlay. SVG exports include both.

## Editing annotation data

**Data → Annotations** in the optional plot editor manages every annotation
panel, including hidden panels. The in-plot menu keeps quick styling controls
(title, colours, range and legend); sizes, borders and label formatting are
under **Advanced**. **Edit data…** opens the selected panel in the Data editor.
When no editor handles that action, the same data editor opens in the plot menu.

The editor supports numeric/categorical matrices, category and column management,
CSV/TSV or JSON replacement, group-marker membership, and panel ordering/visibility.
Replacement tables use cluster IDs in the first column and data headings in the
remaining columns. Blank cells are missing; omitted clusters are allowed. Bars
keep exactly one column, heatmaps at least one, and marker panels at least one group.

Renaming categories updates their assignments. Removing one offers replacement
with another category or missing values. Matrix rows support search, checkbox
and Shift selection, including all filtered rows. Batch actions set or clear one
column or all columns in one undoable edit. Selection survives scrolling and
filtering and resets when changing panels. Enter commits; Escape cancels an
inline edit. All data changes are undoable.

Changes to matrix data use the same atomic patch API as presentation edits:

```js
chart.patch([{
  type: "annotationPanels.update",
  ids: ["expression"],
  changes: {
    columns: ["Control", "Treatment"],
    values: { "cluster-a": [0.2, 0.8], "cluster-b": [0.6, null] }
  }
}]);
```

Hosts can open an editor directly with `editor.editAnnotations(panelUid)`.
The plot emits the cancelable, bubbling DOM event `clustermap:edit-annotation`
with `detail: {chart, panelUid}`. Hosts can handle this event, call
`preventDefault()` to suppress the inline fallback, and route it to
`editor.editAnnotations(event.detail.panelUid)`. Editors do not discover plots
or attach document-wide annotation listeners.
The editor emits `clinker-editor-open` when opened this way, so host buttons
can update their expanded state.
