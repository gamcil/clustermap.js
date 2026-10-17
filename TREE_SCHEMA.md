# Tree schema and implementation contract for clustermap.js

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

When a tree is present, existing `clusterOrder` state must reflect the derived
order. It may remain as a compatibility representation, but cannot become an
independent source of ordering. Ordinary cluster dragging and programmatic
ordering APIs must obey the same constraints.

Tree edits participate in the existing undo/redo system. Save edited child
order in project snapshots. Renaming a cluster must not break its association
with a leaf.

## Rendering and configuration

Appearance is configured in `config.tree`, separate from `data.tree`:

```ts
interface TreeConfig {
  show?: boolean;
  width?: number;
  useBranchLengths?: boolean;

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

Support labels default to one decimal place and sit above and left of their
supported node. Font family follows `config.plot.fontFamily`. The tree scale
bar inherits the main `config.scaleBar` styling and shares its vertical
position; `config.tree.scaleBar.show` controls its visibility independently.
Dashed leaf guides are hidden by default. The tree is positioned as far right
as possible while leaving a gap between every leaf tip and its cluster label.

## Layout and rendering

`src/treeLayout.mjs` owns the shared `layoutTree()` output: root and child
branches, vertical stems, internal nodes, leaf guides, formatted support labels,
and the scale bar. It also owns node hit testing and `interpolateTreeLayout()`,
which supplies the same geometry at each animation frame to every renderer.
Node positions interpolate by identity, so a branch flip folds its stem while
ancestors unaffected by that flip stay still.

`src/treeCanvasRenderer.mjs` measures text and paints these marks into Canvas.
The WebGPU backend uses this same adapter in its Canvas overlay.
`src/treeSvgRenderer.mjs` measures SVG text, joins the marks to DOM elements,
and drives the shared frame interpolation with a D3 transition. SVG export
uses this adapter too. The adapters own drawing and interaction binding;
topology, positioning, label formatting, and scale geometry belong to the
shared layout. These modules are internal; the frontend passes `data.tree`
and `config.tree` through the existing chart API.

## Scope

The initial viewer supports normalised tree input, rectangular rendering,
support labels, styling, node rotation, constrained vertical dragging,
undo/redo, project round-tripping and SVG export.

Newick parsing, filename matching, tree inference and rerooting are outside
this implementation's scope. Future rerooting must explicitly preserve the
correct association of lengths and support values with branches.

## Verification

Run `npm test` for validation, ordering, layout, and state round-trip coverage.
After `npm run build`, run `npm run test:tree-browser` for browser checks of
node flips, undo/redo, public project save/load, and static SVG export. The
browser check uses local files and requires Playwright Chromium to be installed
(`npx playwright install chromium`).
