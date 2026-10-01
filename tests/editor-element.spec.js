import { test, expect } from "@playwright/test";

test("the packaged editor mounts against the demo chart", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");

  await expect(page.locator("clinker-editor.cm-editor")).toBeVisible();
  await expect(page.locator("clinker-editor [data-summary]")).toContainText("visible groups");
  await page.getByRole("button", { name: "Genes", exact: true }).click();
  await expect(page.locator("clinker-editor [data-summary]")).toContainText("genes");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await expect(page.locator("clinker-editor [data-appearance] fieldset")).toHaveCount(7);
});

test("the editor keeps pane-specific controls out of the other data panes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");

  const editor = page.locator("clinker-editor");
  await expect(editor.locator("[data-gene-view]")).toBeHidden();
  await expect(editor.locator("[data-actions]")).toBeHidden();
  await expect(editor.locator('[data-command="new-group"]')).toBeVisible();

  await page.getByRole("button", { name: "Genes", exact: true }).click();
  await expect(editor.locator("[data-gene-view]")).toBeVisible();
  await expect(editor.locator("[data-head]")).toBeHidden();
  await expect(editor.locator('[data-command="new-group"]')).toBeHidden();

  await page.getByRole("button", { name: "Links", exact: true }).click();
  await expect(editor.locator("[data-gene-view]")).toBeHidden();
  await expect(editor.locator("[data-head]")).toBeVisible();
  await expect(editor.locator('[data-command="new-group"]')).toBeHidden();
});

test("group colour inputs reflect the rendered group palette", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect(page.locator('clinker-editor [data-colour][data-type="groups"]').first()).not.toHaveValue("#888888");
});

test("tree parents select their visible descendant genes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await page.getByRole("button", { name: "Genes", exact: true }).click();
  await page.locator("clinker-editor [data-select-many]").first().check();
  await expect(page.locator("clinker-editor [data-actions]")).toContainText("3 genes selected");
});

test("select all includes descendants of collapsed tree branches", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const editor = page.locator("clinker-editor");
  await page.getByRole("button", { name: "Genes", exact: true }).click();
  await editor.getByRole("button", { name: "Collapse all" }).click();
  await editor.getByRole("button", { name: "Select all 9 visible genes" }).click();
  await expect(editor.locator("[data-actions]")).toContainText("9 genes selected");
});

test("tree-row pencils stay in flow and edit the intended cluster or locus", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await page.getByRole("button", { name: "Genes", exact: true }).click();
  const row = page.locator("clinker-editor .cm-editor__tree-parent").first();
  await row.hover();
  await expect(row.locator('[data-focus-edit="cluster:label"]')).toBeVisible();
  await expect(row.locator('[data-focus-edit="locus:label"]')).toBeVisible();

  await row.locator('[data-focus-edit="locus:label"]').click();
  await expect(row.locator('[data-edit="locus:label"]')).toBeFocused();
  await row.locator('[data-edit="locus:label"]').press("Escape");

  await row.hover();
  await row.locator('[data-focus-edit="cluster:label"]').click();
  await expect(row.locator('[data-edit="cluster:label"]')).toBeFocused();
});

test("tree label editing preserves the label's rendered footprint", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await page.getByRole("button", { name: "Genes", exact: true }).click();
  const row = page.locator("clinker-editor .cm-editor__tree-parent").first();
  await expect(row).toHaveCSS("display", "grid");
  const cluster = row.locator(".cm-editor__tree-combined > .cm-editor__editable-field").first();
  const width = await cluster.locator(".cm-editor__editable-label").evaluate((node) => node.getBoundingClientRect().width);
  await row.hover();
  await cluster.locator('[data-focus-edit="cluster:label"]').click();
  const inputWidth = await row.locator('[data-edit="cluster:label"]').evaluate((node) => node.getBoundingClientRect().width);
  expect(Math.abs(inputWidth - width)).toBeLessThanOrEqual(1);
});

test("hovering group and hierarchy rows highlights their genes in the plot", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const highlighted = () => page.locator("#plot polygon.geneHighlight").evaluateAll((nodes) =>
    nodes.filter((node) => getComputedStyle(node).display !== "none").length
  );

  await page.locator("clinker-editor .cm-editor__row--groups").first().hover();
  await expect.poll(highlighted).toBe(2);

  await page.getByRole("button", { name: "Genes", exact: true }).click();
  await page.locator("clinker-editor .cm-editor__tree-parent").first().hover();
  await expect.poll(highlighted).toBe(3);
});

test("rapid table hover is coalesced before updating the chart", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  await page.evaluate(() => {
    const chart = window.__demoChart;
    const highlight = chart.highlight;
    window.__highlightCalls = 0;
    chart.highlight = (...args) => {
      window.__highlightCalls += 1;
      return highlight(...args);
    };
  });
  const rows = page.locator("clinker-editor .cm-editor__row--groups");
  await rows.nth(0).dispatchEvent("pointerover");
  await rows.nth(1).dispatchEvent("pointerover");
  await expect.poll(() => page.evaluate(() => window.__highlightCalls)).toBe(1);
});

test("the packaged editor edits and reorders the live chart model", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");

  const firstGrip = page.locator("clinker-editor [data-reorder]").first();
  await firstGrip.focus();
  await firstGrip.press("ArrowDown");
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.map((group) => group.uid))).toEqual(["group2", "group1", "group3"]);

  await page.locator("clinker-editor .cm-editor__row--groups").first().hover();
  await page.locator('clinker-editor [data-focus-edit="group:subtitle"]').first().click();
  await page.locator('clinker-editor [data-edit="group:subtitle"]').first().fill("Conserved enzyme");
  await page.locator('clinker-editor [data-edit="group:subtitle"]').first().press("Enter");
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups[0].subtitle)).toBe("Conserved enzyme");
});

test("chart-owned history replays editor and application edits without replacing chart data", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const editor = page.locator("clinker-editor");
  await page.locator("clinker-editor .cm-editor__row--groups").first().hover();
  await page.locator('clinker-editor [data-focus-edit="group:subtitle"]').first().click();
  await page.locator('clinker-editor [data-edit="group:subtitle"]').first().fill("Temporary subtitle");
  await page.locator('clinker-editor [data-edit="group:subtitle"]').first().press("Enter");
  await editor.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups[0].subtitle)).toBeUndefined();
  await editor.getByRole("button", { name: "Redo" }).click();
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups[0].subtitle)).toBe("Temporary subtitle");

  await page.evaluate(() => window.__demoChart.patch([{
    type: "groups.update", ids: ["group1"], changes: { label: "Application edit" },
  }]));
  await expect(editor.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.evaluate(() => window.__demoChart.undo());
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups[0].label)).toBe("group 1");
});

test("chart history restores deleted records without a data replacement", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  await page.evaluate(() => window.__demoChart.patch([{ type: "links.delete", ids: ["link1"] }]));
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().links.length)).toBe(2);
  await page.evaluate(() => window.__demoChart.undo());
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().links.map((link) => link.uid))).toEqual(["link1", "link2", "link3"]);
});

test("chart history restores group membership and order after a merge", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  const before = await page.evaluate(() => window.__demoChart.data().groups.map((group) => ({ uid: group.uid, genes: [...group.genes] })));
  await page.evaluate(() => window.__demoChart.patch([{
    type: "groups.merge", targetId: "group1", sourceIds: ["group2"],
  }]));
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.length)).toBe(2);
  await page.evaluate(() => window.__demoChart.undo());
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.map((group) => ({ uid: group.uid, genes: [...group.genes] })))).toEqual(before);
});

test("chart history restores membership after creating a group from selected genes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  const before = await page.evaluate(() => window.__demoChart.data().groups.map((group) => ({ uid: group.uid, genes: [...group.genes] })));
  await page.evaluate(() => {
    const chart = window.__demoChart;
    chart.patch([{
      type: "groups.create",
      group: { uid: "temporary-group", label: "Temporary" },
      geneIds: [chart.data().groups[0].genes[0]],
    }]);
  });
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.length)).toBe(4);
  await page.evaluate(() => window.__demoChart.undo());
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.map((group) => ({ uid: group.uid, genes: [...group.genes] })))).toEqual(before);
});

test("list rows select by click, use pencil editing, and sort by their columns", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const editor = page.locator("clinker-editor");

  await page.getByRole("button", { name: "Genes", exact: true }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await editor.locator(".cm-editor__row--genes").first().click();
  await expect(editor.locator("[data-actions]")).toContainText("1 gene selected");
  await editor.locator('[data-focus-edit="gene:label"]').first().click();
  await editor.locator('[data-edit="gene:label"]').fill("Renamed gene");
  await editor.locator('[data-edit="gene:label"]').press("Enter");
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().clusters.some((cluster) => cluster.loci.some((locus) => locus.genes.some((gene) => gene.label === "Renamed gene"))))).toBe(true);

  await page.getByRole("button", { name: /Sort by Gene/ }).click();
  const genes = await editor.locator(".cm-editor__row--genes .cm-editor__editable-label").allTextContents();
  expect(genes).toEqual([...genes].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));

  await page.getByRole("button", { name: "Links", exact: true }).click();
  await page.getByRole("button", { name: /Sort by Source/ }).click();
  const sources = await editor.locator(".cm-editor__row--links .cm-editor__context").evaluateAll((nodes) => nodes.filter((_, index) => index % 3 === 0).map((node) => node.textContent));
  expect(sources).toEqual([...sources].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
});

test("the packaged editor exposes live link presentation controls", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");

  await page.getByRole("button", { name: "Links", exact: true }).click();
  await expect(page.locator("clinker-editor [data-head]")).toContainText("Endpoint groups");
  await page.locator("clinker-editor [data-edit=\"link:identity\"]").first().fill("75");
  await page.locator("clinker-editor [data-edit=\"link:identity\"]").first().press("Enter");
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().links[0].identity)).toBe(.75);

  await page.locator("clinker-editor [data-visible]").first().click();
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().links[0].hidden)).toBe(true);
});

test("a chart assigned before connection stays synchronized", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await expect(page.locator("clinker-editor")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => Boolean(customElements.get("clinker-editor") && window.__demoChart))).toBe(true);
  await page.evaluate(() => {
    const editor = document.createElement("clinker-editor");
    editor.chart = window.__demoChart;
    editor.id = "preconnected-editor";
    document.body.append(editor);
  });
  await expect(page.locator("#preconnected-editor [data-summary]")).toContainText("visible groups");
  await page.evaluate(() => window.__demoChart.patch([{ type: "groups.create", group: { uid: "late-group", label: "Late group" } }]));
  await expect(page.locator("#preconnected-editor [data-summary]")).toContainText("4 visible groups");
});

test("the editor creates groups and moves a selected gene in one batch", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  page.once("dialog", (dialog) => dialog.accept("New family"));
  await page.getByRole("button", { name: "Create group…" }).click();
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.at(-1).label)).toBe("New family");

  await page.getByRole("button", { name: "Genes", exact: true }).click();
  await page.locator("clinker-editor [data-select]").first().check();
  await page.locator("clinker-editor [data-assign-group]").selectOption("group-4");
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.at(-1).genes.length)).toBe(1);
});

test("group selection restores merge, member and focus workflows", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const editor = page.locator("clinker-editor");

  await editor.locator('[data-select]').nth(0).check();
  await editor.locator('[data-select]').nth(1).check();
  await expect(editor.locator('[data-command="merge"]')).toBeVisible();
  await editor.locator('[data-merge-target]').selectOption("group1");
  await editor.getByRole("button", { name: "Merge groups" }).click();
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups.map((group) => group.uid))).toEqual(["group1", "group3"]);
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups[0].genes.length)).toBe(4);

  await editor.locator('[data-select]').first().check();
  await editor.getByRole("button", { name: "View member genes" }).click();
  await expect(editor.locator('[data-member-filter]')).toContainText("group 1");
  await expect(editor.locator('[data-summary]')).toContainText("in selected group");

  await editor.locator('[data-select]').first().check();
  await editor.getByRole("button", { name: "Focus in plot" }).click();
  await expect.poll(() => page.evaluate(() => window.__demoChart.state().camera.k)).toBeGreaterThan(1);
});

test("appearance changes are applied through the attached chart", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const editor = page.locator("clinker-editor");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page.locator('clinker-editor [data-config="legend.show"]').uncheck();
  await expect.poll(() => page.evaluate(() => window.__demoChart.config().legend.show)).toBe(false);
  await expect(page.locator('clinker-editor [data-config="gene.shape.stroke"]')).toHaveAttribute("type", "color");
  await editor.locator('[data-appearance-filter]').fill("minimap");
  await expect(editor.locator('[data-appearance] fieldset')).toHaveCount(1);
  await expect(editor.locator('[data-appearance]')).toContainText("Show minimap");
});

test("appearance updates made outside the editor stay synchronized", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const editor = page.locator("clinker-editor");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page.evaluate(() => window.__demoChart.config({ legend: { show: false } }));
  await expect(editor.locator('[data-config="legend.show"]')).not.toBeChecked();
});

test("configuration history preserves callback options", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  const preserved = await page.evaluate(() => {
    const callback = () => {};
    window.__demoChart.config({ gene: { shape: { onClick: callback } } });
    window.__demoChart.config({ legend: { show: false } });
    window.__demoChart.undo();
    return window.__demoChart.config().gene.shape.onClick === callback && window.__demoChart.config().legend.show;
  });
  expect(preserved).toBe(true);
});

test("projects stay serializable when configuration contains callbacks", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  const project = await page.evaluate(() => {
    window.__demoChart.config({ gene: { shape: { onClick: () => {} } } });
    return window.__demoChart.project();
  });
  expect(JSON.stringify(project)).toContain('"clinker-project"');
  expect(project.config.gene.shape).not.toHaveProperty("onClick");
});

test("Escape clears batch locus selection only after interacting with its plot", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  await page.evaluate(() => {
    const chart = window.__demoChart;
    chart.locusSelection([chart.data().clusters[0].loci[0].uid]);
    document.querySelector("#workspace").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.__demoChart.locusSelection())).toEqual([]);
});

test("chart history retains only its most recent 100 changes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  const result = await page.evaluate(() => {
    const chart = window.__demoChart;
    for (let value = 1; value <= 105; value += 1) chart.config({ legend: { marginLeft: value } });
    for (let index = 0; index < 100; index += 1) chart.undo();
    return { value: chart.config().legend.marginLeft, canUndo: chart.canUndo(), canRedo: chart.canRedo() };
  });
  expect(result).toEqual({ value: 5, canUndo: false, canRedo: true });
});

test("chart projects round-trip data, appearance, and layout", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);
  const project = await page.evaluate(() => window.__demoChart.project());
  await page.evaluate(() => window.__demoChart.patch([{ type: "groups.update", ids: ["group1"], changes: { label: "Changed" } }]));
  await page.evaluate((snapshot) => window.__demoChart.project(snapshot), project);
  await expect.poll(() => page.evaluate(() => window.__demoChart.data().groups[0].label)).toBe("group 1");
});

test("appearance keeps common controls separate from Advanced settings", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=component");
  const editor = page.locator("clinker-editor");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();

  const legend = editor.locator('[data-appearance] fieldset').filter({ has: page.getByText("Legend", { exact: true }) });
  await expect(legend.getByText("Show legend", { exact: true })).toBeVisible();
  await expect(legend.getByText("Advanced", { exact: true })).toBeVisible();
  await expect(legend.locator("details")).not.toHaveAttribute("open", "");
  await legend.getByText("Advanced", { exact: true }).click();
  await expect(legend.locator("details")).toHaveAttribute("open", "");

  await editor.locator('[data-appearance-filter]').fill("stroke width");
  await expect(editor.locator('[data-appearance] details[open]')).toHaveCount(2);
});
