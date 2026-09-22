export function createLinkGroups(links, oldGroups) {
  const groups = links
    .map((link) => [link.query.uid, link.target.uid])
    .map((group, index, allGroups) =>
      allGroups.slice(index).reduce(
        (merged, candidate) =>
          group.some((gene) => candidate.includes(gene))
            ? [...new Set([...merged, ...candidate])]
            : merged,
        []
      )
    )
    .map((genes, index) => ({
      label: `Group ${index}`,
      genes,
      hidden: false,
      colour: null,
    }))
    .reduce((result, group) => {
      let merged = false;
      result = result.map((existing) => {
        if (existing.genes.some((gene) => group.genes.includes(gene))) {
          merged = true;
          existing.genes = [...new Set([...existing.genes, ...group.genes])];
        }
        return existing;
      });
      if (!merged) result.push({ ...group, uid: result.length });
      return result;
    }, oldGroups || []);

  if (!oldGroups)
    groups.forEach((group, index) => (group.label = `Group ${index}`));
  return groups;
}

export function getGroupScaleValues(groups) {
  const domain = [];
  const range = [];

  groups.forEach((group) => {
    if (group.hidden) return;
    group.genes.forEach((gene) => {
      domain.push(gene);
      range.push(group.uid);
    });
  });

  return { domain, range };
}

export function filterLinks(
  links,
  { groupForGene, geneForUid, bestOnly, threshold }
) {
  const visibleLinks = links.filter(
    (link) =>
      groupForGene(link.query.uid) !== null &&
      groupForGene(link.target.uid) !== null
  );
  if (!bestOnly) return visibleLinks;

  const setsEqual = (a, b) =>
    a.size === b.size && [...a].every((value) => b.has(value));

  class ClusterPairMap extends Map {
    has(pair) {
      return [...this.keys()].some((key) => setsEqual(pair, key));
    }

    get(pair) {
      for (const [key, value] of this) {
        if (setsEqual(pair, key)) return value;
      }
    }

    set(pair, value) {
      return super.set(this.get(pair) || pair, value);
    }
  }

  const linksByClusterPair = new ClusterPairMap();
  const byIdentity = [...visibleLinks].sort((a, b) => b.identity - a.identity);

  for (const link of byIdentity) {
    const clusterPair = new Set([
      geneForUid(link.query.uid).clusterUid,
      geneForUid(link.target.uid).clusterUid,
    ]);

    if (!linksByClusterPair.has(clusterPair)) {
      linksByClusterPair.set(clusterPair, [link]);
      continue;
    }

    const selected = linksByClusterPair.get(clusterPair);
    const superseded = selected.some((candidate) => {
      const genes = new Set([candidate.query.uid, candidate.target.uid]);
      const sharesGene = genes.has(link.query.uid) || genes.has(link.target.uid);
      return sharesGene && link.identity < candidate.identity;
    });
    if (!superseded) selected.push(link);
  }

  return [...linksByClusterPair.values()]
    .flat()
    .filter((link) => link.identity > threshold);
}
