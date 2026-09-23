const CLUSTER_COUNT = 100;
const GENES_PER_CLUSTER = 100;
const GROUP_COUNT = 10;
const GENE_WIDTH = 700;
const GENE_SPACING = 1200;

/**
 * A deterministic, reasonably dense data set for exercising Canvas viewport
 * culling. It contains 10,000 genes and 9,900 links, but only the clusters
 * within the current viewport should be painted by the Canvas renderer.
 */
export function createLargeTestingData() {
  const groups = Array.from({ length: GROUP_COUNT }, (_, index) => ({
    uid: `large-group-${index}`,
    label: `homology group ${index + 1}`,
    genes: [],
  }));
  const clusters = [];
  const links = [];

  for (let clusterIndex = 0; clusterIndex < CLUSTER_COUNT; clusterIndex += 1) {
    const clusterUid = `large-cluster-${clusterIndex}`;
    const locusUid = `large-locus-${clusterIndex}`;
    const genes = Array.from({ length: GENES_PER_CLUSTER }, (_, geneIndex) => {
      const uid = `large-gene-${clusterIndex}-${geneIndex}`;
      groups[geneIndex % GROUP_COUNT].genes.push(uid);
      return {
        uid,
        name: `protein_${String(clusterIndex + 1).padStart(3, "0")}_${String(geneIndex + 1).padStart(3, "0")}`,
        start: geneIndex * GENE_SPACING,
        end: geneIndex * GENE_SPACING + GENE_WIDTH,
        strand: (clusterIndex + geneIndex) % 2,
      };
    });

    clusters.push({
      uid: clusterUid,
      name: `synthetic_genome_${String(clusterIndex + 1).padStart(3, "0")}`,
      loci: [
        {
          uid: locusUid,
          name: `contig_${String(clusterIndex + 1).padStart(3, "0")}`,
          start: 0,
          end: (GENES_PER_CLUSTER - 1) * GENE_SPACING + GENE_WIDTH,
          genes,
        },
      ],
    });

    if (clusterIndex === 0) continue;
    for (let geneIndex = 0; geneIndex < GENES_PER_CLUSTER; geneIndex += 1) {
      links.push({
        uid: `large-link-${clusterIndex - 1}-${clusterIndex}-${geneIndex}`,
        target: { uid: `large-gene-${clusterIndex - 1}-${geneIndex}` },
        query: { uid: `large-gene-${clusterIndex}-${geneIndex}` },
        // Exercise the colour scale without introducing randomness.
        identity: 0.35 + ((clusterIndex * 17 + geneIndex * 7) % 65) / 100,
      });
    }
  }

  // Groups are already explicit and stable. Recomputing them from nearly ten
  // thousand links would benchmark group discovery rather than Canvas culling.
  return { clusters, links, groups, config: { updateGroups: false } };
}
