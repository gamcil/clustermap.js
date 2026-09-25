import { test, expect } from "@playwright/test";

test("the contextual group actions apply a batch update through the chart API", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");

  await expect(page.locator("#editor")).toBeVisible();
  await expect(page.locator("#editor-rows [data-row-select]")).toHaveCount(3);
  await expect(page.locator("#gene-view")).toBeHidden();
  await page.locator('[data-row-select="group:group1"]').check();
  await expect(page.locator("#selection-actions")).toBeVisible();
  await expect(page.locator("#selection-colour")).toHaveValue("#6e40aa");
  await page.locator("#selection-colour").evaluate((node) => {
    node.value = "#123456";
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().groups.find((group) => group.uid === "group1")?.colour
  )).toBe("#123456");
  await expect(page.locator("#selection-undo")).toBeEnabled();
  await page.locator("#selection-undo").click();
  await expect.poll(() => page.evaluate(() =>
    window.__demoChart?.data().groups.find((group) => group.uid === "group1")?.colour
  )).not.toBe("#123456");
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

test("the gene browser offers a collapsible hierarchy and selects locus descendants", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();

  await expect(page.locator('[data-row-type="cluster"]')).toHaveCount(3);
  await expect(page.locator('[data-row-type="locus"]')).toHaveCount(3);
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(9);

  const firstLocus = page.locator('[data-row-type="locus"]').first();
  await firstLocus.locator('[data-row-select]').check();
  await expect(page.locator("#selection-summary")).toHaveText("3 genes selected");

  await firstLocus.locator('[data-tree-toggle]').click();
  await expect(page.locator('[data-row-type="gene"]')).toHaveCount(6);
});

test("the editor moves genes between groups and creates a group from a selection", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();

  const firstGene = page.locator('[data-row-type="gene"]').first();
  const key = await firstGene.locator('[data-row-select]').getAttribute("data-row-select");
  const geneId = key.replace("gene:", "");
  await firstGene.locator('[data-row-select]').check();
  await page.locator("#selection-group").selectOption({ label: "group 2" });
  await page.locator("#selection-assign").click();

  await expect.poll(() => page.evaluate((uid) => {
    const groups = window.__demoChart?.data().groups || [];
    return groups.filter((group) => group.genes.includes(uid)).map((group) => group.label);
  }, geneId)).toEqual(["group 2"]);

  await page.locator("#selection-new-group").fill("Hand-picked genes");
  await page.locator("#selection-create-group").click();
  await expect.poll(() => page.evaluate((uid) => {
    const groups = window.__demoChart?.data().groups || [];
    return groups.filter((group) => group.genes.includes(uid)).map((group) => group.label);
  }, geneId)).toEqual(["Hand-picked genes"]);
});

test("selecting genes in the editor highlights their plotted arrows", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  const firstGene = page.locator('[data-row-type="gene"]').first();
  const key = await firstGene.locator('[data-row-select]').getAttribute("data-row-select");
  const geneId = key.replace("gene:", "");
  await firstGene.locator('[data-row-select]').check();

  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon")?.style.stroke || "";
  }, geneId)).toContain("rgb(22, 119, 255)");
});

test("hovering a gene row temporarily highlights its plotted arrow", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
  const firstGene = page.locator('[data-row-type="gene"]').first();
  const key = await firstGene.locator('[data-row-select]').getAttribute("data-row-select");
  const geneId = key.replace("gene:", "");
  await firstGene.hover();

  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon")?.style.stroke || "";
  }, geneId)).toContain("rgb(22, 119, 255)");
  await page.locator("#editor-summary").hover();
  await expect.poll(() => page.evaluate((uid) => {
    const node = [...document.querySelectorAll("g.gene")].find((candidate) => candidate.__data__?.uid === uid);
    return node?.querySelector("polygon")?.style.stroke || "";
  }, geneId)).not.toContain("22, 119, 255");
});

test("deleting genes preserves link data while removing them from the plot", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&editor=1");
  await page.locator('[data-data-kind="genes"]').click();
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
  await page.locator("#selection-identity").fill("72.5");
  await page.locator("#selection-set-identity").click();
  await expect.poll(() => page.evaluate((uid) =>
    window.__demoChart?.data().links.find((link) => link.uid === uid)?.identity
  , linkId)).toBe(0.725);
  await page.locator("#selection-label").fill("Reviewed match");
  await page.locator("#selection-rename").click();
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
