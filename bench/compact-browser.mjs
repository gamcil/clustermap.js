// Usage: node bench/compact-browser.mjs [link-count] [canvas|webgpu|svg] [firefox|chromium]
import assert from "node:assert/strict";
import { chromium, firefox } from "@playwright/test";
import { startTestServer } from "../tests/helpers/server.mjs";

const count = Number(process.argv[2] ?? 500000), renderer = process.argv[3] ?? "canvas", browserName = process.argv[4] ?? "firefox";
if (!Number.isSafeInteger(count) || count < 1 || count > 0xffffffff || !["canvas", "webgpu", "svg"].includes(renderer) ||
    !["firefox", "chromium"].includes(browserName)) throw new TypeError("Expected a positive link count, renderer and browser.");
const server = await startTestServer('<!doctype html><style>#plot{width:1000px;height:600px}</style><div id="plot"></div><script src="/node_modules/d3/dist/d3.min.js"></script>');
let browser;
try {
  browser = await ({ chromium, firefox })[browserName].launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.url);
  const result = await page.evaluate(async ({ count, renderer }) => {
    const { ClusterMap, CompactLinkStore } = await import("/dist/clustermap.mjs");
    const genes = Array.from({ length: 1000 }, (_, i) => `gene-${i}`);
    const clusters = Array.from({ length: 100 }, (_, cluster) => ({ uid: `cluster-${cluster}`, name: `Cluster ${cluster}`,
      loci: [{ uid: `locus-${cluster}`, start: 0, end: 1000, genes: genes.slice(cluster * 10, cluster * 10 + 10)
        .map((uid, i) => ({ uid, start: i * 50, end: i * 50 + 30, strand: 1 })) }] }));
    const query = new Uint32Array(count), target = new Uint32Array(count), identity = new Float64Array(count), similarity = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      query[i] = i % genes.length; target[i] = (i * 37 + 1) % genes.length;
      identity[i] = 0.5 + (i % 5) / 10; similarity[i] = 0.95;
    }
    const measure = (fn) => { const start = performance.now(); const value = fn(); return [Math.round(performance.now() - start), value]; };
    const [storeMs, base] = measure(() => CompactLinkStore.fromTransferred({ genes, query, target, identity, similarity }));
    const data = { clusters, links: base, groups: [{ uid: "group", genes }], config: { updateGroups: false } };
    const chart = ClusterMap().config({ plot: { renderer, transitionDuration: 0 } });
    const [mountMs] = measure(() => d3.select("#plot").datum(data).call(chart));
    const [bestOnlyMs] = measure(() => chart.config({ link: { bestOnly: true } }));
    const [editMs] = measure(() => chart.patch([{ type: "links.update", ids: ["link-0"], changes: { hidden: true, label: "saved" } }]));
    const [deleteMs] = measure(() => chart.patch([{ type: "links.delete", ids: ["link-1"] }]));
    const [reorderMs] = measure(() => chart.state({ ...chart.state(), clusterOrder: clusters.map((cluster) => cluster.uid).reverse() }));
    const [saveMs, blob] = measure(() => chart.exportCompactProjectBlob({ base }));
    const snapshot = JSON.parse(await blob.text());
    const [loadMs] = measure(() => chart.loadCompactProject(snapshot, { base }));
    const savedLink = chart.data().links.find((link) => link.uid === "link-0");
    const statusDeadline = performance.now() + 10000;
    while (chart.rendererStatus()?.state === "initializing" && performance.now() < statusDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const status = chart.rendererStatus();
    const actualCount = chart.data().links.length;
    chart.destroy();
    return { count, renderer, status, storeMs, mountMs, bestOnlyMs, editMs, deleteMs, reorderMs, saveMs, loadMs,
      compactFigureBytes: blob.size, actualCount, savedLink, hasBaseLinks: Object.hasOwn(snapshot.data, "links") };
  }, { count, renderer });
  assert.deepEqual(errors, []);
  assert.equal(result.actualCount, count - 1);
  assert.equal(result.savedLink.hidden, true);
  assert.equal(result.savedLink.label, "saved");
  assert.equal(result.hasBaseLinks, false);
  console.log(JSON.stringify({ browser: browserName, ...result }));
} finally {
  await browser?.close();
  await server.close();
}
