import { isPlainObject } from "../utils/values.mjs";

const fail = (message) => { throw new TypeError(`Invalid tree rooting: ${message}`); };

export function canRerootTree(tree) {
  return Boolean(tree && tree.distance?.kind !== "mergeHeight" &&
    (tree.rooting || tree.nodes.find((node) => node.uid === tree.root)?.children?.length > 1));
}

function joinedEdge(first, second) {
  const joined = { ...second, ...first };
  delete joined.branchLength;
  if (first.branchLength !== undefined && second.branchLength !== undefined) joined.branchLength = first.branchLength + second.branchLength;
  return joined;
}

function suppressNode(graph, uid, primary) {
  const neighbours = [...graph.edges.get(uid)];
  if (neighbours.length !== 2) fail("only a degree-two display root can be suppressed.");
  const record = { node: structuredClone(graph.nodes.get(uid)), index: [...graph.nodes.keys()].indexOf(uid), edges: structuredClone(neighbours) };
  if (neighbours[1][0] === primary) neighbours.reverse();
  const [[a, first], [b, second]] = neighbours, joined = joinedEdge(first, second);
  for (const [node, other] of [[a, b], [b, a]]) {
    graph.edges.set(node, new Map([...graph.edges.get(node)].map(([key, edge]) => key === uid ? [other, joined] : [key, edge])));
  }
  graph.nodes.delete(uid); graph.edges.delete(uid);
  return record;
}

function graphFor(tree, restore = false) {
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const parents = new Map(), edges = new Map(tree.nodes.map((node) => [node.uid, new Map()]));
  for (const node of tree.nodes) for (const child of node.children || []) {
    const record = nodes.get(child), edge = {};
    for (const key of ["branchLength", "support"]) if (record[key] !== undefined) edge[key] = structuredClone(record[key]);
    const branch = tree.presentation?.nodes?.[child]?.branch;
    if (branch) edge.branch = structuredClone(branch);
    edges.get(node.uid).set(child, edge); edges.get(child).set(node.uid, edge);
    parents.set(child, node.uid);
  }
  for (const node of tree.nodes) {
    const order = [...node.children || [], ...parents.has(node.uid) ? [parents.get(node.uid)] : []];
    edges.set(node.uid, new Map(order.map((uid) => [uid, edges.get(node.uid).get(uid)])));
  }
  if (tree.rooting !== undefined) {
    const baseline = tree.rooting;
    if (!isPlainObject(baseline) || Object.keys(baseline).some((key) => !["root", "node", "outgroup", "children", "suppressed"].includes(key)) ||
        baseline.node !== tree.root || typeof baseline.root !== "string" || baseline.root === baseline.node ||
        !Array.isArray(baseline.children) || nodes.get(tree.root).children?.length !== 2 ||
        !nodes.get(tree.root).children.includes(baseline.outgroup)) fail("invalid saved rooting baseline.");
    const suppressed = baseline.suppressed, known = new Set(nodes.keys());
    if (suppressed !== undefined) {
      if (!isPlainObject(suppressed) || Object.keys(suppressed).some((key) => !["node", "index", "edges"].includes(key)) ||
          !isPlainObject(suppressed.node) || suppressed.node.uid !== baseline.root || nodes.has(baseline.root) ||
          suppressed.node.cluster !== undefined || suppressed.node.branchLength !== undefined || suppressed.node.support !== undefined ||
          !Number.isInteger(suppressed.index) || suppressed.index < 0 || suppressed.index >= nodes.size ||
          !Array.isArray(suppressed.edges) || suppressed.edges.length !== 2 || !Array.isArray(suppressed.node.children) ||
          suppressed.node.children.length !== 2 || new Set(suppressed.node.children).size !== 2 ||
          suppressed.edges.some((entry) => !Array.isArray(entry) || entry.length !== 2 || !nodes.has(entry[0]) || entry[0] === tree.root ||
            !suppressed.node.children.includes(entry[0]) || !isPlainObject(entry[1]) ||
            Object.keys(entry[1]).some((key) => !["branchLength", "support", "branch"].includes(key))) ||
          new Set(suppressed.edges.map(([uid]) => uid)).size !== 2) fail("invalid suppressed display root.");
      known.add(baseline.root);
    }
    if (!known.has(baseline.root)) fail("the original root is missing.");
    const seen = new Set();
    for (const entry of baseline.children) {
      if (!Array.isArray(entry) || entry.length !== 2 || !known.has(entry[0]) || entry[0] === baseline.node || seen.has(entry[0]) ||
          !Array.isArray(entry[1]) || !entry[1].length || entry[1].some((uid) => typeof uid !== "string" || uid === baseline.node || !known.has(uid))) {
        fail("invalid original child ordering.");
      }
      seen.add(entry[0]);
    }
    suppressNode({ nodes, edges }, tree.root, baseline.outgroup);
    if (restore && suppressed) {
      const [[a, first], [b, second]] = structuredClone(suppressed.edges), current = edges.get(a).get(b);
      if (!current) fail("the suppressed root branch is missing.");
      const original = joinedEdge(first, second);
      if (current.branch?.colour !== original.branch?.colour || current.branch?.width !== original.branch?.width) {
        for (const edge of [first, second]) {
          if (current.branch) edge.branch = structuredClone(current.branch);
          else delete edge.branch;
        }
      }
      for (const [uid, other, edge] of [[a, b, first], [b, a, second]]) {
        edges.set(uid, new Map([...edges.get(uid)].map(([key, value]) => key === other ? [baseline.root, edge] : [key, value])));
      }
      const entries = [...nodes]; entries.splice(suppressed.index, 0, [baseline.root, suppressed.node]);
      nodes.clear(); for (const [uid, node] of entries) nodes.set(uid, node);
      edges.set(baseline.root, new Map([[a, first], [b, second]]));
    }
  }
  return { nodes, edges };
}

function orient(tree, graph, root, ordering = null) {
  const nodes = new Map([...graph.nodes].map(([uid, node]) => {
    const copy = structuredClone(node);
    delete copy.children; delete copy.branchLength; delete copy.support;
    return [uid, copy];
  }));
  const records = new Map(Object.entries(tree.presentation?.nodes || {}).filter(([uid]) => nodes.has(uid))
    .map(([uid, record]) => {
      const copy = structuredClone(record); delete copy.branch;
      return [uid, copy];
    }));
  const visited = new Set();
  const visit = (uid, parent = null) => {
    if (visited.has(uid)) fail("invalid original topology.");
    visited.add(uid);
    const node = nodes.get(uid), neighbours = [...graph.edges.get(uid).keys()].filter((key) => key !== parent);
    const children = ordering ? ordering.get(uid) || [] : neighbours;
    if (children.length !== neighbours.length || new Set(children).size !== children.length || children.some((key) => !neighbours.includes(key))) {
      fail("saved rooting does not match the tree topology.");
    }
    if (children.length) {
      if (node.cluster !== undefined) fail("a leaf cannot become an internal node.");
      node.children = [...children];
    } else if (node.cluster === undefined) fail("cannot reroot a tree with a unary display root.");
    for (const child of children) {
      const edge = graph.edges.get(uid).get(child), target = nodes.get(child);
      for (const key of ["branchLength", "support"]) if (edge[key] !== undefined) target[key] = structuredClone(edge[key]);
      if (edge.branch) records.set(child, { ...records.get(child), branch: structuredClone(edge.branch) });
      visit(child, uid);
    }
  };
  visit(root);
  if (visited.size !== nodes.size) fail("the saved topology is incomplete.");
  const result = { ...structuredClone(tree), root, nodes: [...nodes.values()] };
  if (result.presentation) {
    const entries = [...records].filter(([, record]) => Object.keys(record).length);
    if (entries.length) result.presentation.nodes = Object.fromEntries(entries);
    else delete result.presentation.nodes;
    const previous = new Map(tree.nodes.map((node) => [node.uid, node]));
    const leaves = (map, uid) => {
      const node = map.get(uid);
      return node?.children ? node.children.flatMap((child) => leaves(map, child)) : [uid];
    };
    for (const [uid, record] of Object.entries(result.presentation.subtrees || {})) {
      if (!nodes.has(uid)) { delete result.presentation.subtrees[uid]; continue; }
      if (!record.collapsed) continue;
      const before = new Set(leaves(previous, uid)), after = leaves(nodes, uid);
      if (before.size !== after.length || after.some((leaf) => !before.has(leaf))) {
        delete record.collapsed;
        if (!Object.keys(record).length) delete result.presentation.subtrees[uid];
      }
    }
    if (result.presentation.subtrees && !Object.keys(result.presentation.subtrees).length) delete result.presentation.subtrees;
    if (!Object.keys(result.presentation).length) delete result.presentation;
  }
  return result;
}

export function resetTreeRoot(tree) {
  if (tree.rooting === undefined) return structuredClone(tree);
  const graph = graphFor(tree, true);
  const result = orient(tree, graph, tree.rooting.root, new Map(tree.rooting.children));
  delete result.rooting;
  return result;
}

export function rerootTree(tree, nodeId) {
  if (tree.distance?.kind === "mergeHeight") fail("merge-height trees cannot be rerooted.");
  if (nodeId === tree.root) fail("the selected node is already the root.");
  const selected = tree.nodes.find((node) => node.uid === nodeId);
  if (!selected) fail(`unknown node '${nodeId}'.`);
  const parent = tree.nodes.find((node) => node.children?.includes(nodeId))?.uid;
  const parentSide = parent === tree.rooting?.node
    ? tree.nodes.find((node) => node.uid === tree.root).children.find((uid) => uid !== nodeId) : parent;
  const graph = graphFor(tree);
  const originalRoot = tree.rooting?.root || tree.root, oldRoot = graph.nodes.get(originalRoot);
  const originalChildren = tree.rooting ? new Map(tree.rooting.children).get(originalRoot) : oldRoot?.children;
  const suppress = oldRoot && graph.edges.get(originalRoot).size === 2 && !oldRoot.label &&
    !tree.presentation?.nodes?.[originalRoot]?.label && !tree.presentation?.subtrees?.[originalRoot];
  const suppressed = tree.rooting?.suppressed || (suppress ? suppressNode(graph, originalRoot, originalChildren[0]) : undefined);
  if (suppressed && oldRoot) {
    suppressed.node.children = [...originalChildren];
    delete suppressed.node.branchLength; delete suppressed.node.support;
    suppressed.edges.sort(([a], [b]) => originalChildren.indexOf(a) - originalChildren.indexOf(b));
  }
  const targetId = nodeId === suppressed?.node.uid ? suppressed.edges.find(([uid]) => uid !== parentSide)[0] : nodeId;
  let root = tree.rooting?.node || "clustermap-root";
  if (!tree.rooting) while (tree.nodes.some((node) => node.uid === root)) root += "-";
  const other = parentSide === suppressed?.node.uid ? suppressed.edges.find(([uid]) => uid !== targetId)?.[0] : parentSide;
  const edge = graph.edges.get(targetId)?.get(other);
  if (!edge) fail("the selected branch does not exist.");
  const first = structuredClone(edge), second = structuredClone(edge);
  delete second.support;
  if (edge.branchLength !== undefined) {
    first.branchLength = edge.branchLength / 2;
    second.branchLength = edge.branchLength - first.branchLength;
  }
  graph.edges.get(targetId).delete(other); graph.edges.get(other).delete(targetId);
  graph.edges.get(targetId).set(root, first); graph.edges.get(other).set(root, second);
  graph.nodes.set(root, tree.rooting ? tree.nodes.find((node) => node.uid === root) : { uid: root });
  graph.edges.set(root, new Map([[targetId, first], [other, second]]));
  const result = orient(tree, graph, root);
  result.rooting = { root: tree.rooting?.root || tree.root, node: root, outgroup: targetId,
    children: tree.rooting ? structuredClone(tree.rooting.children) : tree.nodes.filter((node) => node.children).map((node) => [node.uid, [...node.children]]),
    ...(suppressed ? { suppressed: structuredClone(suppressed) } : {}) };
  return result;
}
