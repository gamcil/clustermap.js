# Clinker integration: large GCF performance

This handoff is for the Clinker web application. The original investigation is in `clinker/docs/clustermap-large-gcf-performance-handoff.md`. The input used there is `/Users/gamcil/Downloads/gcf-GCF-v2-323761-2026-11-25` (961 GenBank files). The retained-link count has not been measured. A Firefox heap census found approximately 4.15 GiB of reported shallow sizes in one reachable heap graph; it does not identify owners or peak process memory.

## Dependency and current status

The clustermap checkout contains these commits:

- `674b74e`: camera-only updates and `fitFigure()`.
- `c5edde7`: tree-only replacement.
- `1a9e99d`: fewer temporary allocations during link filtering.
- `b63e2f9`: check WebGPU buffer limits before creating oversized buffers; fall back to Canvas.
- `2a2d1e1`: expose renderer status and fallback events.
- `791f5d2`: reuse link indexes and unchanged scene records, and reduce link-index and animation allocation.

Clinker's `web/package.json` currently pins a different clustermap commit; update the pin and lockfile to a revision containing the required changes, then rebuild and verify the packaged vendor assets. `web/build.sh` runs `npm ci`, so it restores the pinned dependency.

These changes do not yet make the scene proportional to drawable links, solve WebGPU capacity via batching, or eliminate project snapshot cloning. Do not treat them as a complete fix for the large GCF.

## Integrate tree and camera updates

In `web/src/tree-import.mjs`:

1. Replace tree installation via `chart.data({ ...chart.data(), tree: ... })` with `chart.tree(next)`, including the import-dialog path. The API clones and validates the tree, checks tree-linked annotations, retains the existing biological data and indexes, adopts the tree leaf order, redraws, and clears history. It can still perform substantial geometry work for changed row positions.
2. Replace removal via `chart.data(...)` with `chart.tree(null)`. Removal clears history and **retains the current row order**. Clinker's computed/default-order branches currently follow removal with `chart.state({ ...chart.state(), clusterOrder: [] })`; preserve that behavior until a separate efficient order-reset API exists. That general state replacement can still rebuild the scene.
3. Replace `frameTree`'s bounds and camera calculation plus `chart.state(...)` with `chart.fitFigure()`. Its defaults use 20 world units of padding and a minimum readable scale of 1 for raster renderers (0 for SVG), constrained by configured zoom limits. Like the previous Clinker framing calculation, large raster figures can be cropped. It changes only the camera and does not change history. Retain or remove the existing `clearHistory()` only after verifying the intended history semantics; tree replacement already clears it.
4. Preserve inactive imported trees and similarity dendrograms, compatibility validation, selected-source behavior, and error handling. `chart.tree()` returns a copy; `chart.data().tree` remains readable. Tree replacement mutates the existing chart data object rather than replacing it, so review the dialog's `targetData === target.data()` freshness check: it no longer detects a tree-only replacement. Use an explicit revision or invalidate pending operations on `tree.replace` and other relevant changes.
5. Tree-linked annotation groups may make removal or replacement invalid; the API rejects invalid changes atomically. Test and provide a useful error rather than silently discarding annotations.

Do not use `chart.data()` replacement merely to install a tree, and do not substitute `chart.camera()` for `fitFigure()` unless Clinker needs a custom camera policy. General `data()` and `state()` retain their existing semantics.

## Renderer fallback

Once the status API is included in the dependency, inspect `chart.rendererStatus()` and subscribe to `chart.on('change', listener)` for `renderer.change`. The status includes `requested`, `active`, `state`, and `reason`; WebGPU may be `initializing`, `active`, or `fallback` (with Canvas active). Surface a useful message when the requested GPU renderer falls back, without repeatedly warning on each frame. Check the current status after mounting as well as subscribing for later changes.

The buffer-limit guard avoids creating an invalid oversized binding. It intentionally falls back rather than dropping links, but it does not keep oversized figures on WebGPU. Clustermap still needs drawable-only GPU records or correctly ordered batches, plus tests with low device limits.

## Measurement and memory work

Create a repeatable run from the supplied input and a smaller correctness fixture. Record Clinker and clustermap revisions, browser/version, hardware, settings, requested and active renderer, and exact cluster, gene, retained-link, adjacent-pair-link and visible-link counts. Instrument separately: initial mount, tree installation, camera framing, node rotation, row-drag preview and release, work scheduled after release, filtering, scene/index construction, GPU upload, and project snapshot creation. Capture elapsed time, main-thread blocking, GC and peak/steady memory where the browser permits. Compare the same input and settings before and after each change; do not infer retained links from the reported GPU buffer size.

Clinker owns its full project format and currently retains analysis links as well as plot links. `web/src/viewer/viewer.mjs` calls `chart.project()` before constructing the Clinker project; that call clones the full figure data and can fail before serialization starts. Measure memory at analysis retention, figure creation, snapshot creation, serialization, download, parsing and import. Streaming JSON output alone does not bound snapshot or parse memory. Coordinate a lower-peak figure snapshot interface with clustermap that preserves committed tree presentation and has a clear consistency contract; do not pass mutable chart data into an asynchronous export without one. Any compact or shared analysis representation, streaming I/O, format versioning and backward compatibility belong to coordinated Clinker work.

The Firefox snapshot at `/Users/gamcil/Downloads/518402416.fxsnapshot` is approximately 420 MiB compressed and 3.19 GB serialized. Analyze it with streaming or other bounded-memory tooling; its census does not attribute object ownership.

## Validation

- Verify tree import, replacement, removal, switching between similarity/imported/default/manual orders, rotation, inactive-tree retention, stale dialogs, and tree-linked annotations. Check undo/redo and history clearing explicitly.
- Exercise SVG, Canvas and WebGPU or its fallback, including minimap, selection, hit testing, drag previews, release, animation, and renderer switching. Verify fallback status and reasons in the host.
- Verify identity thresholds, hidden links, groups, equal-identity ties and painter order. A currently nonadjacent link must reappear when its endpoints become adjacent, including after undo/redo.
- Save and reopen existing and newly exported projects, including tree presentation, inactive trees and analysis; verify SVG export. Report successful round trips and peak memory rather than assuming chunked serialization fixes export.
- Use a small reference fixture and the large GCF under identical settings before and after changes. Record remaining bottlenecks and any untested renderer or hardware paths.
