function normalizeGene(gene, locusUid, clusterUid) {
  const {
    _locus: legacyLocusUid,
    _cluster: legacyClusterUid,
    _strand: legacyStrand,
    locusUid: sourceLocusUid,
    clusterUid: sourceClusterUid,
    ...source
  } = gene;
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
  const {
    _cluster: legacyClusterUid,
    _bio_start: legacyBioStart,
    _bio_end: legacyBioEnd,
    _start: legacyStart,
    _end: legacyEnd,
    _flipped: legacyFlipped,
    _trimLeft: legacyTrimLeft,
    _trimRight: legacyTrimRight,
    clusterUid: sourceClusterUid,
    ...source
  } = locus;
  const bio = source.bio || { start: source.start, end: source.end };
  return {
    ...source,
    clusterUid,
    bio,
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
