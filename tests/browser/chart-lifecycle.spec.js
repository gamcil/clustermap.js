import { test, expect } from "@playwright/test";

for (const renderer of ["svg", "canvas"]) {
  test(`label alignment and tree guides reuse link data with ${renderer}`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:8080/demo/?fixture=burnettii&test=1&renderer=${renderer}`);
    await page.waitForFunction(() => Boolean(window.__demoChart));
    const result = await page.evaluate((renderer) => {
      const chart = window.__demoChart, links = chart.data().links;
      const iterator = links[Symbol.iterator]; let iterations = 0;
      links[Symbol.iterator] = function () { iterations++; return iterator.call(this); };
      chart.clearHistory();
      chart.config({ cluster: { alignLabels: true, labelAlignment: "left" } });
      const anchor = renderer === "svg" ? document.querySelector("g.clusterInfo text.clusterText").getAttribute("text-anchor") : null;
      chart.config({ tree: { leafGuide: { show: true } } });
      const shown = chart.config().tree.leafGuide.show;
      const guides = renderer === "svg" ? document.querySelectorAll("line.tree-leaf-guide").length : null;
      chart.undo(); const undone = chart.config().tree.leafGuide.show;
      chart.redo(); const redone = chart.config().tree.leafGuide.show;
      const canUndo = chart.canUndo();
      chart.config({ tree: { width: chart.config().tree.width + 10 } });
      chart.config({ cluster: { spacing: chart.config().cluster.spacing + 10 } });
      const beforeFilterChange = iterations;
      chart.config({ link: { threshold: 0.95 } });
      const afterFilterChange = iterations;
      delete links[Symbol.iterator];
      return { beforeFilterChange, afterFilterChange, anchor, shown, guides, undone, redone, canUndo };
    }, renderer);
    expect(result.beforeFilterChange).toBe(0);
    expect(result.afterFilterChange).toBeGreaterThan(0);
    if (renderer === "svg") { expect(result.anchor).toBe("start"); expect(result.guides).toBeGreaterThan(0); }
    expect(result.shown).toBe(true);
    expect(result.undone).toBe(false);
    expect(result.redone).toBe(true);
    expect(result.canUndo).toBe(true);
  });
}

test("link edits invalidate filtering before later geometry-only configuration changes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?test=1");
  await page.waitForFunction(() => Boolean(window.__demoChart));
  const result = await page.evaluate(() => {
    const chart = window.__demoChart;
    chart.config({ link: { threshold: 0, bestOnly: false }, plot: { transitionDuration: 0 } });
    const uid = chart.data().links.find((link) => !link.hidden).uid;
    const rendered = () => [...document.querySelectorAll("g.geneLinkG")].some((node) => d3.select(node).datum().uid === uid);
    const before = rendered();
    chart.clearHistory();
    chart.patch([{ type: "links.update", ids: [uid], changes: { hidden: true } }]);
    const hidden = rendered();
    chart.config({ cluster: { spacing: chart.config().cluster.spacing + 10 } });
    const afterGeometry = rendered();
    chart.undo(); chart.undo();
    return { before, hidden, afterGeometry, restored: rendered() };
  });
  expect(result).toEqual({ before: true, hidden: false, afterGeometry: false, restored: true });
});

for (const renderer of ["svg", "canvas"]) {
  test(`tree replacement updates figure bounds before fitting with ${renderer}`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:8080/demo/?fixture=burnettii&test=1&renderer=${renderer}`);
    await page.waitForFunction(() => Boolean(window.__demoChart));
    const result = await page.evaluate(() => {
      const chart = window.__demoChart, tree = chart.tree();
      chart.tree(null);
      chart.config({ plot: { minZoom: 0.01, transitionDuration: 0 } });
      const without = chart.figureBounds();
      chart.tree(tree).fitFigure({ minimumReadableScale: 0 });
      const fitted = chart.figureBounds();
      const surface = document.querySelector(".clusterMapFigureSurface");
      const surfaceWidth = parseFloat(surface.style.width);
      chart.config({ plot: { minZoom: 0.02 } });
      return { without, fitted, afterRedraw: chart.figureBounds(), surfaceWidth,
        refreshedSurfaceWidth: parseFloat(surface.style.width) };
    });
    expect(result.fitted.minX).toBeLessThan(result.without.minX);
    expect(result.fitted.minX).toBeCloseTo(result.afterRedraw.minX, 8);
    expect(result.surfaceWidth).toBeCloseTo(result.refreshedSurfaceWidth, 8);
  });
}

test("renderer status exposes WebGPU fallback to the host", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }));
  await page.goto("http://127.0.0.1:8080/demo/?test=1");
  await page.waitForFunction(() => Boolean(window.__demoChart));
  await page.evaluate(() => {
    const chart = window.__demoChart;
    window.__rendererEvents = [];
    chart.on("change", (event) => { if (event.type === "renderer.change") window.__rendererEvents.push(event.renderer); });
    chart.config({ plot: { renderer: "webgpu", transitionDuration: 0 } });
  });
  await expect.poll(() => page.evaluate(() => window.__demoChart.rendererStatus().state)).toBe("fallback");
  const result = await page.evaluate(() => ({ status: window.__demoChart.rendererStatus(), events: window.__rendererEvents }));
  expect(result.status).toEqual({ requested: "webgpu", active: "canvas", state: "fallback", reason: "WebGPU is unavailable." });
  expect(result.events.map((event) => event.state)).toEqual(["initializing", "fallback"]);
});

test("tree replacement preserves biological data, validates atomically and clears history", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?fixture=burnettii&test=1");
  await page.waitForFunction(() => Boolean(window.__demoChart));
  const result = await page.evaluate(() => {
    const chart = window.__demoChart;
    const data = chart.data();
    const links = data.links, clusters = data.clusters, groups = data.groups;
    const original = chart.tree();
    const order = chart.state().clusterOrder;
    chart.config({ plot: { transitionDuration: 0 } });
    chart.tree(null);
    const removed = !chart.data().tree && !chart.canUndo();
    const retainedOrder = chart.state().clusterOrder;
    const returned = chart.tree(original) === chart;
    original.nodes[0].uid = "changed-by-caller";
    const copy = chart.tree();
    copy.nodes[0].uid = "changed-by-getter";
    const preserved = chart.data() === data && data.links === links && data.clusters === clusters && data.groups === groups;
    const restoredOrder = chart.state().clusterOrder;
    let rejected = false;
    try { chart.tree({ root: "missing", nodes: [] }); } catch (error) { rejected = error instanceof TypeError; }
    return { removed, returned, retainedOrder, restoredOrder, order, preserved, rejected,
      node: chart.tree().nodes[0].uid, history: chart.canUndo(), hasTree: Boolean(chart.project().data.tree) };
  });
  expect(result.removed).toBe(true);
  expect(result.returned).toBe(true);
  expect(result.retainedOrder).toEqual(result.order);
  expect(result.restoredOrder).toEqual(result.order);
  expect(result.preserved).toBe(true);
  expect(result.rejected).toBe(true);
  expect(result.node).not.toMatch(/changed-by/);
  expect(result.history).toBe(false);
  expect(result.hasTree).toBe(true);
});

test("tree replacement retains excluded rows and projects the visible tree", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?fixture=burnettii&test=1&renderer=canvas");
  await page.waitForFunction(() => Boolean(window.__demoChart));
  const result = await page.evaluate(() => {
    const chart = window.__demoChart;
    const tree = chart.tree();
    const excluded = chart.data().clusters[0].uid;
    chart.remove({ clusters: [excluded] });
    chart.tree(null).tree(tree);
    return { excluded, state: chart.state(), visible: chart.visibleData().clusters.map((cluster) => cluster.uid),
      treeLeaves: chart.visibleData().tree.nodes.filter((node) => !node.children).map((node) => node.cluster),
      fullTree: chart.tree().nodes.filter((node) => !node.children).map((node) => node.cluster) };
  });
  expect(result.state.excludedClusters).toContain(result.excluded);
  expect(result.visible).not.toContain(result.excluded);
  expect(result.treeLeaves).not.toContain(result.excluded);
  expect(result.fullTree).toContain(result.excluded);
});

for (const renderer of ["svg", "canvas", "webgpu"]) {
  test(`fitFigure frames bounds without rebuilding with ${renderer}`, async ({ page }) => {
    await page.goto("http://127.0.0.1:8080/demo/?fixture=burnettii&test=1");
    await page.waitForFunction(() => Boolean(window.__demoChart));
    const result = await page.evaluate((renderer) => {
      const chart = window.__demoChart;
      chart.config({ plot: { renderer, minZoom: 0.01, maxZoom: 10, transitionDuration: 0 } });
      const bounds = chart.figureBounds();
      const surface = document.querySelector(renderer === "svg" ? "svg.clusterMap" : "canvas.clusterMapCanvas");
      const viewport = surface.getBoundingClientRect();
      const links = chart.data().links;
      let iterations = 0;
      const iterator = links[Symbol.iterator];
      links[Symbol.iterator] = function () { iterations++; return iterator.call(this); };
      const history = [chart.canUndo(), chart.canRedo()];
      const returned = chart.fitFigure({ padding: 20, minimumReadableScale: 0 }) === chart;
      const camera = chart.camera();
      const afterHistory = [chart.canUndo(), chart.canRedo()];
      let rejected = false;
      try { chart.fitFigure({ padding: -1 }); } catch (error) { rejected = error instanceof TypeError; }
      delete links[Symbol.iterator];
      return { bounds, viewport: { width: viewport.width, height: viewport.height }, camera,
        history, afterHistory, iterations, returned, rejected };
    }, renderer);
    const width = result.bounds.maxX - result.bounds.minX + 40;
    const height = result.bounds.maxY - result.bounds.minY + 40;
    const k = Math.max(0.01, Math.min(10, result.viewport.width / width, result.viewport.height / height));
    expect(result.camera.k).toBeCloseTo(k, 10);
    expect(result.camera.x).toBeCloseTo(Math.max(0, (result.viewport.width - width * k) / 2) - (result.bounds.minX - 20) * k, 8);
    expect(result.camera.y).toBeCloseTo(Math.max(0, (result.viewport.height - height * k) / 2) - (result.bounds.minY - 20) * k, 8);
    expect(result.afterHistory).toEqual(result.history);
    expect(result.iterations).toBe(0);
    expect(result.returned).toBe(true);
    expect(result.rejected).toBe(true);
  });

  test(`camera updates preserve history and link data with ${renderer}`, async ({ page }) => {
    await page.goto("http://127.0.0.1:8080/demo/?test=1");
    const result = await page.evaluate(async (renderer) => {
      const [{ default: clusterMap }, data] = await Promise.all([
        import("/src/chart/chart.js"),
        fetch("/fixtures/testing.json").then((response) => response.json()),
      ]);
      const host = document.querySelector(".chart-host");
      host.replaceChildren();
      const chart = clusterMap().config({ plot: { renderer, transitionDuration: 0 } });
      d3.select(host).datum(data).call(chart);
      chart.config({ plot: { minZoom: 0.2 } });
      const links = chart.data().links;
      let iterations = 0;
      const iterator = links[Symbol.iterator];
      links[Symbol.iterator] = function () { iterations++; return iterator.call(this); };
      const history = [chart.canUndo(), chart.canRedo()];
      const next = { x: 37, y: 52, k: 1.25 };
      const returned = chart.camera(next) === chart;
      const camera = chart.camera();
      camera.x = -1;
      const stateCamera = chart.state().camera;
      const afterHistory = [chart.canUndo(), chart.canRedo()];
      const surface = host.querySelector(renderer === "svg" ? "svg.clusterMap" : "canvas.clusterMapCanvas");
      const transform = d3.zoomTransform(surface);
      let rejected = false;
      try { chart.camera({ x: 0, y: 0, k: 0 }); } catch (error) { rejected = error instanceof TypeError; }
      delete links[Symbol.iterator];
      return { returned, stateCamera, history, afterHistory, iterations, rejected,
        transform: { x: transform.x, y: transform.y, k: transform.k } };
    }, renderer);
    expect(result).toEqual({ returned: true, stateCamera: { x: 37, y: 52, k: 1.25 },
      history: [true, false], afterHistory: [true, false], iterations: 0, rejected: true,
      transform: { x: 37, y: 52, k: 1.25 } });
  });
}

test("destroy releases a chart's generated surfaces", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/chart/chart.js"),
      fetch("/fixtures/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { renderer: "canvas" } });
    window.__chartLifecycle = { chart, host };
    d3.select(host).datum(data).call(chart);
  });

  await expect(page.locator("canvas.clusterMapCanvas")).toBeVisible();
  await page.evaluate(() => window.__chartLifecycle.chart.destroy());

  await expect(page.locator("canvas.clusterMapCanvas")).toHaveCount(0);
  await expect(page.locator("svg.clusterMap")).toHaveCount(0);
  await expect(page.locator("div.tooltip")).toHaveCount(0);
  await expect(page.locator("input.colourPicker")).toHaveCount(0);
});

test("tooltip dismissal stays isolated between chart instances", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?test=1");
  const opacities = await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/chart/chart.js"),
      fetch("/fixtures/testing.json").then((response) => response.json()),
    ]);
    const firstHost = document.querySelector(".chart-host");
    const secondHost = document.createElement("div");
    secondHost.style.width = "400px";
    secondHost.style.height = "300px";
    document.body.append(secondHost);
    firstHost.replaceChildren();
    const firstChart = clusterMap();
    const secondChart = clusterMap();
    d3.select(firstHost).datum(data).call(firstChart);
    d3.select(secondHost).datum(structuredClone(data)).call(secondChart);

    const tooltips = [...document.querySelectorAll("div.tooltip")];
    tooltips.forEach((tooltip) => {
      tooltip.dispatchEvent(new MouseEvent("mouseenter"));
    });
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return tooltips.map((tooltip) => tooltip.style.opacity);
  });

  expect(opacities).toEqual(["0", "0"]);
});

test("project Blob exports the committed snapshot without retaining live data", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?fixture=burnettii&test=1");
  await page.waitForFunction(() => Boolean(window.__demoChart));
  const result = await page.evaluate(async () => {
    const chart = window.__demoChart;
    chart.config({ plot: { transitionDuration: 0 } });
    const before = chart.project();
    chart.previewTreePresentation([{ type: "tree.presentation.update", scope: "tree",
      changes: { colouring: { cutHeight: 4 } } }]);
    const activePreview = JSON.stringify(chart.tree());
    const blob = chart.exportProjectBlob({ extensions: { analysis: { example: [1, 2] }, format: "ignored" } });
    const previewStillActive = JSON.stringify(chart.tree()) === activePreview;
    chart.previewTreePresentation(null);
    chart.config({ cluster: { spacing: chart.config().cluster.spacing + 5 } });
    const saved = JSON.parse(await blob.text());
    const { analysis, ...figure } = saved;
    chart.project(figure);
    return { figure, before, analysis, previewStillActive, loaded: chart.project() };
  });
  expect(result.figure).toEqual(result.before);
  expect(result.loaded).toEqual(result.before);
  expect(result.analysis).toEqual({ example: [1, 2] });
  expect(result.previewStillActive).toBe(true);
});

for (const renderer of ["svg", "canvas", "webgpu"]) {
  test(`compact link input supports chart edits, undo, row removal and project export with ${renderer}`, async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?test=1");
  await page.addScriptTag({ url: "/node_modules/d3/dist/d3.min.js" });
  const result = await page.evaluate(async (renderer) => {
    const { ClusterMap, CompactLinkStore } = await import("/dist/clustermap.mjs");
    const host = document.createElement("div"); host.style.width = "800px"; host.style.height = "400px";
    document.body.append(host);
    const ids = ["a", "b", "c"];
    const columns = { genes: ids, query: new Uint32Array([0, 0]), target: new Uint32Array([1, 2]),
      identity: new Float64Array([0.9, 0.8]), similarity: new Float64Array([1, 0.9]) };
    const links = new CompactLinkStore(columns);
    const data = { clusters: ids.map((uid) => ({ uid, name: uid, loci: [{ uid: `l-${uid}`, start: 0, end: 100,
      genes: [{ uid, start: 10, end: 20, strand: 1 }] }] })), links,
      groups: [{ uid: "group", genes: ids }], config: { updateGroups: false } };
    const chart = ClusterMap().config({ plot: { renderer, transitionDuration: 0 } });
    d3.select(host).datum(data).call(chart);
    const original = chart.data(), arrayView = Array.isArray(original.links), initial = original.links.map((link) => link.uid);
    chart.patch([{ type: "links.update", ids: ["link-0"], changes: { hidden: true } }]);
    const edited = chart.data().links[0].hidden, oldView = original.links[0].hidden;
    chart.patch([{ type: "links.delete", ids: ["link-1"] }]);
    const deleted = chart.data().links.map((link) => link.uid);
    chart.undo(); const restored = chart.data().links.map((link) => link.uid);
    chart.undo(); const undone = chart.data().links[0].hidden;
    chart.remove({ clusters: ["c"] });
    const visible = chart.visibleData().links.map((link) => link.uid);
    chart.undo();
    const project = chart.project(), blob = JSON.parse(await chart.exportProjectBlob().text());
    chart.patch([{ type: "links.update", ids: ["link-0"], changes: { label: "saved", identity: 0.7 } }]);
    chart.patch([{ type: "links.delete", ids: ["link-1"] }]);
    const expectedCompact = chart.project();
    const compact = JSON.parse(await chart.exportCompactProjectBlob({ base: links }).text());
    chart.undo(); chart.undo();
    const wrongBase = new CompactLinkStore({ ...columns, identity: new Float64Array([0.1, 0.8]) });
    let wrongRejected = false;
    try { chart.loadCompactProject(compact, { base: wrongBase }); } catch { wrongRejected = true; }
    const unchangedAfterReject = JSON.stringify(chart.project()) === JSON.stringify(project);
    chart.loadCompactProject(compact, { base: links });
    const compactRoundTrip = chart.project();
    chart.project(JSON.parse(JSON.stringify(project)));
    const roundTrip = chart.project(); chart.destroy(); host.remove();
    return { arrayView, initial, edited, oldView: oldView ?? null, deleted, restored, undone: undone ?? null,
      visible, project, blob, roundTrip, compact, expectedCompact, compactRoundTrip, wrongRejected, unchangedAfterReject };
  }, renderer);
  expect(result.arrayView).toBe(true);
  expect(result.initial).toEqual(["link-0", "link-1"]);
  expect(result.edited).toBe(true);
  expect(result.oldView).toBe(null);
  expect(result.deleted).toEqual(["link-0"]);
  expect(result.restored).toEqual(result.initial);
  expect(result.undone).toBe(null);
  expect(result.visible).toEqual(["link-0"]);
  expect(result.blob).toEqual(result.project);
  expect(result.roundTrip).toEqual(result.project);
  expect(result.compact.data).not.toHaveProperty("links");
  expect(result.compactRoundTrip).toEqual(result.expectedCompact);
  expect(result.wrongRejected).toBe(true);
  expect(result.unchangedAfterReject).toBe(true);
});
}

test("compact figure snapshot saves the committed tree during a preview", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?fixture=burnettii&test=1");
  await page.waitForFunction(() => Boolean(window.__demoChart));
  const result = await page.evaluate(async () => {
    const { CompactLinkStore } = await import("/dist/clustermap.mjs");
    const chart = window.__demoChart, data = chart.data();
    const genes = data.clusters.flatMap((cluster) => cluster.loci.flatMap((locus) => locus.genes)).slice(0, 2).map((gene) => gene.uid);
    const base = new CompactLinkStore({ genes, query: new Uint32Array([0]), target: new Uint32Array([1]),
      identity: new Float64Array([0.9]), similarity: new Float64Array([0.95]) });
    chart.data({ ...data, links: base, config: { ...data.config, updateGroups: false } });
    const before = chart.project();
    chart.previewTreePresentation([{ type: "tree.presentation.update", scope: "tree", changes: { colouring: { cutHeight: 4 } } }]);
    const preview = JSON.stringify(chart.tree());
    const snapshot = JSON.parse(await chart.exportCompactProjectBlob({ base }).text());
    const stillPreviewing = JSON.stringify(chart.tree()) === preview;
    chart.previewTreePresentation(null);
    chart.loadCompactProject(snapshot, { base });
    return { before, after: chart.project(), stillPreviewing };
  });
  expect(result.after).toEqual(result.before);
  expect(result.stillPreviewing).toBe(true);
});

test("compact link column ownership can be transferred in the browser", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/demo/?test=1");
  const result = await page.evaluate(async () => {
    const { CompactLinkStore } = await import("/dist/clustermap.mjs");
    const columns = { genes: ["a", "b"], query: new Uint32Array([0]), target: new Uint32Array([1]),
      identity: new Float64Array([0.9]), similarity: new Float64Array([1]) };
    const store = CompactLinkStore.fromTransferred(columns);
    return { queryBytes: columns.query.byteLength, identityBytes: columns.identity.byteLength, link: store.get("link-0") };
  });
  expect(result.queryBytes).toBe(0);
  expect(result.identityBytes).toBe(0);
  expect(result.link.query.uid).toBe("a");
});
