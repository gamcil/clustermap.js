// Chart data is JSON-like: it is also the format used for data/project export.
// Clone plain values at the boundary so chart edits never mutate caller-owned
// records, including nested link endpoints and user metadata.
function cloneDataValue(value) {
  if (Array.isArray(value)) return value.map(cloneDataValue);
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneDataValue(entry)]));
}

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
  const source = cloneDataValue(data);
  return {
    ...source,
    clusters: source.clusters.map((cluster) => ({
      ...cluster,
      loci: cluster.loci.map((locus) => normalizeLocus(locus, cluster.uid)),
    })),
    links: [...source.links],
    groups: source.groups?.map((group) => ({
      ...group,
      genes: group.genes ? [...group.genes] : group.genes,
    })),
  };
}
