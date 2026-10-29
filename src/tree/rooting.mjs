import { isPlainObject } from "../utils/values.mjs";

const fail = (message) => { throw new TypeError(`Invalid tree rooting: ${message}`); };

function graphFor(tree) {
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
    if (!isPlainObject(baseline) || Object.keys(baseline).some((key) => !["root", "node", "outgroup", "children"].includes(key)) ||
        baseline.node !== tree.root || typeof baseline.root !== "string" || baseline.root === baseline.node || !nodes.has(baseline.root) ||
        !Array.isArray(baseline.children) || nodes.get(tree.root).children?.length !== 2 ||
        !nodes.get(tree.root).children.includes(baseline.outgroup)) fail("invalid saved rooting baseline.");
    const seen = new Set();
    for (const entry of baseline.children) {
      if (!Array.isArray(entry) || entry.length !== 2 || !nodes.has(entry[0]) || entry[0] === baseline.node || seen.has(entry[0]) ||
          !Array.isArray(entry[1]) || !entry[1].length || entry[1].some((uid) => typeof uid !== "string" || uid === baseline.node || !nodes.has(uid))) {
        fail("invalid original child ordering.");
      }
      seen.add(entry[0]);
    }
    const a = baseline.outgroup, b = nodes.get(tree.root).children.find((uid) => uid !== a);
    const first = edges.get(tree.root).get(a), second = edges.get(tree.root).get(b);
    const joined = { ...second, ...first };
    delete joined.branchLength;
    if (first.branchLength !== undefined && second.branchLength !== undefined) joined.branchLength = first.branchLength + second.branchLength;
    for (const [uid, other] of [[a, b], [b, a]]) {
      edges.set(uid, new Map([...edges.get(uid)].map(([key, edge]) => key === tree.root ? [other, joined] : [key, edge])));
    }
    nodes.delete(tree.root); edges.delete(tree.root);
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
  const graph = graphFor(tree);
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
  const graph = graphFor(tree);
  let root = tree.rooting?.node || "clustermap-root";
  if (!tree.rooting) while (graph.nodes.has(root)) root += "-";
  const other = parent === tree.rooting?.node
    ? tree.nodes.find((node) => node.uid === tree.root).children.find((uid) => uid !== nodeId) : parent;
  const edge = graph.edges.get(nodeId)?.get(other);
  if (!edge) fail("the selected branch does not exist.");
  const first = structuredClone(edge), second = structuredClone(edge);
  delete second.support;
  if (edge.branchLength !== undefined) {
    first.branchLength = edge.branchLength / 2;
    second.branchLength = edge.branchLength - first.branchLength;
  }
  graph.edges.get(nodeId).delete(other); graph.edges.get(other).delete(nodeId);
  graph.edges.get(nodeId).set(root, first); graph.edges.get(other).set(root, second);
  graph.nodes.set(root, tree.rooting ? tree.nodes.find((node) => node.uid === root) : { uid: root });
  graph.edges.set(root, new Map([[nodeId, first], [other, second]]));
  const result = orient(tree, graph, root);
  result.rooting = { root: tree.rooting?.root || tree.root, node: root, outgroup: nodeId,
    children: tree.rooting ? structuredClone(tree.rooting.children) : tree.nodes.filter((node) => node.children).map((node) => [node.uid, [...node.children]]) };
  return result;
}
