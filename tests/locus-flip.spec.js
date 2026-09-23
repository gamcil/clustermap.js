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

async function readTrimPreview(locus) {
  return locus.evaluate((node) => {
    const hover = node.querySelector("rect.hover");
    const track = node.querySelector("line.trackBar");
    return {
      hoverX: Number(hover.getAttribute("x")),
      hoverWidth: Number(hover.getAttribute("width")),
      trackStart: Number(track.getAttribute("x1")),
      trackEnd: Number(track.getAttribute("x2")),
    };
  });
}

async function readCamera(locator) {
  return locator.evaluate((node) => {
    const transform = node.transform.baseVal.consolidate();
    const matrix = transform ? transform.matrix : null;
    return matrix ? { x: matrix.e, y: matrix.f, k: matrix.a } : { x: 0, y: 0, k: 1 };
  });
}

function camerasMatch(left, right) {
  return (
    Math.abs(left.x - right.x) < 1e-6 &&
    Math.abs(left.y - right.y) < 1e-6 &&
    Math.abs(left.k - right.k) < 1e-6
  );
}

async function readScreenBounds(locator) {
  return locator.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    })
  );
}

function boundsMatch(left, right) {
  return (
    left.length === right.length &&
    left.every((bounds, index) =>
      ["x", "y", "width", "height"].every(
        (property) => Math.abs(bounds[property] - right[index][property]) < 1e-6
      )
    )
  );
}

async function readLinkPaths(page) {
  return page
    .locator("path.geneLink")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
}

async function readGeneDisplays(locus) {
  return locus.locator("g.genes > g.gene").evaluateAll((nodes) =>
    Object.fromEntries(
      nodes.map((node) => [node.id.slice(node.id.lastIndexOf("gene_")), node.getAttribute("display")])
    )
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
        .evaluateAll((nodes) =>
          nodes.map((node) => node.id.slice(node.id.lastIndexOf("gene_")))
        )
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
  await page.goto("http://127.0.0.1:8080/");

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
  const initialPreview = await readTrimPreview(loci.first());

  const firstGeneThree = loci
    .first()
    .locator('[id$="gene_3"]')
    .locator("polygon.genePolygon");
  const firstHandleBounds = await rightHandles.first().boundingBox();
  const firstGeneBounds = await firstGeneThree.boundingBox();
  if (!firstHandleBounds || !firstGeneBounds) {
    throw new Error("right-trim preview targets are not visible");
  }
  await page.mouse.move(
    firstHandleBounds.x + firstHandleBounds.width / 2,
    firstHandleBounds.y + firstHandleBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    firstGeneBounds.x + firstGeneBounds.width - 1,
    firstGeneBounds.y + firstGeneBounds.height / 2,
    { steps: 10 }
  );
  // Keep the pointer down beyond the normal SVG transition duration.  This
  // catches a stale redraw transition overwriting the live preview.
  await page.waitForTimeout(300);
  await expect
    .poll(async () => {
      const preview = await readTrimPreview(loci.first());
      return (
        preview.trackEnd < initialPreview.trackEnd - 1 &&
        Math.abs(preview.trackStart - preview.hoverX) < 0.1 &&
        Math.abs(preview.trackEnd - (preview.hoverX + preview.hoverWidth)) < 0.1
      );
    })
    .toBe(true);
  await page.mouse.up();
  await expect
    .poll(async () => {
      const preview = await readTrimPreview(loci.first());
      return (
        Math.abs(preview.trackStart - preview.hoverX) < 0.1 &&
        Math.abs(preview.trackEnd - (preview.hoverX + preview.hoverWidth)) < 0.1
      );
    })
    .toBe(true);

  for (let index = 1; index < 2; index += 1) {
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
  const displayedMiddleGene = locus.locator('[id$="gene_1"] polygon.genePolygon');
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
  const originalMiddleGene = locus.locator('[id$="gene_1"] polygon.genePolygon');
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
  await expect(clusters).toHaveCount(3);
  const clusterIds = await clusters.evaluateAll((nodes) => nodes.map((node) => node.id));
  const [firstId, secondId, thirdId] = clusterIds;
  const first = page.locator(`#${firstId}`);
  const second = page.locator(`#${secondId}`);
  const third = page.locator(`#${thirdId}`);
  const firstInfo = first.locator("g.clusterInfo");
  const thirdInfo = third.locator("g.clusterInfo");
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

test("dragging a locus persists its horizontal position", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  const hover = locus.locator("rect.hover");
  const target = locus.locator('[id$="gene_1"] polygon.genePolygon');
  await expect(locus).toBeVisible();

  const before = await captureCheckpoint(page, testInfo, "before-locus-reposition", async () => ({
    locusX: await readTranslateX(locus),
  }));
  const beforePaths = await readLinkPaths(page);

  const start = await hover.boundingBox();
  const end = await target.boundingBox();
  if (!start || !end) throw new Error("locus drag targets are not visible");

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2);
  await expect.poll(() => readLinkPaths(page)).not.toEqual(beforePaths);
  await page.mouse.up();
  await waitForPaint(page);

  await expect
    .poll(async () => Math.abs((await readTranslateX(locus)) - before.locusX) > 1)
    .toBe(true);
  await captureCheckpoint(page, testInfo, "after-locus-reposition", async () => ({
    locusX: await readTranslateX(locus),
  }));
});

test("zoom state persists across a chart redraw", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const svg = page.locator("svg.clusterMap");
  const root = svg.locator("g.clusterMapViewport");
  const locus = page.locator("g.locus").first();
  const clusterNames = page.locator("g.clusterInfo > text.clusterText");
  await expect(locus).toBeVisible();
  const initial = await captureCheckpoint(page, testInfo, "initial-camera", () => readCamera(root));
  const initialLabelBounds = await readScreenBounds(clusterNames);

  // The first chart redraw must retain both the automatic fit-to-view transform
  // and the screen-space geometry of labels whose content did not change.
  await locus.dblclick({ position: { x: 20, y: 11 } });
  await waitForPaint(page);
  await expect.poll(async () => camerasMatch(await readCamera(root), initial)).toBe(true);
  await expect
    .poll(async () => boundsMatch(await readScreenBounds(clusterNames), initialLabelBounds))
    .toBe(true);

  await svg.hover();
  await page.mouse.wheel(0, -400);
  await waitForPaint(page);
  await expect.poll(() => readCamera(root).then((camera) => camera.k)).toBeGreaterThan(initial.k);
  const zoomed = await captureCheckpoint(page, testInfo, "after-zoom", () => readCamera(root));

  // Flipping causes a full chart redraw. The viewport transform must be
  // restored from camera state rather than reset by the SVG renderer.
  await locus.dblclick({ position: { x: 20, y: 11 } });
  await waitForPaint(page);
  await expect
    .poll(async () => camerasMatch(await readCamera(root), zoomed))
    .toBe(true);
});

test("separate chart instances keep SVG IDs and interactions isolated", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await expect(page.locator("svg.clusterMap")).toHaveCount(1);

  await page.evaluate(async () => {
    const host = document.createElement("div");
    host.style.cssText =
      "position: absolute; top: 0; left: 0; width: 320px; height: 240px;";
    document.body.append(host);

    const [module, response] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json"),
    ]);
    const data = await response.json();
    const chart = module.default().config({
      plot: { transitionDuration: 0 },
      link: { label: { show: true, background: true } },
    });
    d3.select(host).datum(data).call(chart);
  });

  const charts = page.locator("svg.clusterMap");
  await expect(charts).toHaveCount(2);
  await expect(charts.nth(1).locator("g.locus").first()).toBeVisible();

  const ids = await charts.evaluateAll((nodes) =>
    nodes.map((svg) => ({
      root: svg.id,
      filter: svg.querySelector("filter").id,
      cluster: svg.querySelector("g.cluster").id,
      clusterInfo: svg.querySelector("g.clusterInfo").id,
      locus: svg.querySelector("g.locus").id,
      gene: svg.querySelector("g.gene").id,
      linkLabelFilter: svg.querySelector("text.geneLinkLabel").getAttribute("filter"),
    }))
  );
  for (const key of Object.keys(ids[0])) {
    expect(ids[0][key]).not.toBe(ids[1][key]);
  }
  for (const chartIds of ids) {
    expect(chartIds.linkLabelFilter).toBe(`url(#${chartIds.filter})`);
  }

  const firstLocus = charts.nth(0).locator("g.locus").first();
  const secondLocus = charts.nth(1).locator("g.locus").first();
  const secondBefore = await readLocusState(secondLocus);

  await firstLocus.dblclick({ position: { x: 20, y: 11 } });
  await waitForPaint(page);

  await expect
    .poll(() => readLocusState(firstLocus).then((state) => state.flipped))
    .toBe(true);
  await expect.poll(() => readLocusState(secondLocus)).toEqual(secondBefore);
});
