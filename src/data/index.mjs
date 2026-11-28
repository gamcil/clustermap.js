import { clusterPairKey } from "../links/layout.mjs";
import { CompactLinkStore, linkStoreFromRecords } from "./linkStore.mjs";

function linkIndexView(map, current, records) {
  return {
    get size() { return map.size; },
    has: (key) => map.has(key),
    get: (key) => { const entry = map.get(key); return entry && Array.from(entry.values,
      (position) => records ? current.getAt(position) : current.uidAt(position)); },
    keys: () => map.keys(),
    withStore: (next) => linkIndexView(map, next, records),
  };
}

// Store numeric positions rather than link objects or generated UID strings.
// Materialize only a requested gene/pair's records in source order.
function linkIndexes(store, clusterForGene, clusterForLocus) {
  // Resolve endpoint dictionaries once. Multiple dictionary entries may name
  // the same ID, so they share a single index entry and count.
  const dictionary = (count, idAt, clusterForId) => {
    const entries = new Map(), ordered = new Map();
    const columns = Array.from({ length: count }, (_, position) => {
      const id = idAt(position);
      if (!entries.has(id)) entries.set(id, { id, ordered, cluster: clusterForId.get(id), count: 0 });
      return entries.get(id);
    });
    return { ordered, columns };
  };
  const gene = dictionary(store.geneCount, (i) => store.geneAt(i), clusterForGene);
  const locus = dictionary(store.locusCount, (i) => store.locusAt(i), clusterForLocus);
  const pairs = new Map(), pairCache = new Map();
  const pairFor = (left, right) => {
    if (left.cluster === undefined || right.cluster === undefined) return null;
    let targets = pairCache.get(left.cluster), entry = targets?.get(right.cluster);
    if (!entry) {
      const key = clusterPairKey(left.cluster, right.cluster);
      entry = pairs.get(key);
      if (!entry) { entry = { count: 0 }; pairs.set(key, entry); }
      if (!targets) { targets = new Map(); pairCache.set(left.cluster, targets); }
      targets.set(right.cluster, entry);
    }
    return entry;
  };
  const endpoints = [null, null, null];
  const readEndpoints = (position) => {
    const kinds = store.hasSpans ? store.endpointKindsAt(position) : 0;
    const query = (kinds & 1 ? locus : gene).columns[store.queryIndexAt(position)];
    const target = (kinds & 2 ? locus : gene).columns[store.targetIndexAt(position)];
    endpoints[0] = query; endpoints[1] = target; endpoints[2] = pairFor(query, target);
  };
  for (let i = 0; i < store.size; i++) {
    readEndpoints(i);
    const query = endpoints[0], target = endpoints[1], pair = endpoints[2];
    if (query.count++ === 0) query.ordered.set(query.id, query);
    if (target !== query && target.count++ === 0) target.ordered.set(target.id, target);
    if (pair) pair.count++;
  }
  for (const map of [gene.ordered, locus.ordered, pairs]) for (const entry of map.values()) {
    entry.values = new Uint32Array(entry.count);
    entry.count = 0;
  }
  for (let i = 0; i < store.size; i++) {
    readEndpoints(i);
    const query = endpoints[0], target = endpoints[1], pair = endpoints[2];
    query.values[query.count++] = i;
    if (target !== query) target.values[target.count++] = i;
    if (pair) pair.values[pair.count++] = i;
  }
  pairCache.clear();
  const genes = gene.ordered, loci = locus.ordered;
  return { linksByGeneId: linkIndexView(genes, store, true), linksByLocusId: linkIndexView(loci, store, true), linksByClusterPair: linkIndexView(pairs, store, false) };
}

export function createChartIndex(data) {
  const clusterById = new Map();
  const locusById = new Map();
  const geneById = new Map();
  const groupById = new Map();
  const linkById = data.links instanceof CompactLinkStore ? data.links : linkStoreFromRecords(data.links);
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

  const { linksByGeneId, linksByLocusId, linksByClusterPair } = linkIndexes(linkById, clusterForGene, clusterForLocus);

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
