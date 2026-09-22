export function xDistance(scaleX, start, end) {
  return scaleX(end) - scaleX(start);
}

export function getClusterExtent(
  cluster,
  { scaleX, clusterOffset, locusOffset, locusState },
  ignoredLoci = []
) {
  let start;
  let end;

  for (const locus of cluster.loci) {
    if (ignoredLoci.includes(locus.uid)) continue;
    const offset = clusterOffset(cluster.uid) + locusOffset(locus.uid);
    const state = locusState ? locusState(locus) : locus;
    const locusStart = scaleX(state.start ?? state._start) + offset;
    const locusEnd = scaleX(state.end ?? state._end) + offset;
    if (start == null || locusStart < start) start = locusStart;
    if (end == null || locusEnd > end) end = locusEnd;
  }

  return [start, end];
}

export function getClusterExtents(clusters, layout, ignoredLoci = []) {
  let start;
  let end;

  for (const cluster of clusters) {
    const [clusterStart, clusterEnd] = getClusterExtent(
      cluster,
      layout,
      ignoredLoci
    );
    if (clusterStart != null && (start == null || clusterStart < start))
      start = clusterStart;
    if (clusterEnd != null && (end == null || clusterEnd > end)) end = clusterEnd;
  }

  return [start, end];
}

export function getClusterLocusRange(
  cluster,
  { scaleX, locusOffset, spacing, locusState }
) {
  const range = [];
  let value = 1;
  let start;
  let end;

  for (const [index, locus] of cluster.loci.entries()) {
    if (index > 0) value = range[range.length - 1] + end - start + spacing;
    const offset = locusOffset(locus.uid) || 0;
    const state = locusState ? locusState(locus) : locus;
    start = scaleX(state.start ?? state._start ?? locus.start);
    end = scaleX(state.end ?? state._end ?? locus.end);
    range.push(value - start + offset);
  }

  return range;
}

export function getLocusScaleValues(clusters, layout) {
  const domain = [];
  const range = [];

  for (const cluster of clusters) {
    domain.push(...cluster.loci.map((locus) => locus.uid));
    range.push(...getClusterLocusRange(cluster, layout));
  }

  return { domain, range };
}
