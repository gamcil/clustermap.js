import { test, expect } from "@playwright/test";

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
