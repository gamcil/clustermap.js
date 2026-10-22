/** Prune absent leaves and collapse unary ancestors without changing source records. */
export function visibleTree(tree, clusterIds, aliases = new Map()) {
  if (!tree) return tree;
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const retained = new Map();
  const visit = (uid) => {
    const node = nodes.get(uid);
    if (!node.children) {
      if (!clusterIds.has(node.cluster)) return null;
      retained.set(uid, node);
      return node;
    }
    const children = node.children.map(visit).filter(Boolean);
    if (!children.length) return null;
    if (children.length === 1) {
      const child = { ...children[0] };
      if (uid !== tree.root) {
        if (Number.isFinite(node.branchLength) && Number.isFinite(child.branchLength)) child.branchLength += node.branchLength;
        else delete child.branchLength;
      }
      aliases.set(uid, child.uid);
      retained.set(child.uid, child);
      return child;
    }
    const result = { ...node, children: children.map((child) => child.uid) };
    retained.set(uid, result);
    return result;
  };
  let root = visit(tree.root);
  if (!root) return null;
  if (root.uid !== tree.root) {
    root = { ...root };
    delete root.branchLength;
    delete root.support;
    retained.set(root.uid, root);
  }
  const presentation = tree.presentation && { ...tree.presentation };
  if (presentation) {
    const styles = new Map(Object.entries(presentation.nodes || {}).filter(([uid]) => retained.has(uid)));
    const subtrees = new Map();
    const inherit = (uid) => {
      const target = aliases.get(uid) ?? uid, branch = presentation.subtrees?.[uid]?.branch;
      if (branch && retained.has(target)) {
        subtrees.set(target, { branch: { ...subtrees.get(target)?.branch, ...branch } });
      }
      for (const child of nodes.get(uid).children || []) inherit(child);
    };
    inherit(tree.root);
    for (const [uid, style] of subtrees) if (!retained.get(uid).children) {
      styles.set(uid, { ...styles.get(uid), branch: { ...style.branch, ...styles.get(uid)?.branch } });
      subtrees.delete(uid);
    }
    if (root.uid !== tree.root && styles.has(root.uid)) {
      const { branch, ...style } = styles.get(root.uid);
      styles.set(root.uid, style);
    }
    if (presentation.nodes || styles.size) presentation.nodes = Object.fromEntries(styles);
    if (presentation.subtrees) presentation.subtrees = Object.fromEntries(subtrees);
  }
  return { ...tree, root: root.uid,
    nodes: tree.nodes.filter((node) => retained.has(node.uid)).map((node) => retained.get(node.uid)),
    ...(presentation ? { presentation } : {}) };
}

/** A display view; source records and saved annotation values remain intact. */
export function visibleChartData(data, state) {
  if (!state.excludedClusters.size && !state.excludedLoci.size) return data;
  const clusters = data.clusters.filter((cluster) => !state.excludedClusters.has(cluster.uid)).map((cluster) => {
    const loci = cluster.loci.filter((locus) => !state.excludedLoci.has(locus.uid));
    return loci.length === cluster.loci.length ? cluster : { ...cluster, loci };
  });
  const clusterIds = new Set(clusters.map((cluster) => cluster.uid));
  const rowIds = new Set(clusters.map((cluster) => String(cluster.uid)));
  const geneIds = new Set(clusters.flatMap((cluster) => cluster.loci.flatMap((locus) => locus.genes.map((gene) => gene.uid))));
  const aliases = new Map();
  const tree = visibleTree(data.tree, clusterIds, aliases);
  const nodeIds = new Set(tree?.nodes.map((node) => node.uid));
  return { ...data, clusters, tree,
    links: data.links.filter((link) => geneIds.has(link.query.uid) && geneIds.has(link.target.uid)),
    groups: data.groups?.map((group) => ({ ...group, genes: group.genes?.filter((uid) => geneIds.has(uid)) })),
    annotationPanels: data.annotationPanels?.map((panel) => panel.type === "groups"
      ? { ...panel, groups: panel.groups.flatMap((group) => {
        if (group.nodeUid !== undefined) {
          const nodeUid = aliases.get(group.nodeUid) ?? group.nodeUid;
          return nodeIds.has(nodeUid) ? [{ ...group, nodeUid }] : [];
        }
        const ids = group.clusterIds.filter((uid) => clusterIds.has(uid));
        return ids.length ? [{ ...group, clusterIds: ids }] : [];
      }) }
      : { ...panel, values: Object.fromEntries(Object.entries(panel.values).filter(([uid]) =>
        rowIds.has(uid))) }).filter((panel) => panel.type !== "groups" || panel.groups.length),
  };
}
