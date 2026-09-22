// @ts-check
import { test, expect } from "@playwright/test";
import { captureCheckpoint, waitForPaint } from "./helpers/report.js";

async function readLocusState(locus) {
  return locus.evaluate((node) => {
    const datum = d3.select(node).datum();
    const locusText = node
      .closest("g.cluster")
      .querySelector("text.locusText").textContent;
    return {
      flipped: locusText.includes("(reversed)"),
      length: datum.end - datum.start,
      genes: datum.genes.map((gene) => gene.uid),
    };
  });
}

async function readTranslateX(locator) {
  return locator.evaluate((node) => {
    const transform = node.transform.baseVal.consolidate();
    return transform ? transform.matrix.e : 0;
  });
}

async function readTranslateY(locator) {
  return locator.evaluate((node) => {
    const transform = node.transform.baseVal.consolidate();
    return transform ? transform.matrix.f : 0;
  });
}

async function readLinkPaths(page) {
  return page
    .locator("path.geneLink")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
}

async function readGeneDisplays(locus) {
  return locus.locator("g.genes > g.gene").evaluateAll((nodes) =>
    Object.fromEntries(nodes.map((node) => [node.id, node.getAttribute("display")]))
  );
}

async function getLocusText(page, locus) {
  const clusterInfoId = await locus.evaluate(
    (node) => node.closest("g.cluster").querySelector("g.clusterInfo").id
  );
  return page.locator(`#${clusterInfoId} text.locusText`);
}

test("double-clicking a locus reverses its gene layout", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  await expect(locus).toBeVisible();
  const before = await captureCheckpoint(page, testInfo, "before-flip", () =>
    readLocusState(locus)
  );

  // The listener is on g.locus. A visible child receives the pointer event,
  // then bubbles it to that group.
  await locus.dblclick({ position: { x: 20, y: 11 } });

  await expect
    .poll(async () => {
      const state = await readLocusState(locus);
      return { flipped: state.flipped, genes: state.genes };
    })
    .toEqual({
      flipped: !before.flipped,
      genes: [...before.genes].reverse(),
    });

  await captureCheckpoint(page, testInfo, "after-flip", () =>
    readLocusState(locus)
  );

  await expect
    .poll(() =>
      locus
        .locator("g.genes > g.gene")
        .evaluateAll((nodes) => nodes.map((node) => node.id))
    )
    .toEqual([...before.genes].reverse().map((uid) => `gene_${uid}`));
});

test("flipping a locus twice restores its link paths", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  await expect(locus).toBeVisible();
  await waitForPaint(page);

  const beforePaths = await readLinkPaths(page);
  await locus.dblclick({ position: { x: 20, y: 11 } });
  await waitForPaint(page);
  await locus.dblclick({ position: { x: 20, y: 11 } });
  await waitForPaint(page);

  await expect.poll(() => readLinkPaths(page)).toEqual(beforePaths);
});

test("dragging left end of locus trims it and hides gene", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  await expect(locus).toBeVisible();

  const clusterInfoId = await locus.evaluate(
    (node) => node.closest("g.cluster").querySelector("g.clusterInfo").id
  );
  const clusterInfo = page.locator(`#${clusterInfoId}`);
  const locusText = clusterInfo.locator("text.locusText");
  const before = await captureCheckpoint(page, testInfo, "before-trim", async () => ({
    locus: await readLocusState(locus),
    clusterInfoX: await readTranslateX(clusterInfo),
  }));
  const beforeClusterInfoX = before.clusterInfoX;
  await expect(locusText).toHaveText("input_locus:1-10000");

  const locusLeftHandle = page.locator("rect.leftHandle").first();
  const locusFirstGene = page.locator("g.gene").first();
  const locusSecondGene = page.locator("polygon.genePolygon").nth(0);
  await locusLeftHandle.dragTo(locusSecondGene);
  await waitForPaint(page);

  expect(await locusFirstGene.getAttribute('display')).toEqual('none');
  await expect(locusText).toHaveText("input_locus:2501-10000");

  await expect
    .poll(() => readTranslateX(clusterInfo))
    .toBeGreaterThan(beforeClusterInfoX);

  await captureCheckpoint(page, testInfo, "after-trim", async () => ({
    locus: await readLocusState(locus),
    clusterInfoX: await readTranslateX(clusterInfo),
  }));
});

test("dragging right handles trims loci and moves the legend", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const loci = page.locator("g.locus");
  const rightHandles = page.locator("rect.rightHandle");
  const legend = page.locator("g.legend");
  const locusLabels = page.locator("g.clusterInfo text.locusText");

  await expect(loci).toHaveCount(3);
  await expect(rightHandles).toHaveCount(3);
  await expect(legend).toBeVisible();
  const before = await captureCheckpoint(
    page,
    testInfo,
    "before-right-trim",
    () => readTranslateX(legend).then((legendX) => ({ legendX }))
  );
  const beforeLegendX = before.legendX;

  for (let index = 0; index < 2; index += 1) {
    const lastGene = loci
      .nth(index)
      .locator("g.genes > g.gene")
      .last()
      .locator("polygon.genePolygon");
    await rightHandles.nth(index).dragTo(lastGene);
  }

  await waitForPaint(page);

  await expect(locusLabels.nth(0)).toHaveText("input_locus:1-6500");
  await expect(locusLabels.nth(1)).toHaveText("NZ_CP042324.1:1-6500");
  await expect.poll(() => readTranslateX(legend)).toBeLessThan(beforeLegendX);

  await captureCheckpoint(
    page,
    testInfo,
    "after-right-trim",
    () => readTranslateX(legend).then((legendX) => ({ legendX }))
  );
});

test("flipping then trimming uses the flipped gene coordinates", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  const locusText = await getLocusText(page, locus);
  const rightHandle = locus.locator("rect.rightHandle");
  const displayedMiddleGene = locus.locator("#gene_1 polygon.genePolygon");
  await expect(locus).toBeVisible();

  await locus.dblclick({ position: { x: 20, y: 11 } });
  await waitForPaint(page);
  await expect(locusText).toHaveText("input_locus (reversed):10000-1");

  // After the flip, gene 1 ends at display coordinate 7500. Trimming at it
  // must hide the original leftmost gene (gene 0), not gene 3.
  await rightHandle.dragTo(displayedMiddleGene);
  await waitForPaint(page);

  await expect(locusText).toHaveText("input_locus (reversed):10000-2501");
  await expect.poll(() => readGeneDisplays(locus)).toEqual({
    gene_3: "inline",
    gene_1: "inline",
    gene_0: "none",
  });
  await captureCheckpoint(page, testInfo, "after-flip-then-trim", async () => ({
    locus: await readLocusState(locus),
    label: await locusText.textContent(),
    geneDisplays: await readGeneDisplays(locus),
  }));
});

test("trimming then flipping preserves the selected genes", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  const locusText = await getLocusText(page, locus);
  const rightHandle = locus.locator("rect.rightHandle");
  const originalMiddleGene = locus.locator("#gene_1 polygon.genePolygon");
  await expect(locus).toBeVisible();

  await rightHandle.dragTo(originalMiddleGene);
  await waitForPaint(page);
  await expect(locusText).toHaveText("input_locus:1-3500");
  await expect.poll(() => readGeneDisplays(locus)).toEqual({
    gene_0: "inline",
    gene_1: "inline",
    gene_3: "none",
  });

  await locus.dblclick({ position: { x: 20, y: 11 } });
  await waitForPaint(page);

  await expect(locusText).toHaveText("input_locus (reversed):3500-1");
  await expect.poll(() => readGeneDisplays(locus)).toEqual({
    gene_3: "none",
    gene_1: "inline",
    gene_0: "inline",
  });
  await captureCheckpoint(page, testInfo, "after-trim-then-flip", async () => ({
    locus: await readLocusState(locus),
    label: await locusText.textContent(),
    geneDisplays: await readGeneDisplays(locus),
  }));
});

test("dragging a cluster persists a snapped vertical order", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const clusters = page.locator("g.cluster");
  const first = clusters.nth(0);
  const second = clusters.nth(1);
  const third = clusters.nth(2);
  const firstInfo = first.locator("g.clusterInfo");
  const thirdInfo = third.locator("g.clusterInfo");
  await expect(clusters).toHaveCount(3);

  const before = await captureCheckpoint(page, testInfo, "before-cluster-reorder", async () => ({
    firstY: await readTranslateY(first),
    secondY: await readTranslateY(second),
    thirdY: await readTranslateY(third),
  }));

  await firstInfo.dragTo(thirdInfo);
  await waitForPaint(page);

  await expect.poll(() => readTranslateY(first)).toBeCloseTo(before.thirdY);
  await expect.poll(() => readTranslateY(second)).toBeCloseTo(before.firstY);
  await expect.poll(() => readTranslateY(third)).toBeCloseTo(before.secondY);
  await captureCheckpoint(page, testInfo, "after-cluster-reorder", async () => ({
    firstY: await readTranslateY(first),
    secondY: await readTranslateY(second),
    thirdY: await readTranslateY(third),
  }));
});

test("inserting an unlinked cluster hides links between separated clusters", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const clusters = page.locator("g.cluster");
  const secondInfo = clusters.nth(1).locator("g.clusterInfo");
  const thirdInfo = clusters.nth(2).locator("g.clusterInfo");
  await expect(clusters).toHaveCount(3);

  const beforePaths = await readLinkPaths(page);
  expect(beforePaths).toHaveLength(3);
  expect(beforePaths).toEqual(expect.not.arrayContaining([""]));
  await captureCheckpoint(page, testInfo, "before-separating-linked-clusters", () => ({
    linkPaths: beforePaths,
  }));

  // The unlinked third cluster becomes the middle row, so clusters one and
  // two are no longer adjacent and their links must not be rendered.
  await thirdInfo.dragTo(secondInfo);
  await waitForPaint(page);

  await expect.poll(() => readLinkPaths(page)).toEqual(beforePaths.map(() => ""));
  await captureCheckpoint(page, testInfo, "after-separating-linked-clusters", async () => ({
    linkPaths: await readLinkPaths(page),
  }));
});
