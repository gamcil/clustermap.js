function setDefault(object, key, value) {
  if (object[key] == null) object[key] = value;
}

function normalizeGene(gene) {
  return {
    ...gene,
    bio: gene.bio || { start: gene.start, end: gene.end, strand: gene.strand },
  };
}

function normalizeLocus(locus) {
  return {
    ...locus,
    bio: locus.bio || { start: locus.start, end: locus.end },
    genes: locus.genes.map(normalizeGene),
  };
}

export function normalizeChartData(data) {
  return {
    ...data,
    clusters: data.clusters.map((cluster) => ({
      ...cluster,
      loci: cluster.loci.map(normalizeLocus),
    })),
    links: [...data.links],
    groups: data.groups?.map((group) => ({
      ...group,
      genes: group.genes ? [...group.genes] : group.genes,
    })),
  };
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
