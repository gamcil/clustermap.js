export function createChartState(data, previous = null) {
  const loci = previous?.loci || new Map();
  const genes = previous?.genes || new Map();
  const clusterIds = data.clusters.map((cluster) => cluster.uid);
  const clusterIdSet = new Set(clusterIds);
  const clusterOrder = [
    ...(previous?.clusterOrder || []).filter((uid) => clusterIdSet.has(uid)),
    ...clusterIds.filter((uid) => !previous?.clusterOrder?.includes(uid)),
  ];
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
      for (const gene of locus.genes) {
        const geneBio = gene.bio || {
          start: gene.start,
          end: gene.end,
          strand: gene.strand,
        };
        const locusBio = locus.bio || { start: locus.start, end: locus.end };
        const key = `${locus.uid}:${gene.uid}`;
        present.add(key);
        if (!genes.has(key)) {
          genes.set(key, {
            start: geneBio.start - locusBio.start,
            end: geneBio.end - locusBio.start,
            strand: geneBio.strand,
          });
        }
      }
    }
  }
  for (const uid of loci.keys()) {
    if (!data.clusters.some((cluster) => cluster.loci.some((locus) => locus.uid === uid))) loci.delete(uid);
  }
  for (const uid of genes.keys()) if (!present.has(uid)) genes.delete(uid);
  return { loci, genes, clusterOrder };
}

export function getClusterOrder(chartState) {
  return chartState.clusterOrder;
}

export function setClusterOrder(chartState, order) {
  chartState.clusterOrder = [...order];
}

export function getLocusState(chartState, locus) {
  return chartState.loci.get(locus.uid);
}

export function getGeneState(chartState, gene) {
  return chartState.genes.get(`${gene._locus}:${gene.uid}`);
}

export function formatLocusText(loci, chartState, hideCoordinates) {
  return loci
    .map((locus) => {
      let start;
      let end;

      const state = getLocusState(chartState, locus);
      if (locus._bio_start != null && locus._bio_end != null) {
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
    const state = getGeneState(chartState, gene);
    const length = scaleGenes ? state.end - state.start : 1000;
    state.start = scaleGenes
      ? state.start
      : index > 0
      ? getGeneState(chartState, genes[index - 1]).end
      : 0;
    state.end = state.start + length;
  });

  const state = getLocusState(chartState, locus);
  const oldStart = state.start;
  const lastGene = locus.genes[locus.genes.length - 1];
  state.start = state.trimLeft
    ? getGeneState(chartState, state.trimLeft).start
    : 0;
  state.end = state.trimRight
    ? getGeneState(chartState, state.trimRight).end
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
    const geneState = getGeneState(chartState, gene);
    const start = geneState.start;
    geneState.start = length - geneState.end;
    geneState.end = length - start;
    geneState.strand = geneState.strand === 1 ? -1 : 1;
  });
  locus.genes.sort(
    (a, b) => getGeneState(chartState, a).start - getGeneState(chartState, b).start
  );
}
