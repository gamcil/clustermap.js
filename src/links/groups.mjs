import { CompactLinkStore } from "../data/linkStore.mjs";
import { endpointGeneId } from "./layout.mjs";
function connectedComponents(links, availableGenes) {
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

  const connect = (query, target) => {
    if (query === undefined || target === undefined ||
        (availableGenes && (!availableGenes.has(query) || !availableGenes.has(target)))) return;
    add(query);
    add(target);
    join(query, target);
  };
  if (links instanceof CompactLinkStore) {
    for (let i = 0; i < links.size; i++) connect(links.queryAt(i), links.targetAt(i));
  } else for (const link of links) {
    connect(endpointGeneId(link.query), endpointGeneId(link.target));
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
export function createLinkGroups(links, oldGroups = [], availableGenes = null) {
  const previous = oldGroups || [];
  const previousByGene = new Map();
  previous.forEach((group, index) => {
    for (const uid of group.genes || []) {
      const indices = previousByGene.get(uid) || [];
      indices.push(index);
      previousByGene.set(uid, indices);
    }
  });

  const components = connectedComponents(links, availableGenes);
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

function linkPassesFilter(link, { groupForGene, geneForUid, locusForUid, threshold }) {
  const query = endpointGeneId(link.query), target = endpointGeneId(link.target);
  const exists = (endpoint, gene) => gene === undefined ? locusForUid?.(endpoint.locusId) : geneForUid(gene);
  return !link.hidden && Boolean(exists(link.query, query)) && Boolean(exists(link.target, target)) &&
    !(link.identity < threshold) && (query === undefined || target === undefined ||
      (groupForGene(query) !== null && groupForGene(target) !== null));
}

// Share selection and tie semantics without changing each storage strategy's
// result representation or ordering.
function acceptBest(best, query, target, identity) {
  const queryBest = best.get(query), targetBest = best.get(target);
  if (queryBest > identity || targetBest > identity) return false;
  best.set(query, Math.max(queryBest ?? -Infinity, identity));
  best.set(target, Math.max(targetBest ?? -Infinity, identity));
  return true;
}

function bestLinkSelector(geneForUid) {
  const pairs = new Map(), cachedPairs = new Map();
  return (query, target, identity) => {
    const left = geneForUid(query).clusterUid, right = geneForUid(target).clusterUid;
    let targets = cachedPairs.get(left), entry = targets?.get(right);
    if (!entry) {
      const first = `${typeof left}:${String(left)}`, second = `${typeof right}:${String(right)}`;
      const pair = first < second ? `${first}|${second}` : `${second}|${first}`;
      let best = pairs.get(pair);
      if (!best) { best = new Map(); pairs.set(pair, best); }
      entry = { pair, best };
      if (!targets) { targets = new Map(); cachedPairs.set(left, targets); }
      targets.set(right, entry);
    }
    const { pair, best } = entry;
    return acceptBest(best, query, target, identity) ? pair : null;
  };
}

function bitsetVisibility(index, bits) {
  return { byteLength: bits.byteLength, has: (uid) => {
    const position = index.order(uid);
    return position !== undefined && Boolean(bits[position >>> 3] & (1 << (position & 7)));
  } };
}

function compactLinkVisibility(store, { groupForGene, geneForUid, locusForUid, bestOnly, threshold }, chartIndex) {
  const bits = new Uint8Array(Math.ceil(store.size / 8));
  // Reuse IDs and eligibility even if the dictionary contains duplicates.
  const byId = new Map(), genes = Array.from({ length: store.geneCount }, (_, index) => {
    const uid = store.geneAt(index);
    if (!byId.has(uid)) {
      const gene = geneForUid(uid);
      byId.set(uid, { index, gene, grouped: Boolean(gene) && groupForGene(uid) !== null });
    }
    return byId.get(uid);
  });
  const queryIndex = store.hasSpans
    ? (position) => store.queryAt(position) === undefined ? undefined : store.queryIndexAt(position)
    : (position) => store.queryIndexAt(position);
  const targetIndex = store.hasSpans
    ? (position) => store.targetAt(position) === undefined ? undefined : store.targetIndexAt(position)
    : (position) => store.targetIndexAt(position);
  const passes = (position, query, target, identity) => {
    const hasQuery = query === undefined ? locusForUid?.(store.queryLocusAt(position)) : genes[query].gene;
    const hasTarget = target === undefined ? locusForUid?.(store.targetLocusAt(position)) : genes[target].gene;
    return !store.hiddenAt(position) && Boolean(hasQuery) && Boolean(hasTarget) && !(identity < threshold) &&
      (query === undefined || target === undefined || (genes[query].grouped && genes[target].grouped));
  };
  // Homogeneous cluster IDs without separators make the index's pairs
  // equivalent to the best-match pairs. Other inputs use the global ordering.
  const pairIndex = chartIndex?.linkById === store ? chartIndex.linksByClusterPair : null;
  let clusterType = null;
  const pairOrdering = bestOnly && pairIndex?.positionLists && genes.every((entry, i) => {
    const cluster = entry.gene?.clusterUid;
    if (!entry.gene) return true;
    const type = typeof cluster;
    if ((type !== "string" && type !== "number") || (type === "string" && /[|\0]/.test(cluster)) ||
        (type === "number" && !Number.isFinite(cluster)) || (clusterType && type !== clusterType)) return false;
    clusterType = type;
    return chartIndex.geneById.get(store.geneAt(i))?.clusterUid === cluster;
  });
  if (pairOrdering) {
    let finite = true;
    for (let i = 0; i < store.size; i++) {
      const query = queryIndex(i), target = targetIndex(i), identity = store.identityAt(i);
      if (!passes(i, query, target, identity)) continue;
      if (!Number.isFinite(identity)) { finite = false; break; }
      bits[i >>> 3] |= 1 << (i & 7);
    }
    if (finite) {
      let scratch = new Uint32Array(128);
      const best = new Map();
      for (const list of pairIndex.positionLists()) {
        if (scratch.length < list.length) scratch = new Uint32Array(list.length);
        let count = 0;
        for (const position of list) if (bits[position >>> 3] & (1 << (position & 7)) &&
            queryIndex(position) !== undefined && targetIndex(position) !== undefined) scratch[count++] = position;
        if (count < 2) continue;
        const passing = scratch.subarray(0, count);
        passing.sort((a, b) => store.identityAt(b) - store.identityAt(a));
        best.clear();
        for (const position of passing) {
          const query = genes[queryIndex(position)].index, target = genes[targetIndex(position)].index;
          if (!acceptBest(best, query, target, store.identityAt(position))) bits[position >>> 3] &= ~(1 << (position & 7));
        }
      }
      return bitsetVisibility(store, bits);
    }
    bits.fill(0);
  }
  const positions = bestOnly ? new Uint32Array(store.size) : null;
  // The sort comparator otherwise resolves sparse edits on every comparison.
  const scores = bestOnly ? new Float64Array(store.size) : null;
  let count = 0;
  for (let i = 0; i < store.size; i++) {
    const query = queryIndex(i), target = targetIndex(i);
    const identity = store.identityAt(i);
    if (!passes(i, query, target, identity)) continue;
    if (positions) { positions[count++] = i; scores[i] = identity; }
    else bits[i >>> 3] |= 1 << (i & 7);
  }
  if (positions) {
    // Typed-array sorting is stable, preserving the source order of ties.
    const passing = positions.subarray(0, count);
    passing.sort((a, b) => scores[b] - scores[a]);
    const select = bestLinkSelector((index) => genes[index].gene);
    for (const position of passing) {
      const query = queryIndex(position), target = targetIndex(position), identity = store.identityAt(position);
      if (query !== undefined && target !== undefined && select(genes[query].index, genes[target].index, identity) === null) continue;
      bits[position >>> 3] |= 1 << (position & 7);
    }
  }
  return bitsetVisibility(store, bits);
}

// Retain one bit per source record, rather than a Set of millions of IDs.
// The captured index makes old scenes independent of later data/index updates.
export function createLinkVisibility(links, options, index, chartIndex = null) {
  if (links instanceof CompactLinkStore && links === index) return compactLinkVisibility(links, options, chartIndex);
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
  return bitsetVisibility(index, bits);
}

export function filterLinks(
  links,
  { groupForGene, geneForUid, locusForUid, bestOnly, threshold }
) {
  if (links instanceof CompactLinkStore) links = links.values();
  const passing = [];
  const options = { groupForGene, geneForUid, locusForUid, threshold };
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
  const spans = [];
  const select = bestLinkSelector(geneForUid);
  // Sort link references directly. Endpoint records can be looked up again
  // after sorting, avoiding a short-lived wrapper object for every link.
  passing.sort((a, b) => b.identity - a.identity);

  for (const link of passing) {
    const query = endpointGeneId(link.query), target = endpointGeneId(link.target);
    if (query === undefined || target === undefined) { spans.push(link); continue; }
    // Equal-scoring links intentionally survive: only a strictly better link
    // that shares an endpoint supersedes this relationship.
    const clusterPair = select(query, target, link.identity);
    if (clusterPair === null) continue;
    const selected = linksByClusterPair.get(clusterPair) || [];
    selected.push(link);
    linksByClusterPair.set(clusterPair, selected);
  }

  return [...linksByClusterPair.values()].flat().concat(spans);
}
