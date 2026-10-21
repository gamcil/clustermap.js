# Annotation panels

Optional top-level `annotationPanels` defines data displayed to the right of
the gene clusters. The array order is the left-to-right panel order. Supported
types are `heatmap` (continuous or categorical colours), `bar` (horizontal
numeric bars), and `groups` (labelled vertical bars spanning cluster rows).

This is an optional supporting view for gene-cluster metadata, disabled by
default. The supported scope is heatmaps, categorical strips and horizontal
bars, plus group markers; statistical chart types are outside the current feature scope.

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
Every panel defaults to the same `gap` (24 world units). The first panel starts
that distance after the full cluster area, including visible scale/identity
bars and a bottom legend; each following visible panel starts at
`previous.x + previous.width + gap`, where width is the column count times
`cellWidth` for heatmaps, or `width` for bars. Hidden panels reserve no space. Titles, heading lengths, colour-key
labels and font sizes do not add implicit padding between panels. Text overhang
is still included in figure bounds and right-side gene legend placement.

Cell gaps are inset equally on both sides of each cell. `cellWidth` remains the
column pitch, and cluster rows keep their existing centers; changing the gap
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

## Behaviour and scope

- Values attach to **cluster IDs**, rather than row indices or locus IDs.
- Cells are centered on each cluster's gene track and follow row drag/reorder
  previews and tree rotations. Horizontal locus movement changes panel anchoring,
  while preserving the common column alignment across rows.
- Panels start after the greater of the locus/trim-indicator extent and the
  right edges of the cluster area's visible scales and bottom legend. Locus
  drag previews respect the same boundary, so dragging a short cluster left
  cannot pull annotations over the identity bar. A right-positioned gene legend
  is placed after the panels and is excluded from their placement boundary.
- Visible panels share title, column-heading and colour-key baselines. Their
  hover borders use the same top and bottom extents, reserving space for the
  tallest heading/key across all visible panels. Cell centers stay aligned with
  the cluster rows; individual cell heights can still be styled separately.
- Shared header spacing uses measured glyph bounds, including heading rotation,
  with a 6-unit gap between the column headings and the panel-title band.
- Column headings, panel titles and colour keys are included in figure bounds
  and static SVG export. Data and project exports retain the panel definitions.
- SVG draws panel primitives directly. Canvas draws cells, keys and text with
  Canvas 2D. WebGPU draws cells and colour keys as instanced GPU rectangles,
  with only panel text on its Canvas overlay. Cell instances share cluster row
  transforms and remain retained during pan, zoom and drag previews.
- Hover an annotation panel (including its headings, colour key or space between
  rows) to show its padded border and **Edit** button above the panel. The button opens a compact menu
  for that panel. Controls update the plot without an Apply button, and the menu
  stays open while editing. Text fields commit on change, matching other label
  editors; numeric and colour controls update on input. Click outside, use the
  close button or press Escape to dismiss it.
- Hover the empty slot to the right of the figure to reveal **+**, including
  when no panels exist yet. Choose Heatmap or Bar chart, enter a title and paste
  CSV/TSV with a header: first column is the cluster UID, remaining columns are
  the data headings. Blank cells are missing; omitted cluster rows are allowed.
  Heatmaps accept numeric or categorical values; bars need one numeric column.
  Alternatively paste JSON containing `columns` and `values` in the same format
  as a panel definition. A starter table lists the current cluster IDs.
- Each Edit menu includes **Move left**, **Move right** and **Remove**. These
  actions and panel creation support undo/redo and persist in data/project exports.
- Panel-specific settings are not in the global Appearance panel. When panels
  are hidden, a **Hidden panels** button in the plot provides access to their
  settings so they can be shown again. Borders, buttons and menus are interface
  elements and do not appear in SVG exports or affect figure bounds.
- Hovering a cell shows the panel, cluster, column and original value (`Missing`
  for null/omitted values). Hit testing uses the same projected cells in SVG,
  Canvas and WebGPU. Tooltips are HTML and are excluded from SVG export.
- Arbitrary chart callbacks and external plotting adapters are not provided yet.

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

Supported changes are the presentation fields in the table, including `columns`,
but excluding `uid`, `type`, and `values`. `scale` replaces the complete scale
definition: omit `domain` to restore automatic bounds. Column label edits must
preserve the row-array lengths and unique, non-empty labels. Batches are
validated before changing live data. Undo/redo stores presentation snapshots,
sharing the original value data rather than copying the matrix into history.
The internal `annotationPanels.replaceStyle` operation restores exact optional
field presence during undo/redo. Data/project exports include current styles.

Choose a preset palette or edit individual colour stops/category colours.
The editor offers inferred or custom continuous domains; categorical domains
continue to follow the JSON definition or inferred category order.

## Demo

Load `?fixture=heatmap&renderer=canvas`, `&renderer=webgpu`, or `&renderer=svg`.
The fixture includes continuous and categorical heatmaps, positive and signed
bar panels, missing/zero values, and a bifurcating tree for trying row rotations.

For a larger, real-data example, load `?fixture=heatmap-project`. This uses
`fixtures/clinker-project-heatmap.json`, based on `clinker-project(3).json`, with
50 clusters, 6,838 homology links and the original tree, settings and saved
layout. Its three panels show:

- **Synthetic response:** four deterministic illustrative columns on a shared
  [-2, 2] scale. These are generated test values, not biological measurements.
  Selected cells and the last cluster's entire row are deliberately missing.
- **Gene count:** a bar panel showing the number of genes in each source cluster,
  with an inferred domain that includes zero.
  Counts describe the source data, including genes hidden by saved trimming.
- **Gene group presence:** presence/absence of the first six source gene groups
  in each cluster, derived from the actual group membership.

Heatmaps in both demo fixtures use the shared default cell dimensions
(32 × 20 world units). Bars use the default panel width of 120 and height of 20.

It defaults to the project's WebGPU renderer. Use
`?fixture=heatmap-project&renderer=canvas` or `&renderer=svg` to compare backends.
The file can also be opened using **Load project…**.

## Implementation

`src/annotations.mjs` owns validation, colour mapping, projected cells and
shared per-frame positioning. `src/layout.mjs` builds panels with the scene
and updates them through the common scene patch path. The thin SVG and Canvas
adapters in `src/annotationRenderers.mjs` consume those records. The two panel
types share cluster-ID association, placement and editing operations; internal
scene records are not part of the public API.

Frame projections are shared by rendering and hit testing. Each scene retains
its static projection and only its latest interaction preview, using weak keys
so retired scenes can be collected. Consumers treat these records as read-only.
Inferred domains are cached by the value-matrix identity; presentation edits
reuse that matrix. Data must be replaced/reloaded rather than mutated in place.

Patch validation checks the private candidate array already built during
normalization. Unchanged panels are reused, and presentation edits rescan values
only when column count, value type or allowed categories change. New matrices
and JSON loads still receive full validation before any live changes are made.
The HTML overlay uses one menu state for adding, editing or accessing hidden
panels, independently of hover state; all renderers share that interface.
It owns the tooltip lifecycle too, retaining listeners across redraws and
releasing them when the feature is disabled or its drawing surface changes.
Scene builds and geometry patches share one annotation-placement function;
geometry patches retain cell/key records and only translate panels when their
anchor moves. The WebGPU rectangle pipeline is created on first use, so charts
without visible annotation geometry do not compile that pipeline.

### Audit: scope and remaining costs

- Core ownership remains synteny. Annotation types are limited to the existing
  heatmap/categorical and bar implementations; there is no chart-plugin framework
  or statistical computation layer.
- With the feature disabled, definitions remain in data but are excluded from
  scene geometry, figure bounds, right-legend placement, editing UI and export.
  Existing annotation GPU buffers and HTML listeners are released. JSON input
  still receives boundary validation. Core validation/geometry remain bundled;
  the optional HTML UI is loaded separately on first activation.
- The shared placement and frame-projection paths are used by all renderers.
  Locus translation, trimming and row reorder reuse cell/key geometry. Changing
  the panel anchor creates translated panel wrappers, not new cell matrices.
- A shared viewport query culls panel marks, headings and keys. Rows use a cached
  sorted index and binary range lookup; column selection is a contiguous range.
  Canvas skips offscreen marks and labels. WebGPU's Canvas overlay requests only
  labels, so it does not walk cells. WebGPU retains complete cell buffers and
  submits merged visible instance ranges without uploading cells during zoom.
  When the entire figure is visible, it takes a constant-time full-range path.
  Live SVG updates annotation joins only when their visible set changes; static
  exports and initial figure fitting use the full figure.
- Annotation-only edits retain biological layout, spatial indexes, scales and
  snapshot baselines. SVG updates annotation/chrome elements; WebGPU retains
  gene/link buffers. Unchanged panels and cell records survive presentation
  edits, and changes limited to text do not re-upload GPU cell buffers. Canvas
  still repaints the visible canvas, but does not re-project the biological data.
- WebGPU uses native rectangles for marks and its Canvas overlay for text. The
  annotation rectangle pipeline is cached after its first use; first activation
  can incur pipeline compilation. Disabling releases its cell/key buffers.
- These are code-audit conclusions, not measured speedup claims. The build has
  been checked; browser interaction/export regression coverage and profiling of
  large matrices remain outstanding.

### Optional UI packaging

`dist/annotationOverlay.mjs` contains the panel menus, data-entry form and tooltip.
The main ES and UMD bundles import it only when annotations are enabled. Deploy
it beside the main bundle (or let a bundler resolve the relative dynamic import).
The core passes its annotation functions into this UI factory, keeping geometry,
validation, scale inference and frame caches shared rather than duplicating them
in the UI bundle. No extra import is needed in application code. Failed UI loading
is reported in the console; annotation rendering and static export remain usable.

## Group markers (proof of concept)

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

The data editor supports:

- Numeric matrix values and categorical dropdowns, keyed by cluster ID.
- Category creation, renaming and colours. Rename updates every assignment.
  Removing a category lets users replace its assignments with another category
  or missing values. A categorical domain may be empty when all values are missing.
- Adding, renaming and removing heatmap columns (at least one must remain).
  Bar panels keep exactly one column.
- Replacing a matrix using CSV/TSV or JSON `{columns, values}`. New categories
  from replacement data are added without discarding existing category colours.
- Group-marker labels, colours, memberships, addition and removal (at least one
  group must remain). Tree clades use node IDs; explicit memberships use cluster selections.
- Panel creation, ordering, visibility and removal.

Values are edited on change/blur; all mutations are immediate and undoable.
Missing values appear as empty numeric inputs or the **Missing** category choice.
The editor shares its toolbar search, controls and table styles across all data
panels. **Replace data…**, visibility, ordering and removal are available directly
in the annotation toolbar. Matrix rows support checkbox and Shift selection,
including selecting all filtered rows. Batch actions set or clear values in one
column or all columns for the selected rows, as one undoable operation.
Selections persist across filtering and scrolling, and reset when switching panels.
Rows are searchable by name/ID and use the same fixed-height row virtualization
as the other data tables. Column headers and cluster names remain visible while scrolling.

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

Send columns, values and category-domain changes together when they depend on
one another; validation checks the complete batch before applying it.
Style-only undo records retain the existing matrix without copying it.

Hosts can open an editor directly with `editor.editAnnotations(panelUid)`.
The plot emits the cancelable, bubbling DOM event `clustermap:edit-annotation`
with `detail: {chart, panelUid}`. An attached `<clinker-editor>` handles events
for its own chart, opens Data → Annotations, and prevents the inline fallback.
Custom hosts may handle this event and call `preventDefault()` instead.
The editor emits `clinker-editor-open` when opened this way, so host buttons
can update their expanded state.
