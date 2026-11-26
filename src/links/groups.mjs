import { CompactLinkStore } from "../data/linkStore.mjs";
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

function linkPassesFilter(link, { groupForGene, geneForUid, threshold }) {
  return !link.hidden && Boolean(geneForUid(link.query.uid)) && Boolean(geneForUid(link.target.uid)) &&
    !(link.identity < threshold) && groupForGene(link.query.uid) !== null && groupForGene(link.target.uid) !== null;
}

// Share selection and tie semantics without changing each storage strategy's
// result representation or ordering.
function bestLinkSelector(geneForUid) {
  const pairs = new Map();
  return (query, target, identity) => {
    const left = geneForUid(query).clusterUid, right = geneForUid(target).clusterUid;
    const first = `${typeof left}:${String(left)}`, second = `${typeof right}:${String(right)}`;
    const pair = first < second ? `${first}|${second}` : `${second}|${first}`;
    let best = pairs.get(pair);
    if (!best) { best = new Map(); pairs.set(pair, best); }
    const queryBest = best.get(query), targetBest = best.get(target);
    if (queryBest > identity || targetBest > identity) return null;
    best.set(query, Math.max(queryBest ?? -Infinity, identity));
    best.set(target, Math.max(targetBest ?? -Infinity, identity));
    return pair;
  };
}

function compactLinkVisibility(store, { groupForGene, geneForUid, bestOnly, threshold }) {
  const bits = new Uint8Array(Math.ceil(store.size / 8));
  const positions = bestOnly ? new Uint32Array(store.size) : null;
  let count = 0;
  for (let i = 0; i < store.size; i++) {
    const query = store.queryAt(i), target = store.targetAt(i);
    if (store.hiddenAt(i) || !geneForUid(query) || !geneForUid(target) || store.identityAt(i) < threshold ||
        groupForGene(query) === null || groupForGene(target) === null) continue;
    if (positions) positions[count++] = i;
    else bits[i >>> 3] |= 1 << (i & 7);
  }
  if (positions) {
    // Typed-array sorting is stable, preserving the source order of ties.
    const passing = positions.subarray(0, count);
    passing.sort((a, b) => store.identityAt(b) - store.identityAt(a));
    const select = bestLinkSelector(geneForUid);
    for (const position of passing) {
      const query = store.queryAt(position), target = store.targetAt(position), identity = store.identityAt(position);
      if (select(query, target, identity) === null) continue;
      bits[position >>> 3] |= 1 << (position & 7);
    }
  }
  return { byteLength: bits.byteLength, has: (uid) => {
    const position = store.order(uid);
    return position !== undefined && Boolean(bits[position >>> 3] & (1 << (position & 7)));
  } };
}

// Retain one bit per source record, rather than a Set of millions of IDs.
// The captured index makes old scenes independent of later data/index updates.
export function createLinkVisibility(links, options, index) {
  if (links instanceof CompactLinkStore && links === index) return compactLinkVisibility(links, options);
  if (links instanceof CompactLinkStore) links = links.values();
  if (!index?.order) {
    const allowed = new Set(filterLinks(links, options).map((link) => link.uid));
    return { has: (uid) => allowed.has(uid) };
  }
  const bits = new Uint8Array(Math.ceil(index.size / 8));
  const add = (link) => {
    const position = index.order(link.uid);
    if (position !== undefined) bits[position >>> 3] |= 1 << (position & 7);
  };
  if (options.bestOnly) {
    for (const link of filterLinks(links, options)) add(link);
  } else {
    for (const link of links) if (linkPassesFilter(link, options)) add(link);
  }
  return { byteLength: bits.byteLength, has: (uid) => {
    const position = index.order(uid);
    return position !== undefined && Boolean(bits[position >>> 3] & (1 << (position & 7)));
  } };
}

export function filterLinks(
  links,
  { groupForGene, geneForUid, bestOnly, threshold }
) {
  if (links instanceof CompactLinkStore) links = links.values();
  const passing = [];
  const options = { groupForGene, geneForUid, threshold };
  for (const link of links) {
    // Dangling endpoints remain editable but cannot be drawn.
    if (!linkPassesFilter(link, options)) continue;
    passing.push(link);
  }
  // Threshold decides visibility regardless of whether the optional
  // best-per-cluster-pair reduction is enabled. Colour scaling is deliberately
  // independent and is resolved by the shared identity scale.
  if (!bestOnly) return passing;

  const linksByClusterPair = new Map();
  const select = bestLinkSelector(geneForUid);
  // Sort link references directly. Endpoint records can be looked up again
  // after sorting, avoiding a short-lived wrapper object for every link.
  passing.sort((a, b) => b.identity - a.identity);

  for (const link of passing) {
    // Equal-scoring links intentionally survive: only a strictly better link
    // that shares an endpoint supersedes this relationship.
    const clusterPair = select(link.query.uid, link.target.uid, link.identity);
    if (clusterPair === null) continue;
    const selected = linksByClusterPair.get(clusterPair) || [];
    selected.push(link);
    linksByClusterPair.set(clusterPair, selected);
  }

  return [...linksByClusterPair.values()].flat();
}
