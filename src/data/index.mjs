import { clusterPairKey } from "../links/layout.mjs";

function appendToIndex(index, key, value) {
  const values = index.get(key);
  if (values) values.push(value);
  else index.set(key, [value]);
}

// One ID-to-position map serves editing lookups and scene painter order.
// The array is retained for this index's lifetime so old scenes remain stable.
class LinkIndex {
  constructor(links) {
    this.links = links;
    this.positions = new Map();
    for (let index = 0; index < links.length; index++) this.positions.set(links[index].uid, index);
  }
  get size() { return this.positions.size; }
  has(uid) { return this.positions.has(uid); }
  order(uid) { return this.positions.get(uid); }
  get(uid) { const index = this.positions.get(uid); return index === undefined ? undefined : this.links[index]; }
  *keys() { yield* this.positions.keys(); }
  *values() { for (const index of this.positions.values()) yield this.links[index]; }
  *entries() { for (const [uid, index] of this.positions) yield [uid, this.links[index]]; }
  [Symbol.iterator]() { return this.entries(); }
}
export function createChartIndex(data) {
  const clusterById = new Map();
  const locusById = new Map();
  const geneById = new Map();
  const groupById = new Map();
  const linkById = new LinkIndex(data.links);
  const linksByGeneId = new Map();
  const linksByClusterPair = new Map();
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

  for (const link of data.links) {
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
