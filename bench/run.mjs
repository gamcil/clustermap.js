import { createServer } from "node:http";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createLargeTestingData, SYNTHETIC_FIXTURES } from "../fixtures/synthetic.mjs";
import { views } from "./views.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const BASELINE = "2f53e25a28d678294dbc050a22766861fc91f2b8"; // Last master revision.
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const repeats = Number(option("--repeats", "3"));
const fixtureName = option("--fixture", "large");
assert.ok(Object.hasOwn(SYNTHETIC_FIXTURES, fixtureName), "--fixture must be large or larger");
const fixtureDimensions = SYNTHETIC_FIXTURES[fixtureName];
const requestedView = option("--view", "both");
assert.ok(requestedView === "both" || requestedView in views, "--view must be standard, overview, or both");
const selectedViews = requestedView === "both" ? Object.keys(views) : [requestedView];
const requestedScale = option("--device-scale-factor", "native");
let deviceScaleFactor = requestedScale === "native" ? null : Number(requestedScale);
const output = resolve(option("--output", `benchmark-results/${new Date().toISOString().replaceAll(":", "-")}`));
const headless = args.includes("--headless"), smoke = args.includes("--smoke");
const profiling = args.includes("--profile"), tracing = args.includes("--trace");
assert.ok(Number.isInteger(repeats) && repeats > 0, "--repeats must be a positive integer");
assert.ok(requestedScale === "native" || Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 0, "Invalid device scale factor");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const json = (value) => JSON.stringify(value, null, 2);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fixture = JSON.stringify(createLargeTestingData(fixtureDimensions));
const legacyFiles = new Map(git("ls-tree", "-r", "--name-only", BASELINE, "src").split("\n")
  .filter((name) => name.endsWith(".js")).map((name) => [name, git("show", `${BASELINE}:${name}`)]));
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (path === "/bench/data.json") { response.setHeader("Content-Type", "application/json"); response.end(fixture); return; }
    let body;
    if (path.startsWith("/baseline/")) body = legacyFiles.get(path.slice(10));
    else {
      const filename = resolve(ROOT, `.${path === "/bench/" ? "/bench/index.html" : path}`);
      if (!filename.startsWith(`${ROOT}${sep}`)) { response.writeHead(403).end(); return; }
      body = await readFile(filename);
    }
    if (body == null) { response.writeHead(404).end(); return; }
    response.setHeader("Content-Type", path.endsWith("/") || extname(path) === ".html" ? "text/html" : "text/javascript");
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
const requestedImplementation = option("--implementation", "all");
const implementations = [
  { implementation: "v1/svg", version: "v1", renderer: "svg", canvas_acceleration: "default" },
  { implementation: "v2/svg", version: "v2", renderer: "svg", canvas_acceleration: "default" },
  { implementation: "v2/canvas-disabled", version: "v2", renderer: "canvas", canvas_acceleration: "disabled" },
  { implementation: "v2/canvas-normal", version: "v2", renderer: "canvas", canvas_acceleration: "default" },
  { implementation: "v2/webgpu", version: "v2", renderer: "webgpu", canvas_acceleration: "default" },
].filter((item) => requestedImplementation === "all" || item.implementation === requestedImplementation);
assert.ok(implementations.length, "Unknown --implementation");
let seed = 19451;
const order = Array.from({ length: repeats }, (_, i) => {
  const block = selectedViews.flatMap((view) => implementations.map((impl) => ({ ...impl, fixture: fixtureName, view, repeat: i + 1 })));
  for (let j = block.length - 1; j > 0; j--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const k = Math.floor(seed / 2 ** 32 * (j + 1));
    [block[j], block[k]] = [block[k], block[j]];
  }
  return block;
}).flat();

async function workflow(page, renderer, view) {
  const snapshot = () => page.evaluate(() => benchmark.state());
  const settle = () => page.evaluate(() => benchmark.settle());
  const initial = await snapshot(), checks = [];
  const steps = smoke ? 6 : view.dragSteps;
  async function phase(name, action) {
    const mark = async (edge) => {
      if (profiling || tracing) await page.evaluate((name) => performance.mark(name), `bench:${name}:${edge}`);
    };
    await mark("start");
    try { return await action(); }
    finally { await mark("end"); }
  }
  async function gesture(action) {
    await page.evaluate(() => benchmark.startFrames());
    try { await action(); }
    finally { await page.evaluate(() => benchmark.stopFrames()); }
  }
  async function drag(from, to, dragSteps = steps) {
    await page.mouse.move(from.x, from.y);
    await gesture(async () => {
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: dragSteps });
      await page.evaluate(() => benchmark.graphics()); // Check resolution while dragging.
      await page.mouse.up();
    });
    checks.push(await settle());
  }
  // Pan out and back, checking the intermediate camera so a no-op cannot pass.
  const edge = page.viewportSize().width - (view.panDistance > 0 ? 600 : 40);
  await phase("pan-out", () => drag({ x: edge, y: 30 }, { x: edge + view.panDistance, y: 30 }));
  assert.ok(Math.abs((await snapshot()).camera.x - initial.camera.x) > 100, "Pan did not move");
  await phase("pan-back", () => drag({ x: edge + view.panDistance, y: 30 }, { x: edge, y: 30 }));
  await page.mouse.move(edge, 30);
  async function zoom(direction) {
    await gesture(async () => {
      const count = smoke ? 1 : view.wheelSteps;
      for (let i = 0; i < count; i++) {
        await page.mouse.wheel(0, direction * view.wheelDelta / count);
        if (count > 1) await page.waitForTimeout(16);
      }
      checks.push(await settle());
    });
  }
  await phase("zoom-out", () => zoom(1));
  assert.ok((await snapshot()).camera.k < initial.camera.k * .8, "Zoom did not move");
  await phase("zoom-back", () => zoom(-1));
  const camera = (await snapshot()).camera;
  assert.ok(Math.abs(camera.k - initial.camera.k) < .01 && Math.hypot(camera.x - initial.camera.x, camera.y - initial.camera.y) < 2, "Camera did not return");

  let targets = await page.evaluate(() => benchmark.targets());
  await phase("locus-drag", () => drag(targets.locus, { x: targets.locus.x + view.locusDistance, y: targets.locus.y }));
  assert.ok(Math.abs((await snapshot()).locusOffset - initial.locusOffset - view.locusDistance / initial.camera.k) < 1, "Locus did not move");
  targets = await page.evaluate(() => benchmark.targets());
  await phase("locus-flip", async () => {
    await page.mouse.dblclick(targets.locus.x, targets.locus.y);
    checks.push(await settle());
  });
  assert.notEqual((await snapshot()).flipped, initial.flipped, "Locus did not flip");
  // Synthetic genes are 1,200 bp apart, projected to 18 world units. Drag
  // from the handle centre so both v1's nearest snap and v2's forward snap
  // select the same boundary, just before the next visible gene.
  targets = await page.evaluate(() => benchmark.targets());
  const beforeTrim = await snapshot();
  await phase("locus-trim", () => drag(targets.trimLeft, {
    x: targets.trimLeft.x + view.trimGenes * 18 * initial.camera.k,
    y: targets.trimLeft.y,
  }));
  const trimmed = await snapshot();
  assert.equal(trimmed.locusStart, beforeTrim.locusStart + view.trimGenes * 1200, "Unexpected trim boundary");
  assert.equal(trimmed.locusEnd, beforeTrim.locusEnd, "Trim moved the opposite boundary");
  assert.equal(trimmed.visibleGeneCount, beforeTrim.visibleGeneCount - view.trimGenes, "Unexpected visible gene count after trim");
  assert.equal(trimmed.flipped, beforeTrim.flipped, "Trim changed locus orientation");
  targets = await page.evaluate(() => benchmark.targets());
  // v1 reorders by crossing rows. Retain normal sampling even in smoke mode
  // so the long overview drag cannot skip entire rows between pointer moves.
  await phase("cluster-drag", () => drag(targets.label, { x: targets.label.x, y: targets.label.y + (view.reorderIndex - 2) * 62 * initial.camera.k }, view.dragSteps));
  const expected = [...initial.order];
  expected.splice(view.reorderIndex, 0, ...expected.splice(2, 1));
  assert.deepEqual((await snapshot()).order, expected, "Unexpected cluster order");
  if (renderer === "webgpu") {
    assert.ok(checks.every((value, i) => value.gpuSubmissions > (checks[i - 1]?.gpuSubmissions ?? 0)), "Missing WebGPU submissions");
  }
  return checks;
}

await mkdir(output, { recursive: true });
assert.equal((await readdir(output)).length, 0, "Output directory must be empty");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
// Canvas acceleration is a process setting. Reuse two isolated browser
// processes, but run only one workflow at a time and close its context afterward.
const browsers = {};
const browserEnvironments = {};
const rows = [];
try {
  browsers.default = await chromium.launch({ headless });
  if (deviceScaleFactor === null) {
    const display = await browsers.default.newPage({ viewport: null });
    deviceScaleFactor = await display.evaluate(() => devicePixelRatio);
    await display.close();
  }
  browsers.disabled = await chromium.launch({
    headless, args: ["--disable-accelerated-2d-canvas"],
  });
  for (const [mode, browser] of Object.entries(browsers)) {
    const session = await browser.newBrowserCDPSession();
    try {
      browserEnvironments[mode] = await session.send("SystemInfo.getInfo");
    } finally { await session.detach(); }
  }
  assert.ok(browserEnvironments.disabled.commandLine.includes("--disable-accelerated-2d-canvas"),
    "Canvas acceleration disable flag missing from browser process");
  await writeFile(resolve(output, "metadata.json"), json({ formatVersion: 12, baseline: BASELINE,
    currentCommit: git("rev-parse", "HEAD"), dirtyWorktree: git("status", "--porcelain"),
    browser: browsers.default.version(), browserEnvironments, playwright: JSON.parse(await readFile(resolve(ROOT, "node_modules/@playwright/test/package.json"))).version,
    d3Baseline: "6.7.0", webVitals: "5.1.0", cpu: os.cpus()[0]?.model, os: `${os.type()} ${os.release()}`,
    fixture: { name: fixtureName, ...fixtureDimensions,
      genes: fixtureDimensions.clusterCount * fixtureDimensions.genesPerCluster,
      links: (fixtureDimensions.clusterCount - 1) * fixtureDimensions.genesPerCluster },
    views: Object.fromEntries(selectedViews.map((view) => [view, views[view]])), requestedScale, deviceScaleFactor, headless, smoke, profiling, tracing, adaptiveResolution: false, seed: 19451, order,
    bundleSha256: hash(await readFile(resolve(ROOT, "dist/clustermap.mjs"))), fixtureSha256: hash(fixture),
    lockSha256: hash(await readFile(resolve(ROOT, "package-lock.json"))),
  }));
  for (const [index, run] of order.entries()) {
    const row = { ...run, status: "ok", inp_ms: null, frame_p95_ms: null, frame_samples: null, reason: "" }, raw = { run, errors: [] };
    const context = await browsers[run.canvas_acceleration].newContext({ viewport: views[run.view].viewport, deviceScaleFactor });
    try {
      const page = await context.newPage();
      page.on("pageerror", (error) => raw.errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/bench/?version=${run.version}&renderer=${run.renderer}&view=${run.view}`);
      await page.bringToFront();
      await page.waitForFunction(() => window.benchmarkReady);
      raw.setup = await page.evaluate(() => benchmark.mount());
      let profiler, tracer;
      if (tracing) {
        tracer = await context.newCDPSession(page);
        await tracer.send("Tracing.start", {
          categories: "devtools.timeline,blink.user_timing,v8.execute,latencyInfo,cc,gpu,toplevel,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.stack",
          transferMode: "ReturnAsStream",
        });
      }
      if (profiling) {
        profiler = await context.newCDPSession(page);
        await profiler.send("Profiler.enable");
        await profiler.send("Profiler.start");
      }
      raw.checks = await workflow(page, run.renderer, views[run.view]);
      if (profiling || tracing) raw.actionMarks = await page.evaluate(() =>
        performance.getEntriesByType("mark").filter((entry) => entry.name.startsWith("bench:")).map((entry) => entry.toJSON()));
      if (profiler) {
        const { profile } = await profiler.send("Profiler.stop");
        await writeFile(resolve(output, `run-${String(index + 1).padStart(3, "0")}.cpuprofile`), json(profile));
        await profiler.detach();
      }
      if (tracer) {
        const completed = new Promise((resolve) => tracer.once("Tracing.tracingComplete", resolve));
        await tracer.send("Tracing.end");
        const { stream } = await completed;
        const chunks = [];
        let eof = false;
        while (!eof) {
          const part = await tracer.send("IO.read", { handle: stream });
          chunks.push(Buffer.from(part.data, part.base64Encoded ? "base64" : "utf8"));
          eof = part.eof;
        }
        await tracer.send("IO.close", { handle: stream });
        await writeFile(resolve(output, `run-${String(index + 1).padStart(3, "0")}.trace.json`), Buffer.concat(chunks));
        await tracer.detach();
      }
      raw.result = await page.evaluate(() => benchmark.result());
      assert.ok(raw.result.inp, "web-vitals did not report INP");
      assert.deepEqual(raw.errors, [], "Page errors");
      row.inp_ms = raw.result.inp.value;
      assert.ok(raw.result.frames.count > 0, "No gesture frame intervals recorded");
      row.frame_p95_ms = raw.result.frames.p95;
      row.frame_samples = raw.result.frames.count;
      if (args.includes("--screenshots")) {
        await page.screenshot({ path: resolve(output, `run-${String(index + 1).padStart(3, "0")}.png`) });
        await page.screenshot({ path: resolve(output, `run-${String(index + 1).padStart(3, "0")}-detail.png`),
          clip: { x: 260, y: 50, width: 800, height: 350 } });
      }
    } catch (error) { row.status = "invalid"; row.reason = error.message; }
    finally { await context.close(); }
    rows.push(row);
    await writeFile(resolve(output, `run-${String(index + 1).padStart(3, "0")}.json`), json(raw));
    const columns = ["implementation", "canvas_acceleration", "fixture", "version", "renderer", "view", "repeat", "status", "inp_ms", "frame_p95_ms", "frame_samples", "reason"];
    const cell = (value) => value == null ? "" : `"${String(value).replaceAll('"', '""')}"`;
    await writeFile(resolve(output, "runs.csv"), [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n") + "\n");
    console.log(`${index + 1}/${order.length} ${run.implementation}/${run.fixture}/${run.view}: ${row.status}${row.reason ? ` — ${row.reason}` : ` (${row.inp_ms} ms)`}`);
  }
  console.table(selectedViews.flatMap((view) => implementations.map(({ implementation }) => {
    const values = rows.filter((r) => r.implementation === implementation && r.view === view && r.status === "ok").map((r) => r.inp_ms).sort((a, b) => a - b);
    const frames = rows.filter((r) => r.implementation === implementation && r.view === view && r.status === "ok")
      .map((r) => r.frame_p95_ms).sort((a, b) => a - b);
    const n = values.length;
    return { fixture: fixtureName, view, implementation, valid: `${n}/${repeats}`,
      median_ms: n ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2 : null,
      min_ms: values[0], max_ms: values.at(-1),
      median_frame_p95_ms: n ? (frames[Math.floor((n - 1) / 2)] + frames[Math.floor(n / 2)]) / 2 : null };
  })));
  console.log(`Results: ${output}`);
  if (rows.some((r) => r.status !== "ok")) process.exitCode = 1;
} finally {
  for (const browser of Object.values(browsers)) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
