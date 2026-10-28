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

Use `chart.uiAppearance("auto")` to follow the system appearance, or choose
`"light"` / `"dark"`. The getter `chart.uiAppearance()` returns the preference.
This changes controls, menus and the attached editor without changing figure
configuration, undo history, saved projects or SVG output. The demo toolbar
exposes the setting; application appearance belongs to the host app.

UI appearance defaults to `"auto"` and is never loaded from figure configuration
or saved projects. Hosts set their preference through `chart.uiAppearance(...)`.
Only `"auto"`, `"light"` and `"dark"` are accepted; other values, including `null`,
throw `TypeError`.

Figures use a white background by default. To choose a softer editing/figure
background explicitly, use `chart.config({ plot: { background: "#f5f5f3" } })`
or the Figure background control. This setting is saved with the project and
used in SVG export, so the displayed figure matches the output.
The padded figure surface follows the content bounds and camera; space outside
the figure uses the interface theme. A label above the surface shows its width ×
height in CSS pixels at 100% zoom, including padding; zooming does not change
these dimensions. The surface and dimensions follow live drag/trim previews,
including labels, trees and annotation panels. SVG output remains resolution independent.

The figure border, shadow and dimensions label are visible by default. Hide
them with `chart.config({ plot: { showFigureFrame: false } })`, or toggle
**Show figure frame** under Appearance → Plot. The figure background and plot
remain visible, and figure bounds and SVG output are unchanged. Set the option
back to `true` to restore the frame.

Under Appearance → Clusters & loci, **Hide locus labels** removes the complete
locus label line while keeping cluster names visible. Its API setting is
`chart.config({ cluster: { hideLocusLabels: true } })` (default `false`).
Cluster names are vertically centred on their gene rows when locus labels are hidden.
**Hide locus coordinates** remains independent: it keeps locus names and hides
only their coordinate ranges when labels are visible.

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
Serve the repository root with `python3 -m http.server 8080`, then open the demo:

```
http://127.0.0.1:8080/demo/?fixture=mcaa&minimap=1&minZoom=0.8
http://127.0.0.1:8080/demo/?fixture=pks&minimap=1&minZoom=0.8
http://127.0.0.1:8080/demo/?fixture=burnettii
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
Size and position the host element using ordinary CSS. Use `editor.open()` and
`editor.close()`, or set `hidden` directly. Add `resizable` for its resize handle.

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

The full editor exposes `header`, `tabs`, `data`, and `appearance` parts; the
data panel exposes `content`, `toolbar`, `selection`, and `table`; the appearance
panel exposes `toolbar` and `settings`.

### Editor navigation

```js
await editor.openAppearance({ section: "tree", focus: true });
editor.close();
```

`open({ tab: "data" | "appearance" })` and `close()` return the editor.
Omit `tab` to retain the current tab when opening.
`openAppearance({ section: null, focus: true })` returns a `Promise<boolean>`.
Assign `.chart` and connect the editor before calling it. It opens the editor,
selects Appearance, clears the appearance filter, expands the target section,
scrolls it into view and optionally focuses its first enabled control. It waits
for layout internally. `section: null` selects the first section.

Supported section IDs: `plot`, `legend`, `links`, `link-labels`,
`tree`, `clusters-loci`, `genes`, `scale-bars`, `plot-navigation`. Unknown IDs,
an unconnected editor or a missing chart return `false` without opening it.
Closing, changing tabs or superseding navigation before layout completes can
also return `false`; focus will not be moved into hidden controls.
The standalone appearance panel exposes the same section IDs through `.sections`
and `openSection(section, { focus: true })`.

The connected editor dispatches `clinker-editor-open` and `clinker-editor-close`
when its visibility changes, including direct changes to `hidden`. Both bubble
and cross shadow boundaries; neither fires for initial connection or unchanged
visibility. Hosts can synchronize their toggle button from these events without
querying shadow roots. Annotation and selection editing entry points are retained.

### UI styling contract

Styles are included with the components. Set public properties on a common
wrapper, the chart container or an editor host; they inherit through nested
components. Explicit public properties override theme defaults. For example:

```css
.plot-workspace {
  --cm-surface: var(--app-surface);
  --cm-foreground: var(--app-foreground);
  --cm-border: var(--app-border);
  --cm-accent: var(--app-accent);
  --cm-font: 13px/1.4 system-ui, sans-serif;
}
```

| Property | Light default | Dark default |
| --- | --- | --- |
| `--cm-background` (workspace outside the figure) | `#ffffff` | `#171b22` |
| `--cm-surface` | `#ffffff` | `#232a35` |
| `--cm-subtle` | `#f3f6fa` | `#293241` |
| `--cm-hover` | `#e3ecf8` | `#354660` |
| `--cm-foreground` | `#20252c` | `#e5eaf1` |
| `--cm-muted` | `#687586` | `#a0adbd` |
| `--cm-border` | `#cbd3de` | `#465365` |
| `--cm-accent`, `--cm-focus-ring` | `#1677ff` | `#85b7ff` |
| `--cm-selection` | `#d6e6fc` | `#3a5276` |
| `--cm-danger` | `#b42318` | `#ffaaa3` |
| `--cm-font` | `13px/1.4 system-ui,sans-serif` | same |
| `--cm-control-height` | `30px` | same |
| `--cm-control-padding` | `4px 8px` | same |
| `--cm-control-radius` | `6px` | same |

Some compact controls have smaller defaults; virtualized data rows retain their
fixed row height. `--_cm-*` properties and component implementation classes are
private. The previous app-specific `--clinker-*` hooks have been removed.

Editors and standalone panels follow their attached chart's UI preference, or
the system when unattached. Set `appearance="light"`, `"dark"` or `"auto"` on an
editor/panel to override that preference locally. The override reaches nested
components. Native controls use the same colour scheme; `auto` responds to
system changes. Colour overrides do not infer a native colour scheme, so set
the UI preference/attribute as well when supplying a custom dark or light palette.

Library-created light DOM controls use an owned `.cm-ui` scope. Floating menus
and tooltips remain inside their chart container and inherit its public tokens.
Selection toolbars mounted elsewhere follow the chart's UI mode; their placement
container must receive the same public tokens, normally through a shared wrapper.
Two independent charts can have different modes and palettes on the same page.
Host CSS should scope app-owned controls; library rules do not theme arbitrary
host buttons or scientific SVG content.

Importing `clinker/editor` registers the full editor. The standalone panel
imports register their own elements; styles are bundled with each component,
so no separate stylesheet or registration call is needed.

### Clinker integration migration

For the coordinated app update described by `CLUSTERMAP_UI_BOUNDARY_DESIGN.md`:

- Import the editor entry for registration; remove the old named
  `defineClinkerEditor` import/call. Keep `mountPlotSelectionToolbar` if used.
- Map app theme tokens to the documented `--cm-*` properties in one workspace
  adapter. Apply it to both chart and editor/toolbar containers when separated.
  Replace legacy `--clinker-*` properties and library-internal CSS overrides.
- Set `chart.uiAppearance(appPreference)` instead of writing `config.plot.theme`.
  Keep application preference persistence in the host.
- Replace Tree appearance's shadow-root traversal with
  `await editor.openAppearance({ section: "tree", focus: true })`. Use public
  open/close events to synchronize the host's editor toggle.
- Update the dependency pin and deployment scripts together. Copy the selected
  core bundle, `dist/editor.mjs`, `dist/annotationOverlay.mjs` and the entire
  `dist/editor/` chunk directory. Keep companion modules beside the core bundle;
  the editor entry may be renamed if its relative `editor/` imports still resolve.
  Remove `editor.css` from copying, packaging and HTML stylesheet links; styles
  are embedded. The removed `editor/element` alias is also unnecessary.

Clustermap owns editing controls and validation; the host owns file parsing,
matching, project workflows, placement and application appearance. No external
stylesheet service or CSS build dependency is needed.

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

Browser checks start their local servers automatically and use local dependencies. They cover
editing, themes, layout, history, tree interactions, virtual scrolling and
project/SVG round trips from SVG and Canvas renderers.

## Rendering benchmark

Run `npm run bench:rendering` for the default three repetitions, or add
`-- --fixture larger` for the larger synthetic fixture. The workflow measures
INP with `web-vitals` and the 95th-percentile animation frame interval during
continuous gestures. See [benchmark usage and limitations](bench/README.md).
