// The public data view is array-shaped in both cases. The shared symbol is
// needed across independently bundled chart and editor modules; keep that
// detail here rather than exposing the backing store to consumers.
export const COMPACT_LINK_VIEW = Symbol.for("clustermap.compactLinks");

export function linkReadAccess(links) {
  const compact = links[COMPACT_LINK_VIEW];
  if (compact) return {
    compact: true,
    get size() { return compact.size; },
    getAt: (position) => compact.getAt(position),
    queryAt: (position) => compact.queryAt(position),
    targetAt: (position) => compact.targetAt(position),
    identityAt: (position) => compact.identityAt(position),
    labelAt: (position) => compact.labelAt(position),
    existingIds: (ids) => [...ids].filter((uid) => compact.has(uid)),
  };
  return {
    compact: false,
    get size() { return links.length; },
    getAt: (position) => links[position],
    queryAt: (position) => links[position].query.uid,
    targetAt: (position) => links[position].target.uid,
    identityAt: (position) => links[position].identity,
    labelAt: (position) => links[position].label,
    existingIds(ids) {
      const wanted = new Set(ids), found = [];
      if (!wanted.size) return found;
      for (const link of links) if (wanted.delete(link.uid)) {
        found.push(link.uid);
        if (!wanted.size) break;
      }
      return found;
    },
  };
}
