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

## Biological fixture

`fixtures/mcaa-neighbourhoods-173.json` and
`fixtures/pks-regions-142.json` are canonical, browser-loadable fixtures
derived from Clinker render exports. The former contains 173 clusters, 7,511
genes, 11,489 links, and 1,200 groups. The latter is a deliberately heavier
stress case with 142 clusters, 7,359 genes, 112,320 links, and 726 groups.
View either with the Canvas renderer:

```
http://127.0.0.1:8080/?fixture=mcaa&minimap=1&minZoom=0.8
http://127.0.0.1:8080/?fixture=pks&minimap=1&minZoom=0.8
```

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

`<clinker-editor>` uses light DOM. Omit the CSS import for an unstyled editor,
or override the namespaced `.cm-editor` classes from an application stylesheet.
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
  the plot uses the same selection. `chart.flipLoci(ids)` flips the supplied
  loci, or the current locus selection when called without IDs. When a dragged
  cluster contains a selected locus, all selected clusters reorder together,
  retaining their relative order.
- `chart.exportSvg({ padding })` returns the current figure as an SVG string,
  irrespective of the interactive renderer in use.
- `chart.destroy()` releases chart-owned event handlers, animations, minimap
  resources, WebGPU resources, and generated DOM when the host is unmounted.

Scenes, interaction state, and renderer backends are deliberately internal;
all backends consume the same projected scene through the chart controller.

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
