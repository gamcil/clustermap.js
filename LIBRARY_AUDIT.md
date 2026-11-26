# Clustermap library audit

## Follow-up: simplicity review, 27 November 2026

The original findings below describe the code as it stood at `fac7e59`. Since
then, link and gene batch validation has been corrected, the unstranded flip
case has a general-transition fallback, CI runs unit tests and checks the
distribution, and configuration validation is declared in the base schema.
The three project export forms now share committed snapshot construction.

Some recent abstractions did not simplify ownership enough to justify their
cost. The editor link-read adapter and extracted raster transition controller
were removed; the latter had moved the existing transition code without
unifying it with gesture previews or SVG. The chart model remains because it
owns data, biological indexes, edits, snapshots and history. Its boundary is
not complete: layout state and preview mutations still live in the chart,
and the chart must coordinate changes with the rendering runtime.

Compared with `fac7e59`, source has grown by a net 54 lines and tests by 190
lines. The chart coordinator is 1,651 lines compared with 1,713 at the
original audit, but its smaller size alone does not mean the system is simpler.
Test and generated bundle changes should be considered separately from runtime
source when evaluating a refactor.

The largest remaining opportunities are:

1. **Unify transition rules where possible.** Direct flips, batch flips,
   general interpolation and SVG transitions still have separate eligibility
   and cancellation paths. Reduce duplicated decisions while retaining the
   measured Canvas and GPU fast paths. Do not add a controller that merely
   passes their mutable state through.
2. **Reduce representation-specific editing and indexing branches.** Array
   links and compact links still diverge in operations, indexes and filtering.
   Any common contract must handle their actual differences and avoid
   expanding the compact table; a single-consumer wrapper is not enough.
3. **Clarify the model/runtime boundary.** Committed edits and history now
   have an owner, but state, cache invalidation, transient tree edits and
   redraw decisions still cross between model, chart and runtime. Simplify
   the actual lifecycle rather than adding layers of change notifications.
4. **Review persistence contracts with their consumers.** Snapshot contents
   are shared, but object, full Blob and compact Blob APIs still represent
   different ownership and size trade-offs. Removing a format or API needs a
   consumer review, not a compatibility assumption.

The renderer-neutral scene, shared geometry and interaction code, and
virtualized editor are useful reuse. Native SVG, Canvas and WebGPU drawing
paths address different backends; combining them just to reduce file count
would not necessarily simplify the library. Future changes should state which
rules or states they remove, and demonstrate behavior and large-data costs.

### Test suite

The suite had 369 unit tests and 642 collected Playwright cases before the
latest pruning. The latter are 214 cases repeated across Chromium, Firefox and
WebKit; some WebGPU cases skip when no adapter is available. The largest
browser files cover gestures, editor workflows and cross-renderer integration.
Keep this distinction visible when discussing test count or runtime.

Recent implementation-shaped tests for the chart model, change-impact
classifier and renderer-mode predicates duplicated existing operation and
browser coverage and were removed. The public configuration ownership test
now covers independent listeners in the browser instead of repeating most of
the scenario in a unit test. Renderer conformance now tests the built bundle.
Retain direct unit tests where they check a distinct invariant, especially
bounded allocations and behavior difficult to observe in a browser.

The full three-browser matrix remains in place. Reducing it would change
coverage, so first measure its runtime and identify a small cross-browser
workflow covering editor, chart interactions and export; run the remaining
cases in a clearly named primary-browser suite. Avoid adding a separate test
for every refactor or asserting a private controller's exact bookkeeping.

A single-worker Chromium run on 27 November collected 212 cases and completed
in about 1.9 minutes: 201 passed and 11 skipped. Summed test durations were
approximately 59 seconds for editor regressions, 19 seconds each for gesture
and consolidation tests, 11 seconds for chart lifecycle, and 3 seconds for
renderer conformance. This is one local measurement, not a CI benchmark. Two
outdated flip tests were corrected, and a renderer-independent group-history
scenario now runs once per browser instead of three times. Playwright now
collects 636 cases across the three browsers. Diagnostic checkpoint screenshots
are retained; they are not image-comparison assertions.

---

Audit of the repository at `fac7e59` on 26 November 2026. The goal is to
reduce the number of concepts and paths needed to implement the existing
features while retaining support for large datasets. This is a structural and
targeted correctness review, not a proof of every feature or a new performance
baseline. No application code was changed as part of this review.

## Assessment

The library has a useful foundation: a renderer-neutral scene, shared layout
and interaction logic, compact link columns, and a virtualized editor. The
complexity problem is chiefly in the contracts between these pieces. Different
paths decide independently what changed, what must be retained, what must be
rebuilt, and which transient state is active. Several internal link
representations and project APIs add further branches.

There are roughly 18,800 lines across 148 files under `src` (including HTML
and CSS). The largest JavaScript modules are `chart/chart.js` (1,713 lines),
`renderers/webgpu.js` (1,625), `scene/layout.mjs` (888), `renderers/svg.js`
(752), and `renderers/canvas.js` (744). These figures identify review areas;
they are not themselves evidence that the code should be removed. A basic
import-graph scan found no source module unreachable from the published entry
points and no static module cycles.

## Correctness findings

### 1. Mixed link-edit batches can create an unusable undo entry

**Priority: high.** `data/operations.mjs` validates most operations against the
initial index and then applies them sequentially. The compact store receives a
separate sequential preflight; ordinary arrays do not. In a reproduced
ordinary-array case, a batch that deletes `link-0` and then updates `link-0`
is accepted. The update acts on the stale index entry, and applying the
generated inverse fails because the link is missing. The same batch against a
`CompactLinkStore` is rejected before mutation. See `data/operations.mjs`:
`applyChartOperations`, `applyOperation`, and the compact preflight.

**Direction:** give both storage implementations the same sequential batch
semantics. Validate and prepare a batch against a lightweight draft or
transaction, then publish it and its inverse together. Reject operations on a
record deleted earlier in the batch unless restoration has made it available.
Avoid cloning the complete link table for validation. Add cross-store tests
for delete/update, delete/restore, duplicate deletes, rejected batches,
and undo/redo. This is a correctness change, not just a code cleanup.

### 2. Direct flip previews can disagree with unstranded link geometry

**Priority: medium.** `scene/preview.mjs` reflects directional link endpoints
in `previewLinkAnchors`. `chart/chart.js` uses the single-locus preview for
direct pointer flips without the eligibility check used for batch flips. In a
small synthetic scene with an unstranded gene (`strand: 0`), two of three
visible affected links had their endpoint order reversed in the final preview
relative to the committed scene. This is a transient visual discrepancy; it
does not establish loss of saved data. The retained batch-transition guard
already sends unstranded linked endpoints through the general transition.

**Direction:** define endpoint ordering once for forward, reverse and
unstranded genes, and use it for committed geometry, Canvas/SVG previews and
WebGPU. Until the optimized preview can represent the unstranded case, route
it through a correct general transition. Test both endpoints, single and batch
flips, trimming, zero duration, and interruption at several progress values.

## Main simplification opportunities

### 3. Separate chart ownership from rendering and interaction orchestration

**Priority: high; larger change.** `chart/chart.js` owns data installation,
indexes, state, selection, history, edits, animation cancellation, renderer
selection, camera, overlays, lifecycle, project I/O, and the public API. It
imports 45 modules. It has several mutable representations of a transition:
`sceneCommit`, `scenePreview`, `rasterScene`, `rasterAnimation`, `locusFlip`,
and pending interaction history. Correctness depends on cleanup and ordering
across many entry points.

**Direction:** introduce a small chart-owned model/transaction boundary with
explicit data, state, index, and history ownership. Make interaction and
animation controllers receive that boundary and return an explicit committed
change or transient preview. Keep the public D3 chart as a thin adapter and
lifecycle owner. Do this by moving one coherent responsibility at a time;
renaming variables or splitting the file without changing ownership would not
reduce the underlying complexity.

### 4. Make change impact and cache ownership explicit

**Priority: high.** Configuration effects are declared next to defaults in
`chart/config.js`, but edit effects are calculated in `data/operations.mjs`,
while `chart/chart.js` separately classifies presentation edits, dirty views,
index preparation and link-filter invalidation. `chart/runtime.js`, scene
indexes, tree caches, the Canvas backend and WebGPU each maintain additional
identity/revision checks. The recent animation and filtering fixes show why
these paths exist, but also how easily one entry point can miss a reuse or
invalidation decision.

**Direction:** define a small common change-impact result for committed
transactions: which biological indexes, visibility/filter results, layout,
presentation and tree/annotation data changed. Let the owner of each cache
derive validity from those impacts or revisions. Keep configuration metadata
in the base schema; do not build per-control fast paths or a generic event
framework. Document the invariants for retained source scenes and invalidate
conservatively whenever a dependency cannot be proved unchanged.

### 5. Consolidate transition semantics, not the renderer backends

**Priority: high.** A direct locus flip uses `canvasBackend.animateFlip` or a
single-locus preview; a batch flip uses `animateRaster`,
`createLocusFlipTransition` and GPU transforms; other edits use
`interpolateScene`; SVG has its own transitions. WebGPU also recognizes row
animations and maintains retained vertex, record and index buffers. This
multiplies eligibility, cancellation, and end-frame cases. The unstranded
issue above is one example of behavior diverging between paths.

**Direction:** establish one renderer-independent transition description:
source, target, visibility and geometry changes, elapsed progress, and
completion/cancellation rules. Backends may implement that description with
SVG transitions, Canvas bitmaps or GPU transforms, and fall back when needed.
The first step should share the endpoint/visibility and eligibility rules and
test their output against the committed scene. Keep backend-specific buffer
and canvas code where it is measurably useful; a universal drawing API would
add complexity and risk to the large-GCF work.

### 6. Put link representations behind one internal contract

**Priority: high.** Array links and `CompactLinkStore` have different edit,
index, validation and iteration paths. `instanceof CompactLinkStore` appears
through normalization, visibility, grouping, indexing, operations, runtime,
serialization and chart APIs. The editor recovers the compact store from a
special symbol on an array-shaped proxy. The proxy supports compatibility but
has surprising materialization costs for array operations. The batch bug in
finding 1 demonstrates that the two paths can behave differently.

**Direction:** define one internal link-table interface for identity, order,
endpoints, scores, iteration, filtering and transactional edits. Keep two
storage strategies if arbitrary IDs/metadata and compact canonical columns
both remain supported; do not expand millions of links to objects. Move
representation-specific decisions into those strategies and their indexes.
Give the editor a deliberate read/query interface rather than discovering an
implementation through `Symbol.for`. Decide the public read contract before
removing the proxy; this is an API change and requires coordinated host work.

### 7. Simplify persistence around one figure model

**Priority: medium.** `chart.project()` materializes an owned object snapshot,
`exportProjectBlob()` independently serializes a full project, and
`exportCompactProjectBlob()` creates a figure plus sparse edits against a
host-owned base. `loadCompactProject()` translates back through `project()`.
The full chart snapshot is named `clinker-project` even though the host has
its own project format and the compact figure has its own format. The
synchronous serializer and separate export paths create further rules around
ownership and preview state.

**Direction:** decide the public boundary deliberately while the format is
unreleased: clustermap owns a figure snapshot and the host owns its analysis
and project container. Represent the figure once, with a clear choice of
embedded versus external link data if both standalone and host use cases are
needed. Share validation and snapshot construction; use distinct encoders for
object or stream/Blob output only where their memory trade-offs require it.
Preserve atomic snapshot semantics and measure peak memory before choosing an
asynchronous or worker implementation. Do not delete standalone export until
its consumers and renderer-only use cases are covered.

### 8. Finish making configuration metadata authoritative

**Priority: medium.** `configSchema` already owns defaults and rendering
effects, which is a good direction. Validation choices, positive/signed
fields and ranges remain in separate path-keyed collections in
`chart/config.js`, while editor controls separately encode options and numeric
attributes in `appearance-panel.html`. Those definitions can drift.

**Direction:** keep type, bounds and choices beside each schema field and
derive model validation from them. Give the editor access to the subset needed
for controls or validate its markup against it. Keep human-facing grouping,
labels, layout and genuinely custom tree controls in the UI; generating the
entire editor from a schema is not required.

### 9. Keep shared geometry; avoid merging unrelated UI just to reduce files

**Priority: medium.** The scene already shares gene, link, annotation, tree,
camera and viewport logic across renderers. SVG export deliberately reuses the
SVG renderer. The editor shares `DataTable`, virtual rows, selection, field
controls and annotation forms. SVG, Canvas and WebGPU still contain distinct
paint code because their rendering and interaction models differ; the editor
and in-plot menus also have different presentation needs.

**Direction:** remove duplicated *rules* where the same visible feature can
diverge: link endpoints and transitions, visibility/adjacency decisions,
validation and shared action payloads. Keep native backend drawing and
purpose-specific UI components. Review the `annotations/overlay.mjs` imports
of editor components as a packaging/dependency boundary, but retain the
existing shared components if splitting them would duplicate behavior. File
count alone is not a reason to combine the editor's HTML, CSS and components.

### 10. Strengthen verification and retire unnecessary historical scaffolding

**Priority: high before structural changes.** The CI Playwright workflow runs
browser tests after `npm ci`, but does not run `npm test` or rebuild the
checked-in `dist` first. It can therefore test a stale bundle and miss unit
regressions. The current large-link browser benchmark measures useful compact
operations, but uses zero-duration transitions; the main rendering benchmark
uses much smaller fixtures and requires a historical Git revision and `d3-v1`
even for current-version comparisons. Recent GPU animation issues require a
real browser/GPU trace; mocked GPU tests cannot establish driver behavior or
frame time.

**Direction:** CI should run unit tests, build, check that generated bundles
match, then run a focused cross-renderer browser suite. Add differential
tests for array versus compact stores; transaction/inverse round trips; scene
patch versus full rebuild; and animation endpoints and interruption across
renderers. Keep a small real-WebGPU smoke run where hardware is available,
with a clearly reported fallback elsewhere. Add a repeatable large compact
workflow including batch flip, trim, alignment, selection, undo and save/load,
recording actual renderer and timing. The historical v1 comparison and its
dependency can be removed or isolated if it no longer informs decisions;
first preserve any benchmark history that remains useful.

## Suggested order

1. Fix findings 1 and 2, add cross-store and cross-renderer regression tests,
   and make CI build and run the tests it claims to validate.
2. Document ownership and change impacts, then centralize invalidation at the
   transaction boundary. Add differential checks before replacing paths.
3. Unify the internal link-table contract and move representation branching
   behind it, without changing the supported data or expanding large tables.
4. Consolidate transition semantics and make the chart controller delegate to
   model, interaction and rendering owners. Preserve the measured GPU and
   Canvas fast paths until equivalent behavior and large-data performance are
   demonstrated.
5. Rationalize figure persistence and configuration metadata, coordinating
   any public contract changes with hosts. Simplify editor/benchmark packaging
   after their consumers are clear.

Each step should have one clear ownership boundary, targeted equivalence
tests, and a large-GCF before/after measurement where it changes performance.
Do not combine them into a rewrite: that would make regressions and memory
changes harder to isolate.

## Verification performed

- `npm test`: 361 unit tests passed.
- `tests/browser/chart-lifecycle.spec.js`: 52 tests passed across Chromium and
  Firefox.
- `tests/browser/editor-regressions.spec.js`: 64 passed and one skipped in
  Chromium.
- Reproduced the mixed link-batch undo failure with ordinary array links and
  confirmed the compact store rejects the same batch before mutation.
- Reproduced the unstranded single-flip preview mismatch in a small synthetic
  scene.

The entire browser matrix, real WebGPU hardware, all project-format cases,
and peak memory were not rerun for this audit. Existing large-GCF traces and
prior checks inform the recommendations; they are not a benchmark of a proposed
refactor.
