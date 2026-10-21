# clustermap.js

A d3 chart for generating gene cluster comparison figures

## What is it?

clustermap.js is an interactive, reusable d3 chart designed to visualise homology between
multiple gene clusters.

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

Plot data may include an optional `tree` containing a display root and a flat
array of nodes. Internal nodes list child UIDs in display order; each leaf
references one plotted cluster UID. Every plotted cluster must have exactly
one leaf. See [TREE_SCHEMA.md](TREE_SCHEMA.md) for the full input contract,
validation rules, configuration, and renderer architecture.

The Clinker frontend is responsible for parsing tree files and matching leaf
labels to cluster UIDs before passing `data.tree` to the chart. Clustermap
validates the resolved tree and derives the initial cluster order from it.
Click an internal node to reverse its branches, or drag clusters within the
orders allowed by the tree. Both changes participate in undo/redo and are
preserved in `chart.project()` snapshots.

Tree appearance is configured through `chart.config({ tree: { ... } })` and
the plot editor's Tree panel. Branch lengths are used when every incoming
branch has a known length and the tree has a positive root-to-tip distance;
otherwise the display falls back to a cladogram. SVG, Canvas, and the WebGPU
Canvas overlay share tree geometry and animation. SVG export is static.

Merge-height dendrograms can opt into cut-height clade colouring through
`tree.distance` and `tree.presentation.colouring`. Sparse subtree/incoming-edge
styles and plain-text node annotations use undoable `chart.patch()` operations.
The appearance editor and internal-node context menu provide the same controls.
See [the styling contract](TREE_SCHEMA.md#colouring-and-annotations) and try
`?fixture=tree-styling&renderer=canvas` for an illustrative example.

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

Group marker PoC: `?fixture=group-markers&renderer=webgpu` shows tree clades,
nested groups and a non-contiguous explicit group alongside a heatmap.

Annotation panels are optional and **disabled by default**. Enable them with
`chart.config({ annotations: { enabled: true } })` or **Appearance → Annotations
→ Enable annotation panels**. Disabling them preserves their data and settings,
but removes the panels and their editing controls from the figure and SVG export.
The annotation demo fixtures enable the feature explicitly.
The optional panel-editing UI loads on demand from `dist/annotationOverlay.mjs`;
include that file beside the main bundle when serving the built files directly.

JSON data may include an `annotationPanels` array for row-aligned heatmaps and
horizontal bars to the right of the clusters. Values are keyed by cluster ID
and follow the clusters' row ordering and animations. Supported views are
continuous/categorical heatmaps and numeric bars, with missing values and keys/axes.
See [ANNOTATION_SCHEMA.md](ANNOTATION_SCHEMA.md) for the JSON API and defaults.
Try `?fixture=heatmap&renderer=canvas` (also `svg` or `webgpu`).
Use `?fixture=heatmap-project` for a 50-cluster project with continuous values,
gene counts and categorical group presence, retaining its tree and saved layout.
WebGPU draws marks using instanced rectangles and text using its Canvas overlay.
SVG export remains vector-based and includes the complete figure.
Hover an annotation panel and click **Edit** for its live styling menu; hover
cells to see their original values. Menus control sizing, gaps, borders, scales
and labels. Edits use the existing `chart.patch()` API and support undo/redo
and data/project export.
Hover the empty slot at the right of the figure and click **+** to add a heatmap
or bar panel from CSV/TSV or JSON data. Edit menus include move-left, move-right
and remove actions. Bars take one numeric column and support signed values.

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

1. Import d3 v7
2. Import clustermap.js
3. Style container div element to take up entire viewport
4. Create and configure clustermap.js ClusterMap function
5. Bind data to container div, call ClusterMap

```html
<html>
  <head>
    <!-- Import d3 v7 and the UMD browser bundle -->
    <script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
    <script src="clustermap.min.js"></script>

    <!-- Make div take up entire viewport -->
    <!-- clustermap.js <svg> element has 100% width/height -->
    <style>
      div#plot {
        width: 100vw;
        height: 100vh;
      }
      #plot div {
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <!-- Create a <div> container for the clustermap.js plot -->
    <!-- clustermap.js will create child <svg> (plot) and <input> (colour picker) elements -->
    <div id="plot"></div>
    <script>
      // Create and configure the ClusterMap function.
      let chart = ClusterMap.ClusterMap().config({
        cluster: {
          spacing: 30,
          alignLabels: true,
        },
      });

      // Load in data via d3.json, select <div> elements and call the
      // chart function on the selection.
      d3.json("data.json").then((data) => {
        d3.select("#plot").datum(data).call(chart);
      });
    </script>
  </body>
</html>
```

## Optional editor element

The data and appearance editor is an opt-in browser component. It is separate
from the chart entry point, so applications which only render a plot do not
load editor code or styles.

```js
import { ClusterMap } from "clinker";
import { defineClinkerEditor } from "clinker/editor";
import "clinker/editor.css"; // Optional default styling.

defineClinkerEditor();
const chart = ClusterMap();
// Mount the chart with D3 as usual, then attach the same chart instance.
document.querySelector("clinker-editor").chart = chart;
```

```html
<div id="plot"></div>
<clinker-editor></clinker-editor>
```

The data views share a panel layout, cell spacing, row selection, keyed virtual
scrolling and native controls. Selectors, checkboxes, colour controls, icon
buttons and batch-action groups use common styles. The shared layout owns
optional tools, record counts, batch actions and the scrolling table viewport. Shared selection controls
manage selected counts, select-visible and clear-selection actions, and header
checkbox state where present.
Inline fields share native validation and keyboard handling: Enter finishes an
input edit, and Escape restores the last saved value. Data changes invalidate
the editor's derived rows, indexes, selection validity and annotation view together.
Scrolling updates the visible row window without rebuilding headers or batch
controls. Group order can be changed by dragging, arrow keys or the Position
field, which commits on change without a separate Move button. Appearance fields
are created when their tab is first opened, then synchronized in place as settings change. All edits use the chart's patch or
configuration API, with rejected edits reported in the editor.

`<clinker-editor>` uses light DOM and installs the shared native-control styles.
Load `clinker/editor.css` for the panel layout, or provide application styles
using the namespaced `.cm-editor` and `.cm-data-*` classes.
The component never owns a separate data copy: edits call the attached chart's
public API and its table refreshes from `chart.on("change")`.

For the optional in-plot locus batch controls, import
`mountPlotSelectionToolbar` from `clinker/editor` and call it with the mounted
chart and a positioned plot container. It returns a cleanup function.

## Chart API

`ClusterMap()` returns a callable D3 chart. Its supported methods are:

The published core and editor bundles include their D3 runtime; applications
do not need a D3 peer dependency, global `d3`, or bundler shim to import them.
The CDN example above loads D3 only because it uses `d3.select(...).call(chart)`
to mount the callable chart. An application may instead pass a D3 selection it
already owns.

- `chart.config(options)` merges supported configuration options and returns the
  chart; when mounted, it redraws immediately. `chart.config()` returns the current configuration. Set
  `plot.renderer` to `"svg"`, `"canvas"`, or `"webgpu"`.
- `plot.adaptiveResolution` defaults to `true`: Canvas can reduce its backing
  resolution during gestures and when zoomed out. Set it to `false` to keep
  Canvas at the device pixel ratio throughout. WebGPU always uses the device
  pixel ratio and four-sample antialiasing for shape edges. The rendering
  benchmark disables adaptive resolution by default.
- `chart.data(data)` replaces data on an already-mounted chart; `chart.data()`
  returns its current normalized data.
- `chart.project()` returns a serializable `{ format, version, data, config,
  state }` snapshot. Pass such a snapshot to `chart.project(project)` to restore
  it into an already-mounted chart. Runtime callback hooks in configuration are
  omitted because they cannot be represented in project JSON; reattach them in
  application code after loading.
- A locus may include an optional numeric `offset` to provide an initial
  horizontal alignment, for example `{ uid: "contig-a", offset: -12500, ... }`.
  It is measured in the same sequence-coordinate units as gene and locus
  positions—not rendered pixels—so a producer such as clinker can provide its
  synteny layout without knowing `plot.scaleFactor`. Explicit offsets override
  the default within-cluster packing only on first initialization; restored
  project state and subsequent user drags take precedence.
- `chart.patch(operations)` validates and atomically applies a batch of edits.
  Presentation operations are `genes.update` (label, colour, name),
  `groups.update` (label, subtitle, colour, hidden), `links.update` (label, colour,
  hidden, identity), and `loci.update` /
  `clusters.update` (label, name), each with stable `ids` and a `changes`
  object. `genes.delete` removes a gene from its locus but deliberately keeps
  its link records in the data; dangling links are omitted from the projected
  figure until both endpoints exist again. `links.delete` removes only selected
  link records. Structural group operations are `groups.assignGenes`,
  `groups.unassignGenes`, `groups.create`, `groups.merge`, and
  `groups.delete`. They retain exclusive membership: assigning a gene to a
  group removes it from any other group, and makes the user-managed groups
  authoritative rather than regenerating them from links on redraw.
- `chart.undo()` and `chart.redo()` reverse or reapply chart edits, appearance
  changes, and completed plot manipulations (flips, anchors, trims, and
  reordering drags). `chart.canUndo()` / `chart.canRedo()` expose their
  availability, and `chart.clearHistory()` discards both stacks. Replacing data
  or loading a project starts a fresh editing history. The chart records only
  the affected records for deletes, rather than retaining a full data snapshot
  after every change. History retains the latest 100 changes.
- `colourBar.domain` controls the shared identity colour scale. Its `min` and
  `max` are normalized values from 0 to 1; set `minMode` or `maxMode` to
  `"data"` to derive that edge from the lowest or highest link identity. The
  scale clamps outside values. This changes colour mapping only;
  `link.threshold` independently controls which links are visible.
- `chart.on("change", listener)` subscribes to data, configuration, state,
  history, and locus-selection/flip changes, returning an unsubscribe function. This
  lets an external table or persistence layer stay synchronized without
  inspecting renderer state.
- `chart.highlight(geneIds)` draws a non-destructive selection outline around
  the given gene IDs in every renderer; call `chart.highlight()` to read the
  current selection or pass an empty iterable to clear it. Pass
  `{ genes, links }` to highlight genes and/or links independently.
- `chart.locusSelection(ids)` sets the loci selected for batch plot operations;
  call it without arguments to read the selected IDs. Shift-clicking a locus in
  the plot uses the same selection. Ctrl/Cmd+Shift-click adds, and
  Alt/Option+Shift-click removes, every locus in the displayed cluster range
  from the last clicked locus to the clicked one. `chart.flipLoci(ids)` flips
  the supplied loci, or the current locus selection when called without IDs.
  `chart.trimLoci(ids)` removes both flanks of the supplied or currently
  selected loci, ending at their displayed outermost genes.
  `chart.restoreLoci(ids)` restores their full bounds while retaining flips and
  horizontal offsets. Trimmed flanks are annotated in the plot with their
  hidden length and feature count. When a dragged cluster contains a selected locus, all
  selected clusters reorder together, retaining their relative order.
- `chart.figureBounds()` returns a fresh, unpadded `{ minX, minY, maxX, maxY }`
  envelope in scene/world coordinates, independent of the camera and viewport,
  or `null` before mounting and after destruction. It includes visible labels,
  legends, scale bars and the tree using Canvas text metrics across SVG, Canvas
  and WebGPU. It creates no SVG and changes no data, camera, selection, history
  or animation state. It measures the latest fully computed layout: ordinary
  transitions use their target layout, deferred locus flips use the last
  computed layout until their target is ready, and temporary drag geometry is
  excluded. Current appearance and tree-annotation settings are included.
  Use it for viewport fitting and overflow detection; exact SVG `getBBox()`
  equality is not guaranteed. The detached measurement context is reused,
  while geometry and text metrics are measured afresh on each call.
- `chart.exportSvg({ padding })` returns the current figure as an SVG string,
  irrespective of the interactive renderer in use.
- `chart.destroy()` releases chart-owned event handlers, animations, minimap
  resources, WebGPU resources, and generated DOM when the host is unmounted.

Scenes, interaction state, and renderer backends are deliberately internal;
all backends consume the same projected scene through the chart controller.

Geometry edits use the shared `patchScene` operation in `src/layout.mjs`.
Locus moves (including batch selections), flips, trims, anchoring and cluster
reordering update affected records and their incident links in one pass.
Translations reuse local geometry; flips and trims reproject changed loci.
The same operation updates labels, trim indicators, bounds, plot decorations,
and hit-testing indexes, and returns changed IDs for renderer buffer updates.
Data or appearance changes use a full scene build. Scene patching is internal
and does not change the public chart API.

History, state reads, and project exports share one source-state baseline per
chart. Data loads and source edits rebuild it; geometry-only interactions reuse
it, and chart destruction releases it. Snapshots still contain only deviations
from source state and never include the cached baseline.

For a bundler-based application, import the ESM package entry directly. D3 is
declared as a peer dependency and is imported by the library:

```js
import { ClusterMap } from "clinker";

const chart = ClusterMap().config({ plot: { renderer: "webgpu" } });
```

The `dist/clustermap.js` and `dist/clustermap.min.js` files are supported UMD
browser bundles for script-tag usage and expect a global D3 v7 instance. This
is the appropriate artifact for applications, such as the Python-packaged
Clinker frontend, that bundle the library as a static browser asset; the ESM
entry is intended for modern JavaScript bundlers.

## Rendering benchmark

Run `npm run bench:rendering` (three repetitions by default) to compare the
original SVG chart with the current SVG, normal Canvas, Canvas with 2D
acceleration disabled, and WebGPU renderers. The Playwright harness records one INP per pan/zoom/drag/flip/trim/reorder workflow directly through
`web-vitals`, plus the 95th-percentile animation frame interval during continuous
gestures, with contributing events and environment metadata.
Use `--fixture larger` for 20,000 genes and 19,800 links (twice the default).
The demo also supports `?fixture=larger&renderer=webgpu` or `&renderer=canvas`.
See [benchmark usage and limitations](bench/README.md).
