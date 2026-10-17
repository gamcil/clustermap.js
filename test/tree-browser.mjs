import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Separate from the default Node suite: this check needs an installed browser.
// Serve the built chart and local D3, without CDN or network dependencies.
test("tree edits, history, projects, and static export through the public chart API", async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end('<!doctype html><style>body{margin:0}.host{width:1600px;height:850px}</style><div class="host" id="plot"></div><script src="/node_modules/d3/dist/d3.min.js"></script>');
      return;
    }
    const filename = resolve(root, `.${pathname}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filename);
      const type = extname(filename) === ".json" ? "application/json" : "text/javascript";
      response.writeHead(200, { "Content-Type": type });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const original = await page.evaluate(async () => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const data = await (await fetch("/fixtures/bua-genbank-tree.json")).json();
    const chart = ClusterMap().config({
      plot: { renderer: "svg", transitionDuration: 0 },
      tree: { width: 180, leafGuide: { show: true } },
      gene: { label: { show: false } },
    });
    window.testChart = chart;
    window.testInput = data;
    window.testChanges = [];
    d3.select("#plot").datum(data).call(chart);
    chart.on("change", (change) => testChanges.push(change.type));
    return chart.project();
  });
  await page.locator("#plot circle.tree-node").first().dispatchEvent("click");
  const rotated = await page.evaluate(() => testChart.project());
  const node = (project, uid) => project.data.tree.nodes.find((entry) => entry.uid === uid);
  assert.deepEqual(node(rotated, "root").children, [...node(original, "root").children].reverse());
  assert.ok(await page.evaluate(() => testChart.canUndo()));
  assert.ok(await page.evaluate(() => testChanges.includes("state.change")), "node flips notify frontend subscribers");
  assert.deepEqual(await page.evaluate(() => { testChart.undo(); return testChart.project(); }), original);
  assert.deepEqual(await page.evaluate(() => { testChart.redo(); return testChart.project(); }), rotated);

  // Drag one leaf over its sibling. The serialized tree must agree with the
  // visual order, and undo/redo must restore both representations together.
  await page.evaluate(() => testChart.clearHistory());
  const drag = await page.evaluate(() => {
    const tree = testChart.data().tree;
    const pair = tree.nodes.find((entry) => entry.uid === "aspergillus-pair-1");
    const clusters = pair.children.map((uid) => tree.nodes.find((entry) => entry.uid === uid).cluster);
    const label = (uid) => [...document.querySelectorAll("#plot g.cluster")]
      .find((group) => group.__data__.uid === uid).querySelector("text.clusterText").getBoundingClientRect();
    return clusters.map((uid) => { const box = label(uid); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; });
  });
  await page.mouse.move(drag[0].x, drag[0].y);
  await page.mouse.down();
  await page.mouse.move(drag[1].x, drag[1].y + 10, { steps: 8 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => testChart.project());
  assert.deepEqual(node(dragged, "aspergillus-pair-1").children, [...node(rotated, "aspergillus-pair-1").children].reverse());
  assert.deepEqual(await page.evaluate(() => { testChart.undo(); return testChart.project(); }), rotated);
  assert.deepEqual(await page.evaluate(() => { testChart.redo(); return testChart.project(); }), dragged);

  const saved = await page.evaluate(() => {
    testChart.config({ tree: { support: { precision: 2 }, branch: { width: 2 } }, cluster: { hideLocusCoordinates: true } });
    return JSON.parse(JSON.stringify(testChart.project()));
  });
  const restored = await page.evaluate((saved) => {
    const noTree = structuredClone(testChart.data());
    delete noTree.tree;
    testChart.data(noTree);
    testChart.config({ tree: { show: false, width: 60 } });
    testChart.project(saved);
    return testChart.project();
  }, saved);
  assert.deepEqual(restored, saved, "public project API restores data, settings, order, and camera");
  assert.equal(await page.evaluate(() => testChart.canUndo()), false, "project loads start with fresh history");
  const fresh = await page.evaluate(async (saved) => {
    const { ClusterMap } = await import("/dist/clustermap.mjs");
    const host = d3.select("body").append("div").attr("class", "host");
    const chart = ClusterMap().config({ plot: { renderer: "canvas", transitionDuration: 0 } });
    host.datum(testInput).call(chart);
    chart.project(saved);
    const result = chart.project();
    chart.destroy();
    host.remove();
    return result;
  }, saved);
  assert.deepEqual(fresh, saved, "a newly mounted chart loads the same project");

  const exportResult = await page.evaluate(() => {
    const inspect = (svg) => {
      const document = new DOMParser().parseFromString(svg, "image/svg+xml");
      return {
        nodes: [...document.querySelectorAll("circle.tree-node")].map((node) => [+node.getAttribute("cx"), +node.getAttribute("cy")]),
        labels: [...document.querySelectorAll("text.tree-support")].map((label) => ({ text: label.textContent, family: label.style.fontFamily })),
        interactive: document.querySelectorAll("[cursor], [tabindex], [pointer-events], g.hover, script").length,
      };
    };
    const svg = inspect(testChart.exportSvg());
    testChart.config({ plot: { renderer: "canvas" } });
    const canvas = inspect(testChart.exportSvg());
    return { svg, canvas, unchangedInput: testInput.tree };
  });
  assert.equal(exportResult.svg.interactive, 0);
  assert.equal(exportResult.canvas.interactive, 0);
  assert.equal(exportResult.svg.nodes.length, 4);
  assert.ok(exportResult.svg.labels.every((label) => label.family && /\.\d{2}$/.test(label.text)));
  exportResult.svg.nodes.forEach((position, index) => {
    assert.ok(Math.abs(position[0] - exportResult.canvas.nodes[index][0]) < 1);
    assert.equal(position[1], exportResult.canvas.nodes[index][1]);
  });
  assert.deepEqual(exportResult.unchangedInput, original.data.tree, "chart edits never mutate caller-owned tree data");
  assert.deepEqual(errors, []);
});
