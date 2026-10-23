# clustermap.js

An interactive D3 chart for comparing gene clusters and preparing publication figures.

## Input data

The clustermap chart expects data in the following format:

```
{
  "clusters": [
    {
      "uid":  <str: Unique ID>,
      "name": <str: Cluster name>,
      "loci": [
        {
          "uid":   <str: Unique ID>,
          "name":  <str: Locus name>,
          "start": <int: Locus start position>,
          "end":   <int: Locus end position>,
          "genes": [
            {
              "uid":    <str: Unique ID>,
              "name":   <str: Gene name>,
              "start":  <int: Gene start position>,
              "end":    <int: Gene end position>,
              "strand": <int: Gene strand (0 or 1)>,
            }
          ]}
      ]}
  ],
  "links": [
    {
      "query": {
      	"uid":  <str: Unique ID of query gene>,
      	"name": <str: Name of query gene>
      },
      "target": {
      	"uid":  <str: Unique ID of target gene>,
      	"name": <str: Name of target gene>
      },
      "identity": <float: Percent identity query-target alignment>
    }
  ],
  "groups": [
    {
      "uid":     <str: Unique ID of group>,
      "label":   <str: Group label>,
      "genes":  [<str: Gene UID>],
      "colour":  <str: Colour code for gene fill>,
      "hidden":  <bool: Hide group in the plot>
    }
  ]
}
```

Gene coordinates must be relative to their containing locus. In other words, a
locus with `start: 0` and `end: 50000` contains genes whose coordinates are in
that same `0..50000` range. Importers may preserve original genomic
coordinates separately in a `bio` field.

## Phylogenetic trees

Optional `data.tree` supplies a display root and nodes whose leaves reference
cluster IDs. Click an internal node to reverse its children, or drag clusters
within tree-compatible orders. Ordering, branch styles and node annotations
support undo/redo and project export. Newick parsing and leaf matching belong
to the host application.

See [TREE_SCHEMA.md](TREE_SCHEMA.md) for fields, validation and styling.
Try `?fixture=tree-styling&renderer=canvas`.

## Interface theme and figure background

Use `chart.config({ plot: { theme: "auto" } })` to follow the system appearance,
or choose `"light"` / `"dark"`. Auto is the default. This themes the controls,
menus and editor; figure colours remain fixed when the interface theme changes.
The demo toolbar and Appearance panel expose the setting.

Figures use a white background by default. To choose a softer editing/figure
background explicitly, use `chart.config({ plot: { background: "#f5f5f3" } })`
or the Figure background control. This setting is saved with the project and
used in SVG export, so the displayed figure matches the output.
The padded figure surface follows the content bounds and camera; space outside
the figure uses the interface theme. A label above the surface shows its width ×
height in CSS pixels at 100% zoom, including padding; zooming does not change
these dimensions. The surface and dimensions follow live drag/trim previews,
including labels, trees and annotation panels. SVG output remains resolution independent.

Gene/group colours, heatmap ramps, bar fills and manual styles remain unchanged.
Neutral configuration colours (`gene.shape.stroke`, `locus.trackBar.colour`,
`scaleBar.colour`, `tree.branch.colour`, `tree.leafGuide.colour`) default to
`null`, which resolves to fixed publication defaults, independent of theme.
Explicit colours in saved projects retain their values.

## Annotation panels

Annotation panels support continuous/categorical heatmaps, horizontal bars and
group markers aligned with cluster rows. They are **disabled by default**:

```js
chart.config({ annotations: { enabled: true } });
```

Disabling the feature hides panels and controls without deleting their data.
Hover a panel and click **Edit** for styling, or use **+** after the last panel
to add one. **Data → Annotations** edits values, categories and group membership.
Edits support undo/redo and are included in project and SVG exports.

See [ANNOTATION_SCHEMA.md](ANNOTATION_SCHEMA.md) for the JSON API.
Try `?fixture=heatmap`, `?fixture=heatmap-project` or `?fixture=group-markers`,
with `&renderer=svg`, `canvas` or `webgpu`.

## Biological fixture

`fixtures/mcaa-neighbourhoods-173.json` and
`fixtures/pks-regions-142.json` are canonical, browser-loadable fixtures
derived from Clinker render exports. The former contains 173 clusters, 7,511
genes, 11,489 links, and 1,200 groups. The latter is a deliberately heavier
stress case with 142 clusters, 7,359 genes, 112,320 links, and 726 groups.
Load the examples locally:

```
http://127.0.0.1:8080/?fixture=mcaa&minimap=1&minZoom=0.8
http://127.0.0.1:8080/?fixture=pks&minimap=1&minZoom=0.8
http://127.0.0.1:8080/?fixture=burnettii
```

The `burnettii` example uses the five GenBank records from the Clinker examples
to show the burnettramic acid (`bua`) gene-cluster comparison with a display
tree. Its four *Aspergillus* leaves form two pairs within a bifurcating clade;
the *Pseudomassariella vexata* leaf is the other root child. The topology,
branch lengths, and support values are synthetic examples for exercising the
viewer, not an inferred phylogeny.

Regenerate a canonical fixture from a compact Clinker `clv_render` sidecar:

```
npm run import:clinker -- path/to/clv_render.json.gz fixtures/output.json
```

The importer preserves the export's cluster order, maps compact link fields to
the public link schema, and rejects dangling gene references.

## Example usage

The built ESM and UMD bundles include their D3 dependencies. D3 is only needed
in application code to create the selection used to mount the chart.
For a bundler, import `{ ClusterMap }` from `"clinker"`. With script tags:

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script src="dist/clustermap.min.js"></script>
<style>#plot { width: 100vw; height: 100vh; }</style>
<div id="plot"></div>
<script>
  const chart = ClusterMap.ClusterMap().config({ cluster: { spacing: 30 } });
  d3.json("data.json").then(data => d3.select("#plot").datum(data).call(chart));
</script>
```

When serving built files directly, deploy `dist/annotationOverlay.mjs` beside
the main bundle. It loads on demand when annotations are enabled.

## Optional editor element

The data and appearance editor is an opt-in browser component. It is separate
from the chart entry point, so applications which only render a plot do not
load editor code or styles.

```js
import { ClusterMap } from "clinker";
import "clinker/editor";
const chart = ClusterMap();
// Mount the chart with D3 as usual, then attach the same chart instance.
document.querySelector("clinker-editor").chart = chart;
```

```html
<div id="plot"></div>
<clinker-editor></clinker-editor>
```

Inline fields validate edits; Enter commits and Escape restores the saved value.
Tables support search, selection, batch actions and virtual scrolling. Group
order can be changed by dragging, arrow keys or the Position field.

The import registers the component and includes its internal styles. The editor
uses shadow DOM; application styles do not need to target its implementation.
Size and position the host element using ordinary CSS. Set `hidden` to control
visibility and add `resizable` to enable its resize handle.

The chart owns data, validation and history. The editor calls its public methods
and subscribes to `chart.on("change")`, including changes made elsewhere and
undo/redo. Assigning another chart or setting `.chart = null` releases the old
subscriptions, drafts, highlights and previews. Removing the element disconnects
its subscriptions; reconnecting restores its view against the current chart.

For a standalone data editor:

```js
import "clinker/editor/data-panel";
document.querySelector("clinker-data-panel").chart = chart;
```

For appearance controls, import `"clinker/editor/appearance-panel"` and attach
the chart to `<clinker-appearance-panel>` the same way. These imports share the
underlying components without registering the full editor.

The full editor and data panel expose `editAnnotations(panelUid)` and `editSelection({ kind, ids })`,
where `kind` is `"clusters"` or `"loci"`. Assign `.chart` first; navigation requested
before connection is applied when the component mounts.

Theme colors follow the chart. Public overrides include `--clinker-accent`,
`--clinker-surface`, `--clinker-foreground`, `--clinker-border`, and
`--clinker-font`. The full editor exposes `header`, `tabs`, `data`, and
`appearance` parts; the data panel exposes `content`, `toolbar`, `selection`,
and `table`; the appearance panel exposes `toolbar` and `settings`.

The existing `defineClinkerEditor`, `defineDataPanel`, `defineAppearancePanel`,
class exports, and `clinker/editor.css` entry remain available for compatibility.
Explicit registration and the stylesheet are no longer needed for normal use.

For the optional in-plot locus batch controls, import
`mountPlotSelectionToolbar` from `clinker/editor` and call it with the mounted
chart and a positioned plot container. Pass `{ editor }` as the optional third
argument to enable its “Edit data…” action. It does not search the document or
mount an editor. It includes its styles and returns a cleanup function.

Annotation requests use the cancelable `clustermap:edit-annotation` event. Hosts
which provide an editor connect it explicitly:

```js
plotContainer.addEventListener("clustermap:edit-annotation", (event) => {
  event.preventDefault();
  editor.editAnnotations(event.detail.panelUid);
});
```

## Chart API

`ClusterMap()` returns a callable D3 chart. Setters return the chart unless
otherwise noted. Data/project replacement requires a mounted chart.

| Method | Behaviour |
| --- | --- |
| `config(options)` / `config()` | Merge settings and redraw / read current settings. |
| `data(data)` / `data()` | Replace data / read normalized data. Replacement clears history. |
| `visibleData()` | Read the filtered data currently included in the plot. |
| `remove({clusters, loci})` | Remove cluster/locus IDs and their contents from the plot, preserving source data. Undoable; removing a cluster's last locus also removes that cluster. |
| `state(snapshot)` / `state()` | Restore / read JSON-safe layout and camera state. |
| `project(project)` / `project()` | Restore / export `{format, version, data, config, state}`. Loading clears history; callbacks are omitted from JSON. |
| `patch(operations)` | Validate and apply an atomic batch of edits as one undo step. |
| `undo()` / `redo()` | Reverse / reapply edits, settings and completed plot manipulations. |
| `canUndo()` / `canRedo()` | Read history availability. |
| `clearHistory()` | Clear both history stacks; history retains at most 100 edits. |
| `on("change", listener)` | Subscribe to chart changes; returns an unsubscribe function. |
| `highlight(ids)` / `highlight()` | Set / read gene highlights. Pass `{genes, links}` to highlight both kinds, or `[]` to clear. |
| `selection({kind, ids})` / `selection()` | Set / read transient plot selection; `kind` is `"loci"` or `"clusters"`. Only one kind is active. |
| `locusSelection(ids)` / `locusSelection()` | Set / read loci selected for batch operations. |
| `clusterSelection(ids)` / `clusterSelection()` | Set / read clusters selected for batch reordering and removal. |
| `flipLoci(ids)` | Flip supplied loci, or the current selection when omitted. |
| `trimLoci(ids)` | Trim supplied/selected loci to their outermost displayed genes. |
| `restoreLoci(ids)` | Restore full locus bounds while retaining flips and offsets. |
| `focus({genes, links, loci, clusters})` | Frame supplied record IDs without changing selection. |
| `figureBounds()` | Read unpadded `{minX, minY, maxX, maxY}` in world coordinates; returns `null` before mounting or after destruction. |
| `exportSvg({padding})` | Export the complete figure as an SVG string from any renderer. Padding defaults to 20. |
| `destroy()` | Release chart-owned handlers, animations, rendering resources and DOM. |

Figure bounds include visible labels, annotations, legends, scales and the tree.
They describe the latest computed layout, excluding drag previews, and do not
change chart state. Measurements use Canvas text metrics; exact agreement with
SVG `getBBox()` is not guaranteed.

### Configuration

- `plot.renderer`: `"svg"`, `"canvas"` or `"webgpu"`.
- `plot.adaptiveResolution`: defaults to `true`; Canvas lowers resolution during
  gestures and at small zoom levels. Set `false` for native pixel ratio.
  WebGPU always uses native pixel ratio with four-sample antialiasing.
- `colourBar.domain`: `min`/`max` are identities from 0 to 1. Set `minMode` or
  `maxMode` to `"data"` for inferred bounds. Colours clamp outside the domain;
  `link.threshold` controls visibility separately.

### Data operations

Record updates use `{type, ids, changes}`:

| Type | Editable fields |
| --- | --- |
| `genes.update` | `label`, `colour`, `name` |
| `groups.update` | `label`, `subtitle`, `colour`, `hidden` |
| `links.update` | `label`, `colour`, `hidden`, `identity` (0–1) |
| `loci.update`, `clusters.update` | `label`, `name` |

`genes.delete` and `links.delete` take `ids`. Gene deletion retains link records;
dangling links stay hidden until both endpoints exist again.
Group operations are `groups.create` (`group`, optional `geneIds`),
`groups.delete` (`ids`), `groups.merge` (`targetId`, `sourceIds`),
`groups.assignGenes` (`groupId`, `geneIds`), `groups.unassignGenes` (`geneIds`)
and `groups.reorder` (`ids`, containing every group exactly once).
Membership is exclusive. Structural group edits disable automatic regrouping.

Tree styling and ordering APIs are documented in [TREE_SCHEMA.md](TREE_SCHEMA.md);
annotation operations are in [ANNOTATION_SCHEMA.md](ANNOTATION_SCHEMA.md).

### Locus placement and selection

A locus may supply an initial `offset` in sequence-coordinate units. Explicit
offsets override default packing on first initialization; restored state and
user drags take precedence.

Shift-click or Ctrl/Cmd-click toggles a single record's selection.
Use a locus body for locus selection or a cluster label for cluster selection.
Ctrl/Cmd+Shift-click adds a range; Alt/Option+Shift-click subtracts one.
Dragging a selected cluster reorders the selected clusters together.
The plot toolbar applies locus operations to selected loci or, through its
Loci menu, to the member loci of selected clusters.

## Development checks

Unit tests live in `tests/unit/`; browser checks live in `tests/browser/`.
The standalone tree check uses Node; the `.spec.js` files use Playwright.

```sh
npm run build
npm test
npx playwright install chromium # Once per browser installation.
npm run test:editor-browser
npm run test:tree-browser
```

Browser checks start local servers and use local dependencies. They cover
editing, themes, layout, history, tree interactions, virtual scrolling and
project/SVG round trips from SVG and Canvas renderers.

## Rendering benchmark

Run `npm run bench:rendering` for the default three repetitions, or add
`-- --fixture larger` for the larger synthetic fixture. The workflow measures
INP with `web-vitals` and the 95th-percentile animation frame interval during
continuous gestures. See [benchmark usage and limitations](bench/README.md).
