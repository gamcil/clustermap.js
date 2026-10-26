# Tree schema

This is the tree input contract implemented by clustermap.js.
Clinker parses tree files and resolves leaf labels to cluster IDs. Clustermap
receives the normalised representation below, renders the tree, and manages
tree-constrained ordering and editing.

## Plot data

Plot data accepts an optional `tree` field. Omitting it preserves existing
behaviour, including unrestricted cluster reordering.

```ts
interface PlotData {
  clusters: PlotCluster[];
  links: PlotLink[];
  groups: PlotGroup[];
  tree?: PlotTree;
}

interface PlotTree {
  /** Node used as the display root. */
  root: string;

  /** Biological rootedness; omitted or null means unspecified. */
  rooted?: boolean | null;

  nodes: PlotTreeNode[];
}

interface PlotTreeNode {
  /** Stable identifier, unique within this tree. */
  uid: string;

  /** Optional original tip label or internal node name. */
  label?: string;

  /** Incoming branch length; omission means unknown, not zero. */
  branchLength?: number;

  /** Support associated with the incoming branch. */
  support?: {
    value: number;
    scale?: "percent" | "proportion" | "unspecified";
    /** Optional description, e.g. "bootstrap" or "posterior". */
    type?: string;
  };

  /** Internal nodes only: child IDs in display order. */
  children?: string[];

  /** Leaves only: reference to an existing cluster UID. */
  cluster?: string;
}
```

The display root does not establish biological rootedness. A tree with
`rooted: false` still needs a display root for rectangular rendering and
child-order traversal. Names and support values remain separate fields.

## Example

This represents `((A,B),C)`. The referenced clusters must also exist in
`data.clusters`.

```json
{
  "tree": {
    "root": "node-0",
    "rooted": null,
    "nodes": [
      {
        "uid": "node-0",
        "children": ["node-1", "node-4"]
      },
      {
        "uid": "node-1",
        "children": ["node-2", "node-3"],
        "branchLength": 0.02,
        "support": {
          "value": 95,
          "scale": "percent",
          "type": "bootstrap"
        }
      },
      {
        "uid": "node-2",
        "label": "A",
        "cluster": "cluster-0",
        "branchLength": 0.01
      },
      {
        "uid": "node-3",
        "label": "B",
        "cluster": "cluster-1",
        "branchLength": 0.03
      },
      {
        "uid": "node-4",
        "label": "C",
        "cluster": "cluster-2",
        "branchLength": 0.04
      }
    ]
  }
}
```

## Validation

- Node IDs are non-empty strings and unique within the tree.
- `root` references an existing node.
- Every node is reachable from the root. There are no cycles or shared
  children; every non-root node has exactly one parent.
- Internal nodes have a non-empty `children` array and no `cluster`.
  Multifurcations and unary nodes are supported.
- Leaves have a `cluster` reference and omit `children`.
- Initially, every plotted cluster is referenced by exactly one leaf. Matching,
  pruning and resolving missing inputs happen in clinker before constructing
  this contract.
- `branchLength` is finite and non-negative.
- Support values are finite. Percent values must be within 0–100; proportions
  within 0–1. An omitted scale means unspecified.
- The root omits `branchLength` and `support`, because it has no incoming branch.
- Labels are arbitrary text, rendered safely as text. They are never used as
  identifiers.
- Invalid trees produce actionable errors. Do not silently repair topology or
  cluster associations.

## Ordering and editing

`children` order is authoritative. Derive cluster display order by traversing
leaves depth-first, visiting children in array order. The ordering of the
`nodes` array has no meaning.

Rotating a node reverses its child array. A more general sibling reorder accepts
only a permutation of that node's existing children. These operations preserve
node IDs, cluster associations, topology, branch lengths and support values.

Clicking an internal node reverses its children. Locus selection remains
unrestricted for batch actions such as editing, flipping and trimming.

Vertical dragging permits only orders in which every clade remains contiguous.
The chart computes legal insertion positions for the dragged clusters,
including batch selections, and clamps the preview to the allowed range.
Committed drag orders update the tree's child arrays as well as the displayed
cluster order. A selection with no compatible insertion remains in place.

Layout state follows tree order. Tree edits support undo/redo and persist in
project snapshots. Renaming a cluster preserves its leaf association.

## Rendering and configuration

Appearance is configured in `config.tree`, separate from `data.tree`:

```ts
interface TreeConfig {
  show?: boolean;
  width?: number;
  useBranchLengths?: boolean;

  /** Internal-node circles and their pointer/keyboard targets; default true. */
  node?: { show?: boolean };

  branch?: {
    width?: number;
    colour?: string;
  };

  support?: {
    show?: boolean;
    fontSize?: number;
    /** Decimal places, default 1. Values retain their supplied scale. */
    precision?: number;
  };

  /** Branch-length scale, or "1 branch" when using a cladogram. */
  scaleBar?: {
    show?: boolean;
    label?: string;
  };

  leafGuide?: {
    show?: boolean;
    colour?: string;
    width?: number;
    /** SVG dash pattern, e.g. "4 3". */
    dash?: string;
  };
}
```

Use cluster row positions for leaf vertical coordinates. Calculate
internal-node positions and branch geometry at runtime. Do not serialise
coordinates, parent pointers, descendant lists or lookup indexes.

If branch-length rendering is requested but any non-root branch lacks a length,
or all root-to-tip distances are zero, the whole tree uses a cladogram. Its
scale bar is labelled `1 branch`; missing lengths are not invented. Support
labels retain their supplied scale; `0.95` is not automatically converted
into `95`.

The tree stays aligned with cluster rows during camera movement and appears in
SVG exports. Hiding the tree changes visibility only; it does not remove
ordering constraints. Horizontal locus movement, flipping and trimming remain
independent of tree ordering.

`config.tree.node.show` hides internal-node circles and their interaction targets
without hiding branches, support values or annotations. It defaults to `true`.
Tree rotation remains available through `chart.rotateTreeNode(uid)`.

Support labels default to one decimal place and sit above and left of their
supported node. Font family follows `config.plot.fontFamily`. The tree scale
bar inherits the main `config.scaleBar` styling and shares its vertical
position; `config.tree.scaleBar.show` controls its visibility independently.
Dashed leaf guides are hidden by default. The tree is positioned as far right
as possible while leaving a gap between every leaf tip and its cluster label.

Tree geometry is shared across SVG, Canvas and WebGPU; static SVG exports
include branches, support labels and annotations. Newick parsing, leaf matching,
tree inference and rerooting are outside the library's scope.

## Colouring and annotations

Trees optionally carry descriptive distance metadata and sparse presentation
settings. All existing tree fields retain their meaning. Unstyled trees retain
neutral branches by default.

```ts
interface PlotTree {
  // ...root, rooted, nodes as above
  distance?: { kind: "mergeHeight"; label?: string };
  presentation?: {
    colouring?: Partial<TreeColouring>;
    subtrees?: Record<string, { branch?: BranchStyle }>;
    nodes?: Record<string, { branch?: BranchStyle; label?: AnnotationLabel }>;
  };
}
interface TreeColouring {
  mode: "none" | "cutHeight";
  cutHeight: number | "auto";
  palette: string[];
  showCutLine: boolean;
}
interface BranchStyle { colour?: string; width?: number }
interface AnnotationLabel {
  text?: string;
  colour?: string;
  fontSize?: number;
  fontWeight?: 400 | 700;
  fontStyle?: "normal" | "italic";
}
```

Dictionary keys are stable tree-node UIDs. Subtree overrides and annotations
require internal nodes; incoming-edge overrides also support leaves. Widths
and font sizes must be finite and positive; colours must be valid CSS colours.
Unknown fields/references and invalid effective policies are rejected before
replacing the active figure. Caller data is cloned.

### Automatic cut colouring

`tree.colouring` configuration supplies shared defaults: `mode: "none"`,
`cutHeight: "auto"`, a six-colour categorical palette, and `showCutLine: false`.
Per-tree `presentation.colouring` overrides those defaults. Store tree-specific
choices there, particularly when switching between imported and computed trees.
`distance.label` is descriptive text for the cut control, not an executable
clustering method.

Cut colouring requires `distance.kind: "mergeHeight"`, complete nonnegative
incoming lengths (except the root), and equal root-to-tip distances within
`1e-12 + 1e-9 × H`, where H is the largest root-to-tip distance. Metadata does
not change geometry or infer branch lengths. Arbitrary phylogenies remain
supported with colouring mode `none`.

Node height is H minus root depth. A merge strictly below the threshold colours
its vertical connector and outgoing edges. Its incoming edge stays neutral
when its parent is at/above the cut. Singletons have no merge mark. Ties remain
neutral; zero is neutral; a cut above H colours the whole tree. `"auto"` resolves
to `0.7 × H`, including zero for a zero-height tree. Null removes patch
overrides and is not valid in persisted presentation values.

Palette assignment uses stable node IDs, so rotating branches preserves colours.
Automatic colours are derived, never written into manual override records.
The optional cut line shows the actual distance value; it is hidden when
branch-length scaling is disabled or the threshold exceeds H.

### Style scope and precedence

Styles resolve property by property:

1. Global `tree.branch` defaults.
2. Automatic merge/clade colour.
3. Inherited manual subtree overrides (nearest override for each property).
4. Explicit incoming-edge override for the child.

`subtrees[uid].branch` includes that node's vertical connector and descendant
branches, excluding its incoming edge. `nodes[uid].branch` affects only its
incoming horizontal edge. The display root has no incoming edge; its decorative
stub retains the global style. Width-only overrides preserve inherited colours.
Markers and support text retain their own appearance.

Annotations are separate from original node names and support values. They use
plain text below/right of the node, with defaults black, 10px, regular, normal,
and the plot font family. Their bounds contribute to figure placement and export.

### Editing API and history

Use patch operations; do not replace chart data for style edits:

```js
chart.patch([{
  type: "tree.presentation.update", scope: "tree",
  changes: { colouring: { mode: "cutHeight", cutHeight: 0.4, showCutLine: true } }
}]);
chart.patch([{
  type: "tree.presentation.update", scope: "subtree", ids: ["node-1"],
  changes: { branch: { colour: "#267c9e", width: 2 } }
}, {
  type: "tree.presentation.update", scope: "node", ids: ["node-1"],
  changes: { label: { text: "Clade A", fontWeight: 700 } }
}]);
// Remove only this colour override, restoring automatic/inherited colour:
chart.patch([{
  type: "tree.presentation.update", scope: "subtree", ids: ["node-1"],
  changes: { branch: { colour: null } }
}]);
chart.patch([{ type: "tree.presentation.reset", scope: "subtree", ids: ["node-1"] }]);
chart.patch([{ type: "tree.presentation.reset", scope: "node", ids: ["node-1"] }]);
chart.patch([{ type: "tree.presentation.reset", scope: "manual" }]);
```

Updates deep-merge sparse fields. Patch-only null removes a field; empty records
are pruned. Resetting a subtree removes only its own override, preserving child
overrides. Resetting all manual styles preserves the colouring policy. A batch
validates atomically and is one undo step; undo restores field absence exactly.
These operations do not rebuild gene/group indexes, change tree topology or
alter locus positions. Styling travels with the tree in `chart.project()`.

`chart.previewTreePresentation(operations)` replaces the current transient tree
style preview without adding history. `chart.patch(operations)` ends the preview
and commits against the original state; `chart.previewTreePresentation(null)`
cancels it. Project snapshots omit the preview. The appearance slider uses this
API to produce one undo step per completed gesture. Configuration changes,
undo/redo, data replacement and destruction also cancel previews.

`chart.rotateTreeNode(uid)` performs the same undoable rotation as clicking a
node. The Appearance panel exposes colouring controls for compatible trees and
resetting all manual styles. Right-click an internal node to edit its subtree,
incoming branch and label. Blank thickness inherits; reset arrows clear the
corresponding overrides. The menu's Reset clears this node's styles and label,
preserving descendant overrides and automatic colouring.

Controls update immediately. SVG nodes also support Shift+F10 or the context-menu
key. Escape closes the menu and restores focus. Controls are excluded from SVG export.

Try `?fixture=tree-styling&renderer=canvas` (or `svg`/`webgpu`) for a small
illustrative bifurcating merge-height tree with an outgroup and annotated clade.
Its distances are demonstration data, not inferred biological relationships.
