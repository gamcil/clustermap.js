function connectedComponents(links) {
  const parent = new Map();
  const rank = new Map();
  const genes = [];
  const add = (uid) => {
    if (parent.has(uid)) return;
    parent.set(uid, uid);
    rank.set(uid, 0);
    genes.push(uid);
  };
  const find = (uid) => {
    let root = uid;
    while (parent.get(root) !== root) root = parent.get(root);
    while (uid !== root) {
      const next = parent.get(uid);
      parent.set(uid, root);
      uid = next;
    }
    return root;
  };
  const join = (left, right) => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (rank.get(leftRoot) < rank.get(rightRoot)) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    parent.set(rightRoot, leftRoot);
    if (rank.get(leftRoot) === rank.get(rightRoot)) rank.set(leftRoot, rank.get(leftRoot) + 1);
  };

  for (const link of links) {
    const query = link.query.uid;
    const target = link.target.uid;
    add(query);
    add(target);
    join(query, target);
  }

  const components = new Map();
  for (const uid of genes) {
    const root = find(uid);
    const component = components.get(root) || [];
    component.push(uid);
    components.set(root, component);
  }
  return [...components.values()];
}

function nextGeneratedUid(used) {
  let uid = 0;
  while (used.has(uid)) uid += 1;
  used.add(uid);
  return uid;
}

function generatedGroup(usedUids, genes) {
  const uid = nextGeneratedUid(usedUids);
  return { uid, label: `Group ${uid}`, genes, hidden: false, colour: null };
}

/**
 * Build connected homology groups from link endpoints.
 *
 * Existing groups keep their uid, label, colour, and visibility when they
 * overlap a new component. Groups with no linked members are retained, which
 * preserves intentionally empty or unlinked groups from older input data.
 */
export function createLinkGroups(links, oldGroups = []) {
  const previous = oldGroups || [];
  const previousByGene = new Map();
  previous.forEach((group, index) => {
    for (const uid of group.genes || []) {
      const indices = previousByGene.get(uid) || [];
      indices.push(index);
      previousByGene.set(uid, indices);
    }
  });

  const components = connectedComponents(links);
  const linkedGenes = new Set(components.flat());
  const usedPrevious = new Set();
  const usedUids = new Set(previous.map((group) => group.uid));
  const generated = [];
  const byPreviousIndex = new Map();

  for (const genes of components) {
    const overlaps = new Map();
    for (const uid of genes) {
      for (const index of previousByGene.get(uid) || []) {
        if (!usedPrevious.has(index)) overlaps.set(index, (overlaps.get(index) || 0) + 1);
      }
    }
    let previousIndex = null;
    let largestOverlap = 0;
    for (const [index, overlap] of overlaps) {
      if (overlap > largestOverlap) {
        previousIndex = index;
        largestOverlap = overlap;
      }
    }
    const group = previousIndex === null
      ? generatedGroup(usedUids, genes)
      : { ...previous[previousIndex], genes };
    if (previousIndex === null) generated.push(group);
    else {
      usedPrevious.add(previousIndex);
      byPreviousIndex.set(previousIndex, group);
    }
  }

  const retained = previous.flatMap((group, index) => {
    const replacement = byPreviousIndex.get(index);
    if (replacement) return [replacement];
    return (group.genes || []).some((uid) => linkedGenes.has(uid)) ? [] : [{ ...group, genes: [...(group.genes || [])] }];
  });
  return [...retained, ...generated];
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
  const passing = [];
  for (const link of links) {
    // Link records remain part of the editable data even if an endpoint is
    // temporarily absent (for example after deleting a gene). A renderer
    // must omit such a link rather than treating that data relationship as
    // deleted or dereferencing a missing gene below.
    const query = geneForUid(link.query.uid);
    const target = geneForUid(link.target.uid);
    if (
      link.hidden ||
      !query ||
      !target ||
      link.identity < threshold ||
      groupForGene(link.query.uid) === null ||
      groupForGene(link.target.uid) === null
    ) continue;
    passing.push({ link, query, target });
  }
  // Threshold decides visibility regardless of whether the optional
  // best-per-cluster-pair reduction is enabled. Colour scaling is deliberately
  // independent and is resolved by the shared identity scale.
  if (!bestOnly) return passing.map(({ link }) => link);

  const pairKey = (left, right) => {
    const first = `${typeof left}:${String(left)}`;
    const second = `${typeof right}:${String(right)}`;
    return first < second ? `${first}|${second}` : `${second}|${first}`;
  };
  const linksByClusterPair = new Map();
  const byIdentity = [...passing].sort((a, b) => b.link.identity - a.link.identity);

  for (const { link, query, target } of byIdentity) {
    const clusterPair = pairKey(
      query.clusterUid,
      target.clusterUid
    );
    const selected = linksByClusterPair.get(clusterPair) || {
      links: [],
      bestIdentityForGene: new Map(),
    };
    const queryBest = selected.bestIdentityForGene.get(link.query.uid);
    const targetBest = selected.bestIdentityForGene.get(link.target.uid);
    // Equal-scoring links intentionally survive: only a strictly better link
    // that shares an endpoint supersedes this relationship.
    if (queryBest > link.identity || targetBest > link.identity) continue;
    selected.links.push(link);
    selected.bestIdentityForGene.set(link.query.uid, Math.max(queryBest ?? -Infinity, link.identity));
    selected.bestIdentityForGene.set(link.target.uid, Math.max(targetBest ?? -Infinity, link.identity));
    linksByClusterPair.set(clusterPair, selected);
  }

  return [...linksByClusterPair.values()]
    .flatMap(({ links: selected }) => selected);
}
