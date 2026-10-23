export const SYNTHETIC_FIXTURES = {
  large: { clusterCount: 100, genesPerCluster: 100 },
  larger: { clusterCount: 100, genesPerCluster: 200 },
};
const GROUP_COUNT = 10;
const GENE_WIDTH = 700;
const GENE_SPACING = 1200;

/**
 * A deterministic, reasonably dense data set for exercising Canvas viewport
 * culling. Defaults to 10,000 genes and 9,900 links. The larger preset doubles
 * genes per row so both fixtures fit the same full-plot benchmark camera.
 */
export function createLargeTestingData({ clusterCount = 100, genesPerCluster = 100 } = {}) {
  if (!Number.isInteger(clusterCount) || clusterCount < 1 ||
      !Number.isInteger(genesPerCluster) || genesPerCluster < 1) {
    throw new RangeError("Synthetic fixture dimensions must be positive integers");
  }
  const groups = Array.from({ length: GROUP_COUNT }, (_, index) => ({
    uid: `large-group-${index}`,
    label: `homology group ${index + 1}`,
    genes: [],
  }));
  const clusters = [];
  const links = [];

  for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
    const clusterUid = `large-cluster-${clusterIndex}`;
    const locusUid = `large-locus-${clusterIndex}`;
    const genes = Array.from({ length: genesPerCluster }, (_, geneIndex) => {
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
          end: (genesPerCluster - 1) * GENE_SPACING + GENE_WIDTH,
          genes,
        },
      ],
    });

    if (clusterIndex === 0) continue;
    for (let geneIndex = 0; geneIndex < genesPerCluster; geneIndex += 1) {
      links.push({
        uid: `large-link-${clusterIndex - 1}-${clusterIndex}-${geneIndex}`,
        target: { uid: `large-gene-${clusterIndex - 1}-${geneIndex}` },
        query: { uid: `large-gene-${clusterIndex}-${geneIndex}` },
        // Exercise the colour scale without introducing randomness.
        identity: 0.35 + ((clusterIndex * 17 + geneIndex * 7) % 65) / 100,
      });
    }
  }

  // Groups are explicit and stable; recomputing them would benchmark group
  // discovery rather than renderer responsiveness.
  return { clusters, links, groups, config: { updateGroups: false } };
}
