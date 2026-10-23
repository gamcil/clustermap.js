import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Separate from the default Node suite: this check needs an installed browser.
// Serve the built chart and local D3, without CDN or network dependencies.
test("tree edits, history, projects, and static export through the public chart API", async (t) => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end('<!doctype html><style>body{margin:0}.host{width:1600px;height:850px}</style><div class="host" id="plot"></div><script src="/node_modules/d3/dist/d3.min.js"></script>');
      return;
    }
    const filename = resolve(root, `.${pathname}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filename);
      const type = extname(filename) === ".json" ? "application/json" : "text/javascript";
      response.writeHead(200, { "Content-Type": type });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const original = await page.evaluate(async () => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const data = await (await fetch("/fixtures/bua-genbank-tree.json")).json();
    const chart = ClusterMap().config({
      plot: { renderer: "svg", transitionDuration: 0 },
      tree: { width: 180, leafGuide: { show: true } },
      gene: { label: { show: false } },
    });
    window.testChart = chart;
    window.testInput = data;
    window.testChanges = [];
    d3.select("#plot").datum(data).call(chart);
    chart.on("change", (change) => testChanges.push(change.type));
    return chart.project();
  });
  await page.locator("#plot circle.tree-node").first().dispatchEvent("click");
  const rotated = await page.evaluate(() => testChart.project());
  const node = (project, uid) => project.data.tree.nodes.find((entry) => entry.uid === uid);
  assert.deepEqual(node(rotated, "root").children, [...node(original, "root").children].reverse());
  assert.ok(await page.evaluate(() => testChart.canUndo()));
  assert.ok(await page.evaluate(() => testChanges.includes("state.change")), "node flips notify frontend subscribers");
  assert.deepEqual(await page.evaluate(() => { testChart.undo(); return testChart.project(); }), original);
  assert.deepEqual(await page.evaluate(() => { testChart.redo(); return testChart.project(); }), rotated);

  // Drag one leaf over its sibling. The serialized tree must agree with the
  // visual order, and undo/redo must restore both representations together.
  await page.evaluate(() => testChart.clearHistory());
  const drag = await page.evaluate(() => {
    const tree = testChart.data().tree;
    const pair = tree.nodes.find((entry) => entry.uid === "aspergillus-pair-1");
    const clusters = pair.children.map((uid) => tree.nodes.find((entry) => entry.uid === uid).cluster);
    const label = (uid) => [...document.querySelectorAll("#plot g.cluster")]
      .find((group) => group.__data__.uid === uid).querySelector("text.clusterText").getBoundingClientRect();
    return clusters.map((uid) => { const box = label(uid); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
  });
  await page.mouse.move(drag[0].x, drag[0].y);
  await page.mouse.down();
  await page.mouse.move(drag[1].x, drag[1].y + 10, { steps: 8 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => testChart.project());
  assert.deepEqual(node(dragged, "aspergillus-pair-1").children, [...node(rotated, "aspergillus-pair-1").children].reverse());
  assert.deepEqual(await page.evaluate(() => { testChart.undo(); return testChart.project(); }), rotated);
  assert.deepEqual(await page.evaluate(() => { testChart.redo(); return testChart.project(); }), dragged);

  const saved = await page.evaluate(() => {
    testChart.config({ tree: { support: { precision: 2 }, branch: { width: 2 } }, cluster: { hideLocusCoordinates: true } });
    return JSON.parse(JSON.stringify(testChart.project()));
  });
  const restored = await page.evaluate((saved) => {
    const noTree = structuredClone(testChart.data());
    delete noTree.tree;
    testChart.data(noTree);
    testChart.config({ tree: { show: false, width: 60 } });
    testChart.project(saved);
    return testChart.project();
  }, saved);
  assert.deepEqual(restored, saved, "public project API restores data, settings, order, and camera");
  assert.equal(await page.evaluate(() => testChart.canUndo()), false, "project loads start with fresh history");
  const fresh = await page.evaluate(async (saved) => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const host = d3.select("body").append("div").attr("class", "host");
    const chart = ClusterMap().config({ plot: { renderer: "canvas", transitionDuration: 0 } });
    host.datum(testInput).call(chart);
    chart.project(saved);
    const result = chart.project();
    chart.destroy();
    if (chart.figureBounds() !== null) throw new Error("Destroyed charts must have no figure bounds.");
    host.remove();
    return result;
  }, saved);
  assert.deepEqual(fresh, saved, "a newly mounted chart loads the same project");

  const duringFlip = await page.evaluate(() => {
    const original = testChart.project();
    const gene = [...document.querySelectorAll("#plot polygon.genePolygon")].find((node) => getComputedStyle(node.parentElement).display !== "none");
    const box = gene.getBBox();
    const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(gene.getScreenCTM());
    testChart.config({ plot: { renderer: "canvas", transitionDuration: 2000 } });
    testChart.clearHistory();
    const beforeFlip = JSON.stringify(testChart.state());
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    let cancelled = 0;
    window.requestAnimationFrame = () => 987654321;
    window.cancelAnimationFrame = () => { cancelled++; };
    let result;
    try {
      document.querySelector("#plot canvas.clusterMapCanvas").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: point.x, clientY: point.y }));
      const before = JSON.stringify(testChart.project());
      const hadHistory = testChart.canUndo();
      cancelled = 0;
      const changes = [];
      const unsubscribe = testChart.on("change", (change) => changes.push(change.type));
      const bounds = testChart.figureBounds();
      unsubscribe();
      result = { bounds, started: beforeFlip !== JSON.stringify(testChart.state()), cancelled, changes,
        unchanged: before === JSON.stringify(testChart.project()), historyUnchanged: hadHistory === testChart.canUndo() };
    } finally {
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      testChart.project(original);
    }
    return result;
  });
  assert.equal(duringFlip.started, true, "exercise a deferred locus flip before its target layout exists");
  assert.equal(duringFlip.cancelled, 0, "measurement does not finish or cancel flip work");
  assert.deepEqual(duringFlip.changes, []);
  assert.equal(duringFlip.unchanged && duringFlip.historyUnchanged, true);

  const envelopes = await page.evaluate(() => {
    const before = testChart.project();
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, subtree: true });
    const svg = testChart.figureBounds();
    const mutations = observer.takeRecords().length;
    observer.disconnect();
    const unchanged = JSON.stringify(before) === JSON.stringify(testChart.project());
    testChart.config({ plot: { renderer: "canvas" } });
    const canvas = testChart.figureBounds();
    const getContext = HTMLCanvasElement.prototype.getContext;
    let visible2d = 0;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "2d" && this.matches("canvas.clusterMapCanvas[data-renderer=webgpu]")) visible2d++;
      return getContext.call(this, type, ...args);
    };
    let webgpu;
    try {
      testChart.config({ plot: { renderer: "webgpu" } });
      webgpu = testChart.figureBounds();
      testChart.config({ plot: { renderer: "canvas" } });
    } finally { HTMLCanvasElement.prototype.getContext = getContext; }
    testChart.config({ tree: { show: false } });
    const hidden = testChart.figureBounds();
    testChart.config({ tree: { show: true } });
    return { svg, canvas, webgpu, visible2d, hidden, unchanged, mutations };
  });
  assert.equal(envelopes.mutations, 0, "bounds measurement creates no figure DOM");
  assert.equal(envelopes.unchanged, true, "bounds measurement preserves data, state and config");
  assert.deepEqual(envelopes.svg, envelopes.canvas);
  assert.deepEqual(envelopes.webgpu, envelopes.canvas);
  assert.equal(envelopes.visible2d, 0, "measurement never acquires a 2D context on the WebGPU surface");
  assert.ok(Object.values(envelopes.canvas).every(Number.isFinite));
  assert.ok(envelopes.canvas.minX < envelopes.hidden.minX, "bounds include the visible tree");

  const annotationEnvelope = await page.evaluate(() => {
    const original = testChart.project();
    const baseline = testChart.figureBounds();
    baseline.minX = Infinity;
    const fresh = testChart.figureBounds();
    testChart.patch([{ type: "tree.presentation.update", scope: "node", ids: [original.data.tree.root],
      changes: { label: { text: "Long annotation ".repeat(40), fontSize: 80, fontStyle: "italic" } } }]);
    const annotated = testChart.figureBounds();
    testChart.config({ tree: { show: false } });
    const hidden = testChart.figureBounds();
    testChart.project(original);
    return { fresh, annotated, hidden };
  });
  assert.ok(Number.isFinite(annotationEnvelope.fresh.minX), "callers receive fresh, independent bounds");
  assert.ok(annotationEnvelope.annotated.maxX - annotationEnvelope.annotated.minX > envelopes.canvas.maxX - envelopes.canvas.minX);
  assert.deepEqual(annotationEnvelope.hidden, envelopes.hidden, "hidden annotations do not extend the envelope");

  const exportResult = await page.evaluate(() => {
    const inspect = (svg) => {
      const document = new DOMParser().parseFromString(svg, "image/svg+xml");
      return {
        nodes: [...document.querySelectorAll("circle.tree-node")].map((node) => [+node.getAttribute("cx"), +node.getAttribute("cy")]),
        labels: [...document.querySelectorAll("text.tree-support")].map((label) => ({ text: label.textContent, family: label.style.fontFamily })),
        interactive: document.querySelectorAll("[cursor], [tabindex], [pointer-events], g.hover, script").length,
      };
    };
    const svg = inspect(testChart.exportSvg());
    testChart.config({ plot: { renderer: "canvas" } });
    const canvas = inspect(testChart.exportSvg());
    return { svg, canvas, unchangedInput: testInput.tree };
  });
  assert.equal(exportResult.svg.interactive, 0);
  assert.equal(exportResult.canvas.interactive, 0);
  assert.equal(exportResult.svg.nodes.length, 4);
  assert.ok(exportResult.svg.labels.every((label) => label.family && /\.\d{2}$/.test(label.text)));
  exportResult.svg.nodes.forEach((position, index) => {
    assert.ok(Math.abs(position[0] - exportResult.canvas.nodes[index][0]) < 1);
    assert.equal(position[1], exportResult.canvas.nodes[index][1]);
  });
  assert.deepEqual(exportResult.unchangedInput, original.data.tree, "chart edits never mutate caller-owned tree data");

  const styled = await page.evaluate(async () => {
    const data = await (await fetch("/fixtures/tree-styling.json")).json();
    testChart.config({ plot: { renderer: "svg" } });
    testChart.data(data);
    testChart.clearHistory();
    return testChart.project();
  });
  const shapeStyles = () => page.evaluate(() => [...document.querySelectorAll("#plot .tree-branch, #plot .tree-stem")]
    .map((node) => ({ uid: node.__data__.uid, colour: node.getAttribute("stroke"), width: node.getAttribute("stroke-width") })));
  const automatic = await shapeStyles();
  assert.equal(automatic.find((mark) => mark.uid === "x:a").colour, "#267c9e");
  assert.equal(automatic.find((mark) => mark.uid === "y:c").colour, "#d7752d");
  assert.equal(await page.locator("#plot g.tree-cut").count(), 1);
  const annotated = await page.evaluate(() => {
    testChart.patch([
      { type: "tree.presentation.update", scope: "subtree", ids: ["x"], changes: { branch: { width: 4, colour: "#ff00aa" } } },
      { type: "tree.presentation.update", scope: "node", ids: ["x"], changes: { label: { text: "<script>plain text</script>", fontStyle: "italic" } } },
    ]);
    return testChart.project();
  });
  assert.deepEqual(await page.evaluate(() => { testChart.undo(); return testChart.project(); }), styled);
  assert.deepEqual(await page.evaluate(() => { testChart.redo(); return testChart.project(); }), annotated);
  assert.equal(await page.locator("#plot text.tree-annotation").textContent(), "<script>plain text</script>");
  assert.equal(await page.locator("#plot text.tree-annotation script").count(), 0);
  const atomic = await page.evaluate(() => {
    const before = JSON.stringify(testChart.project());
    let errors = 0;
    try { testChart.patch([{ type: "tree.presentation.update", scope: "node", ids: ["root"], changes: { branch: { width: 2 } } }]); } catch { errors++; }
    const bad = testChart.project(); bad.data.tree.distance.kind = "invalid";
    try { testChart.project(bad); } catch { errors++; }
    try { testChart.config({ tree: { colouring: { palette: [] } } }); } catch { errors++; }
    return { errors, unchanged: JSON.stringify(testChart.project()) === before };
  });
  assert.deepEqual(atomic, { errors: 3, unchanged: true });
  const preview = await page.evaluate(() => {
    const before = testChart.project();
    const operations = (cutHeight) => [{ type: "tree.presentation.update", scope: "tree", changes: { colouring: { cutHeight } } }];
    testChart.previewTreePresentation(operations(1));
    testChart.previewTreePresentation(operations(4));
    const savedDuringPreview = testChart.project();
    testChart.patch(operations(4));
    const after = testChart.project();
    testChart.undo();
    return { before, savedDuringPreview, after, undone: testChart.project() };
  });
  assert.deepEqual(preview.savedDuringPreview, preview.before);
  assert.deepEqual(preview.undone, preview.before, "a sequence of previews commits as one undo step");
  assert.equal(preview.after.data.tree.presentation.colouring.cutHeight, 4);

  const nodeCircle = page.locator("#plot circle.tree-node");
  await nodeCircle.first().dispatchEvent("contextmenu", { clientX: 200, clientY: 200 });
  await page.getByRole("button", { name: "Reset", exact: true }).waitFor({ state: "visible" });
  assert.deepEqual(await page.evaluate(() => testChart.project()), annotated, "right-click does not rotate or pan");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Reset", exact: true }).isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.matches("circle.tree-node")), true);
  await page.keyboard.press("Shift+F10");
  assert.equal(await page.getByRole("button", { name: "Reset", exact: true }).isVisible(), true);
  await page.keyboard.press("Escape");

  const rootPoint = await nodeCircle.first().evaluate((node) => {
    const point = new DOMPoint(+node.getAttribute("cx"), +node.getAttribute("cy")).matrixTransform(node.getScreenCTM());
    return { x: point.x, y: point.y };
  });
  const parity = await page.evaluate(() => {
    const inspect = () => {
      const doc = new DOMParser().parseFromString(testChart.exportSvg(), "image/svg+xml");
      return { labels: [...doc.querySelectorAll("text.tree-annotation")].map((label) => ({ text: label.textContent, size: label.getAttribute("font-size"), style: label.getAttribute("font-style") })),
        styles: [...doc.querySelectorAll(".tree-branch, .tree-stem")].map((mark) => [mark.getAttribute("stroke"), mark.getAttribute("stroke-width")]),
        interactive: doc.querySelectorAll("[tabindex], [role], [cursor], [aria-label], script").length };
    };
    const svg = inspect();
    const strokes = [];
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) { strokes.push([this.strokeStyle, this.lineWidth]); return stroke.apply(this, args); };
    try { testChart.config({ plot: { renderer: "canvas", minimap: { show: true } } }); }
    finally { CanvasRenderingContext2D.prototype.stroke = stroke; }
    return { svg, canvas: inspect(), strokes };
  });
  assert.deepEqual(parity.svg, parity.canvas);
  assert.equal(parity.svg.interactive, 0);
  assert.ok(parity.strokes.some(([colour, width]) => colour === "#ff00aa" && width === 4), "Canvas draws resolved subtree style");
  assert.deepEqual(parity.svg.labels, [{ text: "<script>plain text</script>", size: "10", style: "italic" }]);
  const beforeRasterMenu = await page.evaluate(() => testChart.project());
  await page.mouse.click(rootPoint.x, rootPoint.y, { button: "right" });
  await page.getByRole("button", { name: "Reset", exact: true }).waitFor({ state: "visible" });
  assert.deepEqual(await page.evaluate(() => testChart.project()), beforeRasterMenu);
  await page.getByLabel("Annotation text", { exact: true }).fill("Raster clade");
  assert.equal(await page.getByLabel("Annotation text", { exact: true }).inputValue(), "Raster clade", "Text editing keeps the node menu open");
  assert.equal(await page.evaluate(() => testChart.data().tree.presentation.nodes.root.label.text), "Raster clade");
  assert.deepEqual(await page.evaluate(() => { testChart.undo(); return testChart.project(); }), beforeRasterMenu);
  const persisted = await page.evaluate(() => {
    const project = JSON.parse(JSON.stringify(testChart.project()));
    testChart.project(project);
    return { project, reloaded: testChart.project() };
  });
  assert.deepEqual(persisted.project, persisted.reloaded);

  await page.evaluate(async () => {
    const { defineClinkerEditor } = await import("/dist/editor.mjs");
    defineClinkerEditor();
    const editor = document.createElement("clinker-editor"); document.body.append(editor); editor.chart = testChart;
  });
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  const editor = page.locator("clinker-editor");
  const slider = editor.getByLabel("Preview cut height", { exact: true });
  const historyBeforePreview = await page.evaluate(() => [testChart.canUndo(), testChart.canRedo()]);
  await slider.evaluate((node) => { node.dataset.retained = "true"; node.value = 2; node.dispatchEvent(new Event("input", { bubbles: true })); });
  await slider.press("Escape");
  assert.equal(await page.evaluate(() => testChart.data().tree.presentation.colouring.cutHeight), 5);
  assert.equal(await slider.inputValue(), "5");
  assert.deepEqual(await page.evaluate(() => [testChart.canUndo(), testChart.canRedo()]), historyBeforePreview);
  await slider.evaluate((node) => { node.value = 2; node.dispatchEvent(new Event("input", { bubbles: true })); });
  await slider.dispatchEvent("pointercancel");
  assert.equal(await page.evaluate(() => testChart.data().tree.presentation.colouring.cutHeight), 5);
  await slider.evaluate((node) => { node.value = 2; node.dispatchEvent(new Event("input", { bubbles: true })); });
  await slider.evaluate((node) => { node.value = 3; node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true })); });
  assert.equal(await page.evaluate(() => testChart.data().tree.presentation.colouring.cutHeight), 3);
  assert.equal(await slider.getAttribute("data-retained"), "true");
  await page.evaluate(() => testChart.undo());
  assert.equal(await page.evaluate(() => testChart.data().tree.presentation.colouring.cutHeight), 5);
  assert.deepEqual(errors, []);
});
