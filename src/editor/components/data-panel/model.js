const emptyData = { clusters: [], groups: [], links: [] };
const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;

/** Cached projections of chart data, independent of DOM and chart mutations. */
export class DataPanelModel {
  #data = null;
  #index = null;
  #view = null;

  get data() { return this.#data; }
  set data(value) { this.#data = value; this.#index = this.#view = null; }
  groupId(value) { return this.#records().groupById.get(String(value))?.uid; }
  recordIds(kind) {
    return kind === "genes" ? this.#records().genes.map(({ gene }) => gene.uid)
      : (this.#data?.[kind] || []).map(({ uid }) => uid);
  }

  plotTarget(kind, ids) {
    if (kind === "links") return { links: [...ids] };
    if (kind === "groups") {
      const selected = new Set(ids);
      ids = (this.#data?.groups || []).filter((group) => selected.has(group.uid)).flatMap((group) => group.genes || []);
    }
    return { genes: [...ids] };
  }

  selectedParents(kind, selection) {
    if (!selection.size) return [];
    const clusters = this.#records().clusters;
    const parents = kind === "loci" ? clusters.flatMap(({ loci }) => loci) : clusters;
    return parents.filter(({ ids }) => ids.length && ids.every((id) => selection.has(id))).map(({ record }) => record.uid);
  }

  view(options) {
    const key = JSON.stringify([options.kind, options.geneView, options.filter, options.memberGroupId, options.sort, [...options.expanded]]);
    if (this.#view?.key === key) return this.#view;
    const branches = [], memberGroup = this.#data?.groups.find((group) => group.uid === options.memberGroupId);
    const rows = this.#computeRows({ ...options, branches, memberGroup });
    const ids = [...new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" || !row.type ? [row.id] : [])))];
    return this.#view = { key, rows, ids, branches, memberGroup, hasCollapsed: branches.some((row) => !row.open), byKey: new Map(rows.map((row) => [row.key ?? row.id, row])),
      parentCount: rows.filter((row) => row.type && row.type !== "gene").length };
  }

  #records() {
    if (this.#index) return this.#index;
    const data = this.#data || emptyData;

    const groups = new Map((data.groups || []).flatMap((group) => (group.genes || []).map((id) => [id, group])));
    const groupById = new Map((data.groups || []).map((group) => [String(group.uid), group]));
    const genes = [], clusters = [];
    const geneById = new Map();
    for (const cluster of data.clusters || []) {
      const loci = [];
      for (const locus of cluster.loci || []) {
        const ids = [];
        for (const gene of locus.genes || []) {
          geneById.set(gene.uid, gene);
          genes.push({ gene, locus, cluster });
          ids.push(gene.uid);
        }
        loci.push({ record: locus, ids });
      }
      clusters.push({ record: cluster, loci, ids: loci.flatMap(({ ids }) => ids) });
    }
    return this.#index = { groups, groupById, genes, geneById, clusters };
  }

  #computeRows({ kind, geneView, filter, memberGroupId, memberGroup, sort, expanded, branches }) {
    const data = this.#data;
    if (!data) return [];
    const needle = filter;
    const includes = (...values) => !needle || values.join(" ").toLowerCase().includes(needle);
    const cache = this.#records();
    const groups = cache.groups;
    if (kind === "groups") return data.groups.filter((group) => includes(labelFor(group, group.uid), group.subtitle)).map((group) => ({
      id: group.uid, label: labelFor(group, group.uid), subtitle: group.subtitle || "", count: group.genes?.length || 0, hidden: Boolean(group.hidden), colour: group.colour,
    }));
    if (kind === "links") {
      const genes = cache.geneById;
      return sortRows(data.links.filter((link) => includes(labelFor(genes.get(link.query.uid), link.query.uid), labelFor(genes.get(link.target.uid), link.target.uid), link.label)).map((link) => ({
        id: link.uid,
        source: labelFor(genes.get(link.query.uid), link.query.uid),
        target: labelFor(genes.get(link.target.uid), link.target.uid),
        identity: Math.round((link.identity || 0) * 1000) / 10,
        groups: `${labelFor(groups.get(link.query.uid), "Ungrouped")} / ${labelFor(groups.get(link.target.uid), "Ungrouped")}`,
        label: link.label || "",
        hidden: Boolean(link.hidden),
        colour: link.colour,
      })), sort);
    }
    memberGroupId = memberGroup?.uid ?? null;
    const memberIds = memberGroup && new Set(memberGroup.genes || []);
    const genes = cache.genes.filter(({ gene, locus, cluster }) =>
      (!memberIds || memberIds.has(gene.uid)) && includes(labelFor(gene, gene.uid), labelFor(locus, locus.uid), labelFor(cluster, cluster.uid), labelFor(groups.get(gene.uid), "Ungrouped")));
    if (geneView === "tree") return treeRows(cache.clusters, groups, genes, { needle, memberGroupId, expanded, branches });
    if (geneView === "groups") return groupTreeRows(data, groups, genes, { needle, expanded, branches });
    return sortRows(genes.map(({ gene, locus, cluster }) => geneRow(gene, locus, cluster, groups)), sort);
  }
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  return rows.sort((left, right) => {
    const a = left[sort.key] ?? "";
    const b = right[sort.key] ?? "";
    const comparison = typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    return comparison * sort.direction;
  });
}

function geneRow(gene, locus, cluster, groups, depth = null) {
  return { ...(depth === null ? {} : { type: "gene", depth }), id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(gene.uid), "Ungrouped"), colour: gene.colour || groups.get(gene.uid)?.colour };
}

function treeRows(clusters, groups, visible, { needle, memberGroupId, expanded, branches }) {
  const visibleIds = new Set(visible.map(({ gene }) => gene.uid));
  const rows = [];
  for (const { record: cluster, loci: members } of clusters) {
    const loci = members.map(({ record: locus }) => ({ locus, genes: locus.genes.filter((gene) => visibleIds.has(gene.uid)) }))
      .filter(({ locus, genes }) => genes.length || (!needle && memberGroupId == null && !locus.genes.length));
    if (!loci.length && (cluster.loci.length || needle || memberGroupId != null)) continue;
    if (loci.length === 1) {
      const { locus, genes } = loci[0];
      const key = `cluster-locus:${cluster.uid}:${locus.uid}`;
      const open = Boolean(needle) || expanded.has(key);
      const row = { type: "cluster-locus", key, cluster, locus, label: labelFor(cluster, cluster.uid), locusLabel: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open };
      branches.push(row); rows.push(row);
      if (open) rows.push(...genes.map((gene) => geneRow(gene, locus, cluster, groups, 1)));
      continue;
    }
    const key = `cluster:${cluster.uid}`;
    const open = Boolean(needle) || expanded.has(key);
    const row = { type: "cluster", key, cluster, label: labelFor(cluster, cluster.uid), count: loci.reduce((count, item) => count + item.genes.length, 0), selectIds: loci.flatMap(({ genes }) => genes.map((gene) => gene.uid)), open };
    branches.push(row); rows.push(row);
    for (const { locus, genes } of loci) {
      const locusKey = `locus:${locus.uid}`;
      const locusOpen = Boolean(needle) || expanded.has(locusKey);
      const row = { type: "locus", key: locusKey, parentKey: key, cluster, locus, label: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open: locusOpen, depth: 1 };
      branches.push(row);
      if (!open) continue;
      rows.push(row);
      if (locusOpen) rows.push(...genes.map((gene) => geneRow(gene, locus, cluster, groups, 2)));
    }
  }
  return rows;
}

function groupTreeRows(data, groups, visible, { needle, expanded, branches }) {
  const entries = new Map(visible.map((entry) => [entry.gene.uid, entry]));
  const buckets = [
    ...(data.groups || []).map((group) => ({ group, key: `gene-group:${group.uid}`, label: labelFor(group, group.uid), genes: (group.genes || []).map((id) => entries.get(id)).filter(Boolean) })),
    { key: "gene-group:ungrouped", label: "Ungrouped", genes: visible.filter(({ gene }) => !groups.has(gene.uid)) },
  ];
  const rows = [];
  for (const bucket of buckets) {
    if (!bucket.genes.length) continue;
    const open = Boolean(needle) || expanded.has(bucket.key);
    const row = { type: "gene-group", group: bucket.group, key: bucket.key, label: bucket.label, count: bucket.genes.length, selectIds: bucket.genes.map(({ gene }) => gene.uid), open };
    branches.push(row); rows.push(row);
    if (open) rows.push(...bucket.genes.map(({ gene, locus, cluster }) => geneRow(gene, locus, cluster, groups, 1)));
  }
  return rows;
}
