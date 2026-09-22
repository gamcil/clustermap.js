function appendToIndex(index, key, value) {
  const values = index.get(key);
  if (values) values.push(value);
  else index.set(key, [value]);
}

export function createChartIndex(data) {
  const clusterById = new Map();
  const locusById = new Map();
  const geneById = new Map();
  const linkById = new Map();
  const linksByGeneId = new Map();

  for (const cluster of data.clusters) {
    clusterById.set(cluster.uid, cluster);

    for (const locus of cluster.loci) {
      locusById.set(locus.uid, locus);
      for (const gene of locus.genes) geneById.set(gene.uid, gene);
    }
  }

  for (const link of data.links) {
    linkById.set(link.uid, link);
    appendToIndex(linksByGeneId, link.query.uid, link);
    appendToIndex(linksByGeneId, link.target.uid, link);
  }

  return { clusterById, locusById, geneById, linkById, linksByGeneId };
}
