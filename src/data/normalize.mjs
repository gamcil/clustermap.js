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
  const bio = locus.bio || { start: locus.start, end: locus.end };
  return {
    ...locus,
    bio,
    _bio_start: bio.start,
    _bio_end: bio.end,
    start: 0,
    end: bio.end - bio.start,
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
    setDefault(locus, "_cluster", cluster.uid);

    for (const gene of locus.genes) {
      setDefault(gene, "_locus", locus.uid);
      setDefault(gene, "_cluster", cluster.uid);
    }
  }

  return cluster;
}
