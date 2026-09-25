import { test, expect } from "@playwright/test";

test("destroy releases a chart's generated surfaces", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const host = document.querySelector(".chart-host");
    host.replaceChildren();
    const chart = clusterMap().config({ plot: { renderer: "canvas" } });
    window.__chartLifecycle = { chart, host };
    d3.select(host).datum(data).call(chart);
  });

  await expect(page.locator("canvas.clusterMapCanvas")).toBeVisible();
  await page.evaluate(() => window.__chartLifecycle.chart.destroy());

  await expect(page.locator("canvas.clusterMapCanvas")).toHaveCount(0);
  await expect(page.locator("svg.clusterMap")).toHaveCount(0);
  await expect(page.locator("div.tooltip")).toHaveCount(0);
  await expect(page.locator("input.colourPicker")).toHaveCount(0);
});

test("tooltip dismissal stays isolated between chart instances", async ({ page }) => {
  await page.goto("http://127.0.0.1:8080/?test=1");
  const opacities = await page.evaluate(async () => {
    const [{ default: clusterMap }, data] = await Promise.all([
      import("/src/clusterMap.js"),
      fetch("/testing.json").then((response) => response.json()),
    ]);
    const firstHost = document.querySelector(".chart-host");
    const secondHost = document.createElement("div");
    secondHost.style.width = "400px";
    secondHost.style.height = "300px";
    document.body.append(secondHost);
    firstHost.replaceChildren();
    const firstChart = clusterMap();
    const secondChart = clusterMap();
    d3.select(firstHost).datum(data).call(firstChart);
    d3.select(secondHost).datum(structuredClone(data)).call(secondChart);

    const tooltips = [...document.querySelectorAll("div.tooltip")];
    tooltips.forEach((tooltip) => {
      tooltip.dispatchEvent(new MouseEvent("mouseenter"));
    });
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return tooltips.map((tooltip) => tooltip.style.opacity);
  });

  expect(opacities).toEqual(["0", "0"]);
});
