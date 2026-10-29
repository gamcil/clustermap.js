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

test("plot selection and batch actions resolve numeric IDs consistently", async ({ page }) => {
  const result = await page.evaluate(() => {
    const data = structuredClone(chart.data());
    data.clusters.forEach((cluster, index) => { cluster.loci[0].uid = index; });
    chart.data(data);
    chart.locusSelection(["0", "1", "missing"]);
    const selected = chart.locusSelection();
    chart.trimLoci(["0"]);
    const trimmed = new Map(chart.state().loci).get(0);
    chart.restoreLoci([0]);
    const restored = new Map(chart.state().loci).get(0);
    chart.remove({ loci: [1] });
    chart.locusSelection(["0", "1", 1, "2"]);
    return { selected, trimmed, restored, visible: chart.locusSelection() };
  });
  expect(result.selected).toEqual([0, 1]);
  expect(result.trimmed).toMatchObject({ start: 100, end: 6600 });
  expect(result.restored).toBeUndefined();
  expect(result.visible).toEqual([0, 2]);
});

test("gene identities survive delimiter collisions and project round trips", async ({ page }) => {
  const result = await page.evaluate(() => {
    chart.data({ clusters: [{ uid: "identity", loci: [
      { uid: "a:b", start: 0, end: 100, genes: [{ uid: "c", start: 10, end: 20, strand: 1 }] },
      { uid: "a", start: 0, end: 100, genes: [{ uid: "b:c", start: 30, end: 40, strand: -1 }] },
      { uid: "numeric", start: 0, end: 100, genes: [{ uid: 0, start: 50, end: 60, strand: 1 }] },
    ] }], links: [], groups: [] });
    chart.flipLoci(["a:b", "numeric"]);
    const snapshot = chart.state();
    const project = chart.project(); chart.project(JSON.parse(JSON.stringify(project)));
    return { version: snapshot.version, genes: snapshot.genes, restored: chart.state() };
  });
  expect(result.version).toBe(2);
  expect(new Map(result.genes).get("c")).toEqual({ start: 80, end: 90, strand: -1 });
  expect(new Map(result.genes).has("b:c")).toBe(false);
  expect(new Map(result.genes).get(0)).toEqual({ start: 40, end: 50, strand: -1 });
  expect(result.restored.genes).toEqual(result.genes);
});

test("project replacement cancels a deferred cluster commit", async ({ page }) => {
  const first = await page.locator("g.clusterInfo").nth(0).boundingBox();
  const second = await page.locator("g.clusterInfo").nth(1).boundingBox();
  const saved = await page.evaluate(() => {
    chart.config({ plot: { renderer: "canvas", transitionDuration: 0 } }); chart.clearHistory();
    const saved = chart.project();
    document.querySelector("canvas.clusterMapCanvas").addEventListener("pointerup", () => {
      window.dragWasCommitted = chart.canUndo();
      chart.project(saved);
    }, { once: true });
    return saved;
  });
  const x = first.x + first.width / 2;
  await page.mouse.move(x, first.y + first.height / 2); await page.mouse.down();
  await page.mouse.move(x, second.y + second.height / 2, { steps: 5 }); await page.mouse.up();
  await waitForPaint(page);
  expect(await page.evaluate(() => window.dragWasCommitted)).toBe(true);
  expect(await page.evaluate(() => chart.state())).toEqual(saved.state);
  expect(await page.evaluate(() => chart.canUndo())).toBe(false);
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
  for (const scaleGenes of [false, true]) {
    test(`${renderer}: flips and trim history preserve source order, scaleGenes=${scaleGenes}`, async ({ page }) => {
      const result = await page.evaluate(({ renderer, scaleGenes }) => {
        if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
        chart.config({ plot: { renderer, scaleGenes, transitionDuration: 0 } }); chart.clearHistory();
        const source = JSON.stringify(chart.data()), original = chart.exportSvg();
        chart.flipLoci(["locus-a"]);
        const flipped = chart.exportSvg(), sourceAfterFlip = JSON.stringify(chart.data()) === source;
        const exportedOrder = [...new DOMParser().parseFromString(flipped, "image/svg+xml")
          .querySelector("g.locus").querySelectorAll("g.gene")].map((node) => node.id.split("gene_")[1]);
        chart.undo(); const undone = chart.exportSvg() === original;
        chart.redo(); const redone = chart.exportSvg() === flipped;
        chart.patch([{ type: "genes.delete", ids: ["a1"] }]);
        chart.undo(); const restoredGene = chart.exportSvg() === flipped;
        const snapshot = chart.state(), loci = new Map(snapshot.loci), genes = new Map(snapshot.genes);
        const locus = loci.get("locus-a");
        locus.trimLeft = "a1"; locus.start = genes.get("a1").start;
        chart.state(snapshot);
        const beforeTrim = JSON.stringify(chart.project());
        chart.trimLoci(["locus-a", "locus-b"]);
        const trimmed = JSON.stringify(chart.project());
        const keptTrim = new Map(chart.state().loci).get("locus-a").trimLeft === "a1";
        chart.undo(); const trimUndo = JSON.stringify(chart.project()) === beforeTrim;
        chart.redo(); const trimRedo = JSON.stringify(chart.project()) === trimmed;
        const project = chart.project(); chart.project(project);
        return { sourceAfterFlip, undone, redone, restoredGene, keptTrim, trimUndo, trimRedo,
          sourceAfterReload: JSON.stringify(chart.data()) === source, exportedOrder };
      }, { renderer, scaleGenes });
      expect(result).toEqual({ sourceAfterFlip: true, undone: true, redone: true, restoredGene: true, keptTrim: true,
        trimUndo: true, trimRedo: true, sourceAfterReload: true, exportedOrder: ["a0", "a1", "a2"] });
    });
  }

  test(`${renderer}: flip completion and cancellation stay safe across interruptions`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const result = await page.evaluate(async (renderer) => {
      const track = document.querySelector("g.locus line.trackBar").getBoundingClientRect();
      const point = { x: track.x + track.width * 0.9, y: track.y + track.height / 2 };
      if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      chart.config({ plot: { renderer, transitionDuration: 10000 } }); chart.clearHistory();
      const figure = () => {
        const svg = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml");
        const genes = [...svg.querySelectorAll("g.gene")].map((gene) =>
          [gene.id, gene.querySelector("polygon.genePolygon").getAttribute("points")]).sort(([a], [b]) => a.localeCompare(b));
        return JSON.stringify({ state: chart.state(), genes });
      };
      const saved = chart.project(), original = figure();
      const startFlip = () => {
        const surface = renderer === "svg" ? document.querySelector("g.locus") : document.querySelector("canvas.clusterMapCanvas");
        surface.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: point.x, clientY: point.y }));
      };
      const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      let detachedPaints = 0;
      const clearRect = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if ((this.canvas.matches(".clusterMapCanvas,.clusterMapWebGpuOverlay")) && !this.canvas.isConnected) detachedPaints++;
        return clearRect.apply(this, args);
      };
      try {
        startFlip();
        const exported = figure(), canUndoExport = chart.canUndo();
        chart.undo(); const exportUndo = figure() === original;
        startFlip(); chart.highlight(["a0"]); figure();
        const highlightRecorded = chart.canUndo();
        chart.highlight([]); chart.undo();
        const highlightUndo = { recorded: highlightRecorded, restored: figure() === original };
        startFlip(); chart.rotateTreeNode("pair");
        chart.undo(); chart.undo();
        const rotationUndo = { restored: figure() === original, undo: chart.canUndo() };
        startFlip(); await settle();
        chart.undo();
        const undoDuring = { restored: figure() === original, undo: chart.canUndo(), redo: chart.canRedo() };
        startFlip();
        chart.config({ plot: { renderer: renderer === "svg" ? "canvas" : "svg" } });
        chart.undo(); chart.undo();
        const switchUndo = { restored: figure() === original, undo: chart.canUndo() };
        startFlip();
        const replacement = structuredClone(saved.state); replacement.clusterOrder = ["b", "a", "c"];
        let flipOrder;
        const stop = chart.on("change", (event) => {
          if (event.type === "state.change") flipOrder = [...chart.data().tree.nodes.find((node) => node.uid === "pair").children];
        });
        chart.state(replacement); stop(); await settle();
        const reordered = chart.state().clusterOrder.join() === "b,a,c";
        chart.undo(); chart.undo();
        const stateReplacement = reordered && flipOrder?.join() === "leaf-a,leaf-b" && figure() === original;
        chart.clearHistory();
        startFlip(); await settle();
        chart.project(saved); await settle();
        const reload = { restored: figure() === original, undo: chart.canUndo(), redo: chart.canRedo() };
        startFlip(); await settle();
        chart.data({ clusters: [], links: [], groups: [] }); await settle();
        const dataReplacement = { clusters: chart.data().clusters.length, loci: chart.state().loci.length, undo: chart.canUndo() };
        chart.project(saved);
        startFlip(); await settle();
        chart.destroy(); await settle();
        return { flippedExport: exported !== original, canUndoExport, exportUndo, highlightUndo, rotationUndo, undoDuring, switchUndo, stateReplacement, reload, dataReplacement,
          detachedPaints, destroyed: chart.state() === null };
      } finally { CanvasRenderingContext2D.prototype.clearRect = clearRect; }
    }, renderer);
    expect(result).toEqual({ flippedExport: true, canUndoExport: true, exportUndo: true,
      highlightUndo: { recorded: true, restored: true }, rotationUndo: { restored: true, undo: false },
      undoDuring: { restored: true, undo: false, redo: true }, switchUndo: { restored: true, undo: false },
      stateReplacement: true, reload: { restored: true, undo: false, redo: false },
      dataReplacement: { clusters: 0, loci: 0, undo: false }, detachedPaints: 0, destroyed: true });
    expect(errors).toEqual([]);
  });

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

test("config, state and batch edits finish history before notifying listeners", async ({ page }) => {
  const results = await page.evaluate(() => {
    const results = [], previous = window.reportError;
    const errors = [];
    window.reportError = (error) => errors.push(error.message);
    try {
      for (const kind of ["config", "state", "batch"]) {
        chart.clearHistory();
        const before = JSON.stringify(chart.project()), events = [];
        const stop = chart.on("change", (event) => {
          if (!["config.change", "state.replace", "loci.trim", "history.change"].includes(event.type)) return;
          events.push({ type: event.type, undo: chart.canUndo(), redo: chart.canRedo() });
          if (event.type !== "history.change") throw new Error("Consumer failed");
        });
        if (kind === "config") chart.config({ cluster: { spacing: 73 } });
        else if (kind === "state") {
          const state = chart.state(); state.camera.x += 17; chart.state(state);
        } else chart.trimLoci(["locus-a", "locus-b"]);
        const after = JSON.stringify(chart.project());
        chart.undo(); const restored = JSON.stringify(chart.project()) === before;
        chart.redo(); const replayed = JSON.stringify(chart.project()) === after;
        stop(); results.push({ kind, events, restored, replayed });
      }
    } finally { window.reportError = previous; }
    return { results, errors };
  });
  expect(results.errors).toHaveLength(9);
  for (const { kind, events, restored, replayed } of results.results) {
    expect(restored).toBe(true); expect(replayed).toBe(true);
    const type = kind === "config" ? "config.change" : "state.replace";
    expect(events).toEqual([
      { type: kind === "batch" ? "loci.trim" : type, undo: true, redo: false },
      { type: "history.change", undo: true, redo: false },
      { type, undo: false, redo: true }, { type: "history.change", undo: false, redo: true },
      { type, undo: true, redo: false }, { type: "history.change", undo: true, redo: false },
    ]);
  }
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
