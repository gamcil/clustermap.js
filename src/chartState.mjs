export function createChartState(data, previous = null) {
  const loci = previous?.loci || new Map();
  const present = new Set();
  for (const cluster of data.clusters) {
    for (const locus of cluster.loci) {
      present.add(locus.uid);
      if (!loci.has(locus.uid)) {
        loci.set(locus.uid, {
          start: locus._start ?? locus.start,
          end: locus._end ?? locus.end,
          flipped: locus._flipped ?? false,
          trimLeft: locus._trimLeft ?? null,
          trimRight: locus._trimRight ?? null,
        });
      }
    }
  }
  for (const uid of loci.keys()) if (!present.has(uid)) loci.delete(uid);
  return { loci };
}

export function getLocusState(chartState, locus) {
  return chartState.loci.get(locus.uid);
}

export function formatLocusText(loci, chartState, hideCoordinates) {
  return loci
    .map((locus) => {
      let start;
      let end;

      const state = getLocusState(chartState, locus);
      if (locus._bio_start) {
        let startDiff = state.start - locus.start;
        let endDiff = locus.end - state.end;
        if (state.flipped) [startDiff, endDiff] = [endDiff, startDiff];
        start = locus._bio_start + startDiff + 1;
        end = locus._bio_end - endDiff;
      } else {
        start = state.start + 1;
        end = state.end;
      }

      if (state.flipped) [start, end] = [end, start];

      const reversed = state.flipped ? " (reversed)" : "";
      if (hideCoordinates || state.start == null || state.end == null)
        return `${locus.name}${reversed}`;
      return `${locus.name}${reversed}:${start.toFixed(0)}-${end.toFixed(0)}`;
    })
    .join(", ");
}

export function recalculateLocusCoordinates(chartState, locus, scaleGenes) {
  locus.genes.forEach((gene, index, genes) => {
    const length = scaleGenes ? gene._end - gene._start : 1000;
    gene.start = scaleGenes ? gene._start : index > 0 ? genes[index - 1].end : 0;
    gene.end = gene.start + length;
    gene.strand = gene._strand;
  });

  const state = getLocusState(chartState, locus);
  const oldStart = state.start;
  const lastGene = locus.genes[locus.genes.length - 1];
  state.start = state.trimLeft ? state.trimLeft.start : 0;
  state.end = state.trimRight
    ? state.trimRight.end
    : scaleGenes
    ? locus.end
    : lastGene.end;

  return { oldStart };
}

export function flipLocus(chartState, locus) {
  const state = getLocusState(chartState, locus);
  state.flipped = !state.flipped;
  const length = locus.end - locus.start;

  [state.trimLeft, state.trimRight] = [
    state.trimRight,
    state.trimLeft,
  ];

  locus.genes.forEach((gene) => {
    const start = gene._start;
    gene._start = length - gene._end;
    gene._end = length - start;
    gene._strand = gene._strand === 1 ? -1 : 1;
  });
  locus.genes.sort((a, b) => a._start - b._start);
}
