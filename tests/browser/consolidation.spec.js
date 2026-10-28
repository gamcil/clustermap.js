import { test, expect } from "@playwright/test";
import { startTestServer } from "../helpers/server.mjs";
import { waitForPaint } from "../helpers/report.js";

let server;
test.beforeAll(async () => {
  server = await startTestServer('<!doctype html><style>body{margin:0}#plot{width:1500px;height:850px}</style><div id="plot"></div><script src="/node_modules/d3/dist/d3.min.js"></script>');
});
test.afterAll(() => server.close());
test.use({ viewport: { width: 1600, height: 950 } });
test.beforeEach(async ({ page }) => {
  await page.goto(server.url);
  await page.evaluate(async () => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const clusters = ["a", "b", "c"].map((uid) => ({ uid, name: `Cluster ${uid}`,
      loci: [{ uid: `locus-${uid}`, name: `Sequence ${uid}`, start: 0, end: 10000,
        genes: [0, 1, 2].map((index) => ({ uid: `${uid}${index}`, start: 100 + index * 2500,
          end: 1600 + index * 2500, strand: 1 })) }] }));
    window.input = { clusters, links: [], groups: [], tree: { root: "root", nodes: [
      { uid: "root", children: ["pair", "leaf-c"] },
      { uid: "pair", branchLength: 0.2, children: ["leaf-a", "leaf-b"] },
      { uid: "leaf-a", branchLength: 0.1, cluster: "a" },
      { uid: "leaf-b", branchLength: 0.2, cluster: "b" },
      { uid: "leaf-c", branchLength: 0.8, cluster: "c" },
    ] } };
    input.config = { updateGroups: false };
    input.groups = [0, 1, 2].map((index) => ({ uid: index, label: `Group ${index}`,
      genes: clusters.map(({ uid }) => `${uid}${index}`) }));
    window.chart = ClusterMap().config({ plot: { transitionDuration: 0, adaptiveResolution: false, fontFamily: "Arial" },
      tree: { width: 160, leafGuide: { show: true } }, legend: { show: false },
      cluster: { hideLocusLabels: true, labelAlignment: "left" } });
    d3.select("#plot").datum(input).call(chart);
  });
});

test("configuration snapshots and listener payloads cannot mutate live settings", async ({ page }) => {
  const result = await page.evaluate(() => {
    const palette = ["red", "blue"];
    chart.config({ tree: { colouring: { palette } } }); palette[0] = "green";
    const snapshot = chart.config(); snapshot.tree.colouring.palette[0] = "yellow";
    chart.on("change", (event) => { if (event.config) event.config.cluster.nameFontSize = 99; });
    chart.config({ cluster: { nameFontSize: 15 } });
    const before = chart.project();
    try { chart.config({ cluster: { nameFontSize: 0 } }); } catch {}
    return { palette: chart.config().tree.colouring.palette, size: chart.config().cluster.nameFontSize,
      unchanged: JSON.stringify(before) === JSON.stringify(chart.project()) };
  });
  expect(result).toEqual({ palette: ["red", "blue"], size: 15, unchanged: true });
});

test("batch trim respects a pretrimmed member and remains one undoable edit", async ({ page }) => {
  const result = await page.evaluate(() => {
    const state = chart.state();
    const loci = new Map(state.loci);
    loci.set("locus-a", { start: 2600, end: 4100, flipped: false, trimLeft: "a1", trimRight: "a1" });
    state.loci = [...loci];
    chart.state(state); chart.clearHistory();
    const before = chart.state();
    chart.trimLoci(["locus-a", "locus-b"]);
    const after = chart.state();
    chart.undo(); const undone = chart.state(), moreUndo = chart.canUndo();
    chart.redo();
    return { before, after, undone, moreUndo, redone: chart.state() };
  });
  const loci = new Map(result.after.loci);
  expect(loci.get("locus-a")).toMatchObject({ start: 2600, end: 4100, trimLeft: "a1", trimRight: "a1" });
  expect(loci.get("locus-b")).toMatchObject({ start: 100, end: 6600 });
  expect(result.undone).toEqual(result.before);
  expect(result.moreUndo).toBe(false);
  expect(result.redone).toEqual(result.after);
});

test("SVG tree edits, previews and history leave biological DOM untouched", async ({ page }) => {
  const result = await page.evaluate(() => {
    const observer = new MutationObserver(() => {});
    for (const node of document.querySelectorAll("g.clusters,g.links")) observer.observe(node,
      { attributes: true, childList: true, characterData: true, subtree: true });
    chart.patch([{ type: "tree.presentation.update", scope: "subtree", ids: ["pair"], changes: { collapsed: true } }]);
    chart.undo(); chart.redo();
    const before = chart.figureBounds();
    chart.previewTreePresentation([{ type: "tree.presentation.update", scope: "node", ids: ["pair"],
      changes: { label: { text: "A wide clade annotation ".repeat(8), fontSize: 32 } } }]);
    const during = chart.figureBounds();
    const hasPreview = Boolean(document.querySelector("text.tree-annotation"));
    chart.previewTreePresentation(null);
    const mutations = observer.takeRecords().length; observer.disconnect();
    return { mutations, before, during, after: chart.figureBounds(), hasPreview,
      triangles: document.querySelectorAll("polygon.tree-subtree").length,
      annotations: document.querySelectorAll("text.tree-annotation").length };
  });
  expect(result.mutations).toBe(0);
  expect(result.hasPreview).toBe(true);
  expect(result.during.maxX - result.during.minX).toBeGreaterThan(result.before.maxX - result.before.minX);
  expect(result.after).toEqual(result.before);
  expect(result.triangles).toBe(1);
  expect(result.annotations).toBe(0);
});

for (const renderer of ["svg", "canvas", "webgpu"]) {
  test(`${renderer}: subtree triangles persist, export and expand through the node menu`, async ({ page }) => {
    const point = await page.locator("circle.tree-node").nth(1).boundingBox();
    await page.evaluate((renderer) => {
      if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      chart.config({ plot: { renderer } }); chart.clearHistory();
    }, renderer);
    await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2, { button: "right" });
    const checkbox = page.getByRole("checkbox", { name: "Collapse subtree", exact: true });
    await checkbox.check();
    const inspect = () => page.evaluate(() => {
      const svg = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml");
      return { triangles: svg.querySelectorAll("polygon.tree-subtree").length,
        branches: svg.querySelectorAll("path.tree-branch").length,
        clusters: svg.querySelectorAll("g.cluster").length };
    });
    expect(await inspect()).toEqual({ triangles: 1, branches: 2, clusters: 3 });
    await page.evaluate(() => chart.undo());
    expect((await inspect()).triangles).toBe(0);
    await page.evaluate(() => { chart.redo(); chart.project(chart.project()); });
    expect(await inspect()).toEqual({ triangles: 1, branches: 2, clusters: 3 });
    const target = await page.evaluate(() => {
      const svg = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml");
      const points = svg.querySelector("polygon.tree-subtree").getAttribute("points").split(/[ ,]+/).map(Number);
      const camera = chart.state().camera;
      return { x: camera.x + (points[0] * 0.4 + points[2] * 0.6) * camera.k,
        y: camera.y + (points[1] * 0.4 + (points[3] + points[5]) * 0.3) * camera.k };
    });
    if (renderer !== "svg") {
      const alpha = await page.locator(renderer === "canvas" ? "canvas.clusterMapCanvas" : "canvas.clusterMapWebGpuOverlay")
        .evaluate((canvas, target) => {
          const rect = canvas.getBoundingClientRect();
          return canvas.getContext("2d").getImageData(Math.floor((target.x - rect.x) * canvas.width / rect.width),
            Math.floor((target.y - rect.y) * canvas.height / rect.height), 1, 1).data[3];
        }, target);
      expect(alpha).toBeGreaterThan(0);
    }
    await page.mouse.click(target.x, target.y, { button: "right" });
    await checkbox.uncheck();
    expect(await inspect()).toEqual({ triangles: 0, branches: 4, clusters: 3 });
  });
}

test("project notifications expose final state and listener errors preserve undo/redo", async ({ page }) => {
  const result = await page.evaluate(() => {
    const saved = chart.project();
    chart.patch([{ type: "clusters.update", ids: ["a"], changes: { name: "Other" } }]);
    chart.config({ cluster: { nameFontSize: 18 } });
    const states = [];
    const unsubscribe = chart.on("change", (event) => {
      if (["data.replace", "config.change", "state.replace"].includes(event.type)) states.push({
        name: chart.data().clusters[0].name, size: chart.config().cluster.nameFontSize,
        state: chart.state(), undo: chart.canUndo(), redo: chart.canRedo(),
      });
    });
    chart.project(saved); unsubscribe();
    const errors = [], previous = window.reportError;
    window.reportError = (error) => errors.push(error.message);
    const notifications = [];
    const stop = chart.on("change", (event) => {
      if (event.type === "data.apply") { notifications.push([chart.canUndo(), chart.canRedo()]); throw new Error("Consumer failed"); }
    });
    try {
      chart.patch([{ type: "clusters.update", ids: ["a"], changes: { name: "Edited" } }]);
      chart.undo(); chart.redo();
    } finally { stop(); window.reportError = previous; }
    return { states, savedState: saved.state, notifications, errors, name: chart.data().clusters[0].name };
  });
  expect(result.states).toHaveLength(3);
  for (const state of result.states) expect(state).toEqual({ name: "Cluster a", size: 12,
    state: result.savedState, undo: false, redo: false });
  expect(result.notifications).toEqual([[true, false], [false, true], [true, false]]);
  expect(result.errors).toEqual(["Consumer failed", "Consumer failed", "Consumer failed"]);
  expect(result.name).toBe("Edited");
});

test("export excludes hidden decorations and figure bounds exclude trailing legend spacing", async ({ page }) => {
  const result = await page.evaluate(() => {
    chart.config({ legend: { show: true, position: "right", columns: 2, columnWidth: 500 } });
    const svg = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml").documentElement;
    const measured = document.importNode(svg, true); measured.style.visibility = "hidden"; document.body.append(measured);
    const box = measured.querySelector("g.clusterMapG").getBBox();
    const extra = chart.figureBounds().maxX - (box.x + box.width); measured.remove();
    chart.config({ legend: { show: false }, scaleBar: { show: false }, colourBar: { show: false }, tree: { scaleBar: { show: false } } });
    const hidden = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml");
    return { extra, hidden: hidden.querySelectorAll("g.legend,g.scaleBar,g.colourBar,g.tree-scale-bar").length };
  });
  expect(Math.abs(result.extra)).toBeLessThan(3);
  expect(result.hidden).toBe(0);
});

for (const renderer of ["svg", "canvas", "webgpu"]) {
  test(`${renderer}: live trimming preserves figure height and committed state is undoable`, async ({ page }) => {
    const targets = await page.evaluate(() => {
      const locus = document.querySelector("g.cluster g.locus");
      const handle = locus.querySelector("rect.leftHandle").getBoundingClientRect();
      const gene = locus.querySelectorAll("polygon.genePolygon")[1].getBoundingClientRect();
      return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2,
        endX: gene.x + gene.width / 2 };
    });
    await page.evaluate((renderer) => { chart.config({ plot: { renderer } }); chart.clearHistory(); }, renderer);
    if (renderer === "webgpu") {
      const canvas = page.locator("canvas.clusterMapCanvas");
      await expect.poll(() => canvas.getAttribute("data-webgpu")).not.toBe("initializing");
      test.skip(await canvas.getAttribute("data-webgpu") === "unavailable", "No WebGPU adapter is available");
      await expect(canvas).toHaveAttribute("data-webgpu", "active");
    }
    const frame = page.locator(".clusterMapFigureSurface");
    const before = await frame.evaluate((node) => parseFloat(node.style.height));
    const state = await page.evaluate(() => chart.state());
    await page.mouse.move(targets.x, targets.y); await page.mouse.down();
    await page.mouse.move(targets.endX, targets.y, { steps: 8 }); await waitForPaint(page);
    expect(await frame.evaluate((node) => parseFloat(node.style.height))).toBeCloseTo(before, 5);
    await page.mouse.up(); await waitForPaint(page);
    expect(await frame.evaluate((node) => parseFloat(node.style.height))).toBeCloseTo(before, 5);
    expect(await page.evaluate(() => chart.state().loci.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => chart.canUndo())).toBe(true);
    await page.evaluate(() => chart.undo());
    expect(await page.evaluate(() => chart.state())).toEqual(state);
    await page.evaluate(() => chart.redo());
    const exported = await page.evaluate(() => {
      const svg = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml");
      return { labels: [...svg.querySelectorAll("text.clusterText")].map((node) => ({
        y: node.getAttribute("y"), baseline: node.getAttribute("dominant-baseline"), anchor: node.getAttribute("text-anchor"),
      })), guides: svg.querySelectorAll("line.tree-leaf-guide").length };
    });
    expect(exported.guides).toBe(2);
    expect(exported.labels).toHaveLength(3);
    for (const label of exported.labels) expect(label).toEqual({ y: "11", baseline: "central", anchor: "start" });
  });
}

test("editor cleanup preserves host highlights and destruction releases state before remounting", async ({ page }) => {
  const result = await page.evaluate(async () => {
    await import("/dist/editor-data-panel.mjs");
    const editor = document.createElement("clinker-data-panel"); editor.chart = chart; document.body.append(editor);
    chart.highlight(["a0"], { owner: editor }); chart.highlight(["b0"]); editor.remove();
    const hostHighlight = chart.highlight();
    document.body.append(editor); chart.highlight(["a0"], { owner: editor }); editor.remove();
    const released = chart.highlight();
    chart.config({ cluster: { spacing: 50 } }); chart.destroy();
    const destroyed = { state: chart.state(), data: chart.data(), undo: chart.canUndo(), redo: chart.canRedo(), bounds: chart.figureBounds() };
    d3.select("#plot").datum(input).call(chart);
    return { hostHighlight, released, destroyed, remounted: Boolean(chart.state()) };
  });
  expect(result.hostHighlight).toEqual(["b0"]);
  expect(result.released).toEqual([]);
  expect(result.destroyed).toEqual({ state: null, data: null, undo: false, redo: false, bounds: null });
  expect(result.remounted).toBe(true);
});
