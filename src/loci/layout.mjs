export function xDistance(scaleX, start, end) {
  return scaleX(end) - scaleX(start);
}

export function getLocusScaleValues(clusters, { scaleX, locusOffset, spacing, locusState }) {
  const domain = [], range = [];
  for (const cluster of clusters) {
    let value = 1, start, end;
    for (const [index, locus] of cluster.loci.entries()) {
      if (index > 0) value = range[range.length - 1] + end - start + spacing;
      const offset = locusOffset(locus.uid) || 0;
      const state = locusState ? locusState(locus) : locus;
      start = scaleX(state.start ?? locus.start);
      end = scaleX(state.end ?? locus.end);
      domain.push(locus.uid);
      range.push(value - start + offset);
    }
  }
  return { domain, range };
}
