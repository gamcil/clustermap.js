function normalizeGene(gene, locusUid, clusterUid) {
  const { _locus, _cluster, locusUid: _sourceLocusUid, clusterUid: _sourceClusterUid, ...source } = gene;
  return {
    ...source,
    // Parent hierarchy is canonical. Legacy relationship fields are ignored
    // after this boundary rather than being trusted as mutable display data.
    locusUid,
    clusterUid,
    bio: source.bio || {
      start: source.start,
      end: source.end,
      strand: source.strand,
    },
  };
}

function normalizeLocus(locus, clusterUid) {
  const { _cluster, clusterUid: _sourceClusterUid, ...source } = locus;
  const bio = source.bio || { start: source.start, end: source.end };
  return {
    ...source,
    clusterUid,
    bio,
    _bio_start: bio.start,
    _bio_end: bio.end,
    start: 0,
    end: bio.end - bio.start,
    genes: source.genes.map((gene) =>
      normalizeGene(gene, source.uid, clusterUid)
    ),
  };
}

export function normalizeChartData(data) {
  return {
    ...data,
    clusters: data.clusters.map((cluster) => ({
      ...cluster,
      loci: cluster.loci.map((locus) => normalizeLocus(locus, cluster.uid)),
    })),
    links: [...data.links],
    groups: data.groups?.map((group) => ({
      ...group,
      genes: group.genes ? [...group.genes] : group.genes,
    })),
  };
}
