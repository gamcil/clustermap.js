/** Return every locus in the inclusive displayed-cluster range. */
export function lociForClusterRange(clusterOrder, clusterById, startClusterUid, endClusterUid) {
  const start = clusterOrder.indexOf(startClusterUid);
  const end = clusterOrder.indexOf(endClusterUid);
  if (start < 0 || end < 0) return [];
  return clusterOrder
    .slice(Math.min(start, end), Math.max(start, end) + 1)
    .flatMap((clusterUid) => clusterById.get(clusterUid)?.loci || [])
    .map((locus) => locus.uid);
}
