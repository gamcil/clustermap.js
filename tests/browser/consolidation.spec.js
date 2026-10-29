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

test("incompatible trees hide rooting controls in menus and the editor", async ({ page }) => {
  await page.evaluate(async () => {
    chart.data(await (await fetch("/fixtures/heatmap.json")).json());
    const node = document.querySelector("circle.tree-node");
    node.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 100, clientY: 100 }));
  });
  await expect(page.getByRole("button", { name: "Root here", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset rooting", exact: true })).toHaveCount(0);
  await expect(page.getByText("Rerooting is unavailable for dendrograms.", { exact: true })).toHaveCount(0);
  const result = await page.evaluate(() => {
    const before = JSON.stringify(chart.project());
    try { chart.patch([{ type: "tree.reroot", nodeId: chart.data().tree.nodes.find((node) => node.uid !== chart.data().tree.root).uid }]); }
    catch {}
    return JSON.stringify(chart.project()) === before;
  });
  expect(result).toBe(true);
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    await import("/dist/editor.mjs");
    const editor = document.createElement("clinker-editor"); editor.chart = chart; document.body.append(editor);
    await editor.openAppearance({ section: "tree" });
  });
  await expect(page.getByRole("button", { name: "Reset rooting", exact: true })).toHaveCount(0);
  await page.evaluate(() => chart.data(structuredClone(input)));
  await expect(page.getByRole("button", { name: "Reset rooting", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const data = structuredClone(input);
    data.tree.nodes.push({ uid: "unary", children: [data.tree.root] }); data.tree.root = "unary";
    chart.data(data);
    const node = document.querySelector("circle.tree-node");
    node.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 100, clientY: 100 }));
  });
  await expect(page.getByRole("button", { name: "Root here", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset rooting", exact: true })).toHaveCount(0);
});

test("invalid replacements preserve the mounted plot, configuration and history", async ({ page }) => {
  const result = await page.evaluate(() => {
    chart.trimLoci(["locus-a"]);
    chart.locusSelection(["locus-b"]);
    const host = document.querySelector("#plot"), datum = d3.select(host).datum();
    const before = JSON.stringify(chart.project()), figure = chart.exportSvg(), events = [];
    const stop = chart.on("change", (event) => events.push(event.type));
    let rejected = 0;
    const failures = [];
    const invalid = [
      (data) => { data.links.push({ uid: "bad", query: null, target: { uid: "a0" } }); },
      (data) => { data.clusters[0].loci[0].genes[0].start = NaN; },
      (data) => { data.groups[0].genes.push(data.groups[1].genes[0]); },
    ];
    for (const mutate of invalid) for (const project of [false, true]) {
      const candidate = chart.project(); mutate(candidate.data);
      candidate.config.cluster.nameFontSize = 30;
      try { project ? chart.project(candidate) : chart.data(candidate.data); }
      catch { rejected++; }
      if (JSON.stringify(chart.project()) !== before || chart.exportSvg() !== figure ||
          d3.select(host).datum() !== datum || !chart.canUndo() || chart.canRedo() ||
          JSON.stringify(chart.locusSelection()) !== '["locus-b"]') failures.push({ project });
    }
    stop();
    chart.undo(); const undone = chart.state().loci.length === 0;
    chart.redo(); const replayed = JSON.stringify(chart.project()) === before;
    chart.patch([{ type: "genes.update", ids: ["a0"], changes: { label: "Still editable" } }]);
    return { rejected, failures, events, undone, replayed, editable: chart.data().clusters[0].loci[0].genes[0].label };
  });
  expect(result).toEqual({ rejected: 6, failures: [], events: [], undone: true, replayed: true, editable: "Still editable" });
});

test("projects retain dangling links and memberships after deleting a gene", async ({ page }) => {
  const result = await page.evaluate(() => {
    const data = structuredClone(chart.data());
    data.links = [{ uid: "ab", query: { uid: "a0" }, target: { uid: "b0" }, identity: 0.9 }];
    chart.data(data);
    chart.patch([{ type: "genes.delete", ids: ["a0"] }]);
    const before = chart.exportSvg(), project = JSON.parse(JSON.stringify(chart.project()));
    chart.project(project);
    return { unchanged: before === chart.exportSvg(), links: chart.data().links,
      members: chart.data().groups[0].genes, deleted: !chart.data().clusters[0].loci[0].genes.some(({ uid }) => uid === "a0") };
  });
  expect(result.unchanged).toBe(true);
  expect(result.deleted).toBe(true);
  expect(result.links).toHaveLength(1);
  expect(result.members).toContain("a0");
});

test("rejected field edits preserve history and valid nullable fields round trip", async ({ page }) => {
  const result = await page.evaluate(() => {
    chart.trimLoci(["locus-a"]);
    const before = JSON.stringify(chart.project()), events = [];
    const stop = chart.on("change", (event) => events.push(event.type));
    let rejected = 0;
    for (const op of [
      { type: "groups.create", group: { uid: {} } },
      { type: "groups.create", group: { uid: "new", hidden: "false" } },
      { type: "genes.update", ids: ["a0"], changes: { colour: "bad" } },
      { type: "clusters.update", ids: ["a"], changes: { name: {} } },
    ]) {
      try { chart.patch([{ type: "genes.update", ids: ["a0"], changes: { label: "Must not change" } }, op]); }
      catch { rejected++; }
    }
    const unchanged = JSON.stringify(chart.project()) === before; stop();
    chart.patch([{ type: "groups.create", group: { uid: "new", label: null, colour: null, hidden: false } }]);
    const created = JSON.stringify(chart.project()); chart.undo();
    const undone = JSON.stringify(chart.project()) === before; chart.redo();
    const redone = JSON.stringify(chart.project()) === created;
    chart.project(JSON.parse(created));
    return { rejected, events, unchanged, undone, redone, reloaded: JSON.stringify(chart.project()) === created };
  });
  expect(result).toEqual({ rejected: 4, events: [], unchanged: true, undone: true, redone: true, reloaded: true });
});

test("group undo restores automatic grouping with retained deleted members", async ({ page }) => {
  const result = await page.evaluate(() => {
    const data = structuredClone(chart.data()); data.config.updateGroups = true;
    data.links = [{ uid: "ab", query: { uid: "a0" }, target: { uid: "b0" }, identity: 0.9 }];
    chart.data(data); chart.patch([{ type: "genes.delete", ids: ["a0"] }]);
    const before = JSON.stringify(chart.project());
    chart.patch([{ type: "groups.merge", targetId: 1, sourceIds: [0] }]);
    const after = JSON.stringify(chart.project()), manual = chart.data().config.updateGroups === false;
    chart.undo(); const restored = JSON.stringify(chart.project()) === before;
    const automatic = chart.data().config.updateGroups;
    chart.redo();
    return { manual, restored, automatic, redone: JSON.stringify(chart.project()) === after };
  });
  expect(result).toEqual({ manual: true, restored: true, automatic: true, redone: true });
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
  test(`${renderer}: root stem control supports history, export, projects and rerooting`, async ({ page }) => {
    await page.evaluate(async (renderer) => {
      if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      chart.config({ plot: { renderer } }); chart.clearHistory();
      await import("/dist/editor.mjs");
      const editor = document.createElement("clinker-editor"); editor.chart = chart; document.body.append(editor);
      await editor.openAppearance({ section: "tree" });
      window.branchCount = () => new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml").querySelectorAll("path.tree-branch").length;
      window.originalTree = JSON.stringify(chart.data().tree);
    }, renderer);
    const toggle = page.getByRole("checkbox", { name: "Show root stem", exact: true });
    await expect(toggle).not.toBeChecked();
    const before = await page.evaluate(() => branchCount());
    await toggle.check();
    expect(await page.evaluate(() => branchCount())).toBe(before + 1);
    expect(await page.evaluate(() => JSON.stringify(chart.data().tree) === originalTree)).toBe(true);
    await page.evaluate(() => chart.undo()); await expect(toggle).not.toBeChecked();
    expect(await page.evaluate(() => branchCount())).toBe(before);
    await page.evaluate(() => { chart.redo(); chart.project(JSON.parse(JSON.stringify(chart.project()))); });
    await expect(toggle).toBeChecked();
    expect(await page.evaluate(() => branchCount())).toBe(before + 1);
    await page.evaluate(() => { chart.patch([{ type: "tree.reroot", nodeId: "pair" }]); });
    expect(await page.evaluate(() => branchCount())).toBe(before + 1);
    await toggle.uncheck();
    expect(await page.evaluate(() => branchCount())).toBe(before);
  });

  for (const nodeId of ["pair", "leaf-a"]) {
    test(`${renderer}: rooting at ${nodeId} rebuilds ordering, persists reset and supports history`, async ({ page }) => {
      const result = await page.evaluate(({ renderer, nodeId }) => {
        if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
        chart.config({ plot: { renderer } }); chart.clearHistory();
        const original = chart.project(), originalSvg = chart.exportSvg();
        chart.patch([{ type: "tree.reroot", nodeId }]);
        const rooted = chart.project(), svg = chart.exportSvg();
        const nodes = new Map(rooted.data.tree.nodes.map((node) => [node.uid, node]));
        const order = (uid) => nodes.get(uid).children?.flatMap(order) || [nodes.get(uid).cluster];
        const matchesOrder = JSON.stringify(order(rooted.data.tree.root)) === JSON.stringify(chart.state().clusterOrder);
        chart.undo(); const undone = JSON.stringify(chart.project()) === JSON.stringify(original) && chart.exportSvg() === originalSvg;
        chart.redo(); const redone = JSON.stringify(chart.project()) === JSON.stringify(rooted) && chart.exportSvg() === svg;
        chart.project(JSON.parse(JSON.stringify(rooted)));
        const loaded = chart.exportSvg() === svg;
        chart.patch([{ type: "tree.reroot", nodeId: "leaf-c" }]);
        const count = chart.data().tree.nodes.length;
        chart.patch([{ type: "tree.reroot.reset" }]);
        const reset = chart.project(); chart.undo(); const resetUndo = Boolean(chart.data().tree.rooting);
        chart.redo();
        return { rooted: rooted.data.tree.root !== original.data.tree.root, matchesOrder, undone, redone, loaded,
          count, originalCount: original.data.tree.nodes.length, resetTree: reset.data.tree, originalTree: original.data.tree,
          unaryNodes: rooted.data.tree.nodes.filter((node) => node.children?.length === 1).length,
          hasStub: svg.includes("tree-root-stub"),
          resetOrder: reset.state.clusterOrder, originalOrder: original.state.clusterOrder, resetUndo,
          resetRedo: !chart.data().tree.rooting, resetSvg: chart.exportSvg() === originalSvg };
      }, { renderer, nodeId });
      expect(result.rooted).toBe(true); expect(result.matchesOrder).toBe(true); expect(result.undone).toBe(true);
      expect(result.redone).toBe(true); expect(result.loaded).toBe(true);
      expect(result.count).toBe(result.originalCount);
      expect(result.unaryNodes).toBe(0); expect(result.hasStub).toBe(false);
      expect(result.resetTree).toEqual(result.originalTree); expect(result.resetOrder).toEqual(result.originalOrder);
      expect(result.resetUndo).toBe(true); expect(result.resetRedo).toBe(true); expect(result.resetSvg).toBe(true);
    });
  }

  test(`${renderer}: leaf context menu roots the tree and editor resets rooting`, async ({ page }) => {
    const label = await page.locator("text.clusterText").filter({ hasText: "Cluster a" }).boundingBox();
    await page.evaluate(({ renderer, point }) => {
      if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      chart.config({ plot: { renderer } });
      const surface = renderer === "svg" ? [...document.querySelectorAll("text.clusterText")].find((node) => node.textContent === "Cluster a") : document.querySelector("canvas.clusterMapCanvas");
      surface.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: point.x, clientY: point.y }));
    }, { renderer, point: { x: label.x + label.width / 2, y: label.y + label.height / 2 } });
    await page.getByRole("button", { name: "Root here", exact: true }).click();
    expect(await page.evaluate(() => chart.data().tree.nodes.find((node) => node.uid === chart.data().tree.root).children[0])).toBe("leaf-a");
    await page.evaluate(async () => {
      await import("/dist/editor.mjs");
      const editor = document.createElement("clinker-editor"); editor.chart = chart; document.body.append(editor);
      editor.open({ tab: "appearance" }); await editor.openAppearance({ section: "tree" });
    });
    await page.getByRole("button", { name: "Reset rooting", exact: true }).click();
    expect(await page.evaluate(() => ({ root: chart.data().tree.root, canReset: Boolean(chart.data().tree.rooting) }))).toEqual({ root: "root", canReset: false });
  });

  test(`${renderer}: group history retains deleted gene memberships through edits and reload`, async ({ page }) => {
    const result = await page.evaluate((renderer) => {
      if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      chart.config({ plot: { renderer } });
      const data = structuredClone(chart.data()); data.groups[0].metadata = { note: "Original group" };
      chart.data(data);
      const original = JSON.stringify(chart.project());
      chart.patch([{ type: "genes.delete", ids: ["a0"] }]);
      const deleted = JSON.stringify(chart.project()), figure = chart.exportSvg(), checks = [];
      for (const operation of [
        { type: "groups.delete", ids: [0] },
        { type: "groups.merge", targetId: 1, sourceIds: [0] },
        { type: "groups.assignGenes", groupId: 1, geneIds: ["b0"] },
        { type: "groups.unassignGenes", geneIds: ["b0"] },
        { type: "groups.create", group: { uid: "new", label: "New" }, geneIds: ["b0"] },
        [
          { type: "groups.update", ids: [0], changes: { label: "Temporary label" } },
          { type: "groups.assignGenes", groupId: 1, geneIds: ["b0"] },
          { type: "groups.delete", ids: [0] },
        ],
      ]) {
        const operations = Array.isArray(operation) ? operation : [operation];
        chart.patch(operations); const edited = JSON.stringify(chart.project());
        chart.undo(); const undo = JSON.stringify(chart.project()) === deleted && chart.exportSvg() === figure;
        chart.redo(); const redo = JSON.stringify(chart.project()) === edited;
        chart.undo(); checks.push({ type: operations.map(({ type }) => type).join(", "), undo, redo });
      }
      chart.undo(); const geneUndo = JSON.stringify(chart.project()) === original && !chart.canUndo();
      chart.redo(); const geneRedo = JSON.stringify(chart.project()) === deleted;
      chart.project(JSON.parse(deleted));
      chart.patch([{ type: "groups.delete", ids: [0] }]); chart.undo();
      return { checks, geneUndo, geneRedo, reloaded: JSON.stringify(chart.project()) === deleted,
        group: chart.data().groups[0] };
    }, renderer);
    for (const check of result.checks) { expect(check.undo, check.type).toBe(true); expect(check.redo, check.type).toBe(true); }
    expect(result.geneUndo).toBe(true); expect(result.geneRedo).toBe(true); expect(result.reloaded).toBe(true);
    expect(result.group).toMatchObject({ uid: 0, genes: ["a0", "b0", "c0"], metadata: { note: "Original group" } });
  });

  test(`${renderer}: unknown strands survive flips, scaling, history and projects`, async ({ page }) => {
    const result = await page.evaluate((renderer) => {
      if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      const data = structuredClone(chart.data()); data.clusters[0].loci[0].genes[1].strand = 0;
      data.clusters[0].loci[0].genes[1].bio.strand = 0;
      chart.project({ ...chart.project(), data, state: null }); chart.config({ plot: { renderer } }); chart.clearHistory();
      const strands = () => {
        const genes = new Map(chart.state().genes);
        return chart.data().clusters[0].loci[0].genes.map((gene) => (genes.get(gene.uid) || gene.bio).strand);
      };
      const original = chart.exportSvg();
      chart.flipLoci(["locus-a"]); const flipped = strands();
      chart.config({ plot: { scaleGenes: false } }); chart.config({ plot: { scaleGenes: true } });
      const scaled = strands();
      chart.flipLoci(["locus-a"]); const twice = strands(), restoredFigure = original === chart.exportSvg();
      chart.undo(); const undone = strands(); chart.redo(); const redone = strands();
      chart.project(JSON.parse(JSON.stringify(chart.project())));
      return { flipped, scaled, twice, restoredFigure, undone, redone, loaded: strands() };
    }, renderer);
    expect(result).toEqual({ flipped: [-1, 0, -1], scaled: [-1, 0, -1], twice: [1, 0, 1],
      restoredFigure: true, undone: [-1, 0, -1], redone: [1, 0, 1], loaded: [1, 0, 1] });
  });

  for (const scaleGenes of [false, true]) {
    test(`${renderer}: deleted trim anchors survive history and project reload, scaleGenes=${scaleGenes}`, async ({ page }) => {
      const result = await page.evaluate(({ renderer, scaleGenes }) => {
        if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
        chart.config({ plot: { renderer, scaleGenes } });
        chart.flipLoci(["locus-a"]); chart.trimLoci(["locus-a"]);
        const before = JSON.stringify(chart.project());
        chart.patch([{ type: "genes.delete", ids: ["a2"] }]);
        const deleted = JSON.stringify(chart.project());
        const trim = new Map(chart.state().loci).get("locus-a");
        chart.undo(); const undone = JSON.stringify(chart.project()) === before;
        chart.redo(); const redone = JSON.stringify(chart.project()) === deleted;
        const figure = chart.exportSvg(); chart.project(JSON.parse(deleted));
        const reloaded = chart.exportSvg() === figure;
        chart.patch([{ type: "genes.delete", ids: ["a0", "a1"] }]);
        const empty = new Map(chart.state().loci).get("locus-a");
        return { trim, undone, redone, reloaded, empty };
      }, { renderer, scaleGenes });
      expect(result.trim).toMatchObject({ trimLeft: "a1", trimRight: "a0" });
      expect(result.undone).toBe(true); expect(result.redone).toBe(true); expect(result.reloaded).toBe(true);
      expect(result.empty?.trimLeft ?? null).toBeNull(); expect(result.empty?.trimRight ?? null).toBeNull();
    });
  }

  test(`${renderer}: scaling restores trimmed and excluded loci through history`, async ({ page }) => {
    const result = await page.evaluate((renderer) => {
      if (renderer === "webgpu") Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
      chart.config({ plot: { renderer } });
      chart.flipLoci(["locus-a"]); chart.trimLoci(["locus-a", "locus-b"]); chart.remove({ clusters: ["b"] });
      chart.clearHistory();
      const widths = () => {
        const genes = new Map(chart.state().genes);
        return chart.data().clusters.flatMap((cluster) => cluster.loci.flatMap((locus) => locus.genes.map((gene) => {
          const state = genes.get(gene.uid) || gene.bio; return state.end - state.start;
        })));
      };
      const original = widths(), trims = chart.state().loci, source = JSON.stringify(chart.data());
      chart.config({ plot: { scaleGenes: false } }); const packed = widths();
      chart.config({ plot: { scaleGenes: true } }); const scaled = widths();
      chart.undo(); const undone = widths(); chart.redo(); const redone = widths();
      chart.project(JSON.parse(JSON.stringify(chart.project())));
      return { original, packed, scaled, undone, redone, loaded: widths(), trims, loadedTrims: chart.state().loci,
        excluded: chart.state().excludedClusters, sourceUnchanged: JSON.stringify(chart.data()) === source };
    }, renderer);
    expect(result.packed).toEqual(result.original.map(() => 1000));
    expect(result.scaled).toEqual(result.original); expect(result.redone).toEqual(result.original);
    expect(result.undone).toEqual(result.packed); expect(result.loaded).toEqual(result.original);
    expect(result.loadedTrims).toEqual(result.trims);
    expect(result.excluded).toEqual(["b"]); expect(result.sourceUnchanged).toBe(true);
  });

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

test("patch, config, state and batch commits expose final rendering and history to listeners", async ({ page }) => {
  const results = await page.evaluate(() => {
    const results = [], previous = window.reportError;
    const errors = [];
    window.reportError = (error) => errors.push(error.message);
    try {
      for (const kind of ["patch", "config", "state", "batch"]) {
        chart.clearHistory();
        const before = JSON.stringify(chart.project()), beforeSvg = chart.exportSvg(), events = [], observed = [];
        const stop = chart.on("change", (event) => {
          if (!["data.apply", "config.change", "state.replace", "loci.trim", "history.change"].includes(event.type)) return;
          events.push({ type: event.type, undo: chart.canUndo(), redo: chart.canRedo() });
          observed.push({ project: JSON.stringify(chart.project()), svg: chart.exportSvg() });
          if (event.type !== "history.change") throw new Error("Consumer failed");
        });
        if (kind === "patch") chart.patch([{ type: "clusters.update", ids: ["a"], changes: { name: "Committed name" } }]);
        else if (kind === "config") chart.config({ cluster: { spacing: 73 } });
        else if (kind === "state") {
          const state = chart.state(); state.camera.x += 17; chart.state(state);
        } else chart.trimLoci(["locus-a", "locus-b"]);
        const after = JSON.stringify(chart.project()), afterSvg = chart.exportSvg();
        chart.undo(); const restored = JSON.stringify(chart.project()) === before;
        chart.redo(); const replayed = JSON.stringify(chart.project()) === after;
        stop(); results.push({ kind, events, restored, replayed, finalRendering: JSON.stringify(observed) === JSON.stringify([
          { project: after, svg: afterSvg }, { project: after, svg: afterSvg },
          { project: before, svg: beforeSvg }, { project: before, svg: beforeSvg },
          { project: after, svg: afterSvg }, { project: after, svg: afterSvg },
        ]) });
      }
    } finally { window.reportError = previous; }
    return { results, errors };
  });
  expect(results.errors).toHaveLength(12);
  for (const { kind, events, restored, replayed, finalRendering } of results.results) {
    expect(restored).toBe(true); expect(replayed).toBe(true); expect(finalRendering).toBe(true);
    const type = kind === "patch" ? "data.apply" : kind === "config" ? "config.change" : "state.replace";
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
