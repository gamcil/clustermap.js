import { clusterPairKey, endpointGeneId } from "../links/layout.mjs";
import { ArrayLinkStore, CompactLinkStore } from "./linkStore.mjs";

function appendToIndex(index, key, value) {
  const values = index.get(key);
  if (values) values.push(value);
  else index.set(key, [value]);
}

// Store numeric positions rather than link objects or generated UID strings.
// Materialize only a requested gene/pair's records in source order.
function compactLinkIndexes(store, clusterForGene, clusterForLocus) {
  const geneCounts = new Map(), locusCounts = new Map(), pairCounts = new Map();
  const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  const pairFor = (query, target, queryLocus, targetLocus) => {
    const left = query === undefined ? clusterForLocus.get(queryLocus) : clusterForGene.get(query);
    const right = target === undefined ? clusterForLocus.get(targetLocus) : clusterForGene.get(target);
    return left !== undefined && right !== undefined ? clusterPairKey(left, right) : null;
  };
  for (let i = 0; i < store.size; i++) {
    const query = store.queryAt(i), target = store.targetAt(i);
    const queryLocus = store.hasSpans ? store.queryLocusAt(i) : undefined, targetLocus = store.hasSpans ? store.targetLocusAt(i) : undefined;
    const pair = pairFor(query, target, queryLocus, targetLocus);
    if (query !== undefined) increment(geneCounts, query);
    if (target !== undefined && query !== target) increment(geneCounts, target);
    if (queryLocus !== undefined) increment(locusCounts, queryLocus);
    if (targetLocus !== undefined && queryLocus !== targetLocus) increment(locusCounts, targetLocus);
    if (pair !== null) increment(pairCounts, pair);
  }
  const makeLists = (counts) => new Map([...counts].map(([key, count]) => [key, { values: new Uint32Array(count), next: 0 }]));
  const genes = makeLists(geneCounts), loci = makeLists(locusCounts), pairs = makeLists(pairCounts);
  const put = (map, key, position) => { const entry = map.get(key); entry.values[entry.next++] = position; };
  for (let i = 0; i < store.size; i++) {
    const query = store.queryAt(i), target = store.targetAt(i);
    const queryLocus = store.hasSpans ? store.queryLocusAt(i) : undefined, targetLocus = store.hasSpans ? store.targetLocusAt(i) : undefined;
    const pair = pairFor(query, target, queryLocus, targetLocus);
    if (query !== undefined) put(genes, query, i);
    if (target !== undefined && query !== target) put(genes, target, i);
    if (queryLocus !== undefined) put(loci, queryLocus, i);
    if (targetLocus !== undefined && queryLocus !== targetLocus) put(loci, targetLocus, i);
    if (pair !== null) put(pairs, pair, i);
  }
  const view = (map, current, records) => ({
    get size() { return map.size; },
    has: (key) => map.has(key),
    get: (key) => { const entry = map.get(key); return entry && Array.from(entry.values,
      (position) => records ? current.getAt(position) : current.uidAt(position)); },
    keys: () => map.keys(),
    withStore: (next) => view(map, next, records),
  });
  return { linksByGeneId: view(genes, store, true), linksByLocusId: view(loci, store, true), linksByClusterPair: view(pairs, store, false) };
}

export function createChartIndex(data) {
  const clusterById = new Map();
  const locusById = new Map();
  const geneById = new Map();
  const groupById = new Map();
  const linkById = data.links instanceof CompactLinkStore ? data.links : new ArrayLinkStore(data.links);
  let linksByGeneId = new Map();
  let linksByLocusId = new Map();
  let linksByClusterPair = new Map();
  const clusterForGene = new Map();
  const clusterForLocus = new Map();

  for (const cluster of data.clusters) {
    clusterById.set(cluster.uid, cluster);

    for (const locus of cluster.loci) {
      locusById.set(locus.uid, locus);
      clusterForLocus.set(locus.uid, cluster.uid);
      for (const gene of locus.genes) {
        geneById.set(gene.uid, gene);
        clusterForGene.set(gene.uid, cluster.uid);
      }
    }
  }

  if (data.links instanceof CompactLinkStore) {
    ({ linksByGeneId, linksByLocusId, linksByClusterPair } = compactLinkIndexes(data.links, clusterForGene, clusterForLocus));
  } else for (const link of data.links) {
    if (link.query.kind === "span") appendToIndex(linksByLocusId, link.query.locusId, link);
    if (link.target.kind === "span" && (link.query.kind !== "span" || link.target.locusId !== link.query.locusId)) {
      appendToIndex(linksByLocusId, link.target.locusId, link);
    }
    const query = endpointGeneId(link.query), target = endpointGeneId(link.target);
    if (query !== undefined) appendToIndex(linksByGeneId, query, link);
    if (target !== undefined && target !== query) appendToIndex(linksByGeneId, target, link);
    const queryCluster = link.query.kind === "span" ? clusterForLocus.get(link.query.locusId) : clusterForGene.get(query);
    const targetCluster = link.target.kind === "span" ? clusterForLocus.get(link.target.locusId) : clusterForGene.get(target);
    if (queryCluster !== undefined && targetCluster !== undefined) {
      appendToIndex(linksByClusterPair, clusterPairKey(queryCluster, targetCluster), link.uid);
    }
  }

  for (const group of data.groups || []) groupById.set(group.uid, group);

  return { clusterById, locusById, geneById, groupById, linkById, linksByGeneId, linksByLocusId, linksByClusterPair };
}

export function recordForId(records, uid) {
  if (!records) return;
  const exact = records.get(uid);
  if (exact) return exact;
  const text = String(uid);
  for (const [key, record] of records) if (String(key) === text) return record;
}
