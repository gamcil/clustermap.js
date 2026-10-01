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

async function readLinkOpacities(page) {
  return page
    .locator("g.geneLinkG")
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("opacity"))));
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

async function requireWebGpuCanvas(page) {
  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.getAttribute("data-webgpu")).not.toBe("initializing");
  const status = await canvas.getAttribute("data-webgpu");
  test.skip(status === "unavailable", "WebGPU adapter is unavailable in this browser");
  expect(status).toBe("active");
  return canvas;
}

async function canvasHasInkAt(canvas, point) {
  return canvas.evaluate((node, { x, y }) => {
    const bounds = node.getBoundingClientRect();
    const sampleX = Math.round(((x - bounds.left) / bounds.width) * node.width);
    const sampleY = Math.round(((y - bounds.top) / bounds.height) * node.height);
    const snapshot = document.createElement("canvas");
    snapshot.width = node.width;
    snapshot.height = node.height;
    const context = snapshot.getContext("2d");
    context.drawImage(node, 0, 0);
    const pixels = context.getImageData(sampleX - 2, sampleY - 2, 5, 5).data;
    for (let index = 0; index < pixels.length; index += 4) {
      const [red, green, blue, alpha] = pixels.slice(index, index + 4);
      if (alpha && red < 230 && green < 230 && blue < 230) return true;
    }
    return false;
  }, point);
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

test("a direct locus flip is one undoable state change", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0 } });
    window.__interactionHistoryChart = chart;
    d3.select(host).datum(data).call(chart);
  });

  const before = await page.evaluate(() => window.__interactionHistoryChart.state());
  const locus = page.locator("g.locus").first();
  await locus.dblclick({ position: { x: 20, y: 11 } });
  await expect.poll(() => page.evaluate(() => window.__interactionHistoryChart.canUndo())).toBe(true);

  await page.evaluate(() => window.__interactionHistoryChart.undo());
  await expect.poll(() => page.evaluate(() => window.__interactionHistoryChart.state())).toEqual(before);
});

test("a direct locus drag is one undoable state change", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0 } });
    window.__interactionHistoryChart = chart;
    d3.select(host).datum(data).call(chart);
  });

  const before = await page.evaluate(() => window.__interactionHistoryChart.state());
  const hover = page.locator("g.locus").first().locator("rect.hover");
  const box = await hover.boundingBox();
  if (!box) throw new Error("locus drag target is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__interactionHistoryChart.canUndo())).toBe(true);
  await page.evaluate(() => window.__interactionHistoryChart.undo());
  await expect.poll(() => page.evaluate(() => window.__interactionHistoryChart.state())).toEqual(before);
});

test("SVG locus text updates before its flip transition finishes", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  const locusText = await getLocusText(page, locus);
  await expect(locusText).toHaveText("input_locus:1-10000");

  await locus.dblclick({ position: { x: 20, y: 11 } });
  await expect(locusText).toHaveText("input_locus (reversed):10000-1", { timeout: 100 });
});

test("editing the SVG scale bar delegates through the chart action", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const label = page.locator("g.scaleBar text.barText");
  await expect(label).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("5000"));
  await label.click();
  await expect(label).toHaveText("5kb");
});

test("editing a legend label uses the default controller action", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const label = page.locator("g.legend g.element text").first();
  await expect(label).toHaveText("group 1");
  page.once("dialog", (dialog) => dialog.accept("renamed group"));
  await label.click();
  await expect(label).toHaveText("renamed group");
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

test("dragging a selected cluster moves its selected cluster block", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0 } });
    window.__selectedClusterDragChart = chart;
    d3.select(host).datum(data).call(chart);
    chart.locusSelection(chart.data().clusters.slice(0, 2).map((cluster) => cluster.loci[0].uid));
  });

  const before = await page.evaluate(() => window.__selectedClusterDragChart.data().clusters.map((cluster) => cluster.uid));
  const clusters = page.locator("g.cluster");
  const [firstInfo, secondInfo, thirdInfo] = [
    clusters.nth(0).locator("g.clusterInfo"),
    clusters.nth(1).locator("g.clusterInfo"),
    clusters.nth(2).locator("g.clusterInfo"),
  ];
  const [firstY, secondY, secondBox, thirdBox] = await Promise.all([
    readTranslateY(clusters.nth(0)),
    readTranslateY(clusters.nth(1)),
    secondInfo.boundingBox(),
    thirdInfo.boundingBox(),
  ]);
  if (!secondBox || !thirdBox) throw new Error("cluster drag targets are not visible");
  const point = { x: secondBox.x + secondBox.width / 2, y: secondBox.y + secondBox.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + 12);
  await expect.poll(() => readTranslateY(clusters.nth(0))).toBeGreaterThan(firstY + 1);
  await expect.poll(() => readTranslateY(clusters.nth(1))).toBeGreaterThan(secondY + 1);
  await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__selectedClusterDragChart.state().clusterOrder)).toEqual([
    before[2],
    before[0],
    before[1],
  ]);
});

test("dragging a cluster follows the pointer before it changes rows", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const clusters = page.locator("g.cluster");
  const first = clusters.nth(0);
  const firstInfo = first.locator("g.clusterInfo");
  const secondInfo = clusters.nth(1).locator("g.clusterInfo");
  const [firstBox, secondBox] = await Promise.all([
    firstInfo.boundingBox(),
    secondInfo.boundingBox(),
  ]);
  if (!firstBox || !secondBox) throw new Error("cluster drag targets are not visible");

  const beforeY = await readTranslateY(first);
  const pointerX = firstBox.x + firstBox.width / 2;
  const pointerY = firstBox.y + firstBox.height / 2;
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX, pointerY + (secondBox.y - firstBox.y) / 4);

  await expect
    .poll(async () => {
      const y = await readTranslateY(first);
      return y > beforeY + 1 && y < beforeY + (secondBox.y - firstBox.y) / 2;
    })
    .toBe(true);
  await page.mouse.up();
});

test("cluster drag previews link adjacency", async ({ page }, testInfo) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const clusters = page.locator("g.cluster");
  await expect(clusters).toHaveCount(3);
  const firstInfo = clusters.nth(0).locator("g.clusterInfo");
  const secondInfo = clusters.nth(1).locator("g.clusterInfo");
  const thirdInfo = clusters.nth(2).locator("g.clusterInfo");
  const [firstBox, secondBox, thirdBox] = await Promise.all([
    firstInfo.boundingBox(),
    secondInfo.boundingBox(),
    thirdInfo.boundingBox(),
  ]);
  if (!firstBox || !secondBox || !thirdBox) {
    throw new Error("cluster drag targets are not visible");
  }

  await expect.poll(() => readLinkOpacities(page)).toEqual([1, 1, 1]);
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, {
    steps: 10,
  });

  await expect.poll(() => readLinkOpacities(page)).toEqual([0, 0, 0]);
  await captureCheckpoint(page, testInfo, "cluster-separated", () => readLinkOpacities(page));

  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, {
    steps: 10,
  });
  await expect.poll(() => readLinkOpacities(page)).toEqual([1, 1, 1]);
  await captureCheckpoint(page, testInfo, "clusters-adjacent", () => readLinkOpacities(page));
  await page.mouse.up();
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
  const startX = start.x + start.width / 2;
  const endX = end.x + end.width / 2;
  const dragY = end.y + end.height / 2;
  await page.mouse.move(startX + (endX - startX) / 3, dragY);
  const firstPreviewX = await readTranslateX(locus);
  await page.mouse.move(startX + (2 * (endX - startX)) / 3, dragY);
  const secondPreviewX = await readTranslateX(locus);
  expect(Math.sign(firstPreviewX - before.locusX)).toBe(Math.sign(endX - startX));
  expect(Math.abs(secondPreviewX - before.locusX)).toBeGreaterThan(
    Math.abs(firstPreviewX - before.locusX) + 1
  );
  await page.mouse.move(endX, dragY, { steps: 4 });
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

test("trimming a moved locus uses its world-space gene boundary", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const locus = page.locator("g.locus").first();
  const hover = locus.locator("rect.hover");
  const moveTarget = locus.locator('[id$="gene_1"] polygon.genePolygon');
  await expect(locus).toBeVisible();

  // Move first so the trim boundary no longer coincides with local x=0.
  await hover.dragTo(moveTarget);
  await waitForPaint(page);

  const handle = locus.locator("rect.rightHandle");
  const geneThree = locus.locator('[id$="gene_3"] polygon.genePolygon');
  const handleBounds = await handle.boundingBox();
  const targetBounds = await geneThree.boundingBox();
  if (!handleBounds || !targetBounds) throw new Error("trim targets are not visible");

  await page.mouse.move(
    handleBounds.x + handleBounds.width / 2,
    handleBounds.y + handleBounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBounds.x + targetBounds.width,
    targetBounds.y + targetBounds.height / 2
  );
  await page.mouse.up();
  await waitForPaint(page);

  await expect(await getLocusText(page, locus)).toHaveText("input_locus:1-6500");
});

test("clicking a gene aligns its matching genes across clusters", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ ClusterMap }, data] = await Promise.all([
      import("/dist/clustermap.mjs"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    // Make the second member of group 1 visibly offset from the anchor.
    Object.assign(data.clusters[1].loci[0].genes[0], { start: 2500, end: 3500 });
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    d3.select(host).datum(data).call(ClusterMap().config({ plot: { transitionDuration: 0 } }));
  });

  const anchor = page.locator('[id$="gene_0"] polygon.genePolygon');
  const match = page.locator('[id$="gene_1001"] polygon.genePolygon');
  const before = await match.boundingBox();
  await anchor.click();

  await expect
    .poll(async () => {
      const [anchorBox, matchBox] = await Promise.all([anchor.boundingBox(), match.boundingBox()]);
      if (!anchorBox || !matchBox) return Infinity;
      return Math.abs(
        (anchorBox.x + anchorBox.width / 2) -
        (matchBox.x + matchBox.width / 2)
      );
    })
    .toBeLessThan(1);
  const after = await match.boundingBox();
  expect(after?.x).not.toBe(before?.x);
});

test("anchoring from the gene menu flips a mismatched locus before alignment", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    data.clusters[0].loci[0].genes[0].strand = 1;
    data.clusters[1].loci[0].genes[0].strand = -1;
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    d3.select(host).datum(data).call(clusterMap().config({ plot: { transitionDuration: 0 } }));
  });

  const anchor = page.locator('[id$="gene_0"] polygon.genePolygon');
  const match = page.locator('[id$="gene_1001"] polygon.genePolygon');
  await anchor.click({ button: "right" });
  await page.locator("div.tooltip button", { hasText: "Anchor map on gene" }).click();

  await expect(page.locator("g.cluster").nth(1).locator("text.locusText")).toContainText("(reversed)");
  await expect
    .poll(async () => {
      const [anchorBox, matchBox] = await Promise.all([anchor.boundingBox(), match.boundingBox()]);
      if (!anchorBox || !matchBox) return Infinity;
      return Math.abs(
        (anchorBox.x + anchorBox.width / 2) -
        (matchBox.x + matchBox.width / 2)
      );
    })
    .toBeLessThan(1);
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

test("switching renderer preserves the camera through the first Canvas gesture", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");

  const svg = page.locator("svg.clusterMap");
  const viewport = svg.locator("g.clusterMapViewport");
  await svg.hover();
  await page.mouse.wheel(0, -400);
  await waitForPaint(page);
  const beforeSwitch = await readCamera(viewport);
  expect(beforeSwitch.k).toBeGreaterThan(1);

  // The editor changes this same live configuration path.
  await page.evaluate(() => {
    window.__demoChart.config({ plot: { renderer: "canvas" } });
  });
  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  const synced = await canvas.evaluate((node) => {
    const { x, y, k } = node.__zoom;
    return { x, y, k };
  });
  expect(synced.k).toBeCloseTo(beforeSwitch.k, 4);
  expect(synced.x).toBeCloseTo(beforeSwitch.x, 3);
  expect(synced.y).toBeCloseTo(beforeSwitch.y, 3);

  await canvas.hover();
  await page.mouse.wheel(0, -100);
  await waitForPaint(page);
  const afterGesture = await canvas.evaluate((node) => {
    const { x, y, k } = node.__zoom;
    return { x, y, k };
  });
  // A fresh identity transform would leave this near 1.15 instead of
  // continuing from the already zoomed SVG camera.
  expect(afterGesture.k).toBeGreaterThan(beforeSwitch.k);
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
      import("/dist/clustermap.mjs"),
      fetch("/testing.json"),
    ]);
    const data = await response.json();
    const chart = module.ClusterMap().config({
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

test("canvas renderer paints the projected chart scene", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&renderer=canvas");

  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator("svg.clusterMap")).toBeHidden();
  const painted = await canvas.evaluate((node) => {
    const context = node.getContext("2d");
    const { width, height } = node;
    const pixels = context.getImageData(0, 0, width, height).data;
    return Array.from(pixels).some((value, index) => index % 4 === 3 && value !== 0);
  });
  expect(painted).toBe(true);
});

test("canvas renderer forwards locus double-clicks to the shared controller", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0 } });
    window.__canvasInteractionTest = { chart, data, host };
    d3.select(host).datum(data).call(chart);
  });

  const track = page.locator("g.locus").first().locator("line.trackBar");
  const trackBox = await track.boundingBox();
  expect(trackBox).not.toBeNull();

  await page.evaluate(() => {
    const { chart, data, host } = window.__canvasInteractionTest;
    chart.config({ plot: { renderer: "canvas" } });
    d3.select(host).datum(data).call(chart);
    chart.clearHistory();
    window.__canvasInteractionTest.beforeFlip = chart.state();
  });
  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();

  const hoverPoint = { x: trackBox.x + trackBox.width / 2, y: trackBox.y - 5 };
  const readPixel = (point) =>
    canvas.evaluate((node, { x, y }) => {
      const bounds = node.getBoundingClientRect();
      const pixelX = Math.round(((x - bounds.left) / bounds.width) * node.width);
      const pixelY = Math.round(((y - bounds.top) / bounds.height) * node.height);
      return [...node.getContext("2d").getImageData(pixelX, pixelY, 1, 1).data];
    }, point);
  const beforeHover = await readPixel(hoverPoint);
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await expect(canvas).toHaveCSS("cursor", "move");
  await expect.poll(() => readPixel(hoverPoint)).not.toEqual(beforeHover);

  await page.mouse.dblclick(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height / 2);

  const exported = await page.evaluate(() => window.__canvasInteractionTest.chart.exportSvg());
  expect(exported).toContain("input_locus (reversed):10000-1");
  expect(exported).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(exported).toContain('class="legend"');
  expect(exported).not.toContain('class="hover');
  expect(exported).not.toContain("visibility: hidden");
  await expect.poll(() => page.evaluate(() => window.__canvasInteractionTest.chart.canUndo())).toBe(true);
  await page.evaluate(() => window.__canvasInteractionTest.chart.undo());
  await expect
    .poll(() => page.evaluate(() => window.__canvasInteractionTest.chart.state()))
    .toEqual(await page.evaluate(() => window.__canvasInteractionTest.beforeFlip));
  await page.evaluate(() => window.__canvasInteractionTest.chart.redo());

  await page.evaluate(() => {
    const { chart, data, host } = window.__canvasInteractionTest;
    chart.config({ plot: { renderer: "svg" } });
    d3.select(host).datum(data).call(chart);
  });
  await expect(page.locator("g.clusterInfo text.locusText").first()).toContainText("(reversed)");
});

test("WebGPU renderer forwards locus interactions through its Canvas overlay", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const supported = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!supported, "WebGPU is unavailable in this browser");

  const track = page.locator("g.locus").first().locator("line.trackBar");
  const gene = page.locator("g.gene").first().locator("polygon.genePolygon");
  const [trackBox, geneBox] = await Promise.all([track.boundingBox(), gene.boundingBox()]);
  expect(trackBox).not.toBeNull();
  expect(geneBox).not.toBeNull();

  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({
      plot: { renderer: "webgpu", transitionDuration: 0 },
    });
    window.__webgpuInteractionTest = { chart, data, host };
    d3.select(host).datum(data).call(chart);
  });

  const canvas = await requireWebGpuCanvas(page);
  await expect(page.locator("canvas.clusterMapWebGpuOverlay")).toBeVisible();

  const point = { x: trackBox.x + trackBox.width / 2, y: trackBox.y - 5 };
  await page.mouse.move(point.x, point.y);
  await expect(canvas).toHaveCSS("cursor", "move");
  await page.mouse.click(geneBox.x + geneBox.width / 2, geneBox.y + geneBox.height / 2, {
    button: "right",
  });
  await expect(page.locator("div.tooltip #gene-label-input")).toBeVisible();
  await page.mouse.dblclick(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height / 2);

  await expect.poll(() => page.evaluate(() => window.__webgpuInteractionTest.chart.exportSvg())).toContain(
    "input_locus (reversed):10000-1"
  );
});

test("WebGPU respects line and straight link appearance", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "WebGPU pixel assertions run in Chromium");
  await page.goto("http://127.0.0.1:8080/?test=1");
  const supported = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!supported, "WebGPU is unavailable in this browser");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({
      plot: { renderer: "webgpu", transitionDuration: 0 },
      link: { asLine: false, straight: false },
    });
    window.__webgpuLinkAppearanceChart = chart;
    d3.select(host).datum(data).call(chart);
  });

  const canvas = await requireWebGpuCanvas(page);
  const imageHash = async () => {
    let hash = 0;
    for (const byte of await canvas.screenshot()) hash = (hash * 31 + byte) >>> 0;
    return hash;
  };
  const curvedRibbon = await imageHash();
  await page.evaluate(() => window.__webgpuLinkAppearanceChart.config({ link: { straight: true } }));
  await expect.poll(imageHash).not.toEqual(curvedRibbon);
  const straightRibbon = await imageHash();
  await page.evaluate(() => window.__webgpuLinkAppearanceChart.config({
    link: { asLine: true, straight: false },
  }));
  await expect.poll(imageHash).not.toEqual(straightRibbon);
  const curvedLine = await imageHash();
  await page.evaluate(() => window.__webgpuLinkAppearanceChart.config({ link: { straight: true } }));
  await expect.poll(imageHash).not.toEqual(curvedLine);
  const straightLine = await imageHash();
  await page.evaluate(() => window.__webgpuLinkAppearanceChart.config({ link: { strokeWidth: 5 } }));
  await expect.poll(imageHash).not.toEqual(straightLine);
});

test("WebGPU aligns a matching gene without leaving the retained scene", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const supported = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!supported, "WebGPU is unavailable in this browser");

  const anchor = page.locator('[id$="gene_0"] polygon.genePolygon');
  const anchorBox = await anchor.boundingBox();
  expect(anchorBox).not.toBeNull();
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    Object.assign(data.clusters[1].loci[0].genes[0], { start: 2500, end: 3500 });
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { renderer: "webgpu", transitionDuration: 0 } });
    window.__webgpuAnchorTest = { chart };
    d3.select(host).datum(data).call(chart);
  });

  const canvas = await requireWebGpuCanvas(page);
  const before = (await canvas.screenshot()).toString("base64");
  await page.mouse.click(
    anchorBox.x + anchorBox.width / 2,
    anchorBox.y + anchorBox.height / 2
  );
  await expect.poll(async () => (await canvas.screenshot()).toString("base64")).not.toEqual(before);

  await expect
    .poll(() => page.evaluate(() => {
      const svg = new DOMParser().parseFromString(
        window.__webgpuAnchorTest.chart.exportSvg(),
        "image/svg+xml"
      );
      const centreX = (uid) => {
        const gene = svg.querySelector(`[id$="gene_${uid}"]`);
        const locus = gene?.closest("g.locus");
        const offset = Number(/translate\(([^, ]+)/.exec(locus?.getAttribute("transform") || "")?.[1] || 0);
        const points = (gene?.querySelector("polygon")?.getAttribute("points") || "")
          .trim()
          .split(/\s+/)
          .map((point) => Number(point.split(",")[0]));
        return offset + (Math.min(...points) + Math.max(...points)) / 2;
      };
      return Math.abs(centreX("0") - centreX("1001"));
    }))
    .toBeLessThan(1);
});

test("WebGPU previews a locus drag before it is committed", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const supported = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!supported, "WebGPU is unavailable in this browser");

  const track = page.locator("g.locus").first().locator("line.trackBar");
  const trackBox = await track.boundingBox();
  expect(trackBox).not.toBeNull();
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({
      plot: { renderer: "webgpu", transitionDuration: 0 },
    });
    d3.select(host).datum(data).call(chart);
  });

  const canvas = await requireWebGpuCanvas(page);
  const before = (await canvas.screenshot()).toString("base64");
  const point = { x: trackBox.x + trackBox.width / 2, y: trackBox.y - 5 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 60, point.y, { steps: 4 });
  await expect.poll(async () => (await canvas.screenshot()).toString("base64")).not.toEqual(before);
  await page.mouse.up();
});

test("WebGPU commits an animated locus flip", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const supported = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!supported, "WebGPU is unavailable in this browser");

  const track = page.locator("g.locus").first().locator("line.trackBar");
  const trackBox = await track.boundingBox();
  expect(trackBox).not.toBeNull();
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({
      plot: { renderer: "webgpu", transitionDuration: 180 },
    });
    window.__webgpuFlipTest = { chart };
    d3.select(host).datum(data).call(chart);
  });

  await requireWebGpuCanvas(page);
  await page.mouse.dblclick(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height / 2);
  await expect.poll(() => page.evaluate(() => window.__webgpuFlipTest.chart.exportSvg())).toContain(
    "input_locus (reversed):10000-1"
  );
});

test("WebGPU previews cluster row movement before it is committed", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const supported = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!supported, "WebGPU is unavailable in this browser");

  const clusterInfo = page.locator("g.clusterInfo").first();
  const clusterBox = await clusterInfo.boundingBox();
  expect(clusterBox).not.toBeNull();
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({
      plot: { renderer: "webgpu", transitionDuration: 0 },
    });
    d3.select(host).datum(data).call(chart);
  });

  const canvas = await requireWebGpuCanvas(page);
  const before = (await canvas.screenshot()).toString("base64");
  const point = {
    x: clusterBox.x + clusterBox.width / 2,
    y: clusterBox.y + clusterBox.height / 2,
  };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + 30, { steps: 4 });
  await expect.poll(async () => (await canvas.screenshot()).toString("base64")).not.toEqual(before);
  await page.mouse.up();
});

test("WebGPU cluster preview hides links for separated clusters", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const supported = await page.evaluate(() => Boolean(navigator.gpu));
  test.skip(!supported, "WebGPU is unavailable in this browser");

  const clusters = page.locator("g.cluster");
  const link = page.locator("path.geneLink").first();
  const [firstBox, secondBox, thirdBox, linkBox] = await Promise.all([
    clusters.nth(0).locator("g.clusterInfo").boundingBox(),
    clusters.nth(1).locator("g.clusterInfo").boundingBox(),
    clusters.nth(2).locator("g.clusterInfo").boundingBox(),
    link.boundingBox(),
  ]);
  if (!firstBox || !secondBox || !thirdBox || !linkBox) {
    throw new Error("cluster drag targets or link ribbon are not visible");
  }
  const linkPoint = { x: linkBox.x + linkBox.width / 2, y: linkBox.y + linkBox.height / 2 };

  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    d3.select(host).datum(data).call(clusterMap().config({
      plot: { renderer: "webgpu", transitionDuration: 0 },
    }));
  });

  const canvas = await requireWebGpuCanvas(page);
  await expect.poll(() => canvasHasInkAt(canvas, linkPoint)).toBe(true);
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, {
    steps: 10,
  });
  await expect.poll(() => canvasHasInkAt(canvas, linkPoint)).toBe(false);
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, {
    steps: 10,
  });
  await expect.poll(() => canvasHasInkAt(canvas, linkPoint)).toBe(true);
  await page.mouse.up();
});

test("canvas renderer opens the shared gene menu at the pointer", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0 } });
    window.__canvasMenuTest = { chart, data, host };
    d3.select(host).datum(data).call(chart);
  });
  const gene = page.locator("g.gene").first().locator("polygon.genePolygon");
  const geneBox = await gene.boundingBox();
  expect(geneBox).not.toBeNull();

  await page.evaluate(() => {
    const { chart, data, host } = window.__canvasMenuTest;
    chart.config({ plot: { renderer: "canvas" } });
    d3.select(host).datum(data).call(chart);
  });
  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  await page.mouse.click(geneBox.x + geneBox.width / 2, geneBox.y + geneBox.height / 2, {
    button: "right",
  });

  const menu = page.locator("div.tooltip");
  await expect(menu.locator("#gene-label-input")).toBeVisible();
  await expect(menu).toHaveCSS("opacity", "1");
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox.x).toBeGreaterThan(geneBox.x - menuBox.width / 2 - 2);
});

test("Space-drag pans Canvas even when it starts over a locus", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const track = page.locator("g.locus").first().locator("line.trackBar");
  const trackBox = await track.boundingBox();
  expect(trackBox).not.toBeNull();

  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0, renderer: "canvas" } });
    d3.select(host).datum(data).call(chart);
  });

  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  const hash = () =>
    canvas.evaluate((node) => {
      const { data, width, height } = node.getContext("2d").getImageData(0, 0, node.width, node.height);
      let value = 0;
      for (let index = 0; index < data.length; index += Math.max(1, Math.floor(data.length / 10000))) {
        value = (value * 31 + data[index]) >>> 0;
      }
      return { value, width, height };
  });

  const before = await hash();
  await page.mouse.move(trackBox.x + 20, trackBox.y + 5);
  await page.keyboard.down("Space");
  await page.mouse.move(trackBox.x + 20, trackBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(trackBox.x + 80, trackBox.y + 45);
  await page.mouse.up();
  await page.keyboard.up("Space");

  await expect.poll(hash).not.toEqual(before);
});

test("Canvas previews a locus drag before its state is committed", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const track = page.locator("g.locus").first().locator("line.trackBar");
  const trackBox = await track.boundingBox();
  expect(trackBox).not.toBeNull();

  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0, renderer: "canvas" } });
    d3.select(host).datum(data).call(chart);
  });

  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  const hash = () =>
    canvas.evaluate((node) => {
      const { data } = node.getContext("2d").getImageData(0, 0, node.width, node.height);
      let value = 0;
      for (let index = 0; index < data.length; index += Math.max(1, Math.floor(data.length / 10000))) {
        value = (value * 31 + data[index]) >>> 0;
      }
      return value;
    });

  const before = await hash();
  await page.mouse.move(trackBox.x + trackBox.width / 2, trackBox.y - 5);
  await page.mouse.down();
  await page.mouse.move(trackBox.x + trackBox.width / 2 + 60, trackBox.y - 5);
  await expect.poll(hash).not.toEqual(before);
  await page.mouse.up();
});

test("Canvas previews a trimmed locus track before its state is committed", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0 } });
    window.__canvasTrimTest = { chart, data, host };
    d3.select(host).datum(data).call(chart);
  });
  const track = page.locator("g.locus").first().locator("line.trackBar");
  const handle = page.locator("rect.rightHandle").first();
  const gene = page.locator("g.locus").first().locator('[id$="gene_3"] polygon.genePolygon');
  const [trackBox, handleBox, geneBox] = await Promise.all([
    track.boundingBox(),
    handle.boundingBox(),
    gene.boundingBox(),
  ]);
  if (!trackBox || !handleBox || !geneBox) throw new Error("trim preview targets are not visible");

  await page.evaluate(() => {
    const { chart, data, host } = window.__canvasTrimTest;
    chart.config({ plot: { renderer: "canvas" } });
    d3.select(host).datum(data).call(chart);
  });

  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  const sample = {
    x: (geneBox.x + geneBox.width + trackBox.x + trackBox.width) / 2,
    y: trackBox.y + trackBox.height / 2,
  };
  const darkest = () =>
    canvas.evaluate((node, point) => {
      const bounds = node.getBoundingClientRect();
      const ratioX = node.width / bounds.width;
      const ratioY = node.height / bounds.height;
      const x = Math.round((point.x - bounds.left) * ratioX);
      const y = Math.round((point.y - bounds.top) * ratioY);
      const pixels = node.getContext("2d").getImageData(x - 2, y - 2, 5, 5).data;
      let value = 255;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3]) value = Math.min(value, pixels[index], pixels[index + 1], pixels[index + 2]);
      }
      return value;
    }, sample);

  await expect.poll(darkest).toBeLessThan(80);
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(geneBox.x + geneBox.width - 1, handleBox.y + handleBox.height / 2, {
    steps: 8,
  });
  await expect.poll(darkest).toBeGreaterThan(180);
  expect(pageErrors).toEqual([]);
  await page.mouse.up();
});

test("Canvas previews a cluster drag before its order is committed", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const clusterInfo = page.locator("g.clusterInfo").first();
  const clusterBox = await clusterInfo.boundingBox();
  expect(clusterBox).not.toBeNull();

  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 0, renderer: "canvas" } });
    d3.select(host).datum(data).call(chart);
  });

  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  const hash = () =>
    canvas.evaluate((node) => {
      const { data } = node.getContext("2d").getImageData(0, 0, node.width, node.height);
      let value = 0;
      for (let index = 0; index < data.length; index += Math.max(1, Math.floor(data.length / 10000))) {
        value = (value * 31 + data[index]) >>> 0;
      }
      return value;
    });

  const before = await hash();
  const pointerX = clusterBox.x + clusterBox.width / 2;
  const pointerY = clusterBox.y + clusterBox.height / 2;
  await page.mouse.move(pointerX, pointerY);
  await page.mouse.down();
  await page.mouse.move(pointerX, pointerY + 12);
  await expect.poll(hash).not.toEqual(before);
  await page.mouse.up();
});

test("canvas renderer animates a locus flip between scene snapshots", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { transitionDuration: 200 } });
    window.__canvasAnimationTest = { chart, data, host };
    d3.select(host).datum(data).call(chart);
  });

  const track = page.locator("g.locus").first().locator("line.trackBar");
  const trackBox = await track.boundingBox();
  expect(trackBox).not.toBeNull();
  await page.evaluate(() => {
    const { chart, data, host } = window.__canvasAnimationTest;
    chart.config({ plot: { renderer: "canvas" } });
    d3.select(host).datum(data).call(chart);
  });
  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();

  const sample = () =>
    canvas.evaluate((node, box) => {
      const bounds = node.getBoundingClientRect();
      const ratioX = node.width / bounds.width;
      const ratioY = node.height / bounds.height;
      const x = Math.max(0, Math.round((box.x - bounds.left - 20) * ratioX));
      const y = Math.max(0, Math.round((box.y - bounds.top - 25) * ratioY));
      const width = Math.min(node.width - x, Math.round((box.width + 40) * ratioX));
      const height = Math.min(node.height - y, Math.round(60 * ratioY));
      return [...node.getContext("2d").getImageData(x, y, width, height).data];
    }, trackBox);
  const before = await sample();

  await page.mouse.dblclick(trackBox.x + trackBox.width / 2, trackBox.y + trackBox.height / 2);
  await page.waitForTimeout(60);
  const during = await sample();
  await page.waitForTimeout(250);
  const after = await sample();

  expect(during).not.toEqual(before);
  expect(during).not.toEqual(after);
  // The retained Canvas scene must be advanced at completion as well as the
  // temporary flip compositor; otherwise the next ordinary paint restores the
  // pre-flip orientation.
  expect(after).not.toEqual(before);
});

test.describe("Canvas motion resolution", () => {
  test.use({ deviceScaleFactor: 2 });

  test("reduces backing resolution only while navigating", async ({ page }) => {
    await page.goto("http://127.0.0.1:8080/?test=1&renderer=canvas");
    const canvas = page.locator("canvas.clusterMapCanvas");
    await expect(canvas).toBeVisible();
    const pixelRatio = () =>
      canvas.evaluate((node) => node.width / node.getBoundingClientRect().width);

    await expect.poll(pixelRatio).toBeGreaterThan(1.5);
    await canvas.hover();
    await page.mouse.wheel(0, -100);
    await expect.poll(pixelRatio).toBeLessThan(1.1);
    await expect.poll(pixelRatio).toBeGreaterThan(1.5);
  });
});

test("Canvas minimap constrains zoom-out and navigates the shared camera", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&renderer=canvas&minimap=1&minZoom=0.8");
  const canvas = page.locator("canvas.clusterMapCanvas");
  const minimap = page.locator("canvas.clusterMapMinimap");
  await expect(canvas).toBeVisible();
  await expect(minimap).toBeVisible();
  await expect.poll(() => minimap.evaluate((node) => node.width)).toBeGreaterThan(0);

  const readCamera = () =>
    canvas.evaluate((node) => {
      const { x, y, k } = node.__zoom;
      return { x, y, k };
    });
  const before = await readCamera();
  const minimapBox = await minimap.boundingBox();
  expect(minimapBox).not.toBeNull();
  await minimap.click({ position: { x: minimapBox.width * 0.8, y: minimapBox.height * 0.2 } });
  await expect.poll(readCamera).not.toEqual(before);

  await canvas.hover();
  await page.mouse.wheel(0, 4000);
  await expect.poll(() => readCamera().then((camera) => camera.k)).toBeGreaterThanOrEqual(0.8);
});

test("Canvas minimap stays clear of the bottom plot editor", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&renderer=canvas&minimap=1&editor=1");
  const minimap = page.locator("canvas.clusterMapMinimap");
  const editor = page.locator("#editor");
  await expect(minimap).toBeVisible();
  await expect(editor).toBeVisible();
  const [minimapBox, editorBox] = await Promise.all([minimap.boundingBox(), editor.boundingBox()]);
  expect(minimapBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(minimapBox.y + minimapBox.height).toBeLessThan(editorBox.y);
});

test("WebGPU minimap navigates the shared camera", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1&renderer=webgpu&minimap=1&minZoom=0.8");
  const canvas = page.locator("canvas.clusterMapCanvas");
  const minimap = page.locator("canvas.clusterMapMinimap");
  await expect(canvas).toBeVisible();
  await expect(minimap).toBeVisible();
  await expect.poll(() => minimap.evaluate((node) => node.width)).toBeGreaterThan(0);

  const readCamera = () =>
    canvas.evaluate((node) => {
      const { x, y, k } = node.__zoom;
      return { x, y, k };
    });
  const before = await readCamera();
  const minimapBox = await minimap.boundingBox();
  expect(minimapBox).not.toBeNull();
  await minimap.click({ position: { x: minimapBox.width * 0.8, y: minimapBox.height * 0.2 } });
  await expect.poll(readCamera).not.toEqual(before);

  await canvas.hover();
  await page.mouse.wheel(0, 4000);
  await expect.poll(() => readCamera().then((camera) => camera.k)).toBeGreaterThanOrEqual(0.8);
});
