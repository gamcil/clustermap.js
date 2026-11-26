import { clusterPairKey } from "../links/layout.mjs";
import { ArrayLinkStore, CompactLinkStore } from "./linkStore.mjs";

function appendToIndex(index, key, value) {
  const values = index.get(key);
  if (values) values.push(value);
  else index.set(key, [value]);
}

// Store numeric positions rather than link objects or generated UID strings.
// Materialize only a requested gene/pair's records in source order.
function compactLinkIndexes(store, clusterForGene) {
  const geneCounts = new Map(), pairCounts = new Map();
  const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  const pairFor = (query, target) => clusterForGene.has(query) && clusterForGene.has(target)
    ? clusterPairKey(clusterForGene.get(query), clusterForGene.get(target)) : null;
  for (let i = 0; i < store.size; i++) {
    const query = store.queryAt(i), target = store.targetAt(i), pair = pairFor(query, target);
    increment(geneCounts, query);
    if (query !== target) increment(geneCounts, target);
    if (pair !== null) increment(pairCounts, pair);
  }
  const makeLists = (counts) => new Map([...counts].map(([key, count]) => [key, { values: new Uint32Array(count), next: 0 }]));
  const genes = makeLists(geneCounts), pairs = makeLists(pairCounts);
  const put = (map, key, position) => { const entry = map.get(key); entry.values[entry.next++] = position; };
  for (let i = 0; i < store.size; i++) {
    const query = store.queryAt(i), target = store.targetAt(i), pair = pairFor(query, target);
    put(genes, query, i);
    if (query !== target) put(genes, target, i);
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
  return { linksByGeneId: view(genes, store, true), linksByClusterPair: view(pairs, store, false) };
}

export function createChartIndex(data) {
  const clusterById = new Map();
  const locusById = new Map();
  const geneById = new Map();
  const groupById = new Map();
  const linkById = data.links instanceof CompactLinkStore ? data.links : new ArrayLinkStore(data.links);
  let linksByGeneId = new Map();
  let linksByClusterPair = new Map();
  const clusterForGene = new Map();

  for (const cluster of data.clusters) {
    clusterById.set(cluster.uid, cluster);

    for (const locus of cluster.loci) {
      locusById.set(locus.uid, locus);
      for (const gene of locus.genes) {
        geneById.set(gene.uid, gene);
        clusterForGene.set(gene.uid, cluster.uid);
      }
    }
  }

  if (data.links instanceof CompactLinkStore) {
    ({ linksByGeneId, linksByClusterPair } = compactLinkIndexes(data.links, clusterForGene));
  } else for (const link of data.links) {
    appendToIndex(linksByGeneId, link.query.uid, link);
    if (link.target.uid !== link.query.uid) appendToIndex(linksByGeneId, link.target.uid, link);
    if (clusterForGene.has(link.query.uid) && clusterForGene.has(link.target.uid)) {
      appendToIndex(linksByClusterPair, clusterPairKey(clusterForGene.get(link.query.uid),
        clusterForGene.get(link.target.uid)), link.uid);
    }
  }

  for (const group of data.groups || []) groupById.set(group.uid, group);

  return { clusterById, locusById, geneById, groupById, linkById, linksByGeneId, linksByClusterPair };
}

export function recordForId(records, uid) {
  if (!records) return;
  const exact = records.get(uid);
  if (exact) return exact;
  const text = String(uid);
  for (const [key, record] of records) if (String(key) === text) return record;
}
