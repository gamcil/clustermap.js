function setDefault(object, key, value) {
  if (object[key] == null) object[key] = value;
}

export function initializeClusterData(cluster) {
  for (const locus of cluster.loci) {
    setDefault(locus, "_offset", 0);
    setDefault(locus, "_cluster", cluster.uid);

    for (const gene of locus.genes) {
      setDefault(gene, "_locus", locus.uid);
      setDefault(gene, "_cluster", cluster.uid);
      setDefault(gene, "_start", gene.start);
      setDefault(gene, "_end", gene.end);
      setDefault(gene, "_strand", gene.strand);
    }
  }

  return cluster;
}
