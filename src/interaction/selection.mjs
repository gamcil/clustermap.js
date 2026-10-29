export function selectionRange(orderedIds, anchor, id, range = false) {
  const start = orderedIds.indexOf(anchor), end = orderedIds.indexOf(id);
  const ranged = range && start >= 0 && end >= 0;
  return {
    ids: ranged ? orderedIds.slice(Math.min(start, end), Math.max(start, end) + 1) : [id],
    anchor: range && start >= 0 ? anchor : id,
    ranged,
  };
}
