const emptyData = { clusters: [], groups: [], links: [] };
const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;

/** Cached projections of chart data, independent of DOM and chart mutations. */
export class DataPanelModel {
  #data = null;
  #index = null;
  #view = null;

  set data(value) { if (value !== this.#data) { this.#data = value; this.invalidate(); } }
  invalidate() { this.#index = this.#view = null; }
  id(value) { return this.#records().ids.get(String(value)) ?? value; }
  groupId(value) { return this.#records().groupById.get(String(value))?.uid; }
  recordIds(kind) {
    return kind === "genes" ? this.#records().genes.map(({ gene }) => gene.uid)
      : (this.#data?.[kind] || []).map(({ uid }) => uid);
  }

  view(options) {
    const key = JSON.stringify([options.kind, options.geneView, options.filter, options.memberGroupId, options.sort, [...options.expanded]]);
    if (this.#view?.key === key) return this.#view;
    const rows = this.#computeRows(options);
    const ids = [...new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" || !row.type ? [row.id] : [])))];
    return this.#view = { key, rows, ids, byKey: new Map(rows.map((row) => [row.key ?? row.id, row])),
      parentCount: rows.filter((row) => row.type && row.type !== "gene").length };
  }

  #records() {
    if (this.#index) return this.#index;
    const data = this.#data || emptyData;

    const ids = new Map();
    const remember = (record) => {
      if (record?.uid !== undefined) ids.set(String(record.uid), record.uid);
      return record;
    };
    const groups = new Map((data.groups || []).flatMap((group) => (group.genes || []).map((id) => [String(id), group])));
    const groupById = new Map((data.groups || []).map((group) => [String(group.uid), remember(group)]));
    const genes = [];
    const geneById = new Map();
    for (const cluster of data.clusters || []) {
      remember(cluster);
      for (const locus of cluster.loci || []) {
        remember(locus);
        for (const gene of locus.genes || []) {
          remember(gene);
          geneById.set(String(gene.uid), gene);
          genes.push({ gene, locus, cluster });
        }
      }
    }
    for (const link of data.links || []) remember(link);
    return this.#index = { ids, groups, groupById, genes, geneById };
  }

  #computeRows({ kind, geneView, filter, memberGroupId, sort, expanded }) {
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
      return sortRows(data.links.filter((link) => includes(labelFor(genes.get(String(link.query.uid)), link.query.uid), labelFor(genes.get(String(link.target.uid)), link.target.uid), link.label)).map((link) => ({
        id: link.uid,
        source: labelFor(genes.get(String(link.query.uid)), link.query.uid),
        target: labelFor(genes.get(String(link.target.uid)), link.target.uid),
        identity: Math.round((link.identity || 0) * 1000) / 10,
        groups: `${labelFor(groups.get(String(link.query.uid)), "Ungrouped")} / ${labelFor(groups.get(String(link.target.uid)), "Ungrouped")}`,
        label: link.label || "",
        hidden: Boolean(link.hidden),
        colour: link.colour,
      })), sort);
    }
    const memberGroup = data.groups.find((group) => group.uid === memberGroupId);
    memberGroupId = memberGroup?.uid ?? null;
    const memberIds = memberGroup && new Set((memberGroup.genes || []).map(String));
    const genes = cache.genes.filter(({ gene, locus, cluster }) =>
      (!memberIds || memberIds.has(String(gene.uid))) && includes(labelFor(gene, gene.uid), labelFor(locus, locus.uid), labelFor(cluster, cluster.uid), labelFor(groups.get(String(gene.uid)), "Ungrouped")));
    if (geneView === "tree") return treeRows(data, groups, genes, { needle, memberGroupId, expanded });
    if (geneView === "groups") return groupTreeRows(data, groups, genes, { needle, expanded });
    return sortRows(genes.map(({ gene, locus, cluster }) => geneRow(gene, locus, cluster, groups)), sort);
  }
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  return [...rows].sort((left, right) => {
    const a = left[sort.key] ?? "";
    const b = right[sort.key] ?? "";
    const comparison = typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    return comparison * sort.direction;
  });
}

function geneRow(gene, locus, cluster, groups, depth = null) {
  return { ...(depth === null ? {} : { type: "gene", depth }), id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(String(gene.uid)), "Ungrouped"), colour: gene.colour || groups.get(String(gene.uid))?.colour };
}

function treeRows(data, groups, visible, { needle, memberGroupId, expanded }) {
  const visibleIds = new Set(visible.map(({ gene }) => gene.uid));
  const rows = [];
  for (const cluster of data.clusters) {
    const loci = cluster.loci.map((locus) => ({ locus, genes: locus.genes.filter((gene) => visibleIds.has(gene.uid)) }))
      .filter(({ locus, genes }) => genes.length || (!needle && memberGroupId == null && !locus.genes.length));
    if (!loci.length && (cluster.loci.length || needle || memberGroupId != null)) continue;
    if (loci.length === 1) {
      const { locus, genes } = loci[0];
      const key = `cluster-locus:${cluster.uid}:${locus.uid}`;
      const open = Boolean(needle) || expanded.has(key);
      rows.push({ type: "cluster-locus", key, cluster, locus, label: labelFor(cluster, cluster.uid), locusLabel: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open });
      if (open) rows.push(...genes.map((gene) => geneRow(gene, locus, cluster, groups, 1)));
      continue;
    }
    const key = `cluster:${cluster.uid}`;
    const open = Boolean(needle) || expanded.has(key);
    rows.push({ type: "cluster", key, cluster, label: labelFor(cluster, cluster.uid), count: loci.reduce((count, item) => count + item.genes.length, 0), selectIds: loci.flatMap(({ genes }) => genes.map((gene) => gene.uid)), open });
    if (!open) continue;
    for (const { locus, genes } of loci) {
      const locusKey = `locus:${locus.uid}`;
      const locusOpen = Boolean(needle) || expanded.has(locusKey);
      rows.push({ type: "locus", key: locusKey, locus, label: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open: locusOpen, depth: 1 });
      if (locusOpen) rows.push(...genes.map((gene) => geneRow(gene, locus, cluster, groups, 2)));
    }
  }
  return rows;
}

function groupTreeRows(data, groups, visible, { needle, expanded }) {
  const entries = new Map(visible.map((entry) => [String(entry.gene.uid), entry]));
  const buckets = [
    ...(data.groups || []).map((group) => ({ group, key: `gene-group:${group.uid}`, label: labelFor(group, group.uid), genes: (group.genes || []).map((id) => entries.get(String(id))).filter(Boolean) })),
    { key: "gene-group:ungrouped", label: "Ungrouped", genes: visible.filter(({ gene }) => !groups.has(String(gene.uid))) },
  ];
  const rows = [];
  for (const bucket of buckets) {
    if (!bucket.genes.length) continue;
    const open = Boolean(needle) || expanded.has(bucket.key);
    rows.push({ type: "gene-group", group: bucket.group, key: bucket.key, label: bucket.label, count: bucket.genes.length, selectIds: bucket.genes.map(({ gene }) => gene.uid), open });
    if (open) rows.push(...bucket.genes.map(({ gene, locus, cluster }) => geneRow(gene, locus, cluster, groups, 1)));
  }
  return rows;
}
