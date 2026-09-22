export function formatLocusText(loci, hideCoordinates) {
  return loci
    .map((locus) => {
      let start;
      let end;

      if (locus._bio_start) {
        let startDiff = locus._start - locus.start;
        let endDiff = locus.end - locus._end;
        if (locus._flipped) [startDiff, endDiff] = [endDiff, startDiff];
        start = locus._bio_start + startDiff + 1;
        end = locus._bio_end - endDiff;
      } else {
        start = locus._start + 1;
        end = locus._end;
      }

      if (locus._flipped) [start, end] = [end, start];

      const reversed = locus._flipped ? " (reversed)" : "";
      if (hideCoordinates || locus._start == null || locus._end == null)
        return `${locus.name}${reversed}`;
      return `${locus.name}${reversed}:${start.toFixed(0)}-${end.toFixed(0)}`;
    })
    .join(", ");
}

export function recalculateLocusCoordinates(locus, scaleGenes) {
  locus.genes.forEach((gene, index, genes) => {
    const length = scaleGenes ? gene._end - gene._start : 1000;
    gene.start = scaleGenes ? gene._start : index > 0 ? genes[index - 1].end : 0;
    gene.end = gene.start + length;
    gene.strand = gene._strand;
  });

  const oldStart = locus._start;
  const lastGene = locus.genes[locus.genes.length - 1];
  locus._start = locus._trimLeft ? locus._trimLeft.start : 0;
  locus._end = locus._trimRight
    ? locus._trimRight.end
    : scaleGenes
    ? locus.end
    : lastGene.end;

  return { oldStart };
}

export function flipLocus(locus) {
  locus._flipped = !locus._flipped;
  const length = locus.end - locus.start;

  [locus._trimLeft, locus._trimRight] = [
    locus._trimRight,
    locus._trimLeft,
  ];

  locus.genes.forEach((gene) => {
    const start = gene._start;
    gene._start = length - gene._end;
    gene._end = length - start;
    gene._strand = gene._strand === 1 ? -1 : 1;
  });
  locus.genes.sort((a, b) => a._start - b._start);
}
