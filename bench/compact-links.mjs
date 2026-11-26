// Run with: node --expose-gc bench/compact-links.mjs [link-count] [--transfer] [--float32]
// Synthetic CPU/memory baseline; does not represent browser or GPU memory.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { CompactLinkStore } from "../src/data/linkStore.mjs";
import { createChartIndex } from "../src/data/index.mjs";
import { createChartRuntime } from "../src/chart/runtime.js";
import { createChartState } from "../src/chart/state.mjs";

const count = Number(process.argv[2] ?? 500000);
if (!Number.isSafeInteger(count) || count < 0 || count > 0xffffffff) throw new TypeError("Specify a non-negative 32-bit link count.");
if (!global.gc) throw new Error("Run with node --expose-gc for comparable retained-memory measurements.");
const mb = (bytes) => Math.round(bytes / 1024 / 1024 * 10) / 10;
const sample = (stage, started) => {
  const elapsedMs = Math.round(performance.now() - started);
  global.gc();
  const memory = process.memoryUsage();
  console.log(JSON.stringify({ stage, elapsedMs, rssMiB: mb(memory.rss), heapMiB: mb(memory.heapUsed),
    arrayBuffersMiB: mb(memory.arrayBuffers) }));
};
const geneCount = 1000, genes = Array.from({ length: geneCount }, (_, i) => `gene-${i}`);
const clusters = Array.from({ length: 100 }, (_, cluster) => ({ uid: `cluster-${cluster}`, name: `Cluster ${cluster}`,
  loci: [{ uid: `locus-${cluster}`, start: 0, end: 1000, genes: genes.slice(cluster * 10, cluster * 10 + 10)
    .map((uid, i) => ({ uid, start: i * 50, end: i * 50 + 30, strand: 1 })) }] }));
let start = performance.now();
const ScoreColumn = process.argv.includes("--float32") ? Float32Array : Float64Array;
let query = new Uint32Array(count), target = new Uint32Array(count), identity = new ScoreColumn(count), similarity = new ScoreColumn(count);
for (let i = 0; i < count; i++) {
  query[i] = i % geneCount; target[i] = (i * 37 + 1) % geneCount;
  identity[i] = 0.5 + (i % 5) / 10; similarity[i] = 0.95;
}
const columns = { genes, query, target, identity, similarity };
const links = process.argv.includes("--transfer") ? CompactLinkStore.fromTransferred(columns) : new CompactLinkStore(columns);
query = target = identity = similarity = null;
columns.query = columns.target = columns.identity = columns.similarity = null;
const data = { clusters, links, groups: [{ uid: "group", genes }], config: { updateGroups: false } };
sample("compact-store", start);
start = performance.now();
const edits = links.snapshotEdits();
assert.equal(edits.base, links.fingerprint);
sample("compact-snapshot", start);
start = performance.now();
const index = createChartIndex(data);
sample("index", start);
const runtime = createChartRuntime();
runtime.setChartIndex(index); runtime.setChartState(createChartState(data));
start = performance.now();
const scene = runtime.updateScene(data);
assert.equal(scene.links.size, count);
if (count) assert.equal(scene.links.get("link-0").allowed, true);
sample("scene", start);
start = performance.now();
runtime.configure({ link: { bestOnly: true } });
const filtered = runtime.updateScene(data);
assert.equal(filtered.links.size, count);
sample("best-only-scene", start);
console.log(JSON.stringify({ links: count, clusters: clusters.length, genes: genes.length,
  adjacentLayouts: filtered.links.geometry?.size ?? null, columnBytes: links.byteLength,
  emptyEditsBytes: Buffer.byteLength(JSON.stringify(edits)) }));
