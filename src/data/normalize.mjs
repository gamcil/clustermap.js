import { validateTreePresentation } from "../tree/model.mjs";
import { validateAnnotationPanels } from "../annotations/model.mjs";
import { clonePlainValue, isRecordId } from "../utils/values.mjs";

// Chart data is JSON-like: it is also the format used for data/project export.
// Clone plain values at the boundary so chart edits never mutate caller-owned
// records, including nested link endpoints and user metadata.
function normalizeGene(gene, locusUid, clusterUid) {
  return {
    ...gene,
    locusUid,
    clusterUid,
    bio: gene.bio || {
      start: gene.start,
      end: gene.end,
      strand: gene.strand,
    },
  };
}

function normalizeLocus(locus, clusterUid) {
  const bio = locus.bio || { start: locus.start, end: locus.end };
  return {
    ...locus,
    clusterUid,
    bio,
    start: 0,
    end: bio.end - bio.start,
    genes: locus.genes.map((gene) =>
      normalizeGene(gene, locus.uid, clusterUid)
    ),
  };
}

function validateRecordIds(data) {
  const ids = new Map();
  const records = (kind, values) => {
    if (!Array.isArray(values)) throw new TypeError(`Invalid chart data: ${kind} must be an array.`);
    const known = ids.get(kind) || new Set();
    ids.set(kind, known);
    for (const record of values) {
      if (!record || !isRecordId(record.uid)) throw new TypeError(`Invalid chart data: ${kind} require non-empty string or finite numeric IDs.`);
      if (known.has(record.uid)) throw new TypeError(`Invalid chart data: duplicate ${kind} ID '${record.uid}'.`);
      known.add(record.uid);
    }
  };
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("Chart data must be an object.");
  records("clusters", data.clusters);
  for (const cluster of data.clusters) {
    records("loci", cluster.loci);
    for (const locus of cluster.loci) records("genes", locus.genes);
  }
  records("links", data.links);
  records("groups", data.groups ?? []);
}

export function normalizeChartData(data, treeConfig = {}) {
  validateRecordIds(data);
  const source = clonePlainValue(data);
  if (source.tree != null) {
    validateTree(source.tree, source.clusters);
    validateTreePresentation(source.tree, treeConfig);
  }
  validateAnnotationPanels(source.annotationPanels, source.clusters, { tree: source.tree });
  return {
    ...source,
    clusters: source.clusters.map((cluster) => ({
      ...cluster,
      loci: cluster.loci.map((locus) => normalizeLocus(locus, cluster.uid)),
    })),
    links: [...source.links],
    groups: source.groups?.map((group) => ({
      ...group,
      genes: group.genes ? [...group.genes] : group.genes,
    })),
  };
}

export function validateTree(tree, clusters) {
  const fail = (message) => { throw new TypeError(`Invalid tree: ${message}`); };
  if (!tree || typeof tree !== "object" || !Array.isArray(tree.nodes)) fail("expected an object with nodes.");
  if (tree.rooted != null && typeof tree.rooted !== "boolean") fail("rooted must be a boolean or null.");
  const nodes = new Map();
  for (const node of tree.nodes) {
    if (!node || typeof node.uid !== "string" || !node.uid.trim()) fail("node IDs must be non-empty strings.");
    if (nodes.has(node.uid)) fail(`duplicate node ID '${node.uid}'.`);
    nodes.set(node.uid, node);
  }
  if (!nodes.has(tree.root)) fail(`root '${tree.root}' does not exist.`);
  const clusterIds = new Set(clusters.map(({ uid }) => uid));
  const seenClusters = new Set();
  const visited = new Set();
  const visiting = new Set();
  const visit = (uid, root = false) => {
    if (visiting.has(uid)) fail(`cycle at node '${uid}'.`);
    if (visited.has(uid)) fail(`node '${uid}' has more than one parent.`);
    const node = nodes.get(uid);
    if (!node) fail(`child '${uid}' does not exist.`);
    if (node.label !== undefined && typeof node.label !== "string") fail(`label for '${uid}' must be text.`);
    if (root && (node.branchLength !== undefined || node.support !== undefined)) fail("the root cannot have branchLength or support.");
    if (node.branchLength !== undefined && (!Number.isFinite(node.branchLength) || node.branchLength < 0)) fail(`branchLength for '${uid}' must be finite and non-negative.`);
    if (node.support !== undefined) {
      const support = node.support;
      if (!support || typeof support !== "object" || Array.isArray(support) || !Number.isFinite(support.value)) {
        fail(`support for '${uid}' must be an object with a finite value.`);
      }
      if (support.scale !== undefined && !["percent", "proportion", "unspecified"].includes(support.scale)) {
        fail(`support scale for '${uid}' must be percent, proportion or unspecified.`);
      }
      if ((support.scale === "percent" && (support.value < 0 || support.value > 100)) ||
          (support.scale === "proportion" && (support.value < 0 || support.value > 1))) {
        fail(`support for '${uid}' is outside its ${support.scale} scale.`);
      }
      if (support.type !== undefined && typeof support.type !== "string") fail(`support type for '${uid}' must be text.`);
    }
    visiting.add(uid);
    if (node.children !== undefined) {
      if (!Array.isArray(node.children) || !node.children.length || node.cluster !== undefined) fail(`internal node '${uid}' must have children and no cluster.`);
      for (const child of node.children) visit(child);
    } else {
      if (!node.cluster || !clusterIds.has(node.cluster)) fail(`leaf '${uid}' must reference an existing cluster.`);
      if (seenClusters.has(node.cluster)) fail(`cluster '${node.cluster}' is referenced more than once.`);
      seenClusters.add(node.cluster);
    }
    visiting.delete(uid); visited.add(uid);
  };
  visit(tree.root, true);
  if (visited.size !== nodes.size) fail("all nodes must be reachable from the root.");
  if (seenClusters.size !== clusterIds.size) fail("every plotted cluster must be referenced by exactly one leaf.");
  validateTreePresentation(tree);
  return tree;
}
