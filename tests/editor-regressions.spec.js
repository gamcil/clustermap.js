import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the shipped editor offline, independently of the demo page/server.
let server, url;
const pageErrors = new WeakMap();
test.beforeAll(async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end('<!doctype html><link rel="stylesheet" href="/dist/editor.css"><style>#plot{width:1200px;height:320px}clinker-editor{height:550px}</style><div id="plot"></div><clinker-editor></clinker-editor><script src="/node_modules/d3/dist/d3.min.js"></script>');
      return;
    }
    const filename = resolve(root, `.${pathname}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filename);
      response.writeHead(200, { "Content-Type": ({ ".json": "application/json", ".css": "text/css" })[extname(filename)] || "text/javascript" });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise((resolve) => server.close(resolve)); });
test.use({ viewport: { width: 1600, height: 1000 } });
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  pageErrors.set(page, errors);
  await page.goto(url);
  await page.evaluate(async () => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const { defineClinkerEditor } = await import("/dist/editor.mjs");
    defineClinkerEditor();
    const project = await (await fetch("/fixtures/clinker-project-heatmap.json")).json();
    window.chart = ClusterMap().config({ plot: { renderer: "svg", transitionDuration: 0 }, annotations: { enabled: true } });
    d3.select("#plot").datum(project.data).call(chart);
    document.querySelector("clinker-editor").chart = chart;
  });
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

const editor = (page) => page.locator("clinker-editor");
const view = (page, kind) => editor(page).locator(`[data-kind="${kind}"]`).click();
const matrixRows = (page) => editor(page).locator(".cm-annotation-matrix tbody .cm-data-row");
async function annotation(page, categorical = false) {
  await view(page, "annotations");
  const uid = await page.evaluate((categorical) => chart.data().annotationPanels.find(
    (panel) => panel.type === "heatmap" && (panel.scale?.type === "categorical") === categorical).uid, categorical);
  await editor(page).getByRole("combobox", { name: "Annotation panel", exact: true }).selectOption(uid);
  return uid;
}
const panelData = (page, uid) => page.evaluate((uid) => chart.data().annotationPanels.find((panel) => panel.uid === uid), uid);

for (const theme of ["light", "dark"]) {
  test(`${theme}: shared geometry and interactive colours across data views`, async ({ page }) => {
    await page.evaluate((theme) => chart.config({ plot: { theme } }), theme);
    let checkboxX;
    for (const kind of ["groups", "links", "tree", "list", "numeric", "categorical"]) {
      if (["numeric", "categorical"].includes(kind)) await annotation(page, kind === "categorical");
      else {
        await view(page, ["tree", "list"].includes(kind) ? "genes" : kind);
        if (["tree", "list"].includes(kind)) {
          await editor(page).locator(`[data-gene-view-kind="${kind}"]`).click();
          if (kind === "tree") await editor(page).locator("[data-tree-toggle]").first().click();
        }
      }
      await page.mouse.move(0, 0);
      const panel = editor(page).locator(".cm-data-panel:visible");
      const head = panel.locator(".cm-data-head").first();
      const rows = panel.locator(".cm-data-row");
      await expect(head).toBeVisible();
      const geometry = await panel.evaluate((node) => ({
        header: node.querySelector(".cm-data-head").getBoundingClientRect().height,
        rows: [...node.querySelectorAll(".cm-data-row")].slice(0, 8).map((row) => {
          const rect = row.getBoundingClientRect(), check = row.querySelector('input[type="checkbox"]').getBoundingClientRect();
          return { height: rect.height, x: check.x, offset: check.y - rect.y };
        }),
      }));
      expect(geometry.header, kind).toBe(32);
      for (const row of geometry.rows) {
        expect(row.height, kind).toBe(34);
        expect(row.offset, kind).toBe(10);
        checkboxX ??= row.x;
        expect(row.x, kind).toBeCloseTo(checkboxX, 1);
      }
      // Compare computed colours to the active theme tokens, including native table cells.
      const tokens = await editor(page).evaluate((node) => {
        const probe = document.createElement("span"); node.append(probe);
        const colour = (token) => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color; };
        const result = Object.fromEntries(["surface", "subtle", "foreground", "hover", "selection"].map((name) => [name, colour(`--cm-${name}`)]));
        probe.remove(); return result;
      });
      await expect(head).toHaveCSS("background-color", tokens.subtle);
      await expect(panel).toHaveCSS("color", tokens.foreground);
      await expect(rows.first()).toHaveCSS("background-color", kind === "tree" ? tokens.subtle : tokens.surface);
      if (kind !== "tree") {
        await rows.first().hover();
        await expect(rows.first()).toHaveCSS("background-color", tokens.hover);
      }
      const check = rows.first().locator('input[type="checkbox"]');
      await check.check();
      if (kind !== "tree") await expect(rows.first()).toHaveCSS("background-color", tokens.selection);
      if (["numeric", "categorical"].includes(kind)) {
        await expect(rows.first().locator("th")).toHaveCSS("background-color", tokens.selection);
      }
      await check.uncheck();
      const field = rows.first().locator(".cm-data-field").first();
      if (await field.count()) {
        await field.focus();
        await expect(field).toHaveCSS("color", tokens.foreground);
        await expect(field).toHaveCSS("outline-style", "solid");
        const fieldBox = await field.boundingBox(), rowBox = await rows.first().boundingBox();
        expect(fieldBox.y).toBeGreaterThanOrEqual(rowBox.y);
        expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(rowBox.y + rowBox.height);
      }
      const tab = editor(page).locator('[data-kind="links"]');
      await tab.hover();
      await expect(tab).toHaveCSS("background-color", tokens.hover);
      await expect(tab).toHaveCSS("cursor", "pointer");
      await expect(editor(page).getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
    }
  });
}

test("inline edits, external edits and merges stay synchronized through history", async ({ page }) => {
  const original = await page.evaluate(() => chart.data().groups[0].label);
  const row = editor(page).locator(".cm-editor__row--groups").first();
  await row.hover();
  await row.locator('[data-focus-edit="group:label"]').click();
  const input = row.locator('[data-edit="group:label"]');
  expect((await input.boundingBox()).height).toBeLessThanOrEqual(34);
  await input.fill("Renamed family"); await input.press("Enter");
  await expect.poll(() => page.evaluate(() => chart.data().groups[0].label)).toBe("Renamed family");
  await expect(row).toContainText("Renamed family");
  await expect(page.locator("#plot .legend-label").filter({ hasText: "Renamed family" })).toHaveCount(1);
  await row.hover(); await row.locator('[data-focus-edit="group:label"]').click();
  await input.fill("Cancelled"); await input.press("Escape");
  await expect(row).toContainText("Renamed family");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(row).toContainText(original);
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  await expect(row).toContainText("Renamed family");
  const before = await page.evaluate(() => chart.data().groups.map(({ uid, genes }) => ({ uid, genes: [...genes] })));
  await editor(page).locator("[data-select]").nth(0).check();
  await editor(page).locator("[data-select]").nth(1).check();
  await editor(page).locator("[data-merge-target]").selectOption(before[0].uid);
  await editor(page).getByRole("button", { name: "Merge groups", exact: true }).click();
  await expect(editor(page).locator(".cm-editor__row--groups")).toHaveCount(before.length - 1);
  await expect(row).toContainText(`${before[0].genes.length + before[1].genes.length} genes`);
  await expect(page.locator("#plot .legend-label")).toHaveCount(before.length - 1);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor(page).locator(".cm-editor__row--groups")).toHaveCount(before.length);
  expect(await page.evaluate(() => chart.data().groups.map(({ uid, genes }) => ({ uid, genes: [...genes] })))).toEqual(before);
  await page.evaluate(() => chart.patch([{ type: "clusters.update", ids: [chart.data().clusters[0].uid], changes: { name: "External edit" } }]));
  await annotation(page);
  await expect(matrixRows(page).first()).toContainText("External edit");
});

test("annotation inline edits, selection and batch values support undo/redo", async ({ page }) => {
  const uid = await annotation(page), before = await panelData(page, uid);
  const ids = await page.evaluate(() => chart.data().clusters.slice(0, 2).map((cluster) => cluster.uid));
  const input = matrixRows(page).first().locator('input[type="number"]').first();
  await input.fill("0.75"); await input.press("Enter");
  expect((await panelData(page, uid)).values[ids[0]][0]).toBe(0.75);
  await input.fill("0.2"); await input.press("Escape");
  await expect(input).toHaveValue("0.75");
  for (let i = 0; i < 2; i++) await matrixRows(page).nth(i).getByRole("checkbox").check();
  await editor(page).getByRole("combobox", { name: "Columns to edit" }).selectOption("all");
  await editor(page).getByRole("spinbutton", { name: "Batch value", exact: true }).fill("2.5");
  await editor(page).getByRole("button", { name: "Set values", exact: true }).click();
  for (const id of ids) expect((await panelData(page, uid)).values[id]).toEqual(before.columns.map(() => 2.5));
  await expect(matrixRows(page).first()).toHaveClass(/is-selected/);
  await editor(page).getByRole("button", { name: "Clear values", exact: true }).click();
  for (const id of ids) expect((await panelData(page, uid)).values[id]).toEqual(before.columns.map(() => null));
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(matrixRows(page).first().locator('input[type="number"]').first()).toHaveValue("2.5");
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  await expect(matrixRows(page).first().locator('input[type="number"]').first()).toHaveValue("");
});

test("categories can be added, assigned, renamed and removed with replacement", async ({ page }) => {
  const uid = await annotation(page, true);
  await editor(page).locator(".cm-annotation-categories summary").click();
  await editor(page).getByRole("textbox", { name: "New category name", exact: true }).fill("Test category");
  await editor(page).getByRole("button", { name: "Add category", exact: true }).click();
  await matrixRows(page).first().getByRole("checkbox").check();
  const domain = (await panelData(page, uid)).scale.domain;
  await editor(page).getByRole("combobox", { name: "Batch value", exact: true }).selectOption(String(domain.indexOf("Test category")));
  await editor(page).getByRole("button", { name: "Set values", exact: true }).click();
  await expect(matrixRows(page).first().getByRole("combobox").first()).toHaveValue(String(domain.indexOf("Test category")));
  if (!await editor(page).locator(".cm-annotation-categories").evaluate((node) => node.open)) {
    await editor(page).locator(".cm-annotation-categories summary").click();
  }
  await editor(page).getByRole("textbox", { name: "Rename category Test category", exact: true }).fill("Renamed category");
  await editor(page).getByRole("textbox", { name: "Rename category Test category", exact: true }).press("Tab");
  expect(Object.values((await panelData(page, uid)).values).flat()).toContain("Renamed category");
  if (!await editor(page).locator(".cm-annotation-categories").evaluate((node) => node.open)) {
    await editor(page).locator(".cm-annotation-categories summary").click();
  }
  await editor(page).getByRole("button", { name: "Remove category Renamed category", exact: true }).click();
  await editor(page).getByRole("combobox", { name: "Replacement category", exact: true }).selectOption("0");
  await editor(page).locator(".cm-annotation-category-remove").getByRole("button", { name: "Remove", exact: true }).click();
  expect((await panelData(page, uid)).scale.domain).not.toContain("Renamed category");
  expect(Object.values((await panelData(page, uid)).values).flat()).not.toContain("Renamed category");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect((await panelData(page, uid)).scale.domain).toContain("Renamed category");
});

test("panel creation, visibility, ordering and removal are reflected in history", async ({ page }) => {
  await annotation(page);
  const before = await page.evaluate(() => chart.data().annotationPanels.map((panel) => panel.uid));
  await editor(page).getByRole("button", { name: "Add panel", exact: true }).click();
  const form = editor(page).locator(".cm-annotation-data-body form");
  await form.getByRole("textbox", { name: "Title", exact: true }).fill("New panel");
  await form.getByRole("button", { name: "Add panel", exact: true }).click();
  const uid = await page.evaluate(() => chart.data().annotationPanels.at(-1).uid);
  await expect(editor(page).getByRole("combobox", { name: "Annotation panel", exact: true })).toHaveValue(uid);
  await editor(page).getByRole("button", { name: "Hide", exact: true }).click();
  expect((await panelData(page, uid)).show).toBe(false);
  await editor(page).getByRole("button", { name: "Show", exact: true }).click();
  expect((await panelData(page, uid)).show).toBe(true);
  await expect(editor(page).getByRole("button", { name: "Move right", exact: true })).toBeDisabled();
  await editor(page).getByRole("button", { name: "Move left", exact: true }).click();
  expect(await page.evaluate(() => chart.data().annotationPanels.at(-2).title)).toBe("New panel");
  await editor(page).getByRole("button", { name: "Remove panel", exact: true }).click();
  expect(await page.evaluate(() => chart.data().annotationPanels.map((panel) => panel.uid))).toEqual(before);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect((await panelData(page, uid)).title).toBe("New panel");
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  expect(await panelData(page, uid)).toBeUndefined();
});

test("annotation rows virtualize, preserve offscreen selection and filter all records", async ({ page }) => {
  // Exceed the shared 200-row virtualization threshold with a compact synthetic model.
  const ids = await page.evaluate(() => {
    const clusters = Array.from({ length: 260 }, (_, index) => ({
      uid: `row-${index}`, name: `Cluster ${index}`, loci: [{
        uid: `locus-${index}`, start: 0, end: 1000,
        genes: [{ uid: `gene-${index}`, start: 100, end: 900, strand: 1 }],
      }],
    }));
    chart.data({ clusters, links: [], groups: [], annotationPanels: [{
      uid: "numeric", type: "heatmap", title: "Numeric", columns: ["Value"],
      values: Object.fromEntries(clusters.map(({ uid }, index) => [uid, [index]])), scale: { type: "continuous" },
    }] });
    return clusters.map(({ uid }) => uid);
  });
  await annotation(page);
  const rows = matrixRows(page), matrix = editor(page).locator(".cm-annotation-matrix");
  await expect(matrix.locator("table")).toHaveAttribute("aria-rowcount", "261");
  expect(await rows.count()).toBeLessThan(80);
  await rows.first().getByRole("checkbox").check();
  await matrix.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(rows.last()).toContainText("Cluster 259");
  expect(await rows.count()).toBeLessThan(80);
  await rows.last().getByRole("checkbox").check();
  await editor(page).getByRole("spinbutton", { name: "Batch value", exact: true }).fill("999");
  await editor(page).getByRole("button", { name: "Set values", exact: true }).click();
  const data = await panelData(page, "numeric");
  expect(data.values[ids[0]]).toEqual([999]);
  expect(data.values[ids.at(-1)]).toEqual([999]);
  expect(data.values[ids[1]]).toEqual([1]);
  await editor(page).locator("[data-filter]").fill("Cluster 259");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Cluster 259");
  await expect(rows.first().locator('input[type="number"]')).toHaveValue("999");
  await editor(page).locator("[data-filter]").fill("");
  await expect(rows.first()).toContainText("Cluster 0");
  await expect(rows.first().getByRole("checkbox")).toBeChecked();
});

for (const renderer of ["svg", "canvas"]) {
  test(`${renderer}: edited figures survive project reload and publication SVG export`, async ({ page }) => {
    await page.evaluate(async () => {
      const data = await (await fetch("/fixtures/heatmap.json")).json();
      const { ClusterMap } = await import("/dist/clustermap.mjs");
      chart.destroy();
      window.chart = ClusterMap().config({ plot: { renderer: "svg", transitionDuration: 0 }, annotations: { enabled: true } });
      d3.select("#plot").datum(data).call(chart);
      document.querySelector("clinker-editor").chart = chart;
      window.publicationInput = structuredClone(data);
    });
    // Use real pointer trimming before saving, so the project must retain the
    // interaction state as well as edits to source data and appearance.
    const locus = page.locator("#plot g.locus").first();
    await locus.hover();
    const handle = await locus.locator("rect.rightHandle").boundingBox();
    const gene = await locus.locator("polygon.genePolygon").boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(gene.x + gene.width - 1, gene.y + gene.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator("#plot text.locusText").first()).toHaveText("sequence_a:1-6500");
    expect(await page.evaluate(() => chart.state().loci.find(([uid]) => uid === "locus-a")[1].end)).toBe(6500);

    await annotation(page);
    const value = matrixRows(page).first().locator('input[type="number"]').first();
    await value.fill("0.75"); await value.press("Enter");
    await page.evaluate(() => chart.patch([
      { type: "groups.update", ids: [chart.data().groups[0].uid], changes: { label: "Edited gene family", colour: "#315b9a" } },
      { type: "tree.presentation.update", scope: "subtree", ids: ["x"], changes: { branch: { colour: "#a34b19", width: 3 } } },
      { type: "tree.presentation.update", scope: "node", ids: ["x"], changes: {
        label: { text: "Publication clade", colour: "#7a3f9a", fontSize: 12, fontWeight: 700 },
      } },
    ]));
    await page.getByRole("button", { name: "Tree node x: rotate children or open context menu", exact: true }).click();
    expect(await page.evaluate(() => chart.state().clusterOrder)).toEqual(["b", "a", "c", "d", "e"]);
    await page.evaluate((renderer) => chart.config({ plot: { renderer, theme: "dark" } }), renderer);

    const saved = await page.evaluate(() => JSON.parse(JSON.stringify(chart.project())));
    expect(saved.data.annotationPanels.find((panel) => panel.uid === "expression").values.a[0]).toBe(0.75);
    const bounds = await page.evaluate(() => chart.figureBounds());
    const svgBefore = await page.evaluate(() => chart.exportSvg());
    const restored = await page.evaluate(async (saved) => {
      const { ClusterMap } = await import("/dist/clustermap.mjs");
      chart.destroy();
      // Mount a fresh chart with defaults and original, unedited data. Only
      // the JSON project can supply the saved trimming, ordering and styles.
      window.chart = ClusterMap();
      d3.select("#plot").datum(structuredClone(publicationInput)).call(chart);
      chart.project(JSON.parse(JSON.stringify(saved)));
      document.querySelector("clinker-editor").chart = chart;
      return { project: chart.project(), bounds: chart.figureBounds(), undo: chart.canUndo(), svg: chart.exportSvg() };
    }, saved);
    expect(restored.project).toEqual(saved);
    expect(restored.undo).toBe(false);
    for (const key of ["minX", "minY", "maxX", "maxY"]) {
      expect(Number.isFinite(restored.bounds[key])).toBe(true);
      expect(restored.bounds[key]).toBeCloseTo(bounds[key], 4);
    }
    await annotation(page);
    const rowA = matrixRows(page).filter({ hasText: "Example A" });
    await expect(rowA.locator('input[type="number"]').first()).toHaveValue("0.75");

    // Measure the exported document independently, with no editor or theme
    // stylesheets. Check actual SVG geometry rather than just saved settings.
    const exported = await page.context().newPage();
    try {
      await exported.setContent("<!doctype html><body></body>");
      const inspect = async (source) => exported.evaluate((source) => {
        const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
        if (parsed.querySelector("parsererror")) throw new Error("Export is not valid SVG");
        document.body.replaceChildren(document.importNode(parsed.documentElement, true));
        const svg = document.querySelector("svg"), plot = svg.querySelector("g.clusterMapG");
        const box = plot.getBBox();
        const marks = (selector, attributes) => [...svg.querySelectorAll(selector)].map((node) => ({
          text: node.textContent,
          ...Object.fromEntries(attributes.map((name) => [name, node.getAttribute(name)])),
        }));
        const clusters = [...svg.querySelectorAll("g.cluster")].map((node) => ({
          label: node.querySelector("text.clusterText").textContent,
          locus: node.querySelector("text.locusText").textContent,
          y: node.transform.baseVal.consolidate().matrix.f,
        })).sort((a, b) => a.y - b.y);
        return {
          viewBox: [svg.viewBox.baseVal.x, svg.viewBox.baseVal.y, svg.viewBox.baseVal.width, svg.viewBox.baseVal.height],
          width: +svg.getAttribute("width"), height: +svg.getAttribute("height"),
          content: { x: box.x, y: box.y, width: box.width, height: box.height },
          background: svg.firstElementChild.getAttribute("fill"), clusters,
          genes: [...svg.querySelectorAll("polygon.genePolygon")].map((node) => ({ points: node.getAttribute("points"), fill: getComputedStyle(node).fill })),
          legend: marks(".legend-label", []),
          clades: marks("text.tree-annotation", ["fill", "font-size", "font-weight"]),
          branches: marks(".tree-branch, .tree-stem", ["d", "x1", "y1", "x2", "y2", "stroke", "stroke-width"]),
          panels: [...svg.querySelectorAll("g.annotationPanel")].map((panel) => ({
            text: panel.textContent, transform: panel.getAttribute("transform"),
            rows: [...panel.querySelectorAll("g.annotationRow")].map((row) => ({
              transform: row.getAttribute("transform"), y: row.transform.baseVal.consolidate().matrix.f,
              rects: [...row.querySelectorAll("rect")].map((rect) => ["x", "y", "width", "height", "fill"].map((name) => rect.getAttribute(name))),
            })),
          })),
          interactive: svg.querySelectorAll("script, foreignObject, g.hover, .leftHandle, .rightHandle, [tabindex], [cursor], [pointer-events]").length,
        };
      }, source);
      const before = await inspect(svgBefore), after = await inspect(restored.svg);
      expect(after).toEqual(before);
      expect(after.interactive).toBe(0);
      expect(after.background).toBe("#ffffff");
      expect(after.clusters.map((row) => row.label)).toEqual(["Example B", "Example A", "Example C", "Example D", "Example E"]);
      expect(after.clusters.find((row) => row.label === "Example A").locus).toBe("sequence_a:1-6500");
      expect(after.genes).toHaveLength(5);
      expect(after.genes.every((gene) => gene.fill === "rgb(49, 91, 154)")).toBe(true);
      expect(after.legend.map((label) => label.text)).toContain("Edited gene family");
      expect(after.clades).toEqual([{ text: "Publication clade", fill: "#7a3f9a", "font-size": "12", "font-weight": "700" }]);
      expect(after.branches.some((branch) => branch.stroke === "#a34b19" && branch["stroke-width"] === "3")).toBe(true);
      expect(after.panels).toHaveLength(4);
      const expression = after.panels.find((panel) => panel.text.includes("Expression"));
      const rowIndex = after.clusters.findIndex((row) => row.label === "Example A");
      const expressionRows = [...expression.rows].sort((a, b) => a.y - b.y);
      // 0.75 is halfway between the fixture's middle and final colour stops.
      expect(expressionRows[rowIndex].rects[0].at(-1)).toBe("rgb(58, 111, 161)");
      const expected = [after.content.x - 20, after.content.y - 20, after.content.width + 40, after.content.height + 40];
      after.viewBox.forEach((value, index) => {
        expect(Number.isFinite(value)).toBe(true);
        // Text hinting can differ slightly once the SVG has its final size.
        expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(0.5);
      });
      expect(after.width).toBeCloseTo(after.viewBox[2], 4);
      expect(after.height).toBeCloseTo(after.viewBox[3], 4);
    } finally { await exported.close(); }
    // Export must not mutate the live figure or its portable project.
    expect(await page.evaluate(() => chart.project())).toEqual(saved);
  });
}
