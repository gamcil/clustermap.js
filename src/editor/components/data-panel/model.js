import { endpointGeneId } from "../../../links/layout.mjs";

const emptyData = { clusters: [], groups: [], links: [] };
const LINK_PAGE_SIZE = 250;
const LINK_PAGE_THRESHOLD = 1000;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;
const endpointLabel = (endpoint, genes, loci) => endpoint.kind === "span"
  ? `${labelFor(loci.get(endpoint.locusId), endpoint.locusId)}:${endpoint.start + 1}-${endpoint.end}`
  : labelFor(genes.get(endpointGeneId(endpoint)), endpointGeneId(endpoint));
const endpointGroup = (endpoint, groups) => endpoint.kind === "span"
  ? "—" : labelFor(groups.get(endpointGeneId(endpoint)), "Ungrouped");

// Stable bucket ordering keeps memory proportional to numeric positions and
// distinct display values, rather than constructing a row object per link.
function sortLinkPositions(positions, sort, value, compact) {
  if (!sort || !positions.length) return positions;
  // Legacy arrays may contain numeric IDs mixed with text labels. Preserve
  // their exact comparator behavior without retaining projected row objects.
  if (!compact) {
    positions.sort((a, b) => {
      const left = value(a, sort.key), right = value(b, sort.key);
      return (typeof left === "number" && typeof right === "number"
        ? left - right : collator.compare(String(left), String(right))) * sort.direction;
    });
    return positions;
  }
  const numeric = sort.key === "identity", ranks = new Map();
  let bucketCount;
  if (numeric) bucketCount = 1001;
  else {
    for (const position of positions) ranks.set(String(value(position, sort.key)), 0);
    const values = [...ranks.keys()].sort(collator.compare);
    let rank = -1, previous;
    for (const current of values) {
      if (previous === undefined || collator.compare(previous, current) !== 0) rank++;
      ranks.set(current, rank); previous = current;
    }
    bucketCount = rank + 1;
  }
  const bucket = (position) => {
    const rank = numeric ? Math.round(value(position, sort.key) * 10) : ranks.get(String(value(position, sort.key)));
    return sort.direction < 0 ? bucketCount - 1 - rank : rank;
  };
  const counts = new Uint32Array(bucketCount);
  for (const position of positions) counts[bucket(position)]++;
  let offset = 0;
  for (let i = 0; i < counts.length; i++) { const count = counts[i]; counts[i] = offset; offset += count; }
  const sorted = new Uint32Array(positions.length);
  for (const position of positions) { const index = bucket(position); sorted[counts[index]++] = position; }
  return sorted;
}

/** Cached projections of chart data, independent of DOM and chart mutations. */
export class DataPanelModel {
  #data = null;
  #index = null;
  #view = null;
  #linkIndex = null;

  get data() { return this.#data; }
  set data(value) { this.#data = value; this.#index = this.#view = this.#linkIndex = null; }
  groupId(value) { return this.#records().groupById.get(String(value))?.uid; }
  recordIds(kind) {
    return kind === "genes" ? this.#records().genes.map(({ gene }) => gene.uid)
      : (this.#data?.[kind] || []).map(({ uid }) => uid);
  }

  existingIds(kind, selected) {
    if (kind !== "links") return this.recordIds(kind);
    const wanted = new Set(selected), found = [];
    if (!wanted.size) return found;
    const links = this.#data?.links || [], compact = links[Symbol.for("clustermap.compactLinks")];
    if (compact) return [...wanted].filter((uid) => compact.has(uid));
    for (const link of links) if (wanted.delete(link.uid)) {
      found.push(link.uid);
      if (!wanted.size) break;
    }
    return found;
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
    const key = JSON.stringify([options.kind, options.geneView, options.filter, options.memberGroupId, options.sort, options.page, [...options.expanded]]);
    if (this.#view?.key === key) return this.#view;
    const branches = [], memberGroup = this.#data?.groups.find((group) => group.uid === options.memberGroupId);
    const paged = options.kind === "links" && this.#data?.links.length > LINK_PAGE_THRESHOLD
      ? this.#linkPage(options) : null;
    const rows = paged ? paged.rows : this.#computeRows({ ...options, branches, memberGroup });
    const ids = [...new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" || !row.type ? [row.id] : [])))];
    return this.#view = { key, rows, ids, branches, memberGroup, hasCollapsed: branches.some((row) => !row.open), byKey: new Map(rows.map((row) => [row.key ?? row.id, row])),
      parentCount: rows.filter((row) => row.type && row.type !== "gene").length, ...(paged || {}) };
  }

  #linkPage({ filter, sort, page = 0 }) {
    const links = this.#data.links, compact = links[Symbol.for("clustermap.compactLinks")];
    const { geneById: genes, locusById: loci, groups } = this.#records();
    const label = (uid) => labelFor(genes.get(uid), uid);
    const group = (uid) => labelFor(groups.get(uid), "Ungrouped");
    const value = (position, key) => {
      const record = compact ? null : links[position];
      const query = compact ? compact.queryAt(position) : endpointGeneId(record.query);
      const target = compact ? compact.targetAt(position) : endpointGeneId(record.target);
      if (key === "source") return compact ? label(query) : endpointLabel(record.query, genes, loci);
      if (key === "target") return compact ? label(target) : endpointLabel(record.target, genes, loci);
      if (key === "identity") return Math.round(((compact ? compact.identityAt(position) : record.identity) || 0) * 1000) / 10;
      if (key === "groups") return compact ? `${group(query)} / ${group(target)}`
        : `${endpointGroup(record.query, groups)} / ${endpointGroup(record.target, groups)}`;
      if (key === "label") return (compact ? compact.labelAt(position) : record.label) || "";
      return "";
    };
    const key = JSON.stringify([filter, sort]);
    if (this.#linkIndex?.key !== key) {
      const positions = new Uint32Array(links.length);
      let count = 0;
      for (let i = 0; i < links.length; i++) {
        if (filter && ![value(i, "source"), value(i, "target"), value(i, "label")].join(" ").toLowerCase().includes(filter)) continue;
        positions[count++] = i;
      }
      const matched = positions.subarray(0, count);
      this.#linkIndex = { key, positions: sortLinkPositions(matched, sort, value, compact) };
    }
    const positions = this.#linkIndex.positions, total = positions.length;
    const pageCount = Math.max(1, Math.ceil(total / LINK_PAGE_SIZE));
    page = Math.min(Math.max(0, page), pageCount - 1);
    const rows = [];
    for (const position of positions.subarray(page * LINK_PAGE_SIZE, (page + 1) * LINK_PAGE_SIZE)) {
      const link = compact ? compact.getAt(position) : links[position];
      rows.push({ id: link.uid, source: endpointLabel(link.query, genes, loci), target: endpointLabel(link.target, genes, loci),
        identity: Math.round((link.identity || 0) * 1000) / 10,
        groups: `${endpointGroup(link.query, groups)} / ${endpointGroup(link.target, groups)}`,
        label: link.label || "", hidden: Boolean(link.hidden), colour: link.colour });
    }
    return { rows, page, pageCount, total, paged: true };
  }

  #records() {
    if (this.#index) return this.#index;
    const data = this.#data || emptyData;

    const groups = new Map((data.groups || []).flatMap((group) => (group.genes || []).map((id) => [id, group])));
    const groupById = new Map((data.groups || []).map((group) => [String(group.uid), group]));
    const genes = [], clusters = [];
    const geneById = new Map(), locusById = new Map();
    for (const cluster of data.clusters || []) {
      const loci = [];
      for (const locus of cluster.loci || []) {
        locusById.set(locus.uid, locus);
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
    return this.#index = { groups, groupById, genes, geneById, locusById, clusters };
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
      const genes = cache.geneById, loci = cache.locusById;
      return sortRows(data.links.filter((link) => includes(endpointLabel(link.query, genes, loci), endpointLabel(link.target, genes, loci), link.label)).map((link) => ({
        id: link.uid,
        source: endpointLabel(link.query, genes, loci),
        target: endpointLabel(link.target, genes, loci),
        identity: Math.round((link.identity || 0) * 1000) / 10,
        groups: `${endpointGroup(link.query, groups)} / ${endpointGroup(link.target, groups)}`,
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
