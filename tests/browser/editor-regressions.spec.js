import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the shipped editor offline, independently of the demo page/server.
let server, url;
const pageErrors = new WeakMap();
test.beforeAll(async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end('<!doctype html><style>#plot{width:1200px;height:320px}clinker-editor{height:550px}</style><div id="plot"></div><clinker-editor>\n</clinker-editor><script src="/node_modules/d3/dist/d3.min.js"></script>');
      return;
    }
    const filename = resolve(root, `.${pathname}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filename);
      response.writeHead(200, { "Content-Type": ({ ".html": "text/html", ".json": "application/json", ".css": "text/css" })[extname(filename)] || "text/javascript" });
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
    await import("/dist/editor.mjs");
    document.querySelector("#plot").addEventListener("clustermap:edit-annotation", (event) => {
      event.preventDefault(); document.querySelector("clinker-editor").editAnnotations(event.detail.panelUid);
    });
    const project = await (await fetch("/fixtures/clinker-project-heatmap.json")).json();
    window.chart = ClusterMap().config({ plot: { renderer: "svg", transitionDuration: 0 }, annotations: { enabled: true } });
    d3.select("#plot").datum(project.data).call(chart);
    document.querySelector("clinker-editor").chart = chart;
  });
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

const editor = (page) => page.locator("clinker-editor");
const editField = async (field) => { await field.hover(); await field.getByRole("button").click(); };
const view = (page, kind) => editor(page).locator(`[data-kind-picker] button[value="${kind}"]`).click();
const matrixRows = (page) => editor(page).locator(".cm-annotation-matrix tbody .cm-data-row");
async function annotation(page, categorical = false) {
  await view(page, "annotations");
  const uid = await page.evaluate((categorical) => chart.data().annotationPanels.find(
    (panel) => panel.type === "heatmap" && (panel.scale?.type === "categorical") === categorical).uid, categorical);
  await editor(page).getByRole("combobox", { name: "Annotation panel", exact: true }).selectOption(uid);
  return uid;
}
const panelData = (page, uid) => page.evaluate((uid) => chart.data().annotationPanels.find((panel) => panel.uid === uid), uid);

const canvasPoint = (page, selector, fraction = 0.5) => page.evaluate(({ selector, fraction }) => {
  const svg = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml").documentElement;
  document.body.append(svg); svg.style.visibility = "hidden";
  try {
    const node = svg.querySelector(selector), box = node.getBBox();
    const world = new DOMPoint(box.x + box.width * fraction, box.y + box.height / 2)
      .matrixTransform(svg.querySelector("g.clusterMapG").getCTM().inverse().multiply(node.getCTM()));
    const camera = chart.state().camera, surface = document.querySelector("#plot canvas.clusterMapCanvas").getBoundingClientRect();
    return { x: surface.x + camera.x + world.x * camera.k, y: surface.y + camera.y + world.y * camera.k };
  } finally { svg.remove(); }
}, { selector, fraction });


for (const theme of ["light", "dark"]) {
  test(`${theme}: shared geometry and interactive colours across data views`, async ({ page }) => {
    await selectionFixture(page, "svg");
    await page.evaluate((theme) => chart.config({ plot: { theme } }), theme);
    let checkboxX;
    for (const kind of ["groups", "links", "tree", "list", "numeric", "categorical"]) {
      if (["numeric", "categorical"].includes(kind)) await annotation(page, kind === "categorical");
      else {
        await view(page, ["tree", "list"].includes(kind) ? "genes" : kind);
        if (["tree", "list"].includes(kind)) {
          await editor(page).locator(`[data-gene-view] button[value="${kind}"]`).click();
          if (kind === "tree") await editor(page).locator("[data-tree-toggle]").first().click();
        }
      }
      await editor(page).getByRole("searchbox", { name: "Filter records", exact: true }).focus();
      await page.mouse.move(0, 0);
      const panel = editor(page).locator(".cm-data-panel:visible");
      const head = panel.locator(".cm-data-head").first();
      const rows = panel.locator(".cm-data-row");
      await expect(head).toBeVisible();
      await expect(editor(page).locator('[data-command="new-group"]')).toBeVisible({ visible: kind === "groups" });
      const geometry = await panel.evaluate((node) => ({
        header: node.querySelector(".cm-data-head").getBoundingClientRect().height,
        rows: [...node.querySelectorAll(".cm-data-row")].slice(0, 8).map((row) => {
          const rect = row.getBoundingClientRect(), check = row.querySelector('input[type="checkbox"]').getBoundingClientRect();
          return { height: rect.height, x: check.x, center: check.y - rect.y + check.height / 2 };
        }),
      }));
      expect(geometry.header, kind).toBe(32);
      for (const row of geometry.rows) {
        expect(row.height, kind).toBe(34);
        expect(Math.abs(row.center - row.height / 2), kind).toBeLessThanOrEqual(1);
        checkboxX ??= row.x;
        expect(row.x, kind).toBeCloseTo(checkboxX, 1);
      }
      // Compare computed colours to the active theme tokens, including native table cells.
      const tokens = await editor(page).evaluate((node) => {
        const probe = document.createElement("span"); node.shadowRoot.append(probe);
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
      const component = rows.first().locator("clinker-editable-field").first();
      if (await component.count()) {
        await editField(component);
        const field = component.locator("input:visible, select:visible");
        await field.focus();
        await expect(field).toBeFocused();
        await expect(field).toHaveCSS("color", tokens.foreground);
        await expect(field).toHaveCSS("outline-style", "solid");
        const fieldBox = await field.boundingBox(), rowBox = await rows.first().boundingBox();
        expect(fieldBox.y).toBeGreaterThanOrEqual(rowBox.y);
        expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(rowBox.y + rowBox.height);
        await field.press("Escape");
      }
      const tab = editor(page).locator('[data-kind-picker] button[value="links"]');
      await tab.hover();
      await expect(tab).toHaveCSS("background-color", tokens.hover);
      await expect(tab).toHaveCSS("cursor", "pointer");
      await expect(editor(page).getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
    }
  });
}

test("inline edits, external edits and merges stay synchronized through history", async ({ page }) => {
  await selectionFixture(page, "svg");
  const original = await page.evaluate(() => chart.data().groups[0].label);
  const row = editor(page).locator(".cm-editor__row--groups").first();
  await row.hover();
  await row.locator('clinker-editable-field[data-field="label"] button').click();
  const input = row.locator('clinker-editable-field[data-field="label"] input');
  expect((await input.boundingBox()).height).toBeLessThanOrEqual(34);
  await input.fill("Renamed family"); await input.press("Enter");
  await expect.poll(() => page.evaluate(() => chart.data().groups[0].label)).toBe("Renamed family");
  await expect(row).toContainText("Renamed family");
  await expect(page.locator("#plot .legend-label").filter({ hasText: "Renamed family" })).toHaveCount(1);
  await row.hover(); await row.locator('clinker-editable-field[data-field="label"] button').click();
  await input.fill("Cancelled"); await input.press("Escape");
  await expect(row).toContainText("Renamed family");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(row).toContainText(original);
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  await expect(row).toContainText("Renamed family");
  const before = await page.evaluate(() => chart.data().groups.map(({ uid, genes }) => ({ uid, genes: [...genes] })));
  await editor(page).locator("[data-select]").nth(0).check();
  await editor(page).locator("[data-select]").nth(1).check();
  await editor(page).locator(".cm-data-actions clinker-action-menu summary").filter({ hasText: /^Merge…$/ }).click();
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

test("record views retain keyboard ordering, subtitle edits, sorting and visibility controls", async ({ page }) => {
  await selectionFixture(page, "svg");
  const groups = editor(page).locator(".cm-editor__row--groups");
  await expect(groups.first().locator('[data-colour]')).toHaveValue("#267c9e");
  await groups.first().locator('[data-reorder]').press("ArrowDown");
  expect(await page.evaluate(() => chart.data().groups.map(({ uid }) => uid))).toEqual(["beta", "alpha", "gamma"]);
  const subtitle = groups.first().locator('clinker-editable-field[data-field="subtitle"]');
  await editField(subtitle); await subtitle.getByRole("textbox").fill("Conserved enzyme"); await subtitle.getByRole("textbox").press("Enter");
  expect(await page.evaluate(() => chart.data().groups[0].subtitle)).toBe("Conserved enzyme");
  await view(page, "genes"); await editor(page).locator('[data-gene-view] button[value="list"]').click();
  const genes = editor(page).locator(".cm-editor__row--genes");
  await genes.first().click();
  await expect(editor(page).locator(".cm-data-meta").first()).toContainText("1 gene selected");
  const label = genes.first().locator('clinker-editable-field[data-field="label"]');
  await editField(label); await label.getByRole("textbox").fill("Renamed gene"); await label.getByRole("textbox").press("Enter");
  for (const [kind, column, values] of [["genes", "Gene", () => genes.locator('clinker-editable-field[data-field="label"]').evaluateAll((fields) => fields.map((field) => field.value))],
    ["links", "Source", () => editor(page).locator(".cm-editor__row--links").evaluateAll((rows) => rows.map((row) => row.querySelector('[data-text="source"]').textContent))]]) {
    await view(page, kind); await editor(page).getByRole("button", { name: new RegExp(`Sort by ${column},`) }).click();
    const actual = await values();
    expect(actual).toEqual([...actual].sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })));
  }
  await editor(page).locator(".cm-editor__row--links [data-visible]").first().click();
  expect(await page.evaluate(() => chart.data().links.some((link) => link.hidden))).toBe(true);
});

test("row hover coalesces updates and collapsed branches remain selectable", async ({ page }) => {
  await selectionFixture(page, "svg");
  await page.evaluate(() => {
    const highlight = chart.highlight; window.hoverCalls = [];
    chart.highlight = (...args) => { if (args.length) hoverCalls.push(args[0]); return highlight(...args); };
  });
  await editor(page).locator(".cm-editor__row--groups").evaluateAll((rows) => {
    rows[0].dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    rows[1].dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => hoverCalls)).toEqual([{ genes: ["gene-b", "gene-c"] }]);
  await view(page, "genes"); await editor(page).locator(".cm-editor__tree-parent").first().hover();
  await expect.poll(() => page.evaluate(() => chart.highlight())).toEqual(["gene-a", "gene-a2"]);
  await editor(page).getByRole("button", { name: "Collapse all", exact: true }).click();
  await editor(page).getByRole("button", { name: "Select all 6 visible genes", exact: true }).click();
  await expect(editor(page).locator(".cm-data-meta").first()).toContainText("6 genes selected");
});

test("group creation, assignment, member navigation and focus retain their workflows", async ({ page }) => {
  await selectionFixture(page, "svg");
  page.once("dialog", (dialog) => dialog.accept("New family"));
  await editor(page).getByRole("button", { name: "Create group…", exact: true }).click();
  const uid = await page.evaluate(() => chart.data().groups.at(-1).uid);
  expect(await page.evaluate(() => chart.data().groups.at(-1).label)).toBe("New family");
  const memberships = () => page.evaluate(() => chart.data().groups.map(({ uid, genes }) => ({ uid, genes: [...genes] })));
  const before = await memberships();
  await view(page, "genes"); await editor(page).locator('[data-gene-view] button[value="list"]').click();
  const row = editor(page).locator(".cm-editor__row--genes").first();
  const geneUid = await row.locator("clinker-editable-field").getAttribute("data-id");
  await row.getByRole("checkbox").check();
  const actions = editor(page).locator("clinker-record-actions");
  await actions.locator('clinker-action-menu[label="Assign…"] summary').click();
  await actions.locator("[data-assign-group]").selectOption(uid);
  await actions.getByRole("button", { name: "Move", exact: true }).click();
  expect(await page.evaluate((uid) => chart.data().groups.find((group) => group.uid === uid).genes, uid)).toEqual([geneUid]);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await memberships()).toEqual(before);
  page.once("dialog", (dialog) => dialog.accept("Selected family"));
  await actions.locator('clinker-action-menu[label="Assign…"] summary').click();
  await actions.getByRole("button", { name: "New group…", exact: true }).click();
  expect(await page.evaluate(() => chart.data().groups.at(-1).genes)).toEqual([geneUid]);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await memberships()).toEqual(before);
  await view(page, "groups"); await editor(page).locator(".cm-editor__row--groups").first().getByRole("checkbox").check();
  await actions.locator('clinker-action-menu[label="Group…"] summary').click();
  await actions.getByRole("button", { name: "View member genes", exact: true }).click();
  await expect(editor(page).locator("[data-member-filter]")).toContainText("Alpha");
  await expect(editor(page).locator(".cm-editor__row--genes")).toHaveCount(2);
  await editor(page).locator(".cm-editor__row--genes").first().getByRole("checkbox").check();
  await page.evaluate(() => { const focus = chart.focus; chart.focus = (target) => { window.focusTarget = target; return focus(target); }; });
  await actions.getByRole("button", { name: "Focus in plot", exact: true }).click();
  expect(await page.evaluate(() => focusTarget)).toEqual({ genes: [geneUid] });
});

test("chart history restores deletions, preserves callbacks, stays bounded and exports portable projects", async ({ page }) => {
  await selectionFixture(page, "svg");
  const result = await page.evaluate(() => {
    const data = chart.data(), ids = data.links.map(({ uid }) => uid), callback = () => {};
    chart.patch([{ type: "links.delete", ids: [ids[0]] }]); chart.undo();
    const restored = chart.data() === data && chart.data().links.map(({ uid }) => uid).join() === ids.join();
    chart.config({ gene: { shape: { onClick: callback } } });
    chart.config({ legend: { show: false } }); chart.undo();
    const preserved = chart.config().gene.shape.onClick === callback && chart.config().legend.show;
    const project = JSON.parse(JSON.stringify(chart.project()));
    chart.clearHistory();
    for (let value = 1; value <= 105; value++) chart.config({ legend: { marginLeft: value } });
    for (let index = 0; index < 100; index++) chart.undo();
    return { restored, preserved, project, value: chart.config().legend.marginLeft, undo: chart.canUndo(), redo: chart.canRedo() };
  });
  expect(result.restored && result.preserved).toBe(true);
  expect(result.project.format).toBe("clinker-project");
  expect(result.project.config.gene.shape).not.toHaveProperty("onClick");
  expect([result.value, result.undo, result.redo]).toEqual([5, false, true]);
});

test("Escape clears plot selection after interacting with its toolbar container", async ({ page }) => {
  await selectionFixture(page, "svg");
  await page.evaluate(() => {
    chart.locusSelection(["locus-a"]);
    document.querySelector("#plot").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await page.keyboard.press("Escape"); await expectSelection(page, "loci", []);
});

test("annotation inline edits, selection and batch values support undo/redo", async ({ page }) => {
  const uid = await annotation(page), before = await panelData(page, uid);
  const ids = await page.evaluate(() => chart.data().clusters.slice(0, 2).map((cluster) => cluster.uid));
  const field = matrixRows(page).first().locator("clinker-editable-field").first(), input = field.locator("input");
  await editField(field);
  await input.fill("0.75"); await input.press("Enter");
  expect((await panelData(page, uid)).values[ids[0]][0]).toBe(0.75);
  await editField(field);
  await input.fill("0.2"); await input.press("Escape");
  await expect(input).toHaveValue("0.75");
  for (let i = 0; i < 2; i++) await matrixRows(page).nth(i).getByRole("checkbox").check();
  await editor(page).locator(".cm-data-actions clinker-action-menu summary").filter({ hasText: /^Edit values…$/ }).click();
  await editor(page).getByRole("combobox", { name: "Columns to edit" }).selectOption("all");
  await editor(page).getByRole("spinbutton", { name: "Batch value", exact: true }).fill("2.5");
  await editor(page).getByRole("button", { name: "Set values", exact: true }).click();
  for (const id of ids) expect((await panelData(page, uid)).values[id]).toEqual(before.columns.map(() => 2.5));
  await expect(matrixRows(page).first()).toHaveClass(/is-selected/);
  await editor(page).locator(".cm-data-actions clinker-action-menu summary").filter({ hasText: /^Edit values…$/ }).click();
  await editor(page).getByRole("button", { name: "Clear values", exact: true }).click();
  for (const id of ids) expect((await panelData(page, uid)).values[id]).toEqual(before.columns.map(() => null));
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await field.evaluate((field) => field.value)).toBe("2.5");
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  expect(await field.evaluate((field) => field.value)).toBe("");
});

test("categories can be added, assigned, renamed and removed with replacement", async ({ page }) => {
  await selectionFixture(page, "svg");
  const uid = await annotation(page, true);
  await editor(page).locator(".cm-annotation-categories summary").click();
  await editor(page).getByRole("textbox", { name: "New category name", exact: true }).fill("Test category");
  await editor(page).getByRole("button", { name: "Add category", exact: true }).click();
  await matrixRows(page).first().getByRole("checkbox").check();
  const domain = (await panelData(page, uid)).scale.domain;
  await editor(page).locator(".cm-data-actions clinker-action-menu summary").filter({ hasText: /^Edit values…$/ }).click();
  await editor(page).getByRole("combobox", { name: "Batch value", exact: true }).selectOption(String(domain.indexOf("Test category")));
  await editor(page).getByRole("button", { name: "Set values", exact: true }).click();
  await expect(matrixRows(page).first().locator("clinker-editable-field").first()).toContainText("Test category");
  if (!await editor(page).locator(".cm-annotation-categories").evaluate((node) => node.open)) {
    await editor(page).locator(".cm-annotation-categories summary").click();
  }
  await editField(editor(page).locator('clinker-category-editor clinker-editable-field[label="Rename category Test category"]'));
  const input = editor(page).getByRole("textbox", { name: "Rename category Test category", exact: true });
  await input.fill("Renamed category"); await input.press("Enter");
  expect(Object.values((await panelData(page, uid)).values).flat()).toContain("Renamed category");
  if (!await editor(page).locator(".cm-annotation-categories").evaluate((node) => node.open)) {
    await editor(page).locator(".cm-annotation-categories summary").click();
  }
  await editor(page).getByRole("button", { name: "Remove category Renamed category", exact: true }).click();
  await editor(page).getByRole("combobox", { name: "Replacement category", exact: true }).selectOption("0");
  await editor(page).locator("clinker-category-editor [data-removal]").getByRole("button", { name: "Remove", exact: true }).click();
  expect((await panelData(page, uid)).scale.domain).not.toContain("Renamed category");
  expect(Object.values((await panelData(page, uid)).values).flat()).not.toContain("Renamed category");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect((await panelData(page, uid)).scale.domain).toContain("Renamed category");
  const restored = await panelData(page, uid);
  await page.evaluate((uid) => chart.patch([{ type: "annotationPanels.update", ids: [uid], changes: { scale: { type: "continuous" }, values: {} } }]), uid);
  await expect(editor(page).locator("clinker-category-editor")).toHaveCount(0);
  await page.evaluate(({ uid, scale, values }) => chart.patch([{ type: "annotationPanels.update", ids: [uid], changes: { scale, values } }]), restored);
  await expect(editor(page).locator("clinker-category-editor clinker-editable-field")).toHaveCount(restored.scale.domain.length);
});

test("panel creation, visibility, ordering and removal are reflected in history", async ({ page }) => {
  await selectionFixture(page, "svg");
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

test("appearance component synchronizes config and preserves disclosure state through filtering", async ({ page }) => {
  await selectionFixture(page, "svg");
  await editor(page).getByRole("tab", { name: "Appearance", exact: true }).click();
  const panel = editor(page).locator("clinker-appearance-panel");
  await panel.locator('[data-config="legend.show"]').uncheck();
  expect(await page.evaluate(() => chart.config().legend.show)).toBe(false);
  await page.evaluate(() => chart.config({ legend: { show: true } }));
  await expect(panel.locator('[data-config="legend.show"]')).toBeChecked();
  const legend = panel.locator("fieldset").filter({ has: page.getByText("Legend", { exact: true }) });
  await legend.locator("summary").click();
  await expect(legend.locator("details")).toHaveAttribute("open", "");
  const search = panel.locator("[data-appearance-filter] input");
  await search.fill("minimap");
  await expect(panel.locator("fieldset:visible")).toHaveCount(1);
  await expect(panel.locator('[data-config="plot.minimap.width"]')).toBeVisible();
  await search.press("Escape");
  await expect(legend.locator("details")).toHaveAttribute("open", "");
  await expect(panel.locator('[data-appearance-section="genes"]')).not.toHaveAttribute("open");
  await legend.locator("summary").press("Enter");
  await search.fill("minimap"); await search.press("Escape");
  await expect(legend.locator("details")).not.toHaveAttribute("open");
  await panel.locator('[data-config="colourBar.domain.minMode"]').selectOption("data");
  await expect(panel.locator('[data-config="colourBar.domain.min"]')).toBeDisabled();
  await panel.locator('[data-config="colourBar.domain.minMode"]').selectOption("fixed");
  await expect(panel.locator('[data-config="colourBar.domain.min"]')).toBeEnabled();
});

test("annotation form and group components commit edits and reversible removals", async ({ page }) => {
  await selectionFixture(page, "svg");
  await annotation(page);
  await editor(page).getByRole("button", { name: "Add panel", exact: true }).click();
  const form = editor(page).locator("clinker-annotation-data-form");
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("groups");
  await form.getByRole("textbox", { name: "Title", exact: true }).fill("Markers");
  await form.getByRole("textbox", { name: "Data", exact: true }).fill("{");
  await form.getByRole("button", { name: "Add panel", exact: true }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await form.getByRole("textbox", { name: "Data", exact: true }).fill(JSON.stringify({ groups: [{ uid: "first", label: "First", clusterIds: ["a"] }] }));
  await form.getByRole("button", { name: "Add panel", exact: true }).click();
  const uid = await page.evaluate(() => chart.data().annotationPanels.at(-1).uid);
  const groups = editor(page).locator("clinker-annotation-group-editor");
  const label = groups.locator("clinker-editable-field").first();
  await editField(label); await label.locator("input").fill("Edited"); await label.locator("input").press("Enter");
  await groups.getByRole("listbox", { name: "Clusters in Edited", exact: true }).selectOption(["a", "c"]);
  expect((await panelData(page, uid)).groups[0]).toMatchObject({ label: "Edited", clusterIds: ["a", "c"] });
  await groups.getByRole("button", { name: "Add group", exact: true }).click();
  expect((await panelData(page, uid)).groups).toHaveLength(2);
  await groups.getByRole("button", { name: "Remove group", exact: true }).first().click();
  expect((await panelData(page, uid)).groups).toHaveLength(1);
  await expect(groups.getByRole("button", { name: "Remove group", exact: true })).toBeDisabled();
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect((await panelData(page, uid)).groups[0].label).toBe("Edited");
  const numeric = await annotation(page), before = await panelData(page, numeric);
  await editor(page).getByRole("button", { name: "Replace data…", exact: true }).click();
  const replacement = editor(page).locator('clinker-annotation-data-form[mode="replace"]');
  await replacement.getByRole("textbox").fill("{");
  await replacement.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(replacement.getByRole("alert")).toBeVisible();
  await replacement.getByRole("textbox").fill(JSON.stringify({ columns: ["Replaced"], values: { a: [3] } }));
  await replacement.getByRole("button", { name: "Replace data", exact: true }).click();
  expect((await panelData(page, numeric)).values.a).toEqual([3]);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await panelData(page, numeric)).toEqual(before);
});

test("record action component commits batch values and validates identity", async ({ page }) => {
  await selectionFixture(page, "svg"); await view(page, "links");
  const rows = editor(page).locator(".cm-editor__row--links");
  await rows.nth(0).getByRole("checkbox").check(); await rows.nth(1).getByRole("checkbox").check();
  const actions = editor(page).locator("clinker-record-actions");
  await actions.locator('clinker-action-menu[label="Edit…"] summary').click();
  await actions.locator("[data-batch-label]").fill("Batch label");
  await actions.getByRole("button", { name: "Set label", exact: true }).click();
  expect(await page.evaluate(() => chart.data().links.map(({ label }) => label))).toEqual(["Batch label", "Batch label"]);
  const identity = actions.locator("[data-batch-identity]");
  await identity.fill("101"); await actions.getByRole("button", { name: "Set identity", exact: true }).click();
  expect(await page.evaluate(() => chart.data().links.map(({ identity }) => identity))).toEqual([1, 0.9]);
  await identity.fill("75"); await actions.getByRole("button", { name: "Set identity", exact: true }).click();
  expect(await page.evaluate(() => chart.data().links.map(({ identity }) => identity))).toEqual([0.75, 0.75]);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => chart.data().links.map(({ identity }) => identity))).toEqual([1, 0.9]);
});

test("data table component mounts deferred rows and disposes them across reconnects", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const table = document.createElement("clinker-data-table"), container = document.createElement("div");
    table.style.height = "120px"; table.append(container);
    let created = 0, disposed = 0;
    table.renderer = { container, key: (id) => id, createRow(id) {
      created++; const row = document.createElement("div"); row.dataset.row = id; row.style.height = "34px"; row.textContent = `Row ${id}`; return row;
    }, disposeRow() { disposed++; } };
    table.rows = Array.from({ length: 250 }, (_, index) => index);
    const deferred = created === 0;
    document.body.append(table);
    const initial = container.querySelectorAll("[data-row]").length;
    table.remove();
    const removed = created === disposed && container.children.length === 0;
    document.body.append(table);
    table.scrollTo({ top: table.scrollHeight });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const reachedEnd = Boolean(container.querySelector('[data-row="249"]')) && table.scrollTop > 0;
    table.rows = [];
    const empty = !table.shadowRoot.querySelector('[part="empty"]').hidden && !container.querySelector("[data-row]");
    table.renderer = null;
    const cleared = created === disposed && container.children.length === 0 && table.shadowRoot.querySelector('[part="empty"]').hidden;
    table.remove(); return { deferred, initial, removed, reachedEnd, empty, cleared };
  });
  expect(result.deferred).toBe(true);
  expect(result.initial).toBeGreaterThan(0); expect(result.initial).toBeLessThan(80);
  expect(result.removed).toBe(true); expect(result.reachedEnd).toBe(true); expect(result.empty).toBe(true); expect(result.cleared).toBe(true);
});

test("annotation table retains selection through column edits and cancels obsolete drafts", async ({ page }) => {
  await selectionFixture(page, "svg");
  const uid = await annotation(page), before = await panelData(page, uid);
  const matrix = editor(page).locator("clinker-annotation-table");
  await matrix.evaluate((node) => { node.dataset.retained = "true"; });
  await matrixRows(page).first().getByRole("checkbox").check();
  const heading = matrix.locator('clinker-editable-field[label="Column 1 name"]');
  await editField(heading); await heading.locator("input").fill("Renamed"); await heading.locator("input").press("Enter");
  expect((await panelData(page, uid)).columns[0]).toBe("Renamed");
  await matrix.getByRole("button", { name: "Add column", exact: true }).click();
  await matrix.getByRole("textbox", { name: "New column name", exact: true }).fill("Extra");
  await matrix.locator("thead form").getByRole("button", { name: "Add", exact: true }).click();
  expect((await panelData(page, uid)).values.a).toEqual([...before.values.a, null]);
  const remove = matrix.locator('button[aria-label="Remove column Extra"]');
  await remove.locator("..").hover(); await remove.click();
  expect((await panelData(page, uid)).values.a).toEqual(before.values.a);
  await expect(matrix).toHaveAttribute("data-retained", "true");
  await expect(matrix.locator(".cm-data-meta")).toContainText("1 cluster selected");
  const field = matrixRows(page).first().locator("clinker-editable-field").first();
  await editField(field); await field.locator("input").fill("99");
  await page.evaluate((uid) => {
    const panel = chart.data().annotationPanels.find((panel) => panel.uid === uid);
    chart.patch([{ type: "annotationPanels.update", ids: [uid], changes: { columns: panel.columns.map((name, index) => index ? name : "External") } }]);
  }, uid);
  expect((await panelData(page, uid)).values.a).toEqual(before.values.a);
  await expect(matrixRows(page).first().getByRole("checkbox")).toBeChecked();
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect((await panelData(page, uid)).columns[0]).toBe("Renamed");
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
  const firstValue = rows.first().locator("clinker-editable-field").first();
  await editField(firstValue); await firstValue.locator("input").fill("55");
  await matrix.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(rows.last()).toContainText("Cluster 259");
  expect((await panelData(page, "numeric")).values[ids[0]]).toEqual([55]);
  expect(await rows.count()).toBeLessThan(80);
  await rows.last().getByRole("checkbox").check();
  await editor(page).locator(".cm-data-actions clinker-action-menu summary").filter({ hasText: /^Edit values…$/ }).click();
  await editor(page).getByRole("spinbutton", { name: "Batch value", exact: true }).fill("999");
  await editor(page).getByRole("button", { name: "Set values", exact: true }).click();
  const data = await panelData(page, "numeric");
  expect(data.values[ids[0]]).toEqual([999]);
  expect(data.values[ids.at(-1)]).toEqual([999]);
  expect(data.values[ids[1]]).toEqual([1]);
  await editor(page).getByRole("searchbox", { name: "Filter records", exact: true }).fill("Cluster 259");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Cluster 259");
  expect(await rows.first().locator("clinker-editable-field").evaluate((field) => field.value)).toBe("999");
  await editor(page).getByRole("searchbox", { name: "Filter records", exact: true }).fill("");
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
    const field = matrixRows(page).first().locator("clinker-editable-field").first(), value = field.getByRole("spinbutton");
    await editField(field);
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

test("a label click without dragging retains its text and leaves history unchanged", async ({ page }) => {
  await selectionFixture(page, "svg");
  const label = page.locator("#plot text.clusterText").first();
  const text = await label.evaluateHandle((node) => node.firstChild);
  let prompts = 0;
  page.once("dialog", async (dialog) => { prompts++; await dialog.dismiss(); });
  const point = await plotPoint(page, "svg", "text.clusterText");
  await page.mouse.click(point.x, point.y);
  expect(prompts).toBe(1);
  expect(await label.evaluate((node, text) => node.firstChild === text, text)).toBe(true);
  expect(await page.evaluate(() => chart.canUndo())).toBe(false);
  await text.dispose();
});

test("plot label and scale edits update the model, editor, history and export", async ({ page }) => {
  // WebKit's automation bounds omit SVG text-anchor offsets; use DOM geometry.
  const clickLabel = async (selector) => {
    const point = await plotPoint(page, "svg", selector); await page.mouse.click(point.x, point.y);
  };
  const label = page.locator("#plot text.clusterText").first();
  page.once("dialog", (dialog) => dialog.accept("Renamed cluster"));
  await clickLabel("text.clusterText");
  await expect(label).toHaveText("Renamed cluster");
  expect(await page.evaluate(() => chart.data().clusters[0].name)).toBe("Renamed cluster");
  await annotation(page);
  await expect(matrixRows(page).first()).toContainText("Renamed cluster");
  expect(await page.evaluate(() => chart.exportSvg())).toContain("Renamed cluster");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => chart.data().clusters[0].name)).not.toBe("Renamed cluster");
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  await expect(label).toHaveText("Renamed cluster");

  const before = await page.evaluate(() => chart.config().scaleBar.basePair);
  page.once("dialog", (dialog) => dialog.accept("5000"));
  await clickLabel("text.barText");
  expect(await page.evaluate(() => chart.project().config.scaleBar.basePair)).toBe(5000);
  await expect(page.locator("#plot text.barText")).toHaveText("5kb");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => chart.config().scaleBar.basePair)).toBe(before);
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator("#plot text.barText")).toHaveText("5kb");
});

test("shared animation timing, completion, cancellation and deferred preparation", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { animate, afterPaint } = await import("/src/renderers/animation.mjs");
    const original = { request: window.requestAnimationFrame, cancel: window.cancelAnimationFrame, now: performance.now };
    const queued = new Map(), values = [];
    let serial = 0, completed = 0, prepared = 0;
    const frame = (now) => { const callbacks = [...queued.values()]; queued.clear(); callbacks.forEach((callback) => callback(now)); };
    window.requestAnimationFrame = (callback) => { queued.set(++serial, callback); return serial; };
    window.cancelAnimationFrame = (id) => queued.delete(id);
    performance.now = () => 0;
    try {
      animate(100, (progress) => values.push(progress), () => completed++);
      frame(25); frame(50); frame(100);
      const cancel = animate(100, () => { throw new Error("Cancelled animation ran"); });
      cancel(); frame(100);
      const cancelPreparation = afterPaint(() => prepared++);
      frame(100); cancelPreparation(); frame(100);
      afterPaint(() => prepared++);
      frame(100); const beforeSecondFrame = prepared; frame(100);
      return { values, completed, beforeSecondFrame, prepared, pending: queued.size };
    } finally {
      window.requestAnimationFrame = original.request; window.cancelAnimationFrame = original.cancel;
      performance.now = original.now;
    }
  });
  expect(result).toEqual({ values: [0.0625, 0.5, 1], completed: 1, beforeSecondFrame: 0, prepared: 1, pending: 0 });
});

test("WebGPU retains geometry across locus edits, anchoring and row reorder", async ({ page }) => {
  test.skip(!await page.evaluate(() => Boolean(navigator.gpu)), "WebGPU is unavailable");
  await page.evaluate(async () => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const data = await (await fetch("/fixtures/heatmap.json")).json();
    chart.destroy();
    window.chart = ClusterMap().config({ plot: { renderer: "webgpu", transitionDuration: 0 }, annotations: { enabled: true } });
    window.gpuStats = { allocations: 0, vertexWrites: 0 };
    const createBuffer = GPUDevice.prototype.createBuffer, writeBuffer = GPUQueue.prototype.writeBuffer;
    GPUDevice.prototype.createBuffer = function (...args) { gpuStats.allocations++; return createBuffer.apply(this, args); };
    GPUQueue.prototype.writeBuffer = function (buffer, ...args) {
      if (buffer.usage & GPUBufferUsage.VERTEX) gpuStats.vertexWrites++;
      return writeBuffer.call(this, buffer, ...args);
    };
    d3.select("#plot").datum(data).call(chart);
    document.querySelector("clinker-editor").chart = chart;
  });
  const canvas = page.locator("#plot canvas.clusterMapCanvas");
  await expect.poll(() => canvas.getAttribute("data-webgpu")).not.toBe("initializing");
  test.skip(await canvas.getAttribute("data-webgpu") === "unavailable", "No WebGPU adapter");
  await expect(canvas).toHaveAttribute("data-webgpu", "active");
  const paint = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await paint();
  const allocations = await page.evaluate(() => gpuStats.allocations);
  const point = (selector, fraction = 0.5) => canvasPoint(page, selector, fraction);
  const track = '[id$="locus_locus-a"] line.trackBar';
  const start = await point(track, 0.9);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 30, start.y, { steps: 6 }); await page.mouse.up(); await paint();
  expect(await page.evaluate(() => chart.state().locusOffsets.some(([uid, offset]) => uid === "locus-a" && offset !== 0))).toBe(true);
  expect(await page.evaluate(() => gpuStats.allocations)).toBe(allocations);

  await page.evaluate(() => { gpuStats.vertexWrites = 0; chart.rotateTreeNode("x"); });
  await paint();
  expect(await page.evaluate(() => chart.state().clusterOrder)).toEqual(["b", "a", "c", "d", "e"]);
  expect(await page.evaluate(() => gpuStats.vertexWrites)).toBe(0);
  const gene = await point('[id$="gene_gene-a"] polygon.genePolygon');
  await page.mouse.click(gene.x, gene.y); await paint();
  expect(await page.evaluate(() => chart.state().clusterOffsets.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => gpuStats.vertexWrites)).toBe(0);
  const flip = await point(track, 0.9);
  await page.mouse.dblclick(flip.x, flip.y); await paint();
  expect(await page.evaluate(() => chart.state().loci.find(([uid]) => uid === "locus-a")[1].flipped)).toBe(true);
  expect(await page.evaluate(() => gpuStats.vertexWrites)).toBeGreaterThan(0);
  expect(await page.evaluate(() => gpuStats.allocations)).toBe(allocations);
});

test("failed SVG exports remove their temporary measurement surface", async ({ page }) => {
  const result = await page.evaluate(() => {
    const before = document.querySelectorAll("body > svg").length;
    const original = SVGGraphicsElement.prototype.getBBox;
    SVGGraphicsElement.prototype.getBBox = function (...args) {
      if (this.matches("g.clusterMapG") && this.ownerSVGElement.parentNode === document.body) {
        throw new Error("Export measurement failed");
      }
      return original.apply(this, args);
    };
    try {
      try { chart.exportSvg(); } catch (error) {
        return { message: error.message, remaining: document.querySelectorAll("body > svg").length - before };
      }
    } finally { SVGGraphicsElement.prototype.getBBox = original; }
  });
  expect(result).toEqual({ message: "Export measurement failed", remaining: 0 });
});

test("raster listeners persist across edits and detach on renderer changes and destroy", async ({ page }) => {
  const result = await page.evaluate(() => {
    chart.config({ plot: { renderer: "canvas" } });
    const surface = document.querySelector("#plot canvas.clusterMapCanvas");
    const listener = () => d3.select(surface).on("pointerdown.canvasInteraction");
    const initial = listener();
    chart.config({ gene: { label: { show: false } } });
    const afterConfig = listener() === initial;
    chart.patch([{ type: "genes.update", ids: [chart.data().clusters[0].loci[0].genes[0].uid], changes: { label: "Updated" } }]);
    const afterPatch = listener() === initial;
    chart.undo();
    const afterUndo = listener() === initial;
    chart.data(structuredClone(chart.data()));
    const afterReplacement = listener() === initial;
    chart.config({ plot: { renderer: "svg" } });
    const detached = listener() === undefined;
    chart.config({ plot: { renderer: "canvas" } });
    const next = document.querySelector("#plot canvas.clusterMapCanvas");
    const rebound = next !== surface && typeof d3.select(next).on("pointerdown.canvasInteraction") === "function";
    chart.destroy();
    const destroyed = d3.select(next).on("pointerdown.canvasInteraction") === undefined;
    return { afterConfig, afterPatch, afterUndo, afterReplacement, detached, rebound, destroyed };
  });
  expect(result).toEqual({ afterConfig: true, afterPatch: true, afterUndo: true,
    afterReplacement: true, detached: true, rebound: true, destroyed: true });
});

test("context menus retain bindings and use current data and configured actions", async ({ page }) => {
  const gene = page.locator("#plot polygon.genePolygon").first();
  const uid = await gene.evaluate((node) => node.__data__.uid);
  await page.evaluate((uid) => {
    window.reveals = [];
    window.enterMenu = d3.select("#plot .tooltip").on("mouseenter");
    chart.config({ gene: { shape: { onReveal: (gene) => reveals.push(["old", gene.label]) } } });
    chart.patch([{ type: "genes.update", ids: [uid], changes: { label: "Updated label" } }]);
    chart.config({ gene: { shape: { onReveal: (gene) => reveals.push(["new", gene.label]) } } });
  }, uid);
  await gene.dispatchEvent("contextmenu", { clientX: 100, clientY: 100 });
  await page.locator("#plot .tooltip").getByRole("button", { name: "Reveal in data editor" }).click();
  expect(await page.evaluate(() => reveals)).toEqual([["new", "Updated label"]]);
  await page.evaluate((uid) => {
    const data = structuredClone(chart.data());
    data.clusters.flatMap((cluster) => cluster.loci).flatMap((locus) => locus.genes)
      .find((gene) => gene.uid === uid).label = "Replacement label";
    chart.data(data);
  }, uid);
  await gene.dispatchEvent("contextmenu", { clientX: 100, clientY: 100 });
  await page.locator("#plot .tooltip").getByRole("button", { name: "Reveal in data editor" }).click();
  expect(await page.evaluate(() => reveals)).toEqual([["new", "Updated label"], ["new", "Replacement label"]]);
  expect(await page.evaluate(() => d3.select("#plot .tooltip").on("mouseenter") === enterMenu)).toBe(true);
});


test("Canvas bitmap flips commit once and support undo and export during animation", async ({ page }) => {
  await page.evaluate(async () => {
    const data = await (await fetch("/fixtures/heatmap.json")).json();
    chart.data(data);
    chart.config({ plot: { renderer: "canvas", transitionDuration: 100 } });
    chart.state({ ...chart.state(), camera: { x: 350, y: 40, k: 1 } });
    chart.clearHistory();
    window.bitmapCopies = 0;
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (this.canvas.classList.contains("clusterMapCanvas")) bitmapCopies++;
      return drawImage.apply(this, args);
    };
  });
  const point = await canvasPoint(page, '[id$="locus_locus-a"] line.trackBar', 0.9);
  await page.mouse.move(point.x, point.y);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(() => page.evaluate(() => bitmapCopies)).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  const flipped = () => page.evaluate(() => chart.state().loci.some(([uid, state]) => uid === "locus-a" && state.flipped));
  expect(await flipped()).toBe(true);
  await page.evaluate(() => chart.undo());
  expect(await flipped()).toBe(false);
  expect(await page.evaluate(() => chart.canUndo())).toBe(false);
  await page.evaluate(() => chart.redo());
  expect(await flipped()).toBe(true);
  // Trigger a fresh flip and flush it through export before its animation ends.
  const next = await canvasPoint(page, '[id$="locus_locus-a"] line.trackBar', 0.9);
  await page.mouse.dblclick(next.x, next.y);
  expect(await page.evaluate(() => chart.exportSvg())).toContain("clusterMapG");
  expect(await flipped()).toBe(false);
  await page.evaluate(() => chart.undo());
  expect(await flipped()).toBe(true);
});

test("renderer switches cancel Canvas animation paints on detached surfaces", async ({ page }) => {
  await page.evaluate(async () => {
    chart.data(await (await fetch("/fixtures/heatmap.json")).json());
    chart.config({ plot: { renderer: "canvas", transitionDuration: 120 } });
    window.detachedPaints = 0;
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains("clusterMapCanvas") && !this.canvas.isConnected) detachedPaints++;
      return clearRect.apply(this, args);
    };
    chart.rotateTreeNode("x");
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.evaluate(() => chart.config({ plot: { renderer: "svg" } }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => detachedPaints)).toBe(0);
});

test("WebGPU fallback paints the current frame and reflects subsequent edits", async ({ page }) => {
  await page.evaluate(async () => {
    Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
    chart.data(await (await fetch("/fixtures/heatmap.json")).json());
    chart.config({ plot: { renderer: "canvas", adaptiveResolution: false, transitionDuration: 0 } });
    chart.state({ ...chart.state(), camera: { x: 350, y: 40, k: 1 } });
    chart.patch([{ type: "genes.update", ids: ["gene-a"], changes: { colour: "#cc5500" } }]);
  });
  const point = await canvasPoint(page, '[id$="gene_gene-a"] polygon.genePolygon');
  const pixel = (selector) => page.evaluate(({ point, selector }) => {
    const canvas = document.querySelector(selector), bounds = canvas.getBoundingClientRect();
    const x = Math.floor((point.x - bounds.x) * canvas.width / bounds.width);
    const y = Math.floor((point.y - bounds.y) * canvas.height / bounds.height);
    return [...canvas.getContext("2d").getImageData(x, y, 1, 1).data];
  }, { point, selector });
  const before = await pixel("#plot canvas.clusterMapCanvas");
  expect(before).toEqual([204, 85, 0, 255]);
  await page.evaluate(() => chart.config({ plot: { renderer: "webgpu" } }));
  await expect(page.locator("#plot canvas.clusterMapCanvas")).toHaveAttribute("data-webgpu", "unavailable");
  expect(await pixel("#plot canvas.clusterMapWebGpuOverlay")).toEqual(before);
  await page.evaluate(() => chart.patch([{ type: "genes.update", ids: ["gene-a"], changes: { colour: "#1155aa" } }]));
  expect(await pixel("#plot canvas.clusterMapWebGpuOverlay")).toEqual([17, 85, 170, 255]);
});

for (const renderer of ["svg", "canvas"]) for (const duration of [0, 80]) {
  test(`${renderer}: ${duration}ms flips paint current geometry and create one history entry`, async ({ page }) => {
    await page.evaluate(async ({ renderer, duration }) => {
      chart.data(await (await fetch("/fixtures/heatmap.json")).json());
      chart.config({ plot: { renderer, transitionDuration: duration } });
      chart.state({ ...chart.state(), camera: { x: 350, y: 40, k: 1 } });
      chart.clearHistory();
    }, { renderer, duration });
    const points = () => page.evaluate(() => new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml")
      .querySelector('[id$="gene_gene-a"] polygon.genePolygon').getAttribute("points"));
    const before = await points();
    if (renderer === "svg") await page.locator('#plot [id$="locus_locus-a"]').dispatchEvent("dblclick");
    else {
      const point = await canvasPoint(page, '[id$="locus_locus-a"] line.trackBar', 0.9);
      await page.mouse.dblclick(point.x, point.y);
    }
    await expect.poll(() => page.evaluate(() => chart.canUndo())).toBe(true);
    const after = await points();
    expect(after).not.toBe(before);
    if (renderer === "svg") await expect(page.locator('#plot [id$="gene_gene-a"] polygon.genePolygon')).toHaveAttribute("points", after);
    await page.evaluate(() => chart.undo());
    expect(await points()).toBe(before);
    expect(await page.evaluate(() => chart.canUndo())).toBe(false);
    await page.evaluate(() => chart.redo());
    expect(await points()).toBe(after);
  });
}

test("camera focus uses the current renderer and becomes inert after destruction", async ({ page }) => {
  const result = await page.evaluate(() => {
    const uid = chart.data().clusters[0].loci[0].genes[0].uid;
    chart.config({ plot: { renderer: "canvas" } });
    chart.focus([uid]);
    const canvas = d3.select("#plot canvas.clusterMapCanvas").node().__zoom;
    const focusedCanvas = chart.state().camera;
    chart.config({ plot: { renderer: "svg" } });
    chart.focus([uid]);
    const svg = d3.select("#plot svg.clusterMap").node().__zoom;
    const focusedSvg = chart.state().camera;
    chart.destroy();
    const chainable = chart.focus([uid]) === chart;
    return { canvas: { x: canvas.x, y: canvas.y, k: canvas.k }, focusedCanvas,
      svg: { x: svg.x, y: svg.y, k: svg.k }, focusedSvg, chainable, after: chart.state().camera };
  });
  expect(result.canvas).toEqual(result.focusedCanvas);
  expect(result.svg).toEqual(result.focusedSvg);
  expect(result.chainable).toBe(true);
  expect(result.after).toEqual(result.focusedSvg);
});

async function selectionFixture(page, renderer) {
  await page.evaluate(async (renderer) => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const { mountPlotSelectionToolbar } = await import("/dist/editor.mjs");
    window.disposePlotToolbar?.(); chart.destroy();
    const data = await (await fetch("/fixtures/heatmap.json")).json();
    const second = structuredClone(data.clusters[0].loci[0]);
    second.uid = "locus-a2"; second.name = "sequence_a2"; second.genes[0].uid = "gene-a2";
    data.clusters[0].loci.push(second);
    data.config = { ...data.config, updateGroups: false };
    data.groups = [
      { uid: "alpha", label: "Alpha", colour: "#267c9e", genes: ["gene-a", "gene-a2"] },
      { uid: "beta", label: "Beta", colour: "#4477aa", genes: ["gene-b", "gene-c"] },
      { uid: "gamma", label: "Gamma", colour: "#228833", genes: ["gene-d", "gene-e"] },
    ];
    data.links = [
      { uid: "ab", query: { uid: "gene-a" }, target: { uid: "gene-b" }, identity: 1 },
      { uid: "cd", query: { uid: "gene-c" }, target: { uid: "gene-d" }, identity: 0.9 },
    ];
    window.selectionInput = structuredClone(data);
    window.chart = ClusterMap().config({ plot: { renderer, transitionDuration: 0, adaptiveResolution: false },
      cluster: { spacing: 10 }, annotations: { enabled: true } });
    d3.select("#plot").datum(data).call(chart);
    document.querySelector("clinker-editor").chart = chart;
    window.disposePlotToolbar = mountPlotSelectionToolbar(chart, document.querySelector("#plot"), { editor: document.querySelector("clinker-editor") });
  }, renderer);
  if (renderer === "webgpu") {
    await expect.poll(() => page.locator("#plot canvas.clusterMapCanvas").getAttribute("data-webgpu"))
      .toMatch(/^(active|unavailable)$/);
    if (process.env.CLUSTERMAP_REQUIRE_WEBGPU) await expect(page.locator("#plot canvas.clusterMapCanvas")).toHaveAttribute("data-webgpu", "active");
  }
}

const clusterLabel = (uid) => `[id$="cluster_${uid}"] text.clusterText`;
const locusTrack = (uid) => `[id$="locus_${uid}"] line.trackBar`;
async function plotPoint(page, renderer, selector) {
  if (renderer !== "svg") return canvasPoint(page, selector);
  return page.locator(`#plot ${selector}`).first().evaluate((node) => {
    const bounds = node.getBBox(), point = new DOMPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      .matrixTransform(node.getScreenCTM());
    return { x: point.x, y: point.y };
  });
}
async function selectAt(page, renderer, selector, modifiers = ["Shift"]) {
  const point = await plotPoint(page, renderer, selector);
  const keys = modifiers.map((key) => key === "ControlOrMeta" ? (process.platform === "darwin" ? "Meta" : "Control") : key);
  for (const key of keys) await page.keyboard.down(key);
  try { await page.mouse.click(point.x, point.y); }
  finally { for (const key of keys.toReversed()) await page.keyboard.up(key); }
}
const plotToolbar = (page) => page.locator("#plot .cm-plot-selection-toolbar");
const expectSelection = async (page, kind, ids) => expect.poll(() => page.evaluate(() => chart.selection())).toEqual({ kind, ids });

for (const renderer of ["svg", "canvas", "webgpu"]) {
  test(`${renderer}: plot selection toggles, ranges and editor handoff`, async ({ page }) => {
    await selectionFixture(page, renderer);
    for (const uid of ["a", "b", "a"]) await selectAt(page, renderer, clusterLabel(uid));
    await expectSelection(page, "clusters", ["b"]);
    await selectAt(page, renderer, clusterLabel("b"));
    await expectSelection(page, "clusters", []);
    await selectAt(page, renderer, clusterLabel("a"));
    await selectAt(page, renderer, clusterLabel("d"), ["ControlOrMeta", "Shift"]);
    await expectSelection(page, "clusters", ["a", "b", "c", "d"]);
    await selectAt(page, renderer, clusterLabel("b"), ["Alt", "Shift"]);
    await expectSelection(page, "clusters", ["c", "d"]);
    await expect(plotToolbar(page)).toContainText("2 clusters selected");
    await expect(plotToolbar(page).locator("summary").filter({ hasText: /^Loci…$/ })).toBeVisible();
    await selectAt(page, renderer, locusTrack("locus-a"));
    await expectSelection(page, "loci", ["locus-a"]);
    await selectAt(page, renderer, locusTrack("locus-b"), ["ControlOrMeta", "Shift"]);
    await expectSelection(page, "loci", ["locus-a", "locus-a2", "locus-b"]);
    await selectAt(page, renderer, locusTrack("locus-a2"));
    await expectSelection(page, "loci", ["locus-a", "locus-b"]);
    expect(await page.evaluate(() => chart.canUndo())).toBe(false);
    await plotToolbar(page).locator("summary").filter({ hasText: /^More…$/ }).click();
    await plotToolbar(page).getByRole("button", { name: "Edit data…", exact: true }).click();
    await expect(editor(page).locator('[data-kind-picker] button[value="genes"]')).toHaveAttribute("aria-pressed", "true");
    await expect(editor(page).locator(".cm-data-meta").first()).toContainText("2 genes selected");
    await expect(editor(page).locator(".cm-editor__tree-gene.is-selected")).toHaveCount(2);
    await page.keyboard.press("Escape");
  });

  test(`${renderer}: plot removals retain source data through undo, redo and project reload`, async ({ page }) => {
    await selectionFixture(page, renderer);
    await page.evaluate(() => chart.locusSelection(["locus-a"]));
    await plotToolbar(page).locator("summary").filter({ hasText: /^More…$/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await plotToolbar(page).getByRole("button", { name: "Remove selected loci", exact: true }).click();
    expect(await page.evaluate(() => chart.visibleData().clusters[0].loci.map((locus) => locus.uid))).toEqual(["locus-a2"]);
    expect(await page.evaluate(() => chart.data().clusters[0].loci.length)).toBe(2);
    await expect(plotToolbar(page)).toBeHidden();
    await page.evaluate(() => chart.undo());
    expect(await page.evaluate(() => chart.visibleData().clusters[0].loci.length)).toBe(2);
    await page.evaluate(() => chart.redo());
    expect(await page.evaluate(() => chart.visibleData().clusters[0].loci.length)).toBe(1);
    await page.evaluate(() => { chart.undo(); chart.clusterSelection(["a", "c"]); });
    await plotToolbar(page).locator("summary").filter({ hasText: /^More…$/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await plotToolbar(page).getByRole("button", { name: "Remove selected clusters", exact: true }).click();
    const inspect = () => page.evaluate(() => ({
      source: chart.data().clusters.map((cluster) => cluster.uid), visible: chart.visibleData().clusters.map((cluster) => cluster.uid),
      nodes: chart.visibleData().tree.nodes.map((node) => ({ uid: node.uid, length: node.branchLength })),
      values: chart.visibleData().annotationPanels.find((panel) => panel.uid === "expression").values,
      links: chart.visibleData().links.length,
    }));
    const removed = await inspect();
    expect(removed.source).toEqual(["a", "b", "c", "d", "e"]);
    expect(removed.visible).toEqual(["b", "d", "e"]);
    expect(removed.nodes.some((node) => ["a", "c", "x", "y"].includes(node.uid))).toBe(false);
    expect(removed.nodes.find((node) => node.uid === "b").length).toBe(7);
    expect(removed.links).toBe(0);
    expect(Object.keys(removed.values)).toEqual(["b", "d", "e"]);
    const exported = await page.evaluate(() => {
      const svg = new DOMParser().parseFromString(chart.exportSvg(), "image/svg+xml");
      return [...svg.querySelectorAll("g.cluster text.clusterText")].map((label) => label.textContent);
    });
    expect(exported).toEqual(["Example B", "Example D", "Example E"]);
    await page.evaluate(() => chart.undo());
    expect((await inspect()).visible).toEqual(["a", "b", "c", "d", "e"]);
    await page.evaluate(() => chart.redo());
    expect(await inspect()).toEqual(removed);
    const saved = await page.evaluate(() => JSON.parse(JSON.stringify(chart.project())));
    await page.evaluate(async (saved) => {
      const { ClusterMap } = await import("/dist/clustermap.mjs");
      disposePlotToolbar(); chart.destroy();
      window.chart = ClusterMap();
      d3.select("#plot").datum(structuredClone(selectionInput)).call(chart);
      chart.project(saved); document.querySelector("clinker-editor").chart = chart;
    }, saved);
    expect(await inspect()).toEqual(removed);
    expect(await page.evaluate(() => chart.project())).toEqual(saved);
    expect(await page.evaluate(() => chart.canUndo())).toBe(false);
    await annotation(page);
    await expect(matrixRows(page)).toHaveCount(3);
    await page.evaluate(() => chart.remove({ clusters: chart.visibleData().clusters.map((cluster) => cluster.uid) }));
    expect(await page.evaluate(() => ({ count: chart.visibleData().clusters.length, tree: chart.visibleData().tree }))).toEqual({ count: 0, tree: null });
    await page.evaluate(() => chart.undo());
    expect((await inspect()).visible).toEqual(["b", "d", "e"]);
  });

  test(`${renderer}: cluster dragging respects explicit selection, tree constraints and stable bounds`, async ({ page }) => {
    await selectionFixture(page, renderer);
    await page.evaluate(() => chart.clusterSelection(["a", "b"]));
    const size = () => page.locator("#plot .clusterMapFigureSurface").evaluate((node) => ({ width: node.style.width, height: node.style.height }));
    const before = await size(), from = await plotPoint(page, renderer, clusterLabel("a")), to = await plotPoint(page, renderer, clusterLabel("c"));
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(from.x, to.y, { steps: 10 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await size()).toEqual(before);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => chart.state().clusterOrder)).toEqual(["c", "d", "a", "b", "e"]);
    await page.evaluate(() => { chart.undo(); chart.locusSelection(["locus-a", "locus-c"]); });
    const a = await plotPoint(page, renderer, clusterLabel("a")), b = await plotPoint(page, renderer, clusterLabel("b"));
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x, b.y, { steps: 10 }); await page.mouse.up();
    await expect.poll(() => page.evaluate(() => chart.state().clusterOrder)).toEqual(["b", "a", "c", "d", "e"]);
  });
}

test("editor parent ranges and contextual actions keep the table stationary", async ({ page }) => {
  await selectionFixture(page, "svg");
  await view(page, "genes");
  await editor(page).getByRole("button", { name: "Collapse all", exact: true }).click();
  const rows = editor(page).locator(".cm-editor__tree-parent"), before = await rows.first().boundingBox();
  await rows.first().getByRole("checkbox").check();
  expect((await rows.first().boundingBox()).y).toBe(before.y);
  await rows.nth(2).getByRole("checkbox").click({ modifiers: ["Shift"] });
  expect((await rows.first().boundingBox()).y).toBe(before.y);
  await expect(editor(page).locator(".cm-data-meta").first()).toContainText("4 genes selected");
  expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
  await editor(page).locator('[data-gene-view] button[value="groups"]').click();
  const groups = editor(page).locator(".cm-editor__tree-parent");
  await groups.last().getByRole("checkbox").click({ modifiers: ["Shift"] });
  await editor(page).locator(".cm-data-actions clinker-action-menu summary").filter({ hasText: /^Remove…$/ }).click();
  await expect(editor(page).locator('[data-command="remove-loci"]')).toBeHidden();
  await expect(editor(page).locator('[data-command="remove-clusters"]')).toBeHidden();
  await expect(editor(page).locator('[data-command="delete-groups"]')).toBeVisible();
  const geneCount = await page.evaluate(() => chart.data().clusters.flatMap((cluster) => cluster.loci).flatMap((locus) => locus.genes).length);
  page.once("dialog", (dialog) => dialog.accept());
  await editor(page).locator('[data-command="delete-groups"]').click();
  expect(await page.evaluate(() => chart.data().groups.length)).toBeLessThan(3);
  expect(await page.evaluate(() => chart.data().clusters.flatMap((cluster) => cluster.loci).flatMap((locus) => locus.genes).length)).toBe(geneCount);
  await page.evaluate(() => chart.undo());
  expect(await page.evaluate(() => chart.data().groups.length)).toBe(3);
});

test("editable components preserve drafts and normalize commits through history", async ({ page }) => {
  await selectionFixture(page, "svg");
  const field = editor(page).locator('.cm-editor__row--groups clinker-editable-field[data-field="label"]').first();
  const input = field.getByRole("textbox"), uid = await field.getAttribute("data-id");
  const label = () => page.evaluate((uid) => chart.data().groups.find((group) => String(group.uid) === uid).label, uid);
  await editField(field); await input.fill("Uncommitted draft");
  await page.evaluate((uid) => chart.patch([{ type: "groups.update", ids: [uid], changes: { label: "Application edit" } }]), uid);
  await expect(input).toHaveValue("Uncommitted draft");
  await input.press("Escape");
  expect(await field.evaluate((field) => field.value)).toBe("Application edit");
  expect(await label()).toBe("Application edit");
  await editField(field); await input.fill("  Normalized label  "); await input.press("Enter");
  expect(await label()).toBe("Normalized label");
  expect(await field.evaluate((field) => field.value)).toBe("Normalized label");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await label()).toBe("Application edit");
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click();
  expect(await label()).toBe("Normalized label");
  await editField(field); await input.fill("Blur commits once");
  await editor(page).getByRole("searchbox", { name: "Filter records", exact: true }).focus();
  expect(await label()).toBe("Blur commits once");
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  expect(await label()).toBe("Normalized label");
});

test("cluster and locus fields keep their footprint, selection and distinct patch targets", async ({ page }) => {
  await page.evaluate(async () => chart.data(await (await fetch("/fixtures/heatmap.json")).json()));
  await view(page, "genes");
  const row = editor(page).locator(".cm-editor__tree-parent").first();
  await row.getByRole("checkbox").check();
  const summary = editor(page).locator('.cm-data-meta [part="summary"]').first();
  const selected = await summary.innerText();
  for (const type of ["clusters", "loci"]) {
    const field = row.locator(`clinker-editable-field[data-type="${type}"]`), input = field.getByRole("textbox");
    const before = await field.evaluate((field) => ({ id: field.dataset.id, value: field.value, width: field.getBoundingClientRect().width }));
    const sourceName = () => page.evaluate(({ type, id }) => {
      const records = type === "clusters" ? chart.data().clusters : chart.data().clusters.flatMap((cluster) => cluster.loci);
      return records.find((record) => String(record.uid) === id).name;
    }, { type, id: before.id });
    const sourceBefore = await sourceName();
    await editField(field);
    expect(Math.abs((await field.boundingBox()).width - before.width)).toBeLessThanOrEqual(1);
    await input.fill(""); await input.press("Enter");
    await expect(input).toBeVisible(); expect(await sourceName()).toBe(sourceBefore);
    await input.press("Escape");
    await expect(summary).toHaveText(selected);
    await editField(field); await input.fill(`Edited ${type}`); await input.press("Enter");
    expect(await sourceName()).toBe(`Edited ${type}`);
    expect(await field.evaluate((field) => field.value)).toBe(`Edited ${type}`);
    expect(Math.abs((await field.boundingBox()).height - 28)).toBeLessThanOrEqual(1);
    await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
    expect(await sourceName()).toBe(sourceBefore);
    expect(await field.evaluate((field) => field.value)).toBe(before.value);
  }
});

test("numeric component validation rejects invalid identities without changing history", async ({ page }) => {
  await selectionFixture(page, "svg");
  await view(page, "links");
  const field = editor(page).locator('clinker-editable-field[data-field="identity"]').first(), input = field.getByRole("spinbutton");
  const uid = await field.getAttribute("data-id");
  const identity = () => page.evaluate((uid) => chart.data().links.find((link) => String(link.uid) === uid).identity, uid);
  const before = await identity();
  await editField(field);
  for (const value of ["101", "-1", ""]) {
    await input.fill(value); await input.press("Enter");
    expect(await input.evaluate((input) => input.checkValidity())).toBe(false);
    expect(await identity()).toBe(before); expect(await page.evaluate(() => chart.canUndo())).toBe(false);
  }
  await input.press("Escape"); await expect(input).toBeHidden();
  await editField(field); await input.fill("75"); await input.press("Enter");
  expect(await identity()).toBe(0.75);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click(); expect(await identity()).toBe(before);
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click(); expect(await identity()).toBe(0.75);
});

test("virtualized component fields commit on blur and discard drafts when data is replaced", async ({ page }) => {
  await page.evaluate(() => {
    const genes = Array.from({ length: 260 }, (_, i) => ({ uid: `gene-${i}`, start: i * 100, end: i * 100 + 80, strand: 1 }));
    chart.data({ config: { updateGroups: false }, clusters: [{ uid: "c", name: "Cluster", loci: [{ uid: "l", start: 0, end: 26000, genes }] }],
      links: [], groups: genes.map((gene, i) => ({ uid: `group-${i}`, label: `Group ${i}`, genes: [gene.uid] })) });
  });
  const rows = editor(page).locator(".cm-editor__row--groups"), table = editor(page).locator(".cm-editor__table");
  expect(await rows.count()).toBeLessThan(80);
  const field = rows.first().locator('clinker-editable-field[data-field="label"]');
  await editField(field); await field.getByRole("textbox").fill("Saved before scrolling");
  await table.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(rows.last()).toContainText("Group 259");
  await table.evaluate((node) => { node.scrollTop = 0; });
  await expect(rows.first()).toContainText("Saved before scrolling");
  await editField(field); await field.getByRole("textbox").fill("Discard this draft");
  await page.evaluate(() => {
    const data = structuredClone(chart.data()); data.groups[0].label = "Replacement data"; chart.data(data);
  });
  await expect(field.getByRole("textbox")).toBeHidden();
  expect(await field.evaluate((field) => field.value)).toBe("Replacement data");
  expect(await page.evaluate(() => chart.data().groups[0].label)).toBe("Replacement data");
  expect(await page.evaluate(() => chart.canUndo())).toBe(false);
});

test("controller preserves parent range anchors after external edits", async ({ page }) => {
  await selectionFixture(page, "svg"); await view(page, "genes");
  await editor(page).getByRole("button", { name: "Collapse all", exact: true }).click();
  const parents = editor(page).locator(".cm-editor__tree-parent");
  await parents.first().getByRole("checkbox").check();
  await page.evaluate(() => chart.patch([{ type: "groups.update", ids: ["alpha"], changes: { label: "Edited alpha" } }]));
  await parents.nth(2).getByRole("checkbox").click({ modifiers: ["Shift"] });
  await expect(editor(page).locator(".cm-data-meta").first()).toContainText("4 genes selected");
  await expect(parents.nth(1).getByRole("checkbox")).toBeChecked();
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor(page).locator(".cm-data-meta").first()).toContainText("4 genes selected");
});

test("controller expands filtered combined branches without offering partial cluster removal", async ({ page }) => {
  await selectionFixture(page, "svg");
  await page.evaluate(() => chart.patch([{ type: "groups.assignGenes", groupId: "beta", geneIds: ["gene-a2"] }]));
  await editor(page).locator(".cm-editor__row--groups").first().getByRole("checkbox").check();
  const actions = editor(page).locator("clinker-record-actions");
  await actions.locator('clinker-action-menu[label="Group…"] summary').click();
  await actions.getByRole("button", { name: "View member genes", exact: true }).click();
  await editor(page).locator('[data-gene-view] button[value="tree"]').click();
  await expect(editor(page).locator(".cm-editor__tree-gene")).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Expand visible", exact: true }).click();
  await expect(editor(page).locator(".cm-editor__tree-gene")).toHaveCount(1);
  await editor(page).locator(".cm-editor__tree-parent").first().getByRole("checkbox").check();
  await actions.locator('clinker-action-menu[label="Remove…"] summary').click();
  await expect(actions.locator('[data-command="remove-loci"]')).toBeVisible();
  await expect(actions.locator('[data-command="remove-clusters"]')).toBeHidden();
});

test("controller preserves selection on rejected edits and reconciles a subsequent merge", async ({ page }) => {
  await selectionFixture(page, "svg");
  const rows = editor(page).locator(".cm-editor__row--groups");
  await rows.nth(0).getByRole("checkbox").check(); await rows.nth(1).getByRole("checkbox").check();
  await page.evaluate(() => { window.originalPatch = chart.patch; chart.patch = () => { throw new Error("Rejected test edit"); }; });
  const actions = editor(page).locator("clinker-record-actions");
  await actions.locator('clinker-action-menu[label="Remove…"] summary').click();
  page.once("dialog", (dialog) => dialog.accept());
  await actions.getByRole("button", { name: "Delete selected groups", exact: true }).click();
  await expect(editor(page).locator("[data-editor-error]")).toHaveText("Rejected test edit");
  await expect(editor(page).locator(".cm-data-meta").first()).toContainText("2 groups selected");
  await expect(rows.filter({ has: page.locator('input:checked') })).toHaveCount(2);
  expect(await page.evaluate(() => ({ count: chart.data().groups.length, undo: chart.canUndo() }))).toEqual({ count: 3, undo: false });
  await page.evaluate(() => { chart.patch = window.originalPatch; });
  await actions.locator('clinker-action-menu[label="Merge…"] summary').click();
  await actions.locator("[data-merge-target]").selectOption("alpha");
  await actions.getByRole("button", { name: "Merge groups", exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(editor(page).locator("[data-editor-error]")).toBeHidden();
  await expect(rows.filter({ has: page.locator('input:checked') })).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Undo", exact: true }).click(); await expect(rows).toHaveCount(3);
  await editor(page).getByRole("button", { name: "Redo", exact: true }).click(); await expect(rows).toHaveCount(2);
});

test("controller restores selection highlights when filtering removes the hovered row", async ({ page }) => {
  await selectionFixture(page, "svg");
  const rows = editor(page).locator(".cm-editor__row--groups");
  await rows.first().getByRole("checkbox").check();
  await rows.nth(1).hover();
  await expect.poll(() => page.evaluate(() => chart.highlight())).toEqual(["gene-b", "gene-c"]);
  await editor(page).getByRole("searchbox", { name: "Filter records", exact: true }).fill("Alpha");
  await expect(rows).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => chart.highlight())).toEqual(["gene-a", "gene-a2"]);
  await expect(rows.first().getByRole("checkbox")).toBeChecked();
});

test("editor styles are self-contained and expose explicit theme overrides", async ({ page }) => {
  await selectionFixture(page, "svg");
  await page.addStyleTag({ content: "button{font-size:40px!important;background:magenta!important}.cm-data-row{height:90px!important;background:magenta!important}" });
  await editor(page).evaluate((node) => node.style.setProperty("--clinker-accent", "#7134c6"));
  await expect(editor(page).getByRole("button", { name: "Undo", exact: true })).toHaveCSS("font-size", "13px");
  await expect(editor(page).locator(".cm-data-row").first()).toHaveCSS("height", "34px");
  await expect(editor(page).getByRole("tab", { name: "Data", exact: true })).toHaveCSS("border-bottom-color", "rgb(113, 52, 198)");
  expect(await page.locator('link[href*="editor.css"]').count()).toBe(0);
  expect(await page.evaluate(() => ({
    privateHeader: document.querySelector(".cm-editor__header") === null,
    dataShadow: Boolean(document.querySelector("clinker-editor").shadowRoot.querySelector("clinker-data-panel").shadowRoot),
  }))).toEqual({ privateHeader: true, dataShadow: true });
});

for (const [entry, tag] of [["editor", "clinker-editor"], ["data-panel", "clinker-data-panel"], ["appearance-panel", "clinker-appearance-panel"]]) {
  test(`${entry}: import upgrades early chart assignments inside another shadow root`, async ({ page }) => {
    await page.goto(url);
    await page.evaluate(async ({ entry, tag }) => {
      document.querySelector("clinker-editor").remove();
      const { ClusterMap } = await import("/dist/clustermap.mjs");
      const data = await (await fetch("/fixtures/heatmap.json")).json();
      window.chart = ClusterMap().config({ plot: { renderer: "svg", transitionDuration: 0, theme: "dark" } });
      d3.select("#plot").datum(data).call(chart);
      const panel = document.createElement(tag); panel.id = "standalone"; panel.style.height = "400px"; panel.chart = chart;
      const host = document.createElement("section"); document.body.append(host);
      host.attachShadow({ mode: "open" }).append(panel);
      await import(entry === "editor" ? "/dist/editor.mjs" : `/dist/editor-${entry}.mjs`);
    }, { entry, tag });
    const panel = page.locator("#standalone");
    expect(await panel.evaluate((node) => ({ connected: node.chart === chart, shadow: Boolean(node.shadowRoot), fullEditorRegistered: Boolean(customElements.get("clinker-editor")) })))
      .toEqual({ connected: true, shadow: true, fullEditorRegistered: entry === "editor" });
    await expect(panel).toHaveCSS("background-color", "rgb(35, 42, 53)");
    if (entry !== "appearance-panel") {
      if (entry === "editor") await page.evaluate(() => {
        window.openEvents = 0;
        document.addEventListener("clinker-editor-open", () => openEvents++);
      });
      await panel.evaluate((node) => node.editSelection({ kind: "clusters", ids: ["a"] }));
      if (entry === "editor") expect(await page.evaluate(() => openEvents)).toBe(1);
      await expect(panel.locator(".cm-data-meta").first()).toContainText("1 gene selected");
      await page.evaluate(() => chart.patch([{ type: "clusters.update", ids: ["a"], changes: { name: "External name" } }]));
      await expect(panel.locator(".cm-editor__tree-parent").first()).toContainText("External name");
    } else {
      await page.evaluate(() => chart.config({ legend: { show: false } }));
      await expect(panel.locator('[data-config="legend.show"]')).not.toBeChecked();
      await panel.locator('[data-config="legend.show"]').check();
      expect(await page.evaluate(() => chart.config().legend.show)).toBe(true);
    }
  });
}

test("editor navigation can be configured before mounting and survives reconnects", async ({ page }) => {
  await selectionFixture(page, "svg");
  await editor(page).evaluate((node) => {
    node.remove();
    window.integrationEditor = document.createElement("clinker-editor");
    integrationEditor.chart = chart;
    const ids = ["d"]; integrationEditor.editSelection({ kind: "clusters", ids }); ids[0] = "a";
    document.body.append(integrationEditor);
  });
  await expect(editor(page).locator(".cm-data-meta").first()).toContainText("1 gene selected");
  await expect(editor(page).locator(".cm-editor__tree-parent.is-selected")).toContainText("Example D");
  const uid = await page.evaluate(() => chart.data().annotationPanels.find((panel) => panel.type === "heatmap").uid);
  await page.evaluate((uid) => { integrationEditor.remove(); integrationEditor.editAnnotations(uid); document.body.append(integrationEditor); }, uid);
  await expect(editor(page).getByRole("combobox", { name: "Annotation panel", exact: true })).toHaveValue(uid);
  await editor(page).evaluate((node) => node.reset());
  await expect(editor(page).locator(".cm-editor__row--groups")).toHaveCount(3);
});

test("editor releases chart subscriptions and highlights on detach and replacement", async ({ page }) => {
  await selectionFixture(page, "svg");
  await page.evaluate(async () => {
    window.disposePlotToolbar();
    const editor = document.querySelector("clinker-editor"); editor.chart = null;
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const target = document.createElement("div"); document.body.append(target);
    window.secondChart = ClusterMap().config({ plot: { renderer: "svg", transitionDuration: 0 } });
    d3.select(target).datum(structuredClone(selectionInput)).call(secondChart);
    window.integrationCounts = [chart, secondChart].map((source) => {
      const count = { listeners: 0, previewClears: 0 }, on = source.on, preview = source.previewTreePresentation;
      source.on = (...args) => { count.listeners++; const unsubscribe = on(...args); return () => { count.listeners--; unsubscribe(); }; };
      source.previewTreePresentation = (value) => { if (value === null) count.previewClears++; return preview(value); };
      return count;
    });
    editor.chart = chart;
  });
  await editor(page).locator(".cm-editor__row--groups").first().getByRole("checkbox").check();
  expect(await page.evaluate(() => integrationCounts.map(({ listeners }) => listeners))).toEqual([3, 0]);
  await editor(page).evaluate((node) => { window.detachedEditor = node; node.remove(); });
  expect(await page.evaluate(() => ({ listeners: integrationCounts[0].listeners, highlight: chart.highlight(), preview: integrationCounts[0].previewClears })))
    .toEqual({ listeners: 0, highlight: [], preview: 1 });
  await page.evaluate(() => document.body.append(detachedEditor));
  expect(await page.evaluate(() => integrationCounts.map(({ listeners }) => listeners))).toEqual([3, 0]);
  await editor(page).evaluate((node) => { node.chart = secondChart; });
  expect(await page.evaluate(() => ({ listeners: integrationCounts.map(({ listeners }) => listeners), oldHighlight: chart.highlight() })))
    .toEqual({ listeners: [0, 3], oldHighlight: [] });
  const uid = await annotation(page);
  await expect(matrixRows(page)).toHaveCount(5);
  await editor(page).evaluate((node) => { node.chart = null; });
  expect(await page.evaluate(() => integrationCounts.map(({ listeners }) => listeners))).toEqual([0, 0]);
  await expect(matrixRows(page)).toHaveCount(0);
  const panelPicker = editor(page).getByRole("combobox", { name: "Annotation panel", exact: true });
  await expect(panelPicker).toBeHidden();
  await editor(page).evaluate((node) => { node.chart = secondChart; });
  await expect(panelPicker).toHaveValue(uid);
  await expect(matrixRows(page)).toHaveCount(5);
  await editor(page).evaluate((node) => { node.chart = null; });
  await view(page, "groups");
  await expect(editor(page).locator("clinker-record-table")).toContainText("Set the chart property");
});

test("demo mounts the editor and routes annotation requests explicitly", async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `import "${url}/node_modules/d3/dist/d3.min.js"; export const select=window.d3.select; export const json=(path)=>fetch(path).then(response=>response.json());`,
  }));
  await page.goto(`${url}/demo/index.html?fixture=heatmap&renderer=svg&test=1&editor=1`);
  await expect(editor(page)).toBeVisible();
  await expect(editor(page).locator(".cm-editor__row--groups").first()).toBeVisible();
  expect(await editor(page).evaluate((node) => node.chart === window.__demoChart)).toBe(true);
  await page.locator("#btn-editor").click();
  await expect(editor(page)).toBeHidden();
  const uid = await page.evaluate(() => {
    const panelUid = __demoChart.data().annotationPanels.find((panel) => panel.type === "heatmap").uid;
    const event = new CustomEvent("clustermap:edit-annotation", { bubbles: true, cancelable: true,
      detail: { chart: __demoChart, panelUid } });
    if (document.querySelector("#plot").dispatchEvent(event)) throw new Error("Annotation request was not handled");
    return panelUid;
  });
  await expect(editor(page)).toBeVisible();
  await expect(editor(page).getByRole("combobox", { name: "Annotation panel", exact: true })).toHaveValue(uid);
  await expect(page.locator("#btn-editor")).toHaveAttribute("aria-expanded", "true");
});
