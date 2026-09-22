function normalizeGene(gene, locusUid, clusterUid) {
  return {
    ...gene,
    locusUid,
    clusterUid,
    bio: gene.bio || {
      start: gene.start,
      end: gene.end,
      strand: gene.strand,
    },
  };
}

function normalizeLocus(locus, clusterUid) {
  const bio = locus.bio || { start: locus.start, end: locus.end };
  return {
    ...locus,
    clusterUid,
    bio,
    start: 0,
    end: bio.end - bio.start,
    genes: locus.genes.map((gene) =>
      normalizeGene(gene, locus.uid, clusterUid)
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
