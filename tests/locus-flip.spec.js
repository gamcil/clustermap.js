// @ts-check
import { test, expect } from "@playwright/test";

async function readLocusState(locus) {
  return locus.evaluate((node) => {
    const datum = d3.select(node).datum();
    return {
      flipped: datum._flipped,
      length: datum.end - datum.start,
      genes: datum.genes.map((gene) => ({
        uid: gene.uid,
        start: gene._start,
        end: gene._end,
        strand: gene._strand,
      })),
    };
  });
}

async function waitForPaint(page) {
  // A zero-duration D3 transition still completes on a future animation frame.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
}

async function readTranslateX(locator) {
  return locator.evaluate((node) => {
    const transform = node.transform.baseVal.consolidate();
    return transform ? transform.matrix.e : 0;
  });
}

async function readLinkPaths(page) {
  return page
    .locator("path.geneLink")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
}

test("double-clicking a locus reverses its gene layout", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  await expect(locus).toBeVisible();
  await waitForPaint(page);

  const before = await readLocusState(locus);
  await testInfo.attach("before-flip.json", { body: Buffer.from(JSON.stringify(before, null, 2)), contentType: "application/json", });
  await testInfo.attach("before-flip.png", { body: await page.screenshot(), contentType: "image/png", });

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
      genes: [...before.genes].reverse().map((gene) => ({
        uid: gene.uid,
        start: before.length - gene.end,
        end: before.length - gene.start,
        strand: gene.strand === 1 ? -1 : 1,
      })),
    });

  await waitForPaint(page);
  const after = await readLocusState(locus);
  await testInfo.attach("after-flip.json", { body: Buffer.from(JSON.stringify(after, null, 2)), contentType: "application/json", });
  await testInfo.attach("after-flip.png", { body: await page.screenshot(), contentType: "image/png", });

  await expect
    .poll(() =>
      locus
        .locator("g.genes > g.gene")
        .evaluateAll((nodes) => nodes.map((node) => node.id))
    )
    .toEqual([...before.genes].reverse().map((gene) => `gene_${gene.uid}`));
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
  await waitForPaint(page);

  const before = await readLocusState(locus);
  const clusterInfoId = await locus.evaluate(
    (node) => node.closest("g.cluster").querySelector("g.clusterInfo").id
  );
  const clusterInfo = page.locator(`#${clusterInfoId}`);
  const locusText = clusterInfo.locator("text.locusText");
  const beforeClusterInfoX = await readTranslateX(clusterInfo);
  await expect(locusText).toHaveText("input_locus:1-10000");

  await testInfo.attach("before-trim.json", { body: Buffer.from( JSON.stringify({ locus: before, clusterInfoX: beforeClusterInfoX }, null, 2)), contentType: "application/json", });
  await testInfo.attach("before-trim.png", { body: await page.screenshot(), contentType: "image/png", });

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

  const after = await readLocusState(locus);
  const afterClusterInfoX = await readTranslateX(clusterInfo);
  await testInfo.attach("after-trim.json", { body: Buffer.from( JSON.stringify({ locus: after, clusterInfoX: afterClusterInfoX }, null, 2)), contentType: "application/json", });
  await testInfo.attach("after-trim.png", { body: await page.screenshot(), contentType: "image/png", });
});

test("dragging right handles trims loci and moves the legend", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const loci = page.locator("g.locus");
  const rightHandles = page.locator("rect.rightHandle");
  const legend = page.locator("g.legend");
  const locusLabels = page.locator("g.clusterInfo text.locusText");

  await expect(loci).toHaveCount(2);
  await expect(rightHandles).toHaveCount(2);
  await expect(legend).toBeVisible();
  await waitForPaint(page);

  const beforeLegendX = await readTranslateX(legend);
  await testInfo.attach("before-right-trim.json", { body: Buffer.from(JSON.stringify({ legendX: beforeLegendX }, null, 2)), contentType: "application/json", });
  await testInfo.attach("before-right-trim.png", { body: await page.screenshot(), contentType: "image/png", });

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

  const afterLegendX = await readTranslateX(legend);
  await testInfo.attach("after-right-trim.json", { body: Buffer.from(JSON.stringify({ legendX: afterLegendX }, null, 2)), contentType: "application/json", });
  await testInfo.attach("after-right-trim.png", { body: await page.screenshot(), contentType: "image/png", });
});
