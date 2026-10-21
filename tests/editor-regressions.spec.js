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
