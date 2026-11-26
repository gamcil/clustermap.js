# Rendering responsiveness benchmark

```sh
npm ci
npx playwright install chromium
npm run build
npm run bench:rendering
```

The benchmark mounts a deterministic synthetic fixture, then uses normal
Playwright mouse actions. Choose one size per run with `--fixture`:

| Fixture | Clusters | Genes per cluster | Total genes | Links |
| --- | ---: | ---: | ---: | ---: |
| `large` (default) | 100 | 100 | 10,000 | 9,900 |
| `larger` | 100 | 200 | 20,000 | 19,800 |

```sh
npm run bench:rendering -- --fixture larger --view overview
```

The larger fixture doubles genes and links while retaining the same 100 rows,
spacing, colours, and deterministic identities. Both sizes fit the same overview
camera, allowing comparisons at the same gene size and row spacing. At standard
zoom, extra genes primarily extend beyond the viewport; overview displays all
20,000 genes. Each size uses identical data across the five implementations.
Fixture name, dimensions, counts, and data hash are saved in metadata; CSV rows
also identify the fixture. This selection does not multiply the default run count.

**Pan out/back → zoom out/back → hover locus → gene click → drag, flip, and trim locus → reorder cluster.**

The trim drags the left handle past 20 genes (360px in standard view, 54px in
overview), using the same input steps as the other drags. It verifies the exact
snapped start boundary, unchanged end/orientation, and removal of exactly 20
visible genes. All implementations perform this through real pointer input.

The workload focuses on common v1/v2 plot interactions so each comparison uses
the same actions: pan/zoom, locus hover and edits, gene click, and cluster
reorder. Selection and tree interactions are excluded because the v1 reference
does not provide the corresponding behavior. Legend/scale controls are hidden to
keep the plot matched, and editor panels are outside this renderer benchmark.
Context menus are excluded because their overlay behavior is inconsistent across
views and renderers. This is broad core-plot coverage, not a benchmark of every
feature.

The page directly imports `onINP` from **web-vitals 5.1.0**. INP is retained as
page-level context; use the per-gesture measures below for renderer comparisons.
A `requestAnimationFrame` sampler records the **95th-percentile frame interval** across pan, zoom,
locus drag, trim, and cluster drag gestures. The sampler runs from the first animation
callback before each gesture through the first callback after release; wheel
sampling includes D3's gesture completion. Flip clicks, setup, screenshots, and
between-gesture waits are excluded from frame sampling. Intervals from separate
gestures are never joined. Raw intervals and sample counts are saved.

The harness also records **input-to-post-render-frame estimates** per gesture.
It timestamps the relevant page input (`pointermove` for hover, `click` for gene
click, `dblclick` for flip, `wheel` for zoom, and pointer events for drags), then
records callback execution time on the second `requestAnimationFrame`. The first
callback gives the chart a rendering opportunity before the sample is closed.
Raw samples are stored in each run JSON under `workflow.latencies`;
`gestures.csv` reports p50/p95 and sample count for each gesture. For the main
comparison, each gesture contributes one value: its input-latency p95. The
benchmark pools these gesture values equally across gestures and repeats, then
reports their p50 and p95 in `summary.csv`. This prevents long drags with many
pointer events from outweighing clicks, flips, or other actions. This estimates
response after a rendering opportunity; it does not confirm that pixels were
presented or measure physical input-to-display latency. Use trace mode to
investigate render and compositor timing.

Frame intervals describe browser callback cadence, not actual displayed frames
or input-to-display latency. Playwright action pacing also influences them;
compare the same workflow and environment across renderers. There are no custom
performance observers, continuous-delay scores, or load timings.
Mounting/setup has no trusted interactions and contributes no INP.

The local default is **five repetitions**; override with `--repeats N`.
Each repetition compares these five implementations in a shuffled block with a
fixed seed, at each of two views:

1. v1 SVG
2. v2 SVG
3. v2 Canvas with 2D canvas acceleration disabled
4. v2 Canvas with normal browser settings
5. v2 WebGPU

Five repetitions across both views produce 50 CSV rows. Use `--view overview`
for 25 workflows at full-plot zoom. Each workflow gets a fresh page/context.
There are no retries; failed runs remain saved.

The disabled Canvas case uses a separate Chromium process launched with
`--disable-accelerated-2d-canvas`; it does not disable the GPU globally. All other
cases use the normal browser process. Workflows run sequentially. Both processes
use the same Chromium build, viewport, and device scale factor.

Metadata records `SystemInfo.getInfo` for both processes, including actual launch
command lines, GPU devices, and graphics feature status. The disable flag is
checked against the actual command line. Raw graphics checkpoints record Canvas
context attributes at setup, during gestures, and at completion. These settings
and browser-wide diagnostics do not establish the backing implementation of
every canvas at every instant: “normal” means browser-managed acceleration,
not guaranteed hardware acceleration. CSV and summaries distinguish the two
Canvas cases by `implementation` and `canvas_acceleration`.

- v1: unchanged ES modules from the last local `master` revision at implementation
  time, `2f53e25a28d678294dbc050a22766861fc91f2b8`, served from Git. That revision
  specifies D3 major 6; the benchmark pins **6.7.0**. The harness hides legend
  and scale groups using CSS because v1 lacks their v2 visibility flags.
- v2: `dist/clustermap.mjs`, with Canvas adaptive resolution disabled. Both raster
  renderers must use the chosen device scale factor, including while dragging.
  WebGPU uses four-sample antialiasing to smooth geometry edges, alongside the
  browser's default Canvas/SVG antialiasing. Outputs are not pixel-identical.
- Headed Chromium uses the same **1440 × 900 viewport** in both views:
  **standard** is zoom 1; **overview** is zoom 0.13. The overview exposes all
  100 rows and the full 100- or 200-gene width, compared with roughly 14 rows
  and 60 genes per row in the standard view. The visual setup differs only by
  zoom; viewport, camera position, styles, and filtering are shared. The same
  interaction categories run in both views, with drag paths scaled to keep them
  usable at each zoom. Settings are recorded in metadata.
  Use `--view standard`, `--view overview`, or `--view both` (the default).
  The default device scale factor is detected from the native display (normally
  2 on Retina); the same value is applied to every renderer. Use
  `--device-scale-factor 1` or `2` for an explicit override. WebGPU context
  and actual GPU submissions are checked, and fallback invalidates the run.
- Input uses ordinary awaited Playwright actions. Standard uses 24 steps per
  drag, a 160px pan out/back, an 80px locus move, and a cluster move from index
  2 to 5. Overview uses 72 steps per drag, a 360px pan out/back, a 240px locus
  move, and a cluster move from index 2 to 30 (about 226px on screen). Each overview
  zoom gesture delivers 20 wheel inputs, spaced by at least 16ms, totalling the
  same wheel delta as standard. More input steps sustain motion for longer;
  slow renderers can take longer to process the same sequence. This is a
  repeatable action sequence, not a fixed-rate input or throughput benchmark.
  View and gesture settings are shared in `views.mjs` and recorded in metadata.
- Pan/zoom movement, locus offset/orientation, trim boundaries/visible gene count, and final cluster order are
  verified. Configured transitions are zero, but v1 retains its hardcoded 250ms
  peer-row animations during dragging.

`--output PATH` chooses a new/empty results directory. `--repeats 1 --smoke`
reduces pan/locus/trim drags to six steps and each zoom to one wheel input for a
functional check. Cluster reordering retains its normal step count so v1 does
not skip rows. `--headless` is available
for diagnostics; WebGPU may not be available there.
`--screenshots` saves full and detail images after measurement for checking
visual consistency, without adding screenshot work to the INP measurement.

`summary.csv` is the primary comparison: it reports all-interaction response
p50/p95, giving each gesture equal weight across repeats. `runs.csv` reports INP
and frame-interval p95 for each workflow as supporting context; `gestures.csv`
contains per-gesture detail. Raw JSON preserves the `web-vitals`
value and contributing entries, final state, and graphics checks. It also records
Web Vitals INP attribution when available: target, input delay, handler processing
duration, presentation delay, and Long Animation Frame script details. Long
Animation Frame details are only available for frames of at least 50 ms; shorter
interactions still have INP subpart timings. Metadata records versions,
bundle/fixture/lockfile hashes, dirty status, CPU/OS, viewport, resolution, and
execution order. Summaries are grouped by view and implementation.

INP covers qualifying discrete inputs within this mixed workflow; it does not
directly measure continuous pan/zoom latency, GPU throughput, or physical display
latency. Observer delivery is allowed to settle before reading the result.
Run on a plugged-in physical machine, close other applications, and record GPU,
display refresh rate, and interruptions alongside manuscript results.

For diagnosis only, `--profile` records a Chrome DevTools CPU profile per
workflow. Profiling adds overhead; these runs are marked in metadata and should
not be combined with ordinary benchmark results.

Use `--implementation v2/webgpu` (or another implementation name from the CSV)
to run only one renderer case. `--trace` additionally saves a Chrome Performance
trace, including browser rendering work. Both diagnostic modes add `bench:*`
action markers to identify pan, zoom, locus drag/flip/trim, and cluster drag phases.
For a single diagnostic run:

```sh
npm run bench:rendering -- --fixture larger --view standard --repeats 1 \
  --implementation v2/webgpu --profile --trace
```

Load `run-001.trace.json` in Chrome DevTools' Performance panel. The adjacent
JSON contains action marker times and INP entries; `run-001.cpuprofile` contains
the JavaScript sampling profile. Traced timings are diagnostic, not benchmark
comparisons.

Earlier format-6 runs used overview zoom 0.35 and shorter gestures; treat these
as different workloads.

Format-8 runs use shorter overview gestures than format-7 and add the disabled
Canvas case. Do not pool timings across these protocol versions.

Format-9 uses intermediate-length overview gestures (72 drag steps, 360px pan,
240px locus move, 28-row reorder, 20 wheel inputs per zoom). Three repetitions
remain the default. Format-8 results describe the earlier shorter workflow.

Format-10 adds selectable synthetic fixture sizes; `large` retains the original
data. Compare results using the recorded fixture, view, and gesture settings.

Format-11 adds the verified trim drag to the workflow and frame sampler. Later
cluster reordering therefore operates on a trimmed locus. Treat this as a new
workload; do not pool its timings with earlier workflows that omitted trimming.

Format-12 adds Web Vitals INP attribution to raw run data. Format-13 adds
per-input next-animation-frame estimates. Format-14 adds common hover/click/menu
actions and fixes the v1 entry-module path. Format-15 adds menu-compatible gene
metadata. Format-16 removes the unreliable context-menu step; don't pool results
across these protocol versions. Format-17 continuously samples input frames for
discrete-only gestures such as flip and adds the per-gesture `gestures.csv`.
Format-18 double-clicks a gene within the locus to isolate the flip from the
overlapping locus drag surface. Format-19 timestamps event receipt with the page
clock to keep input and animation-frame timestamps in the same clock domain; don't
pool latency measurements across this change. Format-20 positions the pointer
and lets the locus-hover transition settle before measuring the flip itself.
Format-21 timestamps animation-frame callback execution rather than its supplied
frame-start timestamp, avoiding negative delays when input is handled in the same
rendering update. Format-22 dispatches the flip's two press/release pairs at the
already-positioned pointer. Format-23 closes each latency sample on the second
RAF so the chart's first scheduled render can run before the sample is recorded.
Format-24 uses Playwright's native double-click sequence again so all resulting
browser events are observed. Format-25 reports latency by event type as well as
gesture. Format-26 filters each gesture to its relevant input event and reports
one row per gesture; flip latency uses only `dblclick`, excluding incidental
pointer movement. Format-27 computes the headline p50/p95 over per-gesture p95
values, with equal weight for each gesture across repeats. This prevents high
input counts in long gestures from diluting slower discrete interactions. Do not
compare primary summaries with earlier formats. Format-28 uses one 1440 × 900
viewport for both views and lowers overview zoom to 0.13 to keep the full fixture
visible; don't compare its overview timings with earlier formats.

## Renderer optimization status

Disabled gene/link labels now skip the Canvas overlay's viewport queries,
record traversal, and preview geometry calculations. Locus drag/flip previews
use GPU transforms for retained genes, tracks, and link endpoints. Canvas
continues to render text from the shared scene and previews.

Next: consider using instanced link records for ordinary rendering as well as
interaction previews; profile enabled text before adding overlay caching.

## Compact link-store baseline

Run `node --expose-gc bench/compact-links.mjs 2592111` to exercise a synthetic
compact table at the observed large-GCF link count. It reports stage durations
and post-GC Node RSS, heap and array-buffer sizes for table creation, indexing,
scene construction and best-match filtering. This is a repeatable CPU baseline;
it does not measure the real GCF, browser peak memory, project saving or GPU
memory. Use a fresh process for each comparison.
