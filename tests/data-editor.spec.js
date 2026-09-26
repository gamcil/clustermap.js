import { test, expect } from "@playwright/test";

test("the contextual group actions apply a batch update through the chart API", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");

  await expect(page.locator("#editor")).toBeVisible();
  await expect(page.locator("#editor-rows [data-row-select]")).toHaveCount(3);
  await expect(page.locator("#gene-view")).toBeHidden();
  await page.locator('[data-row-select="group:group1"]').check();
  await page.locator('[data-row-select="group:group2"]').check();
  await expect(page.locator("#selection-actions")).toBeVisible();
  await expect(page.locator("#selection-colour")).toHaveValue("#888888");
  await page.locator("#selection-colour").evaluate((node) => {
    node.value = "#123456";
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().groups.filter((group) => ["group1", "group2"].includes(group.uid)).map((group) => group.colour)
  )).toEqual(["#123456", "#123456"]);
  await expect(page.locator("#selection-undo")).toBeEnabled();
  await page.locator("#selection-undo").click();
  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().groups.filter((group) => ["group1", "group2"].includes(group.uid)).map((group) => group.colour)
  )).not.toEqual(["#123456", "#123456"]);
});

test("the editor shows each group's rendered palette colour", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart?.data()))).toBe(true);

  const expected = await page.evaluate(() => {
    const group = window.__demoChart?.data().groups.find((item) => item.uid === "group1");
    return window.d3.color(group?.colour).formatHex();
  });
  await expect(page.locator('[data-row-colour="group:group1"]')).toHaveValue(expected);
});

test("groups edit an optional legend label directly in the table", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  const group = page.locator('[data-row-key="group:group1"]');
  await group.locator('[data-row-rename-key^="group-subtitle:"]').dblclick();
  await group.locator("[data-row-rename]").fill("Reference proteins");
  await group.locator("[data-row-rename]").press("Enter");
  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().groups.find((group) => group.uid === "group1")?.subtitle
  )).toBe("Reference proteins");
  await expect(page.locator("text.legend-subtitle").filter({ hasText: "Reference proteins" })).toBeVisible();
});

test("the gene browser compacts single-locus clusters and selects their descendants", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();

  await expect(page.locator('[data-row-type="cluster-locus"]')).toHaveCount(3);
  await expect(page.locator('[data-row-type="cluster"]')).toHaveCount(0);
  await expect(page.locator('[data-row-type="locus"]')).toHaveCount(0);
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(0);
  await expect(page.locator("#editor-summary")).toHaveText("3 visible tree rows · 9 selectable genes.");
  await expect(page.locator("#select-all-visible")).toHaveText("Select all 9 visible genes");

  const firstCluster = page.locator('[data-row-type="cluster-locus"]').first();
  const compactGap = await firstCluster.locator(".combined-tree-label").evaluate((node) => {
    const cluster = node.querySelector('[data-row-rename-key^="cluster:"] .label-text').getBoundingClientRect();
    const separator = node.querySelector(".tree-name-separator").getBoundingClientRect();
    return separator.left - cluster.right;
  });
  expect(compactGap).toBeLessThanOrEqual(8);
  await firstCluster.locator('[data-row-select]').check();
  await expect(page.locator("#selection-summary")).toHaveText("3 genes selected");

  await firstCluster.locator('[data-tree-toggle]').click();
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(3);
});

test("the group gene tree organizes homology groups and their members", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="groups"]').click();

  await expect(page.locator('[data-row-type="gene-group"]')).toHaveCount(4);
  await expect(page.locator("#editor-summary")).toHaveText("4 visible tree rows · 9 selectable genes.");
  const group = page.locator('[data-row-key="gene-group:group1"]');
  await expect(group).toContainText("group 1");
  await group.locator('[data-row-select]').check();
  await expect(page.locator("#selection-summary")).toHaveText("2 genes selected");

  await group.locator('[data-tree-toggle]').click();
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(2);
});

test("gene trees can expand and collapse all visible branches", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="groups"]').click();
  await expect(page.locator("#tree-actions")).toBeVisible();
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(0);
  await expect(page.locator("#tree-toggle-all")).toHaveText("Expand visible");

  await page.locator("#tree-toggle-all").click();
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(9);
  await expect(page.locator("#tree-toggle-all")).toHaveText("Collapse all");
  await page.locator("#tree-toggle-all").click();
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(0);

  await page.locator('[data-gene-view="list"]').click();
  await expect(page.locator("#tree-actions")).toBeHidden();
});

test("a selected group opens an exact member filter in the gene list", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-row-select="group:group1"]').check();
  await expect(page.locator("#selection-view-members")).toBeVisible();

  await page.locator("#selection-view-members").click();
  await expect(page.locator('[data-data-kind="genes"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-gene-view="list"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#member-group-filter")).toBeVisible();
  await expect(page.locator("#member-group-filter")).toContainText("Group: group 1");
  await expect(page.locator("#editor-summary")).toHaveText("2 visible genes in selected group.");
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(2);
  await expect(page.locator(".list-group")).toHaveText(["group 1", "group 1"]);

  await page.locator("#member-group-filter-clear").click();
  await expect(page.locator("#member-group-filter")).toBeHidden();
  await expect(page.locator("#editor-summary")).toHaveText("9 visible genes.");
});

test("the group-member scope carries into the group gene tree", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-row-select="group:group1"]').check();
  await page.locator("#selection-view-members").click();
  await page.locator('[data-gene-view="groups"]').click();

  await expect(page.locator('[data-row-type="gene-group"]')).toHaveCount(1);
  await expect(page.locator('[data-row-key="gene-group:group1"]')).toContainText("2 genes");
});

test("plot context menus can reveal a gene or group in the data editor", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart?.data()))).toBe(true);

  const gene = page.locator("polygon.genePolygon").first();
  await gene.click({ button: "right" });
  // Context menus contain editable controls, so they stay available until the
  // user dismisses them instead of timing out while they are being read.
  await page.waitForTimeout(1100);
  await expect(page.getByRole("button", { name: "Reveal in data editor" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal in data editor" }).click();
  await expect(page.locator("#editor")).toBeVisible();
  await expect(page.locator('[data-data-kind="genes"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-row-type="gene"] [data-row-select]:checked')).toHaveCount(1);

  await page.locator("text.legend-label").first().click({ button: "right" });
  await page.getByRole("button", { name: "Reveal in data editor" }).click();
  await expect(page.locator('[data-data-kind="groups"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-row-type="group"] [data-row-select]:checked')).toHaveCount(1);
});

test("double-clicking names renames every editable row type in place", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();

  const rename = async (rowType, name) => {
    const row = page.locator(`[data-row-type="${rowType}"]`).first();
    await row.locator(".row-label").dblclick();
    const input = row.locator("[data-row-rename]");
    await expect(input).toBeFocused();
    await input.fill(name);
    await input.press("Enter");
  };

  const compact = page.locator('[data-row-type="cluster-locus"]').first();
  await compact.locator('[data-row-rename-key^="cluster:"]').dblclick();
  await compact.locator("[data-row-rename]").fill("Reference genome");
  await compact.locator("[data-row-rename]").press("Enter");
  await compact.locator('[data-row-rename-key^="locus:"]').dblclick();
  await compact.locator("[data-row-rename]").fill("Reference locus");
  await compact.locator("[data-row-rename]").press("Enter");
  await compact.locator("[data-tree-toggle]").click();
  await rename("gene", "Reference gene");
  await expect.poll(() => page.evaluate(() => {
    const data = window.__demoChart?.data();
    return [data?.clusters[0]?.name, data?.clusters[0]?.loci[0]?.name, data?.clusters[0]?.loci[0]?.genes[0]?.label];
  })).toEqual(["Reference genome", "Reference locus", "Reference gene"]);

  await page.locator('[data-data-kind="groups"]').click();
  await page.locator('[data-row-type="group"]').first().locator('[data-row-rename-key^="group:"]').dblclick();
  await page.locator('[data-row-rename]').fill("Reviewed group");
  await page.locator('[data-row-rename]').press("Enter");
  await expect.poll(() => page.evaluate(() => window.__demoChart?.data().groups[0]?.label)).toBe("Reviewed group");

  await page.locator('[data-data-kind="links"]').click();
  await page.locator('[data-row-type="link"]').first().locator(".row-label").dblclick();
  await page.locator('[data-row-rename]').fill("Reviewed link");
  await page.locator('[data-row-rename]').press("Enter");
  await expect.poll(() => page.evaluate(() => window.__demoChart?.data().links[0]?.label)).toBe("Reviewed link");
});

test("the flat gene list exposes sortable locus and cluster columns", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();

  const header = page.locator("#editor-list-header");
  await expect(header).toBeVisible();
  await expect(header.getByRole("button", { name: "Sort by Locus" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sort by Cluster" })).toBeVisible();
  await expect(page.locator(".editor-row.list-gene .list-locus").first()).not.toBeEmpty();
  await expect(page.locator(".editor-row.list-gene .list-cluster").first()).not.toBeEmpty();

  await header.getByRole("button", { name: "Sort by Cluster" }).click();
  const clusters = await page.locator(".editor-row.list-gene .list-cluster").allTextContents();
  expect(clusters).toEqual([...clusters].sort((left, right) => left.localeCompare(right)));

  await page.locator("#editor-filter").fill("GCF_003123456.1");
  await expect(page.locator("#editor-summary")).toContainText("3 visible genes");
  await expect(page.locator(".editor-row.list-gene .list-cluster")).toHaveText([
    "GCF_003123456.1",
    "GCF_003123456.1",
    "GCF_003123456.1",
  ]);
});

test("the data filter supports clearing", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  const filter = page.locator("#editor-filter");
  await filter.focus();
  await filter.fill("group 1");
  await expect(page.locator("#editor-filter-clear")).toBeVisible();
  await filter.press("Escape");
  await expect(filter).toHaveValue("");
  await expect(page.locator("#editor-filter-clear")).toBeHidden();
});

test("an empty filter result explains how to return to the data", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator("#editor-filter").fill("no such group");
  await expect(page.locator("#editor-empty-state")).toContainText('No groups match “no such group”.');
  await page.locator("#editor-empty-state [data-clear-filter]").click();
  await expect(page.locator("#editor-filter")).toHaveValue("");
  await expect(page.locator('[data-row-type="group"]')).toHaveCount(3);
});

test("group and link views expose sortable columns and select all visible records", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await expect(page.locator("#editor-list-header").getByRole("button", { name: "Sort by Genes" })).toBeVisible();
  await expect(page.locator("#editor-list-header").getByRole("button", { name: "Sort by Legend label" })).toBeVisible();
  await expect(page.locator("#editor-list-header").getByRole("button", { name: "Sort by Visible" })).toBeVisible();
  await page.locator("#select-all-visible").click();
  await expect(page.locator("#selection-summary")).toHaveText("3 groups selected");

  await page.locator('[data-data-kind="links"]').click();
  const header = page.locator("#editor-list-header");
  await expect(header.getByRole("button", { name: "Sort by Source" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sort by Target" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sort by Identity" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sort by Endpoint groups" })).toBeVisible();
});

test("Shift-click selects a contiguous range of visible rows", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  const first = page.locator('[data-row-select="group:group1"]');
  const last = page.locator('[data-row-select="group:group3"]');

  await first.check();
  await last.click({ modifiers: ["Shift"] });

  await expect(page.locator("#selection-summary")).toHaveText("3 groups selected");
  await expect(page.locator('[data-row-select="group:group2"]')).toBeChecked();
});

test("the focused data table supports select-all and clear-selection shortcuts", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  const table = page.locator("#editor-list-scroll");
  await table.focus();
  await page.keyboard.press("Control+A");
  await expect(page.locator("#selection-summary")).toHaveText("3 groups selected");

  await page.keyboard.press("Escape");
  await expect(page.locator("#selection-actions")).toBeHidden();
  await expect(page.locator('[data-row-select]:checked')).toHaveCount(0);
});

test("the editor moves genes between groups and creates a group from a selection", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();

  const firstGene = page.locator('[data-row-type="gene"]').first();
  const key = await firstGene.locator('[data-row-select]').getAttribute("data-row-select");
  const geneId = key.replace("gene:", "");
  await firstGene.locator('[data-row-select]').check();
  await expect(page.locator("#selection-group")).toHaveValue("");
  await expect(page.locator("#selection-assign")).toBeDisabled();
  await page.locator("#selection-group").selectOption({ label: "group 2" });
  await expect(page.locator("#selection-assign")).toBeEnabled();
  await page.locator("#selection-assign").click();

  await expect.poll(() => page.evaluate((uid) => {
    const groups = window.__demoChart?.data().groups || [];
    return groups.filter((group) => group.genes.includes(uid)).map((group) => group.label);
  }, geneId)).toEqual(["group 2"]);

  await page.locator("#selection-begin-create-group").click();
  await page.locator("#selection-new-group").fill("Hand-picked genes");
  await page.locator("#selection-create-group").click();
  await expect.poll(() => page.evaluate((uid) => {
    const groups = window.__demoChart?.data().groups || [];
    return groups.filter((group) => group.genes.includes(uid)).map((group) => group.label);
  }, geneId)).toEqual(["Hand-picked genes"]);
});

test("selection actions only show operations valid for the active data type", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");

  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();
  await page.locator('[data-row-type="gene"]').first().locator('[data-row-select]').check();
  await expect(page.locator("#selection-group-label")).toBeVisible();
  await expect(page.locator("#selection-begin-create-group")).toBeVisible();
  await expect(page.locator("#selection-new-group-label")).toBeHidden();
  await expect(page.locator("#selection-delete-genes")).toBeVisible();

  await page.locator('[data-data-kind="groups"]').click();
  await page.locator('[data-row-select="group:group1"]').check();
  await expect(page.locator("#selection-group-label")).toBeHidden();
  await expect(page.locator("#selection-begin-create-group")).toBeHidden();
  await expect(page.locator("#selection-delete-genes")).toBeHidden();
  await expect(page.locator("#selection-delete")).toBeVisible();

  await page.locator('[data-data-kind="links"]').click();
  await page.locator('[data-row-type="link"]').first().locator('[data-row-select]').check();
  await expect(page.locator("#selection-group-label")).toBeHidden();
  await expect(page.locator("#selection-new-group-label")).toBeHidden();
  await expect(page.locator("#selection-delete-links")).toBeVisible();
});

test("selecting genes in the editor highlights their plotted arrows", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();
  const firstGene = page.locator('[data-row-type="gene"]').first();
  const key = await firstGene.locator('[data-row-select]').getAttribute("data-row-select");
  const geneId = key.replace("gene:", "");
  await firstGene.locator('[data-row-select]').check();

  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon.geneHighlight")?.style.stroke || "";
  }, geneId)).toContain("rgb(22, 119, 255)");
  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon.geneHighlight")?.getAttribute("fill") || "";
  }, geneId)).toContain("22, 119, 255");
  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon.genePolygon")?.getAttribute("fill") || "";
  }, geneId)).not.toContain("22, 119, 255");
});

test("Focus in plot frames the selected records only when requested", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();
  const row = page.locator('[data-row-type="gene"]').last();
  await row.locator('[data-row-select]').check();
  const before = await page.locator("svg.clusterMap").evaluate((node) => ({ ...node.__zoom }));
  await page.locator("#selection-focus").click();
  await expect.poll(() => page.locator("svg.clusterMap").evaluate((node) => ({ ...node.__zoom }))).not.toEqual(before);

  // Hidden links remain in the editor so users can revise their metadata;
  // focusing one falls back to its endpoint genes rather than doing nothing.
  await page.evaluate(() => window.__demoChart?.config({ link: { threshold: 1 } }));
  await page.locator('[data-data-kind="links"]').click();
  await page.locator('[data-row-type="link"]').first().locator('[data-row-select]').check();
  const beforeHiddenLinkFocus = await page.locator("svg.clusterMap").evaluate((node) => ({ ...node.__zoom }));
  await page.locator("#selection-focus").click();
  await expect.poll(() => page.locator("svg.clusterMap").evaluate((node) => ({ ...node.__zoom }))).not.toEqual(beforeHiddenLinkFocus);
});

test("Focus in plot uses the active Canvas camera", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1&renderer=canvas");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();
  await page.locator('[data-row-type="gene"]').last().locator('[data-row-select]').check();
  const canvas = page.locator("canvas.clusterMapCanvas");
  const before = await canvas.evaluate((node) => ({ ...node.__zoom }));
  await page.locator("#selection-focus").click();
  await expect.poll(() => canvas.evaluate((node) => ({ ...node.__zoom }))).not.toEqual(before);
});

test("selecting a group highlights all of its member genes in the plot", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-row-select="group:group1"]').check();

  await expect.poll(() => page.evaluate(() => {
    const highlighted = new Set(window.__demoChart?.highlight());
    return ["0", "1001"].every((uid) => highlighted.has(uid));
  })).toBe(true);
});

test("selecting or hovering a link highlights it in the plot", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="links"]').click();
  const links = page.locator('[data-row-type="link"]');
  const first = links.nth(0);
  const second = links.nth(1);
  const linkId = (row) => row.locator('[data-row-select]').getAttribute("data-row-select").then((key) => key.replace("link:", ""));
  const stroke = (uid) => page.evaluate((id) => {
    const node = [...document.querySelectorAll("g.geneLinkG")].find((candidate) => candidate.__data__?.uid === id);
    return node?.querySelector("path.geneLinkHighlight")?.style.stroke || "";
  }, uid);

  const firstId = await linkId(first);
  const secondId = await linkId(second);
  await first.locator('[data-row-select]').check();
  await expect.poll(() => stroke(firstId)).toContain("rgb(22, 119, 255)");
  await expect.poll(() => page.evaluate((id) => {
    const node = [...document.querySelectorAll("g.geneLinkG")].find((candidate) => candidate.__data__?.uid === id);
    return node?.querySelector("path.geneLinkHighlight")?.style.fill || "";
  }, firstId)).toContain("22, 119, 255");

  await second.hover();
  await expect.poll(() => stroke(secondId)).toContain("rgb(22, 119, 255)");
  await page.locator("#editor-summary").hover();
  await expect.poll(() => stroke(firstId)).toContain("rgb(22, 119, 255)");
});

test("hovering a gene row temporarily highlights its plotted arrow", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();
  const firstGene = page.locator('[data-row-type="gene"]').first();
  const key = await firstGene.locator('[data-row-select]').getAttribute("data-row-select");
  const geneId = key.replace("gene:", "");
  await firstGene.hover();

  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon.geneHighlight")?.style.stroke || "";
  }, geneId)).toContain("rgb(22, 119, 255)");
  await page.locator("#editor-summary").hover();
  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon.geneHighlight")?.getAttribute("display") || "";
  }, geneId)).toBe("none");
});

test("deleting genes preserves link data while removing them from the plot", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();
  const firstGene = page.locator('[data-row-type="gene"]').first();
  const key = await firstGene.locator('[data-row-select]').getAttribute("data-row-select");
  const geneId = key.replace("gene:", "");
  const linkCount = await page.evaluate(() => window.__demoChart?.data().links.length);
  await firstGene.locator('[data-row-select]').check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#selection-delete-genes").click();
  await expect.poll(() => page.evaluate((uid) =>
    window.__demoChart?.data().clusters.flatMap((cluster) => cluster.loci).flatMap((locus) => locus.genes).some((gene) => gene.uid === uid)
  , geneId)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__demoChart?.data().links.length)).toBe(linkCount);
});

test("the link view edits and deletes links without changing genes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="links"]').click();
  const firstLink = page.locator('[data-row-type="link"]').first();
  const key = await firstLink.locator('[data-row-select]').getAttribute("data-row-select");
  const linkId = key.replace("link:", "");
  const geneCount = await page.evaluate(() => window.__demoChart?.data().clusters.flatMap((cluster) => cluster.loci).flatMap((locus) => locus.genes).length);
  await firstLink.locator('[data-row-select]').check();
  await firstLink.locator("[data-row-begin-identity]").click();
  await firstLink.locator("[data-row-identity]").fill("72.5");
  await firstLink.locator("[data-row-identity]").press("Tab");
  await expect.poll(() => page.evaluate((uid) =>
    window.__demoChart?.data().links.find((link) => link.uid === uid)?.identity
  , linkId)).toBe(0.725);
  await firstLink.locator(".row-label").dblclick();
  await firstLink.locator("[data-row-rename]").fill("Reviewed match");
  await firstLink.locator("[data-row-rename]").press("Enter");
  await expect.poll(() => page.evaluate((uid) =>
    window.__demoChart?.data().links.find((link) => link.uid === uid)?.label
  , linkId)).toBe("Reviewed match");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#selection-delete-links").click();
  await expect.poll(() => page.evaluate((uid) =>
    window.__demoChart?.data().links.some((link) => link.uid === uid)
  , linkId)).toBe(false);
  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().clusters.flatMap((cluster) => cluster.loci).flatMap((locus) => locus.genes).length
  )).toBe(geneCount);
});

test("visible selection controls share one fixed action-bar height", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="links"]').click();
  await page.locator('[data-row-type="link"]').first().locator('[data-row-select]').check();

  const heights = await page.locator("#selection-summary, #selection-clear, #selection-actions .action-group > :not([hidden])").evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().height)).filter(Boolean)
  );
  expect(new Set(heights)).toEqual(new Set([30]));
});

test("the identity colour domain controls link shading and bar endpoints", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.locator('[data-config="colourBar.domain.min"]').fill("30");
  await page.locator('[data-config="colourBar.domain.min"]').press("Enter");
  await expect.poll(() => page.evaluate(() => window.__demoChart?.config().colourBar.domain.min)).toBe(0.3);
  await expect(page.locator(".colourBar .startText")).toHaveText("30");
  await expect(page.locator(".colourBar .endText")).toHaveText("100");
  await page.locator('[data-config="colourBar.domain.minMode"]').selectOption("data");
  await expect(page.locator('[data-config="colourBar.domain.min"]')).toBeDisabled();
});

test("the editor deletes a selected group", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-row-select="group:group3"]').check();
  await page.locator("#selection-delete").click();
  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().groups.map((group) => group.uid)
  )).not.toContain("group3");
});

test("the groups view creates an empty named group without selecting genes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator("#group-begin-create").click();
  await page.locator("#new-group-name").fill("Notes for review");
  await page.locator("#new-group-create").click();
  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().groups.find((group) => group.label === "Notes for review")?.genes
  )).toEqual([]);
});

test("the bottom editor exposes live appearance controls", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");

  await expect(page.locator("#editor")).toHaveCSS("border-top-width", "1px");
  await page.getByRole("tab", { name: "Appearance" }).click();
  await expect(page.locator('[data-editor-panel="appearance"]')).toBeVisible();
  await page.locator('[data-config="link.show"]').uncheck();

  await expect.poll(() => page.evaluate(() => window.__demoChart?.config().link.show)).toBe(false);

  const geneAdvanced = page.locator("#appearance-controls fieldset").filter({ has: page.getByText("Genes", { exact: true }) }).locator("details");
  await expect(geneAdvanced).not.toHaveAttribute("open", "");
  await expect(page.locator('[data-config="gene.shape.bodyHeight"]')).toBeHidden();
  await geneAdvanced.locator("summary").click();
  await expect(page.locator('[data-config="gene.shape.bodyHeight"]')).toBeVisible();
});

test("the appearance finder reveals matching advanced settings", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.getByRole("tab", { name: "Appearance" }).click();
  const finder = page.locator("#appearance-filter");
  await finder.fill("body height");
  await expect(page.locator('[data-config="gene.shape.bodyHeight"]')).toBeVisible();
  await expect(page.locator('[data-config="link.show"]')).toBeHidden();
  await expect(page.locator("#appearance-filter-clear")).toBeVisible();
  await page.locator("#appearance-filter-clear").click();
  await expect(finder).toHaveValue("");
  await expect(page.locator('[data-config="link.show"]')).toBeVisible();
});

test("the bottom editor grows from its top resize handle", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  const initialHeight = await page.locator("#editor").evaluate((node) => node.getBoundingClientRect().height);
  const handle = page.locator("#editor-resize-handle");
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 100);
  await page.mouse.up();

  await expect.poll(() => page.locator("#editor").evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(initialHeight + 80);
});

test("opening the floating editor does not resize the plot workspace", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const before = await page.locator("#workspace").evaluate((node) => {
    const { width, height } = node.getBoundingClientRect();
    return { width, height };
  });

  await page.locator("#btn-editor").click();
  await expect(page.locator("#editor")).toBeVisible();
  await expect.poll(() => page.locator("#workspace").evaluate((node) => {
    const { width, height } = node.getBoundingClientRect();
    return { width, height };
  })).toEqual(before);
});

test("chart.patch emits one normalized change event", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await expect.poll(() => page.evaluate(() => Boolean(window.__demoChart))).toBe(true);

  const event = await page.evaluate(() => {
    const events = [];
    const stop = window.__demoChart.on("change", (change) => events.push({
      type: change.type,
      operations: change.operations,
    }));
    window.__demoChart.patch([{
      type: "groups.update",
      ids: ["group1"],
      changes: { label: "Renamed group" },
    }]);
    stop();
    return events[0];
  });

  expect(event).toEqual({
    type: "data.apply",
    operations: [{
      type: "groups.update",
      ids: ["group1"],
      changes: { label: "Renamed group" },
    }],
  });
});

test("the editor virtualizes every matching row instead of truncating the result", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?fixture=large&test=1&editor=1");
  await expect(page.locator("#editor-summary")).toContainText("10 visible groups");

  await page.locator('[data-data-kind="genes"]').click();
  await page.locator('[data-gene-view="list"]').click();
  await expect(page.locator("#editor-summary")).toContainText("10000 visible genes");
  expect(await page.locator("#editor-rows .editor-row").count()).toBeLessThan(100);
});
