# Clinkermap UI integration handoff for Clinker

## Dependency

The clustermap changes, including the expanded bounds API and built `dist`
assets, are in commit `0d88d9267d72269754e2803aa72c4572833c34b1`.
The commit is local until pushed; a GitHub archive URL will work only once that
commit is available remotely. Clinker's `web/package.json` currently pins
`8cb76e06357190fddffc0116b3513a14d00f67c8`. Update the pin and lockfile to the
new commit or a release containing it, using Clinker's normal dependency process.
No Clinker files have been changed by this handoff.

## Tour: target a locus across renderers

`viewer.chart` exposes `screenBounds({ loci: [uid] })` for SVG, Canvas and
WebGPU. It returns `{ left, top, right, bottom, width, height }` in viewport CSS
pixels (the coordinate system of `getBoundingClientRect()`), or `null` when the
record, mounted surface or usable surface size is unavailable. The returned
rectangle is the full unclipped, committed scene bounds. It does not move the
camera or change selection and does not follow transient drag/animation previews.
Read it again if the camera or layout changes.

For the additional tour steps, query the displayed cluster name with
`chart.screenBounds({ clusterLabels: [clusterUid] })` and the tree branches and
interactive nodes with `chart.screenBounds({ tree: true })`. Both use the same
unclipped viewport coordinates and committed-layout contract as locus bounds.
They return `null` for a missing or hidden target. Tree bounds exclude leaf
guides, scale bars and annotations. A query may combine targets and returns
their union. These additions are included in the dependency commit named above.

Additional queries cover `{ legend: true }`, `{ legendItems: [groupUid] }`,
`{ scaleBar: true }`, `{ colourBar: true }`, `{ annotations: true }`, and
`{ annotationPanels: [panelUid] }`. Hidden decorations return `null` when
queried alone. Individual text, tree marks, legend symbols and annotation cells
are also queryable. See the clustermap README for the target list and scope.

In `web/src/viewer/tour.mjs`, the selection step currently targets `#plot`.
Use the first locus of the first visible cluster, checking for empty data:

```js
const chart = viewer.chart;
const uid = chart.visibleData()?.clusters[0]?.loci[0]?.uid;
if (uid) {
  chart.focus({ loci: [uid] });
  const bounds = chart.screenBounds({ loci: [uid] });
  // Position a temporary element for Driver.js using bounds, if available.
}
```

For Driver.js, create a temporary, non-interactive fixed-position element using
the returned rectangle, and remove it when leaving the step or closing the tour.
If no target is available or visible, fall back to `#plot`. The tour only needs
a static highlight: no per-frame tracking is necessary. Decide explicitly
whether to preserve and restore the previous camera if the tour uses `focus()`;
restoring the original editor state remains Clinker's responsibility.

## Toolbar and minimap

Clustermap places its selection toolbar at the upper left and moves it below the
minimap when horizontal space is insufficient. Remove the override for
`.plot-stage > .cm-plot-selection-toolbar` in `web/src/style.css`, which sets
`right: 12px` and `left: auto`. Retain the toolbar's existing mount/dispose
lifecycle in `web/src/viewer/viewer.mjs` and check narrow plot sizes in Clinker.

## Other behavior

- Initial framing now centers or aligns each axis independently. Raster figures
  retain their minimum readable scale, and restored project cameras still use
  the saved state. Check Clinker's own `configureMinimap` against the new framing.
- The tree menu groups clade styling and labels under disclosures; rooting reset
  and node/clade settings reset remain distinct. Existing tree operations and
  project data are unchanged.
- The editor now says **Figure editor**. Its search placeholders match each
  view, Appearance navigation highlights the destination, and identity filter
  and colour-scale controls have descriptions.
- Manual annotation creation can use a draft table showing cluster names and
  IDs. CSV/TSV/JSON entry remains available. Clinker continues to own file
  import and matching; use the existing annotation panel operations once the
  data has been mapped to cluster IDs.
- Library-owned popovers share control and surface styles. Clinker's own menus
  and dialogs are separate application UI and were not changed.

## Assets and validation in Clinker

After updating the dependency and lockfile, regenerate and check the embedded
viewer using the existing scripts from the Clinker repository root:

```sh
npm --prefix web run sync:assets
npm --prefix web run check:assets
npm --prefix web run test:browser
```

Review generated assets under `crates/clinker-cli/assets/viewer/`. Extend
`web/tests/browser/tour.test.mjs` to check the locus target and fallback, and
verify its cleanup and editor/camera restoration. Exercise toolbar/minimap
coexistence, annotation import, tree controls and project save/reopen with the
updated dependency. Clustermap's own unit suite and focused Chromium checks for
the new API, editor, tree and popovers passed before the commit.
