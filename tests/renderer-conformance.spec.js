// @ts-check
import { test, expect } from "@playwright/test";
import { waitForPaint } from "./helpers/report.js";

const renderers = ["svg", "canvas", "webgpu"];

async function requireWebGpuCanvas(page) {
  const canvas = page.locator("canvas.clusterMapCanvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.getAttribute("data-webgpu")).not.toBe("initializing");
  const status = await canvas.getAttribute("data-webgpu");
  test.skip(status === "unavailable", "WebGPU adapter is unavailable in this browser");
  expect(status).toBe("active");
}

// Raster backends do not retain SVG elements for hit testing. Capture the
// shared initial geometry from SVG, then remount exactly the same data with
// the backend under test. This makes the pointer interactions exercise the
// renderer-independent controller rather than renderer DOM details.
async function mountRenderer(page, renderer) {
  await page.goto("http://127.0.0.1:8080/?test=1");
  if (renderer === "webgpu") {
    test.skip(!(await page.evaluate(() => Boolean(navigator.gpu))), "WebGPU is unavailable");
  }

  const firstLocus = page.locator("g.locus").first();
  const [track, rightHandle, lastGene, firstInfo, thirdInfo] = await Promise.all([
    firstLocus.locator("line.trackBar").boundingBox(),
    firstLocus.locator("rect.rightHandle").boundingBox(),
    firstLocus.locator('[id$="gene_3"] polygon.genePolygon').boundingBox(),
    page.locator("g.cluster").nth(0).locator("g.clusterInfo").boundingBox(),
    page.locator("g.cluster").nth(2).locator("g.clusterInfo").boundingBox(),
  ]);
  if (!track || !rightHandle || !lastGene || !firstInfo || !thirdInfo) {
    throw new Error("initial SVG targets are not visible");
  }

  await page.evaluate(async (selectedRenderer) => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({
      plot: { renderer: selectedRenderer, transitionDuration: 0 },
    });
    window.__rendererConformance = { chart };
    d3.select(host).datum(data).call(chart);
  }, renderer);

  if (renderer === "svg") {
    await expect(page.locator("svg.clusterMap")).toBeVisible();
  } else if (renderer === "webgpu") {
    await requireWebGpuCanvas(page);
  } else {
    await expect(page.locator("canvas.clusterMapCanvas")).toBeVisible();
  }
  await waitForPaint(page);
  return { track, rightHandle, lastGene, firstInfo, thirdInfo };
}

async function exportedSvg(page) {
  return page.evaluate(() => window.__rendererConformance.chart.exportSvg());
}

async function rightTrimHandlePoint(page, renderer, handle) {
  const expected = {
    x: handle.x + handle.width / 2,
    y: handle.y + handle.height / 2,
  };
  if (renderer === "svg") return expected;

  const canvas = page.locator("canvas.clusterMapCanvas");
  // Canvas and WebGPU receive pointer events through the raster surface. Its
  // camera may be fitted a few pixels differently from the staging SVG used
  // to obtain target coordinates, so ask the shared hit-testing path where
  // the handle actually is.
  for (let offset = -80; offset <= 80; offset += 2) {
    await page.mouse.move(expected.x + offset, expected.y);
    if ((await canvas.evaluate((node) => getComputedStyle(node).cursor)) === "ew-resize") {
      return { x: expected.x + offset, y: expected.y, offset };
    }
  }
  throw new Error("right trim handle did not resolve through the raster hit region");
}

async function rasterClusterLabelPoint(page, label) {
  return page.evaluate((clusterLabel) => {
    const numberList = (value) =>
      (value || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    const svg = new DOMParser().parseFromString(
      window.__rendererConformance.chart.exportSvg(),
      "image/svg+xml"
    );
    const cluster = [...svg.querySelectorAll("g.cluster")].find(
      (node) => node.querySelector("text.clusterText")?.textContent === clusterLabel
    );
    const info = cluster?.querySelector("g.clusterInfo");
    const canvas = document.querySelector("canvas.clusterMapCanvas");
    const camera = canvas?.__zoom;
    if (!cluster || !info || !canvas || !camera) {
      throw new Error("raster cluster label could not be projected through the camera");
    }
    const [clusterX = 0, clusterY = 0] = numberList(cluster.getAttribute("transform"));
    const [infoX = 0] = numberList(info.getAttribute("transform"));
    const bounds = canvas.getBoundingClientRect();
    // One world unit inside the text's right edge is safely within the shared
    // Canvas/WebGPU cluster-label hit region without relying on text metrics.
    return {
      x: bounds.left + camera.x + (clusterX + infoX - 1) * camera.k,
      y: bounds.top + camera.y + (clusterY + 5) * camera.k,
    };
  }, label);
}

async function exportedClusterOrder(page) {
  return page.evaluate(() => {
    const source = window.__rendererConformance.chart.exportSvg();
    const svg = new DOMParser().parseFromString(source, "image/svg+xml");
    return [...svg.querySelectorAll("g.cluster")]
      .map((cluster) => {
        const numbers = (cluster.getAttribute("transform") || "").match(/-?\d+(?:\.\d+)?/g);
        return {
          label: cluster.querySelector("text.clusterText")?.textContent,
          y: Number(numbers?.at(-1) || 0),
        };
      })
      .sort((left, right) => left.y - right.y)
      .map(({ label }) => label);
  });
}

for (const renderer of renderers) {
  test(`${renderer} commits locus flip and trimming through the shared controller`, async ({ page }) => {
    const { track } = await mountRenderer(page, renderer);

    await page.mouse.dblclick(track.x + track.width / 2, track.y + track.height / 2);
    await expect.poll(() => exportedSvg(page)).toContain("input_locus (reversed):10000-1");

    // Remount before trimming so these source-SVG coordinates still refer to
    // the unflipped locus; the interaction itself remains identical for all
    // three backends.
    const trimTargets = await mountRenderer(page, renderer);
    const handle = await rightTrimHandlePoint(page, renderer, trimTargets.rightHandle);
    const offset = handle.offset || 0;
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(
      trimTargets.lastGene.x + trimTargets.lastGene.width - 1 + offset,
      trimTargets.lastGene.y + trimTargets.lastGene.height / 2,
      { steps: 6 }
    );
    await page.mouse.up();
    await expect.poll(() => exportedSvg(page)).toContain("input_locus:1-6500");
  });

  test(`${renderer} commits a cluster reorder through the shared controller`, async ({ page }) => {
    const { firstInfo, thirdInfo } = await mountRenderer(page, renderer);
    const before = await exportedClusterOrder(page);
    expect(before).toHaveLength(3);

    const firstPoint = renderer === "svg"
      ? { x: firstInfo.x + firstInfo.width / 2, y: firstInfo.y + firstInfo.height / 2 }
      : await rasterClusterLabelPoint(page, before[0]);
    const thirdPoint = renderer === "svg"
      ? { x: thirdInfo.x + thirdInfo.width / 2, y: thirdInfo.y + thirdInfo.height / 2 }
      : await rasterClusterLabelPoint(page, before[2]);

    await page.mouse.move(firstPoint.x, firstPoint.y);
    await page.mouse.down();
    await page.mouse.move(thirdPoint.x, thirdPoint.y, {
      steps: 8,
    });
    await page.mouse.up();

    await expect.poll(() => exportedClusterOrder(page)).toEqual([before[1], before[2], before[0]]);
  });
}
